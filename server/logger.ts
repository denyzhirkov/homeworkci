import {
  createRun,
  finishRun,
  getRunsByPipeline,
  getRunByRunId,
  createStep,
  finishStep,
  type RunRecord,
} from "./db.ts";

export interface LogEntry {
  pipelineId: string;
  runId: string;
  status: "success" | "fail" | "running";
  duration?: number;
  startedAt?: number;
}

// Create a new run record in DB, returns the DB row id
export function startRun(pipelineId: string, runId: string): number {
  return createRun(pipelineId, runId);
}

// Finish a run with status and log content
export function saveLog(
  dbRunId: number,
  status: string,
  content: string,
  durationMs: number
): void {
  finishRun(dbRunId, status, content, durationMs);
}

// Get run history for a pipeline
export function getRunHistory(pipelineId: string): LogEntry[] {
  const runs = getRunsByPipeline(pipelineId);
  return runs.map((r: RunRecord) => ({
    pipelineId: r.pipeline_id,
    runId: r.run_id,
    status: r.status as "success" | "fail" | "running",
    duration: r.duration_ms ?? undefined,
    startedAt: r.started_at,
  }));
}

// Get log content for a specific run
export function getRunLog(pipelineId: string, runId: string): string | null {
  const run = getRunByRunId(pipelineId, runId);
  return run?.log_content ?? null;
}

// Get log content with status (for handling running pipelines)
export function getRunLogWithStatus(pipelineId: string, runId: string): { log: string | null; status: string | null } {
  const run = getRunByRunId(pipelineId, runId);
  if (!run) return { log: null, status: null };
  return { log: run.log_content, status: run.status };
}

// --- Step tracking ---

export function startStep(dbRunId: number, stepName: string, moduleName: string): number {
  return createStep(dbRunId, stepName, moduleName);
}

export function endStep(
  stepId: number,
  success: boolean,
  result?: unknown,
  error?: string,
  skipped?: boolean
): void {
  const status = skipped ? "skipped" : (success ? "success" : "fail");
  const resultJson = result !== undefined ? JSON.stringify(result) : undefined;
  finishStep(stepId, status, resultJson, error);
}
