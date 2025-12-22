import { Database } from "@db/sqlite";
import { ensureDir } from "@std/fs";
import { config } from "./config.ts";

const DATA_DIR = config.dataDir;
const DB_PATH = `${DATA_DIR}/homework.db`;

await ensureDir(DATA_DIR);

// Initialize database connection
const db = new Database(DB_PATH);

// Run migrations on startup
function migrate() {
  // Create runs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pipeline_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      duration_ms INTEGER,
      log_content TEXT,
      UNIQUE(pipeline_id, run_id)
    )
  `);

  // Create steps table
  db.exec(`
    CREATE TABLE IF NOT EXISTS steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      module TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      result_json TEXT,
      error TEXT,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for faster queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_pipeline_id ON runs(pipeline_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_steps_run_id ON steps(run_id)`);

  console.log("[DB] Migrations complete");
}

migrate();

// --- Runs ---

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

export function createRun(pipelineId: string, runId: string): number {
  const stmt = db.prepare(`
    INSERT INTO runs (pipeline_id, run_id, status, started_at)
    VALUES (?, ?, 'running', ?)
  `);
  stmt.run(pipelineId, runId, Date.now());
  return db.lastInsertRowId as number;
}

export function finishRun(
  dbRunId: number,
  status: string,
  logContent: string,
  durationMs: number
) {
  const stmt = db.prepare(`
    UPDATE runs 
    SET status = ?, log_content = ?, finished_at = ?, duration_ms = ?
    WHERE id = ?
  `);
  stmt.run(status, logContent, Date.now(), durationMs, dbRunId);
}

export function getRunsByPipeline(pipelineId: string, limit = 50): RunRecord[] {
  const stmt = db.prepare(`
    SELECT id, pipeline_id, run_id, status, started_at, finished_at, duration_ms, log_content
    FROM runs
    WHERE pipeline_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `);
  return stmt.all(pipelineId, limit) as RunRecord[];
}

export function getRunByRunId(pipelineId: string, runId: string): RunRecord | null {
  const stmt = db.prepare(`
    SELECT id, pipeline_id, run_id, status, started_at, finished_at, duration_ms, log_content
    FROM runs
    WHERE pipeline_id = ? AND run_id = ?
  `);
  const result = stmt.get(pipelineId, runId) as RunRecord | undefined;
  return result || null;
}

// --- Steps ---

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

export function createStep(
  dbRunId: number,
  stepName: string,
  moduleName: string
): number {
  const stmt = db.prepare(`
    INSERT INTO steps (run_id, step_name, module, status, started_at)
    VALUES (?, ?, ?, 'running', ?)
  `);
  stmt.run(dbRunId, stepName, moduleName, Date.now());
  return db.lastInsertRowId as number;
}

export function finishStep(
  stepId: number,
  status: string,
  resultJson?: string,
  error?: string
) {
  const stmt = db.prepare(`
    UPDATE steps 
    SET status = ?, finished_at = ?, result_json = ?, error = ?
    WHERE id = ?
  `);
  stmt.run(status, Date.now(), resultJson || null, error || null, stepId);
}

export function getStepsByRunId(dbRunId: number): StepRecord[] {
  const stmt = db.prepare(`
    SELECT id, run_id, step_name, module, status, started_at, finished_at, result_json, error
    FROM steps
    WHERE run_id = ?
    ORDER BY started_at ASC
  `);
  return stmt.all(dbRunId) as StepRecord[];
}

// --- Statistics ---

export interface PipelineStats {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  success_rate: number;
  avg_duration_ms: number | null;
  last_run_at: number | null;
}

export function getPipelineStats(pipelineId: string): PipelineStats {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total_runs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
      SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as failed_runs,
      AVG(CASE WHEN status != 'running' THEN duration_ms END) as avg_duration_ms,
      MAX(started_at) as last_run_at
    FROM runs
    WHERE pipeline_id = ?
  `);
  const row = stmt.get(pipelineId) as {
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    avg_duration_ms: number | null;
    last_run_at: number | null;
  };

  return {
    total_runs: row.total_runs || 0,
    successful_runs: row.successful_runs || 0,
    failed_runs: row.failed_runs || 0,
    success_rate: row.total_runs > 0 
      ? (row.successful_runs / row.total_runs) * 100 
      : 0,
    avg_duration_ms: row.avg_duration_ms,
    last_run_at: row.last_run_at,
  };
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

export function getOverviewStats(): OverviewStats {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const stmt = db.prepare(`
    SELECT 
      COUNT(DISTINCT pipeline_id) as total_pipelines_run,
      COUNT(*) as total_runs,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
      SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as failed_runs,
      SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) as runs_today,
      SUM(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) as runs_this_week
    FROM runs
  `);
  const row = stmt.get(dayAgo, weekAgo) as {
    total_pipelines_run: number;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    runs_today: number;
    runs_this_week: number;
  };

  return {
    total_pipelines_run: row.total_pipelines_run || 0,
    total_runs: row.total_runs || 0,
    successful_runs: row.successful_runs || 0,
    failed_runs: row.failed_runs || 0,
    success_rate: row.total_runs > 0
      ? (row.successful_runs / row.total_runs) * 100
      : 0,
    runs_today: row.runs_today || 0,
    runs_this_week: row.runs_this_week || 0,
  };
}

// Close database on process exit
globalThis.addEventListener("unload", () => {
  db.close();
});

export { db };

