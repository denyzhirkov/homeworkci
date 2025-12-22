// Shared types for HomeworkCI server

// --- Pipeline Types ---

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  schedule?: string;
  env?: string; // Environment name to use
  keepWorkDir?: boolean; // Keep sandbox directory after run (for debugging)
  steps: PipelineStep[];
}

export interface PipelineStep {
  name?: string; // Step name for results reference via ${results.name}
  description?: string;
  module: string;
  params?: Record<string, unknown>;
  parallel?: string; // Group name for parallel execution
}

// --- Context Types ---

export interface PipelineContext {
  readonly workDir: string; // Isolated sandbox directory
  readonly env: Readonly<Record<string, string>>;
  readonly results: Record<string, unknown>;
  prev: unknown;
  readonly pipelineId: string;
  readonly startTime: number;
  readonly log: (msg: string) => void;
  readonly signal: AbortSignal;
  readonly stepIndex?: number;
}

// --- Module Types ---

export interface StepModule {
  run: (ctx: PipelineContext, params: Record<string, unknown>) => Promise<unknown>;
}

export interface ModuleInfo {
  id: string;
  description: string;
  fullDocs: string;
  isBuiltIn: boolean;
}

// --- Run Types ---

export interface RunningPipeline {
  controller: AbortController;
  dbRunId: number;
  runId: string;
  logBuffer: string;
  startTime: number;
  sandboxPath: string;
  keepWorkDir: boolean;
}

export interface RunRecord {
  id: number;
  pipeline_id: string;
  run_id: string;
  status: string;
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
  log_content: string | null;
}

export interface StepRecord {
  id: number;
  run_id: number;
  step_name: string;
  module: string;
  status: string;
  started_at: number;
  finished_at: number | null;
  result_json: string | null;
  error: string | null;
}

// --- Statistics Types ---

export interface PipelineStats {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  success_rate: number;
  avg_duration_ms: number | null;
  last_run_at: number | null;
}

export interface OverviewStats {
  total_pipelines_run: number;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  success_rate: number;
  runs_today: number;
  runs_this_week: number;
}

// --- Log Types ---

export interface LogEntry {
  pipelineId: string;
  runId: string;
  status: "success" | "fail" | "running" | "cancelled";
  duration?: number;
  startedAt?: number;
}

// --- Docker Types ---

export interface DockerRunOptions {
  image: string;
  cmd: string;
  workDir: string;
  env?: Record<string, string>;
  workdir?: string;
  network?: string;
  memory?: string;
  cpus?: string;
  timeout?: number;
  removeImage?: boolean;
  reuse?: boolean;
}

export interface DockerRunResult {
  code: number;
  output: string;
}

