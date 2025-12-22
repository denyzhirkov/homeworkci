// Pipeline execution engine
// Orchestrates pipeline runs with step execution, logging, and cleanup

import { loadModule } from "./modules.ts";
import { getMergedEnv } from "./variables.ts";
import { startRun, saveLog, startStep, endStep } from "./logger.ts";
import { config } from "./config.ts";
import { killContainersForRun, stopPersistentContainer } from "./docker-manager.ts";
import { createSandbox, cleanupSandbox } from "./sandbox.ts";
import { loadPipeline } from "./pipeline-repository.ts";
import { interpolate } from "./interpolation.ts";
import { pubsub } from "./pubsub.ts";
import { finishRun } from "./db.ts";
import type { Pipeline, PipelineStep, PipelineContext, RunningPipeline } from "./types/index.ts";

// Re-export from repository and sandbox for backward compatibility
export { loadPipeline, savePipeline, listPipelines, deletePipeline, isDemoPipeline } from "./pipeline-repository.ts";
export { cleanupOldSandboxes } from "./sandbox.ts";

// --- Security utilities ---

// Patterns to detect and mask sensitive data in logs
const SENSITIVE_PATTERNS = [
  /(?:password|passwd|pwd|secret|token|api[_-]?key|auth|bearer|credential)[\s]*[=:]\s*['"]?([^'"\s,;]+)/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /[a-f0-9]{32,}/gi, // Long hex strings (potential tokens/hashes)
];

function sanitizeLogMessage(msg: string): string {
  let sanitized = msg;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.length > 8) {
        return match.substring(0, 4) + "*".repeat(Math.min(match.length - 4, 16));
      }
      return "****";
    });
  }
  return sanitized;
}

function validatePipelineId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new Error("Pipeline ID must be a non-empty string");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Pipeline ID contains invalid characters");
  }
  if (id.length > 128) {
    throw new Error("Pipeline ID too long");
  }
}

// --- Running pipelines tracking ---

const runningPipelines = new Map<string, RunningPipeline>();

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

function createPipelineContext(
  sandboxPath: string,
  mergedEnv: Record<string, string>,
  pipelineId: string,
  startTime: number,
  sanitizedLog: (msg: string) => void,
  signal: AbortSignal
): PipelineContext {
  // Internal mutable storage
  const resultsStorage: Record<string, unknown> = Object.create(null);
  let prevResult: unknown = null;

  // Frozen immutable fields
  const frozenFields = Object.freeze({
    workDir: sandboxPath,
    env: Object.freeze({ ...mergedEnv }),
    pipelineId,
    startTime,
    log: sanitizedLog,
    signal,
  });

  // Create secure context with controlled mutability
  return Object.create(null, {
    workDir: { value: frozenFields.workDir, writable: false, enumerable: true },
    env: { value: frozenFields.env, writable: false, enumerable: true },
    pipelineId: { value: frozenFields.pipelineId, writable: false, enumerable: true },
    startTime: { value: frozenFields.startTime, writable: false, enumerable: true },
    log: { value: frozenFields.log, writable: false, enumerable: true },
    signal: { value: frozenFields.signal, writable: false, enumerable: true },

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

export async function runPipeline(id: string) {
  if (runningPipelines.has(id)) {
    throw new Error(`Pipeline ${id} is already running`);
  }

  const pipeline = await loadPipeline(id);
  if (!pipeline) {
    throw new Error(`Pipeline ${id} not found`);
  }

  console.log(`[Engine] Starting pipeline: ${pipeline.name} (${id})`);

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

  const totalSteps = pipeline.steps.length;
  pubsub.publish({ type: "start", pipelineId: id, payload: { runId, totalSteps } });

  const log = (msg: string) => {
    console.log(msg);
    const ts = new Date().toISOString();
    logBuffer += `[${ts}] ${msg}\n`;
    runningInfo.logBuffer = logBuffer;
    pubsub.publish({ type: "log", pipelineId: id, payload: { runId, msg, ts } });
  };

  const sanitizedLog = (msg: string): void => {
    log(sanitizeLogMessage(msg));
  };

  // Create context
  const mergedEnv = await getMergedEnv(pipeline.env);
  const ctx = createPipelineContext(sandboxPath, mergedEnv, id, startTime, sanitizedLog, controller.signal);

  sanitizedLog(`[Sandbox] Created isolated working directory: ${sandboxPath}`);

  // Group consecutive steps with same parallel value
  const stepGroups = groupSteps(pipeline.steps);

  // Execute step function
  const executeStep = async (step: PipelineStep, stepIndex: number) => {
    const stepName = step.description || step.name || step.module;
    log(`Running step: ${stepName}`);
    pubsub.publish({ type: "step-start", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps } });

    const stepId = startStep(dbRunId, stepName, step.module);
    const mod = await loadModule(step.module);

    if (!mod) {
      const error = `Module '${step.module}' not found`;
      endStep(stepId, false, undefined, error);
      throw new Error(error);
    }

    const resolvedParams = interpolate(step.params || {}, ctx);

    try {
      const result = await mod.run(ctx, resolvedParams);
      log(`Step '${stepName}' completed. Result: ${JSON.stringify(result)}`);
      pubsub.publish({ type: "step-end", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps, success: true } });
      endStep(stepId, true, result);
      return { step, result, stepIndex };
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      pubsub.publish({ type: "step-end", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps, success: false, error: errorMsg } });
      endStep(stepId, false, undefined, errorMsg);
      throw e;
    }
  };

  let success = true;
  let currentStepIndex = 0;

  try {
    for (const group of stepGroups) {
      if (group.length === 1) {
        const { step, result } = await executeStep(group[0], currentStepIndex);
        ctx.prev = result;
        if (step.name) ctx.results[step.name] = result;
        currentStepIndex++;
      } else {
        log(`Running ${group.length} steps in parallel (group: ${group[0].parallel})`);
        const startIndex = currentStepIndex;
        const results = await Promise.all(
          group.map((step, i) => executeStep(step, startIndex + i))
        );

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
    log(`Pipeline failed: ${errorMsg}`);
  } finally {
    // Stop persistent Docker container if used
    if (config.dockerEnabled) {
      await stopPersistentContainer(id, runId);
    }

    // Cleanup sandbox
    if (!pipeline.keepWorkDir) {
      await cleanupSandbox(sandboxPath, log);
    } else {
      log(`[Sandbox] Keeping working directory for debugging: ${sandboxPath}`);
    }
  }

  const duration = Date.now() - ctx.startTime;
  log(`\nPipeline finished. Duration: ${duration}ms`);

  saveLog(dbRunId, success ? "success" : "fail", logBuffer, duration);
  pubsub.publish({ type: "end", pipelineId: id, payload: { runId, success } });
  runningPipelines.delete(id);

  return { success, duration, runId, workDir: pipeline.keepWorkDir ? sandboxPath : null };
}

// --- Helper functions ---

function groupSteps(steps: PipelineStep[]): PipelineStep[][] {
  const groups: PipelineStep[][] = [];

  for (const step of steps) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && step.parallel && lastGroup[0].parallel === step.parallel) {
      lastGroup.push(step);
    } else {
      groups.push([step]);
    }
  }

  return groups;
}
