// Wait for conditions to be met.
// Tags: built-in
//
// Usage Examples:
// Wait for HTTP endpoint:
// {
//   "module": "wait",
//   "params": {
//     "op": "http",
//     "url": "https://api.example.com/health",
//     "timeout": 30000,
//     "interval": 1000
//   }
// }
//
// Wait for file:
// {
//   "module": "wait",
//   "params": {
//     "op": "file",
//     "path": "./output.txt",
//     "timeout": 60000
//   }
// }
//
// Wait for process:
// {
//   "module": "wait",
//   "params": {
//     "op": "process",
//     "pid": 12345,
//     "timeout": 30000
//   }
// }
//
// Returns: { "success": true, "waited": <ms>, "attempts": <number>, "operation": <string> }

import type { PipelineContext, ModuleResult } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    op: {
      type: "string",
      required: true,
      enum: ["http", "file", "process"],
      description: "Wait operation type: http (wait for HTTP endpoint), file (wait for file to exist), process (wait for process to finish)"
    },
    // HTTP operation parameters
    url: {
      type: "string",
      required: false,
      description: "HTTP endpoint URL (required for http operation). Supports interpolation: ${env.API_URL}/health",
      visibleWhen: { param: "op", equals: "http" }
    },
    method: {
      type: "string",
      required: false,
      default: "GET",
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
      description: "HTTP method (for http operation)",
      visibleWhen: { param: "op", equals: "http" }
    },
    expectedStatus: {
      type: "number",
      required: false,
      default: 200,
      description: "Expected HTTP status code (for http operation)",
      visibleWhen: { param: "op", equals: "http" }
    },
    headers: {
      type: "object",
      required: false,
      description: "Custom HTTP headers (for http operation)",
      visibleWhen: { param: "op", equals: "http" }
    },
    // File operation parameters
    path: {
      type: "string",
      required: false,
      description: "File path to wait for (required for file operation). Relative to sandbox or absolute path.",
      visibleWhen: { param: "op", equals: "file" }
    },
    // Process operation parameters
    pid: {
      type: "number",
      required: false,
      description: "Process ID to wait for (required for process operation)",
      visibleWhen: { param: "op", equals: "process" }
    },
    // Common parameters
    timeout: {
      type: "number",
      required: false,
      default: 60000,
      description: "Maximum wait time in milliseconds (default: 60000)"
    },
    interval: {
      type: "number",
      required: false,
      default: 1000,
      description: "Polling interval in milliseconds (default: 1000, minimum: 100)"
    },
    retries: {
      type: "number",
      required: false,
      description: "Maximum number of attempts (alternative to timeout). If set, timeout is ignored."
    }
  }
};

interface WaitResult {
  success: true;
  waited: number;
  attempts: number;
  operation: string;
}

interface PollOptions {
  timeout: number;
  interval: number;
  retries?: number;
  signal?: AbortSignal;
  log?: (msg: string) => void;
}

/**
 * Poll until condition is met or timeout/retries exceeded
 */
async function pollUntil(
  checkCondition: () => Promise<boolean>,
  options: PollOptions
): Promise<{ success: boolean; attempts: number; elapsed: number }> {
  const { timeout, interval, retries, signal, log } = options;
  const startTime = Date.now();
  let attempts = 0;
  const minInterval = 100;
  const actualInterval = Math.max(interval, minInterval);

  // Determine if we use timeout or retries
  const useRetries = retries !== undefined && retries > 0;
  const maxTime = useRetries ? Infinity : timeout;

  while (true) {
    // Check for abort signal
    if (signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }

    // Check timeout
    const elapsed = Date.now() - startTime;
    if (!useRetries && elapsed >= maxTime) {
      throw new Error(`Timeout after ${elapsed}ms (${attempts} attempts)`);
    }

    // Check retries limit
    if (useRetries && attempts >= retries) {
      throw new Error(`Max retries exceeded (${attempts} attempts)`);
    }

    attempts++;

    try {
      const conditionMet = await checkCondition();
      if (conditionMet) {
        const totalElapsed = Date.now() - startTime;
        if (log) {
          log(`[Wait] Condition met after ${totalElapsed}ms (${attempts} attempts)`);
        }
        return { success: true, attempts, elapsed: totalElapsed };
      }
    } catch (e: any) {
      // For network errors and file errors, continue polling
      // Only throw if it's an abort signal
      if (signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }
      // Log error but continue
      if (log) {
        log(`[Wait] Attempt ${attempts} failed: ${e.message || String(e)}`);
      }
    }

    // Wait before next attempt (unless condition was met)
    if (attempts < (useRetries ? retries! : Infinity)) {
      // Check timeout again before waiting
      const currentElapsed = Date.now() - startTime;
      if (!useRetries && currentElapsed >= maxTime) {
        throw new Error(`Timeout after ${currentElapsed}ms (${attempts} attempts)`);
      }

      // Wait for interval, but respect abort signal
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(resolve, actualInterval);

        if (signal) {
          signal.addEventListener("abort", () => {
            clearTimeout(timeoutId);
            reject(new Error("Pipeline stopped by user"));
          }, { once: true });
        }
      });
    }
  }
}

/**
 * Wait for HTTP endpoint to be available
 */
async function waitForHttp(
  ctx: PipelineContext,
  params: { url?: string; method?: string; expectedStatus?: number; headers?: Record<string, string>; timeout?: number; interval?: number; retries?: number }
): Promise<WaitResult> {
  const { url, method = "GET", expectedStatus = 200, headers, timeout = 60000, interval = 1000, retries } = params;

  if (!url) {
    throw new Error("URL is required for http operation");
  }

  if (ctx.log) {
    ctx.log(`[Wait] Waiting for HTTP ${method} ${url} to return status ${expectedStatus}...`);
  }

  const result = await pollUntil(
    async () => {
      try {
        const response = await fetch(url, {
          method,
          headers: headers || {},
          signal: ctx.signal,
        });
        return response.status === expectedStatus;
      } catch (e: any) {
        // Network errors - continue polling
        if (ctx.signal?.aborted) {
          throw e;
        }
        return false;
      }
    },
    {
      timeout,
      interval,
      retries,
      signal: ctx.signal,
      log: ctx.log,
    }
  );

  return {
    success: true,
    waited: result.elapsed,
    attempts: result.attempts,
    operation: "http",
  };
}

/**
 * Wait for file to exist
 */
async function waitForFile(
  ctx: PipelineContext,
  params: { path?: string; timeout?: number; interval?: number; retries?: number }
): Promise<WaitResult> {
  const { path, timeout = 60000, interval = 1000, retries } = params;

  if (!path) {
    throw new Error("Path is required for file operation");
  }

  // Resolve path relative to workDir if not absolute
  const filePath = path.startsWith("/") ? path : `${ctx.workDir}/${path}`;

  if (ctx.log) {
    ctx.log(`[Wait] Waiting for file: ${filePath}...`);
  }

  const result = await pollUntil(
    async () => {
      try {
        await Deno.stat(filePath);
        return true; // File exists
      } catch {
        return false; // File doesn't exist yet
      }
    },
    {
      timeout,
      interval,
      retries,
      signal: ctx.signal,
      log: ctx.log,
    }
  );

  return {
    success: true,
    waited: result.elapsed,
    attempts: result.attempts,
    operation: "file",
  };
}

/**
 * Wait for process to finish (check if process exists)
 */
async function waitForProcess(
  ctx: PipelineContext,
  params: { pid?: number; timeout?: number; interval?: number; retries?: number }
): Promise<WaitResult> {
  const { pid, timeout = 60000, interval = 1000, retries } = params;

  if (pid === undefined || pid === null) {
    throw new Error("PID is required for process operation");
  }

  if (ctx.log) {
    ctx.log(`[Wait] Waiting for process ${pid} to finish...`);
  }

  // Use shell command to check if process exists
  // kill -0 <pid> returns 0 if process exists, non-zero if it doesn't
  const result = await pollUntil(
    async () => {
      try {
        const command = new Deno.Command("sh", {
          args: ["-c", `kill -0 ${pid} 2>/dev/null || exit 1`],
          cwd: ctx.workDir,
          stdout: "piped",
          stderr: "piped",
        });

        const process = command.spawn();
        const status = await process.status;

        // If kill -0 succeeds (exit code 0), process still exists
        // We want to wait until it doesn't exist (exit code != 0)
        return !status.success;
      } catch {
        // If command fails, assume process doesn't exist
        return true;
      }
    },
    {
      timeout,
      interval,
      retries,
      signal: ctx.signal,
      log: ctx.log,
    }
  );

  return {
    success: true,
    waited: result.elapsed,
    attempts: result.attempts,
    operation: "process",
  };
}

export async function run(
  ctx: PipelineContext,
  params: {
    op: "http" | "file" | "process";
    url?: string;
    method?: string;
    expectedStatus?: number;
    headers?: Record<string, string>;
    path?: string;
    pid?: number;
    timeout?: number;
    interval?: number;
    retries?: number;
  }
): Promise<ModuleResult> {
  const { op } = params;

  if (!op) {
    throw new Error("Operation 'op' is required");
  }

  // Validate interval is reasonable
  const interval = params.interval ?? 1000;
  if (interval < 100) {
    throw new Error("Interval must be at least 100ms");
  }

  switch (op) {
    case "http":
      return await waitForHttp(ctx, params);
    case "file":
      return await waitForFile(ctx, params);
    case "process":
      return await waitForProcess(ctx, params);
    default:
      throw new Error(`Unknown operation: ${op}`);
  }
}
