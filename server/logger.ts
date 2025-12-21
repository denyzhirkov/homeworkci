import { ensureDir } from "@std/fs";
import { join } from "@std/path";

const LOGS_DIR = "./logs";

export interface LogEntry {
  pipelineId: string;
  runId: string; // Timestamp
  status: "success" | "fail" | "running";
  duration?: number;
}

export async function saveLog(pipelineId: string, runId: string, status: string, content: string) {
  const dir = join(LOGS_DIR, pipelineId);
  await ensureDir(dir);

  // Filename format: <timestamp>_<status>.log
  const filename = `${runId}_${status}.log`;
  await Deno.writeTextFile(join(dir, filename), content);
}

export async function getRunHistory(pipelineId: string): Promise<LogEntry[]> {
  const dir = join(LOGS_DIR, pipelineId);
  const history: LogEntry[] = [];

  try {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && entry.name.endsWith(".log")) {
        // Parse 1234567890_success.log
        const [runId, statusPart] = entry.name.split("_");
        const status = statusPart.replace(".log", "") as any;

        history.push({
          pipelineId,
          runId,
          status,
        });
      }
    }
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      console.error("Error reading run logs:", e);
    }
  }

  // Sort descending
  return history.sort((a, b) => Number(b.runId) - Number(a.runId));
}

export async function getRunLog(pipelineId: string, runId: string): Promise<string | null> {
  const dir = join(LOGS_DIR, pipelineId);
  try {
    // We don't know the status suffix, so we look for matching prefix
    for await (const entry of Deno.readDir(dir)) {
      if (entry.name.startsWith(runId + "_")) {
        return await Deno.readTextFile(join(dir, entry.name));
      }
    }
  } catch {
    // ignore
  }
  return null;
}
