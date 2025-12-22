import { ensureDir } from "@std/fs";
import { join, parse } from "@std/path";
import { loadModule } from "./modules.ts";
import { getMergedEnv } from "./variables.ts";
import { startRun, saveLog, startStep, endStep } from "./logger.ts";
import { config } from "./config.ts";
import { killContainersForRun, stopPersistentContainer } from "./docker-manager.ts";

// Secure pipeline context interface - strictly typed
export interface PipelineContext {
  readonly workDir: string; // Isolated sandbox directory for this pipeline run
  readonly env: Readonly<Record<string, string>>;
  readonly results: Record<string, unknown>;
  prev: unknown;
  readonly pipelineId: string;
  readonly startTime: number;
  readonly log: (msg: string) => void;
  readonly signal: AbortSignal;
}

// Patterns to detect and mask sensitive data in logs
const SENSITIVE_PATTERNS = [
  /(?:password|passwd|pwd|secret|token|api[_-]?key|auth|bearer|credential)[\s]*[=:]\s*['"]?([^'"\s,;]+)/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /[a-f0-9]{32,}/gi, // Long hex strings (potential tokens/hashes)
];

// Mask sensitive data in log messages
function sanitizeLogMessage(msg: string): string {
  let sanitized = msg;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      // Keep first 4 chars, mask the rest
      if (match.length > 8) {
        return match.substring(0, 4) + "*".repeat(Math.min(match.length - 4, 16));
      }
      return "****";
    });
  }
  return sanitized;
}

// Validate pipeline ID to prevent path traversal and injection
function validatePipelineId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new Error("Pipeline ID must be a non-empty string");
  }
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Pipeline ID contains invalid characters");
  }
  if (id.length > 128) {
    throw new Error("Pipeline ID too long");
  }
}

const PIPELINES_DIR = config.pipelinesDir;
const SANDBOX_DIR = config.sandboxDir;

await ensureDir(PIPELINES_DIR);
await ensureDir(SANDBOX_DIR);

// Demo pipelines are read-only
const DEMO_PIPELINES = ["demo", "docker-demo"];

// --- Sandbox Directory Management ---

/**
 * Creates an isolated sandbox directory for a pipeline run.
 * Path: ./tmp/{pipelineId}/{runId}/
 */
async function createSandbox(pipelineId: string, runId: string): Promise<string> {
  const sandboxPath = join(SANDBOX_DIR, pipelineId, runId);
  await ensureDir(sandboxPath);
  return sandboxPath;
}

/**
 * Cleans up the sandbox directory after pipeline completion.
 * Removes all files and the directory itself.
 */
async function cleanupSandbox(sandboxPath: string, log: (msg: string) => void): Promise<void> {
  try {
    await Deno.remove(sandboxPath, { recursive: true });
    log(`[Sandbox] Cleaned up working directory: ${sandboxPath}`);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      log(`[Sandbox] Warning: Failed to cleanup ${sandboxPath}: ${e}`);
    }
  }
}

/**
 * Cleans up old sandbox directories (older than maxAge).
 * Called periodically to prevent disk space issues.
 */
export async function cleanupOldSandboxes(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  let cleaned = 0;
  const now = Date.now();

  try {
    for await (const pipelineEntry of Deno.readDir(SANDBOX_DIR)) {
      if (!pipelineEntry.isDirectory) continue;

      const pipelinePath = join(SANDBOX_DIR, pipelineEntry.name);
      for await (const runEntry of Deno.readDir(pipelinePath)) {
        if (!runEntry.isDirectory) continue;

        const runPath = join(pipelinePath, runEntry.name);
        const stat = await Deno.stat(runPath);

        if (stat.mtime && (now - stat.mtime.getTime()) > maxAgeMs) {
          await Deno.remove(runPath, { recursive: true });
          cleaned++;
        }
      }

      // Remove empty pipeline directories
      try {
        await Deno.remove(pipelinePath); // Will fail if not empty
      } catch { /* Directory not empty, ignore */ }
    }
  } catch (e) {
    console.error("[Sandbox] Error during cleanup:", e);
  }

  return cleaned;
}

export function isDemoPipeline(id: string): boolean {
  return DEMO_PIPELINES.includes(id);
}

export interface Pipeline {
  id: string; // Filename (without extension)
  name: string;
  schedule?: string;
  env?: string; // Environment name to use (optional)
  keepWorkDir?: boolean; // If true, sandbox directory is not cleaned up (for debugging)
  steps: PipelineStep[];
}

export interface PipelineStep {
  name?: string; // Step name for results reference via ${results.name}
  description?: string;
  module: string;
  params?: Record<string, any>;
  parallel?: string; // Group name for parallel execution
}

export async function loadPipeline(id: string): Promise<Pipeline | null> {
  try {
    const text = await Deno.readTextFile(join(PIPELINES_DIR, `${id}.json`));
    const pipeline = JSON.parse(text);
    pipeline.id = id;
    return pipeline;
  } catch (e) {
    console.error(`Failed to load pipeline ${id}:`, e);
    return null;
  }
}

export async function savePipeline(id: string, pipeline: Omit<Pipeline, "id">) {
  if (isDemoPipeline(id)) {
    throw new Error("Cannot modify demo pipeline");
  }
  await Deno.writeTextFile(join(PIPELINES_DIR, `${id}.json`), JSON.stringify(pipeline, null, 2));
}

export async function listPipelines(): Promise<Pipeline[]> {
  const pipelines: Pipeline[] = [];
  try {
    for await (const entry of Deno.readDir(PIPELINES_DIR)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const id = parse(entry.name).name;
        const p = await loadPipeline(id);
        if (p) pipelines.push(p);
      }
    }
  } catch (e) {
    console.error("Error listing pipelines:", e);
  }
  return pipelines;
}

import { pubsub } from "./pubsub.ts";
import { finishRun } from "./db.ts";

// Track running pipelines with AbortController and run info for cancellation
interface RunningPipeline {
  controller: AbortController;
  dbRunId: number;
  runId: string;
  logBuffer: string;
  startTime: number;
  sandboxPath: string;
  keepWorkDir: boolean;
}

const runningPipelines = new Map<string, RunningPipeline>();

export function getActivePipelines(): string[] {
  return Array.from(runningPipelines.keys());
}

export async function stopPipeline(id: string): Promise<boolean> {
  const running = runningPipelines.get(id);
  if (running) {
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
  return false;
}

export async function runPipeline(id: string) {
  if (runningPipelines.has(id)) {
    throw new Error(`Pipeline ${id} is already running`);
  }

  const pipeline = await loadPipeline(id);
  if (!pipeline) {
    throw new Error(`Pipeline ${id} not found`);
  }

  console.log(`[Engine] Starting pipeline: ${pipeline.name} (${id})`);

  const controller = new AbortController();
  const runId = String(Date.now());
  const dbRunId = startRun(id, runId); // Create run record in DB
  const startTime = Date.now();

  // Create isolated sandbox directory for this run
  const sandboxPath = await createSandbox(id, runId);

  let logBuffer = `Pipeline: ${pipeline.name}\nRun ID: ${runId}\nStarted: ${new Date().toISOString()}\nWorkDir: ${sandboxPath}\n\n`;

  // Store running pipeline info for cancellation support
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

  // Notify start
  pubsub.publish({ type: "start", pipelineId: id, payload: { runId, totalSteps } });

  const log = (msg: string) => {
    console.log(msg);
    const ts = new Date().toISOString();
    logBuffer += `[${ts}] ${msg}\n`;
    runningInfo.logBuffer = logBuffer; // Keep reference updated for stop
    // Notify log
    pubsub.publish({ type: "log", pipelineId: id, payload: { runId, msg, ts } });
  };

  // Validate pipeline ID before use
  validatePipelineId(id);

  // Context shared between steps
  // Merge whitelisted system env, global vars, and selected environment vars
  const mergedEnv = await getMergedEnv(pipeline.env);

  // Create sanitized log function that masks sensitive data
  const sanitizedLog = (msg: string): void => {
    log(sanitizeLogMessage(msg));
  };

  // Internal mutable storage
  const resultsStorage: Record<string, unknown> = Object.create(null);
  let prevResult: unknown = null;

  // Frozen immutable fields
  const frozenFields = Object.freeze({
    workDir: sandboxPath, // Isolated sandbox directory for this run
    env: Object.freeze({ ...mergedEnv }), // Frozen copy of env
    pipelineId: id,
    startTime,
    log: sanitizedLog, // Sanitized logging to mask secrets
    signal: controller.signal, // AbortSignal for cancellation
  });

  sanitizedLog(`[Sandbox] Created isolated working directory: ${sandboxPath}`);

  // Create secure context with controlled mutability
  const ctx: PipelineContext = Object.create(null, {
    // Immutable fields from frozen object
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
          // Deep freeze the value to prevent modification
          target[key] = typeof value === "object" && value !== null
            ? Object.freeze(JSON.parse(JSON.stringify(value)))
            : value;
          return true;
        },
        deleteProperty() {
          return false; // Prevent deletion
        },
      }),
      writable: false,
      enumerable: true,
    },
  });

  // Helper deep interpolation function with safe property access
  const interpolate = (obj: unknown): unknown => {
    if (typeof obj === 'string') {
      return obj.replace(/\${([\w.]+)}/g, (_, path: string) => {
        const keys = path.split('.');
        // deno-lint-ignore no-explicit-any
        let value: any = ctx;
        for (const key of keys) {
          // Validate key to prevent prototype pollution
          if (key === "__proto__" || key === "constructor" || key === "prototype") {
            return "";
          }
          value = value?.[key];
        }
        return value !== undefined ? String(value) : "";
      });
    } else if (Array.isArray(obj)) {
      return obj.map(interpolate);
    } else if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(obj)) {
        result[key] = interpolate((obj as Record<string, unknown>)[key]);
      }
      return result;
    }
    return obj;
  };

  // Group consecutive steps with same parallel value
  const stepGroups: PipelineStep[][] = [];
  for (const step of pipeline.steps) {
    const lastGroup = stepGroups[stepGroups.length - 1];
    if (lastGroup && step.parallel && lastGroup[0].parallel === step.parallel) {
      // Same parallel group - add to existing group
      lastGroup.push(step);
    } else {
      // New group (either no parallel, or different parallel value)
      stepGroups.push([step]);
    }
  }

  // Execute a single step
  const executeStep = async (step: PipelineStep, stepIndex: number) => {
    const stepName = step.description || step.name || step.module;
    log(`Running step: ${stepName}`);
    pubsub.publish({ type: "step-start", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps } });

    // Record step start in DB
    const stepId = startStep(dbRunId, stepName, step.module);

    const mod = await loadModule(step.module);
    if (!mod) {
      const error = `Module '${step.module}' not found`;
      endStep(stepId, false, undefined, error);
      throw new Error(error);
    }

    // Resolve params with interpolation
    const resolvedParams = interpolate(step.params || {});

    try {
      const result = await mod.run(ctx, resolvedParams);
      log(`Step '${stepName}' completed. Result: ${JSON.stringify(result)}`);
      pubsub.publish({ type: "step-end", pipelineId: id, payload: { runId, step: stepName, stepIndex, totalSteps, success: true } });

      // Record step success in DB
      endStep(stepId, true, result);

      return { step, result, stepIndex };
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
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
        // Single step - execute normally
        const { step, result } = await executeStep(group[0], currentStepIndex);
        ctx.prev = result;
        if (step.name) {
          ctx.results[step.name] = result;
        }
        currentStepIndex++;
      } else {
        // Parallel group - execute all steps simultaneously
        log(`Running ${group.length} steps in parallel (group: ${group[0].parallel})`);

        const startIndex = currentStepIndex;
        const results = await Promise.all(
          group.map((step, i) => executeStep(step, startIndex + i))
        );

        // Save all results
        for (const { step, result } of results) {
          if (step.name) {
            ctx.results[step.name] = result;
          }
        }
        // prev = last result in the parallel group
        ctx.prev = results[results.length - 1].result;
        currentStepIndex += group.length;
      }
    }
  } catch (e: any) {
    success = false;
    const errorMsg = e?.message || String(e);
    log(`Pipeline failed: ${errorMsg}`);
  } finally {
    // Stop persistent Docker container if used
    if (config.dockerEnabled) {
      await stopPersistentContainer(id, runId);
    }

    // Cleanup sandbox directory unless keepWorkDir is set
    if (!pipeline.keepWorkDir) {
      await cleanupSandbox(sandboxPath, log);
    } else {
      log(`[Sandbox] Keeping working directory for debugging: ${sandboxPath}`);
    }
  }

  const duration = Date.now() - ctx.startTime;
  log(`\nPipeline finished. Duration: ${duration}ms`);

  saveLog(dbRunId, success ? "success" : "fail", logBuffer, duration);

  // Notify end
  pubsub.publish({ type: "end", pipelineId: id, payload: { runId, success } });

  runningPipelines.delete(id);

  return { success, duration, runId, workDir: pipeline.keepWorkDir ? sandboxPath : null };
}

export async function deletePipeline(id: string) {
  if (isDemoPipeline(id)) {
    throw new Error("Cannot delete demo pipeline");
  }
  try {
    await Deno.remove(join(PIPELINES_DIR, `${id}.json`));
    // Optionally delete logs?
    // await Deno.remove(join("./logs", id), { recursive: true }).catch(() => {});
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }
}
