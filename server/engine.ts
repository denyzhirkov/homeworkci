import { ensureDir } from "@std/fs";
import { join, parse } from "@std/path";
import { loadModule } from "./modules.ts";
import { getMergedEnv } from "./variables.ts";
import { startRun, saveLog, startStep, endStep } from "./logger.ts";

const PIPELINES_DIR = "./pipelines";
await ensureDir(PIPELINES_DIR);

// Demo pipelines are read-only
const DEMO_PIPELINES = ["demo"];

export function isDemoPipeline(id: string): boolean {
  return DEMO_PIPELINES.includes(id);
}

export interface Pipeline {
  id: string; // Filename (without extension)
  name: string;
  schedule?: string;
  env?: string; // Environment name to use (optional)
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
}

const runningPipelines = new Map<string, RunningPipeline>();

export function getActivePipelines(): string[] {
  return Array.from(runningPipelines.keys());
}

export function stopPipeline(id: string): boolean {
  const running = runningPipelines.get(id);
  if (running) {
    running.controller.abort();
    
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
  let logBuffer = `Pipeline: ${pipeline.name}\nRun ID: ${runId}\nStarted: ${new Date().toISOString()}\n\n`;

  // Store running pipeline info for cancellation support
  const runningInfo: RunningPipeline = {
    controller,
    dbRunId,
    runId,
    logBuffer,
    startTime,
  };
  runningPipelines.set(id, runningInfo);

  // Notify start
  pubsub.publish({ type: "start", pipelineId: id, payload: { runId } });

  const log = (msg: string) => {
    console.log(msg);
    const ts = new Date().toISOString();
    logBuffer += `[${ts}] ${msg}\n`;
    runningInfo.logBuffer = logBuffer; // Keep reference updated for stop
    // Notify log
    pubsub.publish({ type: "log", pipelineId: id, payload: { runId, msg, ts } });
  };

  // Context shared between steps
  // Merge system env, global vars, and selected environment vars
  const mergedEnv = await getMergedEnv(pipeline.env);

  const ctx: any = {
    cwd: Deno.cwd(),
    workDir: Deno.cwd(), // In a real CI this would be a fresh tmp dir
    env: mergedEnv,
    results: {} as Record<string, any>,
    prev: null, // Result of previous step, accessible via ${prev}
    pipelineId: id,
    startTime,
    log: log, // Allow modules to log?
    signal: controller.signal, // AbortSignal for cancellation
  };

  // Helper deep interpolation function
  const interpolate = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/\${([\w\.]+)}/g, (_, path) => {
        const keys = path.split('.');
        let value = ctx;
        for (const key of keys) {
          value = value?.[key];
        }
        return value !== undefined ? String(value) : "";
      });
    } else if (Array.isArray(obj)) {
      return obj.map(interpolate);
    } else if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const key in obj) {
        result[key] = interpolate(obj[key]);
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
  const executeStep = async (step: PipelineStep) => {
    const stepName = step.description || step.name || step.module;
    log(`Running step: ${stepName}`);
    pubsub.publish({ type: "step-start", pipelineId: id, payload: { runId, step: stepName } });

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
      pubsub.publish({ type: "step-end", pipelineId: id, payload: { runId, step: stepName, success: true } });
      
      // Record step success in DB
      endStep(stepId, true, result);
      
      return { step, result };
    } catch (e: any) {
      const errorMsg = e?.message || String(e);
      endStep(stepId, false, undefined, errorMsg);
      throw e;
    }
  };

  let success = true;

  try {
    for (const group of stepGroups) {
      if (group.length === 1) {
        // Single step - execute normally
        const { step, result } = await executeStep(group[0]);
        ctx.prev = result;
        if (step.name) {
          ctx.results[step.name] = result;
        }
      } else {
        // Parallel group - execute all steps simultaneously
        log(`Running ${group.length} steps in parallel (group: ${group[0].parallel})`);
        
        const results = await Promise.all(group.map(executeStep));
        
        // Save all results
        for (const { step, result } of results) {
          if (step.name) {
            ctx.results[step.name] = result;
          }
        }
        // prev = last result in the parallel group
        ctx.prev = results[results.length - 1].result;
      }
    }
  } catch (e: any) {
    success = false;
    const errorMsg = e?.message || String(e);
    log(`Pipeline failed: ${errorMsg}`);
    pubsub.publish({ type: "step-end", pipelineId: id, payload: { runId, step: "unknown", success: false, error: errorMsg } });
  }

  const duration = Date.now() - ctx.startTime;
  log(`\nPipeline finished. Duration: ${duration}ms`);

  saveLog(dbRunId, success ? "success" : "fail", logBuffer, duration);

  // Notify end
  pubsub.publish({ type: "end", pipelineId: id, payload: { runId, success } });

  runningPipelines.delete(id);

  return { success, duration, runId };
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
