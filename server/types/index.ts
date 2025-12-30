// Shared types for HomeworkCI server

// --- Pipeline Types ---

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  tags?: string[]; // Tags for organizing pipelines into virtual folders
  schedule?: string;
  env?: string; // Environment name to use
  keepWorkDir?: boolean; // Keep sandbox directory after run (for debugging)
  inputs?: PipelineInput[]; // Input parameters for parameterized runs
  steps: StepItem[]; // Steps can include nested arrays for parallel execution
}

export interface PipelineStep {
  name?: string; // Step name for results reference via ${results.name}
  description?: string;
  module: string;
  params?: Record<string, unknown>;
  dependsOn?: string | string[]; // Step names this step depends on (must succeed first)
}

// A step item can be a single step or an array of parallel steps
export type StepItem = PipelineStep | PipelineStep[];

// --- Pipeline Input Types ---

export interface PipelineInput {
  name: string;
  type: "string" | "boolean" | "select";
  label?: string;
  default?: string | boolean;
  options?: string[]; // for type: "select"
}

// --- Context Types ---

export interface PipelineContext {
  readonly workDir: string; // Isolated sandbox directory
  readonly env: Readonly<Record<string, string>>;
  readonly inputs: Readonly<Record<string, string | boolean>>; // Runtime input values
  readonly results: Record<string, unknown>;
  prev: unknown;
  readonly pipelineId: string;
  readonly startTime: number;
  readonly log: (msg: string) => void;
  readonly signal: AbortSignal;
  readonly stepIndex?: number;
}

// --- Module Types ---

// Valid return types for modules
export type ModuleResult =
  | { success: true }
  | { skipped: true }
  | { waited: number }
  | { code: number }
  | string
  | Record<string, unknown>;

export interface StepModule {
  run: (ctx: PipelineContext, params: Record<string, unknown>) => Promise<ModuleResult>;
}

export interface ModuleInfo {
  id: string;
  description: string;
  fullDocs: string;
  isBuiltIn: boolean;
  tags?: string[]; // Tags parsed from "// Tags: tag1, tag2" comment
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

