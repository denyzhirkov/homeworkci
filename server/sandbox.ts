// Sandbox directory management for pipeline execution
// Each pipeline run gets an isolated temporary directory

import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { config } from "./config.ts";

const SANDBOX_DIR = config.sandboxDir;

// Ensure sandbox root exists
await ensureDir(SANDBOX_DIR);

/**
 * Creates an isolated sandbox directory for a pipeline run.
 * Path: ./tmp/{pipelineId}/{runId}/
 */
export async function createSandbox(pipelineId: string, runId: string): Promise<string> {
  const sandboxPath = join(SANDBOX_DIR, pipelineId, runId);
  await ensureDir(sandboxPath);
  return sandboxPath;
}

/**
 * Cleans up the sandbox directory after pipeline completion.
 * Removes all files and the directory itself.
 */
export async function cleanupSandbox(sandboxPath: string, log?: (msg: string) => void): Promise<void> {
  try {
    await Deno.remove(sandboxPath, { recursive: true });
    log?.(`[Sandbox] Cleaned up working directory: ${sandboxPath}`);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      log?.(`[Sandbox] Warning: Failed to cleanup ${sandboxPath}: ${e}`);
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

