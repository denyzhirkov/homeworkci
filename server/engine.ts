// Pipeline execution engine
// Orchestrates pipeline runs with step execution, logging, and cleanup

import { loadModule } from "./modules.ts";
import { getMergedEnv, getSSHPrivateKeys } from "./variables.ts";
import { startRun, saveLog, startStep, endStep } from "./logger.ts";
import { config } from "./config.ts";
import { killContainersForRun, stopPersistentContainer } from "./docker-manager.ts";
import { createSandbox, cleanupSandbox } from "./sandbox.ts";
import { loadPipeline } from "./pipeline-repository.ts";
import { interpolate } from "./interpolation.ts";
import { pubsub } from "./pubsub.ts";
import { finishRun } from "./db.ts";
import { sanitizeLogMessage, validatePipelineId } from "./utils/index.ts";
import type { PipelineStep, PipelineContext, RunningPipeline, StepItem } from "./types/index.ts";

// Forbidden keys to prevent prototype pollution (same as in interpolation.ts)
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// Re-export from repository and sandbox for backward compatibility
export { loadPipeline, savePipeline, listPipelines, deletePipeline, isDemoPipeline } from "./pipeline-repository.ts";
export { cleanupOldSandboxes } from "./sandbox.ts";

// --- Running pipelines tracking ---

const runningPipelines = new Map<string, RunningPipeline>();

// Maximum log buffer size to prevent memory exhaustion on long-running pipelines
const MAX_LOG_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB

export function getActivePipelines(): string[] {
  return Array.from(runningPipelines.keys());
}

export async function stopPipeline(id: string): Promise<boolean> {
  const running = runningPipelines.get(id);
  if (!running) return false;

  running.controller.abort();

  // Kill any Docker containers for this run
  if (config.dockerEnabled) {
    const killed = await killContainersForRun(id, running.runId);
    if (killed > 0) {
      console.log(`[Docker] Killed ${killed} container(s) for pipeline ${id}`);
    }
  }

  // Cleanup sandbox directory unless keepWorkDir is set
  if (!running.keepWorkDir) {
    try {
      await Deno.remove(running.sandboxPath, { recursive: true });
      console.log(`[Sandbox] Cleaned up on stop: ${running.sandboxPath}`);
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) {
        console.error(`[Sandbox] Failed to cleanup: ${e}`);
      }
    }
  }

  // Save cancellation to DB
  const duration = Date.now() - running.startTime;
  const logContent = running.logBuffer + `\n[${new Date().toISOString()}] Pipeline stopped by user.\n`;
  finishRun(running.dbRunId, "cancelled", logContent, duration);

  runningPipelines.delete(id);
  pubsub.publish({ type: "end", pipelineId: id, payload: { runId: running.runId, success: false } });
  return true;
}

// --- Pipeline context creation ---

// Helper function to format date components from timestamp
function formatDateComponents(timestamp: number): {
  DATE: string;
  TIME: string;
  DATETIME: string;
  YEAR: string;
  MONTH: string;
  DAY: string;
} {
  const date = new Date(timestamp);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");

  return {
    DATE: `${year}-${month}-${day}`,
    TIME: `${hours}:${minutes}:${seconds}`,
    DATETIME: `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`,
    YEAR: year,
    MONTH: month,
    DAY: day,
  };
}

function createPipelineContext(
  sandboxPath: string,
  mergedEnv: Record<string, string>,
  sshKeys: Record<string, string>,
  pipelineId: string,
  startTime: number,
  sanitizedLog: (msg: string) => void,
  signal: AbortSignal,
  inputs: Record<string, string | boolean> = {},
  runId: string,
  pipelineName: string
): PipelineContext {
  // Internal mutable storage
  const resultsStorage: Record<string, unknown> = Object.create(null);
  let prevResult: unknown = null;

  // Format date components
  const dateComponents = formatDateComponents(startTime);

  // Frozen immutable fields
  const frozenFields = Object.freeze({
    workDir: sandboxPath,
    env: Object.freeze({ ...mergedEnv }),
    inputs: Object.freeze({ ...inputs }),
    sshKey: Object.freeze({ ...sshKeys }),
    pipelineId,
    startTime,
    log: sanitizedLog,
    signal,
    BUILD_ID: runId,
    UNIXTIMESTAMP: startTime,
    WORK_DIR: sandboxPath,
    DATE: dateComponents.DATE,
    TIME: dateComponents.TIME,
    DATETIME: dateComponents.DATETIME,
    YEAR: dateComponents.YEAR,
    MONTH: dateComponents.MONTH,
    DAY: dateComponents.DAY,
    PIPELINE_NAME: pipelineName,
  });

  // Create secure context with controlled mutability
  return Object.create(null, {
    workDir: { value: frozenFields.workDir, writable: false, enumerable: true },
    env: { value: frozenFields.env, writable: false, enumerable: true },
    inputs: { value: frozenFields.inputs, writable: false, enumerable: true },
    sshKey: { value: frozenFields.sshKey, writable: false, enumerable: true },
    pipelineId: { value: frozenFields.pipelineId, writable: false, enumerable: true },
    startTime: { value: frozenFields.startTime, writable: false, enumerable: true },
    log: { value: frozenFields.log, writable: false, enumerable: true },
    signal: { value: frozenFields.signal, writable: false, enumerable: true },
    BUILD_ID: { value: frozenFields.BUILD_ID, writable: false, enumerable: true },
    UNIXTIMESTAMP: { value: frozenFields.UNIXTIMESTAMP, writable: false, enumerable: true },
    WORK_DIR: { value: frozenFields.WORK_DIR, writable: false, enumerable: true },
    DATE: { value: frozenFields.DATE, writable: false, enumerable: true },
    TIME: { value: frozenFields.TIME, writable: false, enumerable: true },
    DATETIME: { value: frozenFields.DATETIME, writable: false, enumerable: true },
    YEAR: { value: frozenFields.YEAR, writable: false, enumerable: true },
    MONTH: { value: frozenFields.MONTH, writable: false, enumerable: true },
    DAY: { value: frozenFields.DAY, writable: false, enumerable: true },
    PIPELINE_NAME: { value: frozenFields.PIPELINE_NAME, writable: false, enumerable: true },

    // Controlled mutable: prev (getter/setter with deep freeze on set)
    prev: {
      get() { return prevResult; },
      set(value: unknown) {
        prevResult = typeof value === "object" && value !== null
          ? Object.freeze(JSON.parse(JSON.stringify(value)))
          : value;
      },
      enumerable: true,
    },

    // Results proxy: allows setting new keys but values become frozen once set
    results: {
      value: new Proxy(resultsStorage, {
        get(target, prop) {
          return target[prop as string];
        },
        set(target, prop, value) {
          const key = prop as string;
          target[key] = typeof value === "object" && value !== null
            ? Object.freeze(JSON.parse(JSON.stringify(value)))
            : value;
          return true;
        },
        deleteProperty() {
          return false;
        },
      }),
      writable: false,
      enumerable: true,
    },
  }) as PipelineContext;
}

// --- Pipeline execution ---

export async function runPipeline(
  id: string,
  runtimeInputs?: Record<string, string | boolean>,
  _parentPipelineId?: string,
  _parentRunId?: string
) {
  if (runningPipelines.has(id)) {
    throw new Error(`Pipeline ${id} is already running`);
  }

  const pipeline = await loadPipeline(id);
  if (!pipeline) {
    throw new Error(`Pipeline ${id} not found`);
  }

  console.log(`[Engine] Starting pipeline: ${pipeline.name} (${id})`);

  // Merge default inputs with runtime inputs
  const inputs: Record<string, string | boolean> = {};
  if (pipeline.inputs) {
    for (const input of pipeline.inputs) {
      if (input.default !== undefined) {
        inputs[input.name] = input.default;
      }
    }
  }
  if (runtimeInputs) {
    Object.assign(inputs, runtimeInputs);
  }

  // Validate pipeline ID
  validatePipelineId(id);

  const controller = new AbortController();
  const startTime = Date.now();
  const runId = String(startTime); // Use same timestamp for runId and startTime
  const dbRunId = startRun(id, runId);

  // Create isolated sandbox directory
  const sandboxPath = await createSandbox(id, runId);

  let logBuffer = `Pipeline: ${pipeline.name}\nRun ID: ${runId}\nStarted: ${new Date().toISOString()}\nWorkDir: ${sandboxPath}\n\n`;

  const runningInfo: RunningPipeline = {
    controller,
    dbRunId,
    runId,
    logBuffer,
    startTime,
    sandboxPath,
    keepWorkDir: pipeline.keepWorkDir ?? false,
  };
  runningPipelines.set(id, runningInfo);

  const totalSteps = countTotalSteps(pipeline.steps);
  pubsub.publish({ type: "start", pipelineId: id, payload: { runId, totalSteps } });

  // Log function with optional step context
  const log = (msg: string, stepName?: string) => {
    console.log(msg);
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}\n`;

    // Prevent memory exhaustion by truncating old logs when buffer is too large
    if (logBuffer.length + line.length > MAX_LOG_BUFFER_SIZE) {
      const halfSize = Math.floor(MAX_LOG_BUFFER_SIZE / 2);
      logBuffer = logBuffer.slice(-halfSize) + "\n[...earlier logs truncated...]\n";
    }

    logBuffer += line;
    runningInfo.logBuffer = logBuffer;
    pubsub.publish({ type: "log", pipelineId: id, payload: { runId, msg, ts, stepName } });
  };

  // Pipeline-level log (without step context)
  const pipelineLog = (msg: string): void => {
    log(sanitizeLogMessage(msg));
  };

  // Interpolate pipeline.env to support ${inputs.VAR} syntax for dynamic environment selection
  let resolvedPipelineEnv = pipeline.env;
  if (pipeline.env && pipeline.env.includes("${")) {
    // Create minimal context for env interpolation (only inputs available at this point)
    const envInterpolationCtx = { inputs } as unknown as PipelineContext;
    resolvedPipelineEnv = interpolate(pipeline.env, envInterpolationCtx) as string;
    pipelineLog(`[Engine] Resolved environment: ${pipeline.env} → ${resolvedPipelineEnv}`);
  }

  // Create context - each step will get its own log function with bound stepName
  const mergedEnv = await getMergedEnv(resolvedPipelineEnv);
  const sshKeys = await getSSHPrivateKeys();
  const ctx = createPipelineContext(sandboxPath, mergedEnv, sshKeys, id, startTime, pipelineLog, controller.signal, inputs, runId, pipeline.name);

  pipelineLog(`[Sandbox] Created isolated working directory: ${sandboxPath}`);
  
  // Log environment variables for debugging (only keys, not values for security)
  const envKeys = Object.keys(mergedEnv);
  pipelineLog(`[Engine] Environment "${resolvedPipelineEnv || 'none'}": ${envKeys.length} variables (${envKeys.slice(0, 10).join(', ')}${envKeys.length > 10 ? '...' : ''})`);

  // Normalize steps: single steps become [step], arrays stay as parallel groups
  const stepGroups = normalizeSteps(pipeline.steps);

  // Validate dependencies before execution
  try {
    validateDependencies(stepGroups);
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    pipelineLog(`[Engine] Dependency validation failed: ${errorMsg}`);
    throw e;
  }

  // Track step execution status for dependency checking
  const stepStatuses = new Map<string, boolean>();
  
  // Track module usage count for auto-generating step names (e.g., "shell_1", "delay_2")
  const moduleUsageCount = new Map<string, number>();

  // Check if step should be skipped based on skipWhen condition
  // Supports variables from PipelineContext:
  // - inputs.* (e.g., inputs.skipBuild)
  // - env.* (e.g., env.SKIP_TEST)
  // - results.stepName.* (e.g., results.build.skip) - results from named steps
  // - prev.* (e.g., prev.skip) - result from previous step
  // Also supports interpolation in variable path (e.g., "${inputs.env}.SKIP_BUILD")
  function shouldSkipStep(step: PipelineStep, ctx: PipelineContext): boolean {
    if (!step.skipWhen) return false;
    
    const condition = step.skipWhen;
    
    // Support interpolation in variable path (e.g., "${inputs.env}.SKIP_BUILD")
    let variablePath = condition.variable;
    if (variablePath.includes("${")) {
      variablePath = interpolate(variablePath, ctx) as string;
    }
    
    const pathParts = variablePath.split('.');
    
    // Get value from context using the path
    // Supports nested access: inputs.skipBuild, env.SKIP_TEST, results.stepName.skip, prev.skip
    let value: unknown = ctx;
    for (const key of pathParts) {
      // Validate key to prevent prototype pollution
      if (FORBIDDEN_KEYS.has(key)) {
        return false;
      }
      value = value?.[key];
    }
    
    // Helper for loose comparison (handles "1" == 1, "true" == true, etc.)
    const looseEquals = (a: unknown, b: unknown): boolean => {
      // Strict equality first
      if (a === b) return true;
      
      // Handle string to number comparison
      if (typeof a === "string" && typeof b === "number") {
        return Number(a) === b;
      }
      if (typeof a === "number" && typeof b === "string") {
        return a === Number(b);
      }
      
      // Handle string to boolean comparison
      if (typeof a === "string" && typeof b === "boolean") {
        const lower = a.toLowerCase();
        if (b === true) return lower === "true" || lower === "1";
        if (b === false) return lower === "false" || lower === "0";
      }
      if (typeof a === "boolean" && typeof b === "string") {
        const lower = b.toLowerCase();
        if (a === true) return lower === "true" || lower === "1";
        if (a === false) return lower === "false" || lower === "0";
      }
      
      return false;
    };
    
    // Check equals condition
    if (condition.equals !== undefined) {
      return looseEquals(value, condition.equals);
    }
    
    // Check notEquals condition
    if (condition.notEquals !== undefined) {
      return !looseEquals(value, condition.notEquals);
    }
    
    return false;
  }

  // Execute step function
  const executeStep = async (step: PipelineStep, stepIndex: number) => {
    // Generate step name: use provided name/description, or auto-generate as "module_N"
    let stepName: string;
    if (step.description || step.name) {
      stepName = step.description || step.name!;
    } else {
      // Auto-generate name: module_1, module_2, etc.
      const count = (moduleUsageCount.get(step.module) || 0) + 1;
      moduleUsageCount.set(step.module, count);
      stepName = `${step.module}_${count}`;
    }
    
    // Create step-specific logger that always uses this step's name (fixes race condition in parallel execution)
    const stepSpecificLog = (msg: string) => log(sanitizeLogMessage(msg), stepName);
    
    // Check dependencies before execution
    checkDependencies(step, stepStatuses, stepSpecificLog);
    
    // Check if step should be skipped
    if (shouldSkipStep(step, ctx)) {
      // Marker for saved logs parsing (not used in live mode)
      log(`SKIPPED: ${stepName} (condition: ${step.skipWhen?.variable})`, stepName);
      pubsub.publish({ type: "step-skipped", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps } });
      
      const stepId = startStep(dbRunId, stepName, step.module);
      const skippedResult = { skipped: true, reason: step.skipWhen?.variable };
      endStep(stepId, true, skippedResult, undefined, true);
      
      // Track as success for dependency checking (skipped steps are considered successful)
      if (step.name) stepStatuses.set(step.name, true);
      
      pubsub.publish({ type: "step-end", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps, success: true, skipped: true } });
      return { step, result: skippedResult, stepIndex, skipped: true };
    }
    
    // Marker for saved logs parsing (not used in live mode)
    log(`Running step: ${stepName}`, stepName);
    pubsub.publish({ type: "step-start", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps } });

    const stepId = startStep(dbRunId, stepName, step.module);
    const mod = await loadModule(step.module);

    if (!mod) {
      const error = `Module '${step.module}' not found`;
      endStep(stepId, false, undefined, error);
      throw new Error(error);
    }

    const resolvedParams = interpolate(step.params || {}, ctx) as Record<string, unknown>;

    // Create step-specific context with bound logger (fixes race condition in parallel execution)
    // Manually create new context object with overridden log
    const stepCtx: PipelineContext = {
      workDir: ctx.workDir,
      env: ctx.env,
      inputs: ctx.inputs,
      sshKey: ctx.sshKey,
      pipelineId: ctx.pipelineId,
      startTime: ctx.startTime,
      log: stepSpecificLog,  // Override with step-specific logger
      signal: ctx.signal,
      BUILD_ID: ctx.BUILD_ID,
      UNIXTIMESTAMP: ctx.UNIXTIMESTAMP,
      WORK_DIR: ctx.WORK_DIR,
      DATE: ctx.DATE,
      TIME: ctx.TIME,
      DATETIME: ctx.DATETIME,
      YEAR: ctx.YEAR,
      MONTH: ctx.MONTH,
      DAY: ctx.DAY,
      PIPELINE_NAME: ctx.PIPELINE_NAME,
      prev: ctx.prev,
      results: ctx.results,
    };

    try {
      const result = await mod.run(stepCtx, resolvedParams);
      // Marker for saved logs parsing (not used in live mode)
      log(`Step '${stepName}' completed`, stepName);
      pubsub.publish({ type: "step-end", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps, success: true } });
      endStep(stepId, true, result);
      // Track success for dependency checking
      if (step.name) stepStatuses.set(step.name, true);
      return { step, result, stepIndex, skipped: false };
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      pubsub.publish({ type: "step-end", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps, success: false, error: errorMsg } });
      endStep(stepId, false, undefined, errorMsg);
      // Track failure for dependency checking
      if (step.name) stepStatuses.set(step.name, false);
      throw e;
    }
  };

  let success = true;
  let currentStepIndex = 0;

  try {
    try {
      for (const group of stepGroups) {
        if (group.length === 1) {
          const { step, result } = await executeStep(group[0], currentStepIndex);
          ctx.prev = result;
          if (step.name) ctx.results[step.name] = result;
          currentStepIndex++;
        } else {
          // Parallel group
          // Marker for saved logs parsing (not used in live mode)
          pipelineLog(`Running ${group.length} steps in parallel`);
          pubsub.publish({ type: "parallel-start", pipelineId: id, payload: { runId, count: group.length } });
          
          const startIndex = currentStepIndex;
          const results = await Promise.all(
            group.map((step, i) => executeStep(step, startIndex + i))
          );

          // Collect executed and skipped step names
          const executed = results.filter(r => !r.skipped).map(r => r.step.name || r.step.module);
          const skipped = results.filter(r => r.skipped).map(r => r.step.name || r.step.module);
          
          pubsub.publish({ type: "parallel-end", pipelineId: id, payload: { runId, executed, skipped } });

          for (const { step, result } of results) {
            if (step.name) ctx.results[step.name] = result;
          }
          ctx.prev = results[results.length - 1].result;
          currentStepIndex += group.length;
        }
      }
    } catch (e: unknown) {
      success = false;
      const errorMsg = e instanceof Error ? e.message : String(e);
      pipelineLog(`Pipeline failed: ${errorMsg}`);
    } finally {
      // Stop persistent Docker container if used
      if (config.dockerEnabled) {
        await stopPersistentContainer(id, runId);
      }

      // Cleanup sandbox
      if (!pipeline.keepWorkDir) {
        await cleanupSandbox(sandboxPath, pipelineLog);
      } else {
        pipelineLog(`[Sandbox] Keeping working directory for debugging: ${sandboxPath}`);
      }
    }

    const duration = Date.now() - ctx.startTime;
    pipelineLog(`\nPipeline finished. Duration: ${duration}ms`);

    saveLog(dbRunId, success ? "success" : "fail", logBuffer, duration);
    pubsub.publish({ type: "end", pipelineId: id, payload: { runId, success } });

    return { success, duration, runId, workDir: pipeline.keepWorkDir ? sandboxPath : null };
  } finally {
    // Guarantee cleanup of runningPipelines Map to prevent memory leaks
    runningPipelines.delete(id);
  }
}

// --- Helper functions ---

// Normalize steps to arrays: single steps become [step], arrays stay as-is
function normalizeSteps(steps: StepItem[]): PipelineStep[][] {
  return steps.map(item => Array.isArray(item) ? item : [item]);
}

// Count total individual steps (for progress tracking)
function countTotalSteps(steps: StepItem[]): number {
  return steps.reduce((sum, item) => sum + (Array.isArray(item) ? item.length : 1), 0);
}

// Normalize dependsOn to array
function normalizeDependsOn(dependsOn?: string | string[]): string[] {
  if (!dependsOn) return [];
  return Array.isArray(dependsOn) ? dependsOn : [dependsOn];
}

// Get all step names defined before a given step index (for validation)
function getStepNamesBeforeIndex(stepGroups: PipelineStep[][], targetGroupIndex: number, targetIndexInGroup: number): Set<string> {
  const names = new Set<string>();
  
  for (let g = 0; g < stepGroups.length; g++) {
    const group = stepGroups[g];
    for (let s = 0; s < group.length; s++) {
      // Stop if we've reached the target step
      if (g === targetGroupIndex && s >= targetIndexInGroup) break;
      if (g > targetGroupIndex) break;
      
      const step = group[s];
      if (step.name) names.add(step.name);
    }
    if (g >= targetGroupIndex) break;
  }
  
  return names;
}

// Validate that all dependsOn references point to steps that come before
function validateDependencies(stepGroups: PipelineStep[][]): void {
  for (let g = 0; g < stepGroups.length; g++) {
    const group = stepGroups[g];
    for (let s = 0; s < group.length; s++) {
      const step = group[s];
      const deps = normalizeDependsOn(step.dependsOn);
      
      if (deps.length === 0) continue;
      
      const availableNames = getStepNamesBeforeIndex(stepGroups, g, s);
      
      for (const dep of deps) {
        if (!availableNames.has(dep)) {
          const stepName = step.description || step.name || step.module;
          throw new Error(
            `Step "${stepName}" depends on "${dep}" which is not defined before it. ` +
            `Available step names: ${[...availableNames].join(", ") || "(none)"}`
          );
        }
      }
    }
  }
}

// Check if all dependencies of a step have succeeded
function checkDependencies(
  step: PipelineStep, 
  stepStatuses: Map<string, boolean>,
  log: (msg: string) => void
): void {
  const deps = normalizeDependsOn(step.dependsOn);
  if (deps.length === 0) return;
  
  const stepName = step.description || step.name || step.module;
  
  for (const dep of deps) {
    const status = stepStatuses.get(dep);
    if (status === undefined) {
      throw new Error(`Step "${stepName}" depends on "${dep}" which has not been executed`);
    }
    if (status === false) {
      throw new Error(`Step "${stepName}" depends on "${dep}" which failed`);
    }
  }
  
  log(`Dependencies satisfied for "${stepName}": ${deps.join(", ")}`);
}
