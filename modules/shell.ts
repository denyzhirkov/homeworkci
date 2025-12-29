// Executes a shell command.
// Tags: built-in
//
// Usage Example:
// {
//   "module": "shell",
//   "params": {
//     "cmd": "echo 'Hello World'"
//   }
// }
//
// Returns: { "code": 0 }

import type { PipelineContext } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    cmd: {
      type: "string",
      required: true,
      description: "Shell command to execute. Supports pipes, && and ; operators."
    }
  }
};

export async function run(ctx: PipelineContext, params: { cmd: string }): Promise<{ code: number }> {
  if (ctx.log) ctx.log(`[Shell] Executing: ${params.cmd}`);

  // Wrap command with exec so SIGKILL kills the actual command, not just the shell
  // For simple commands, exec replaces the shell process
  // For complex commands (pipes, etc.), we prepend exec to ensure proper signal handling
  const wrappedCmd = params.cmd.includes("|") || params.cmd.includes("&&") || params.cmd.includes(";")
    ? params.cmd  // Complex command - can't use exec
    : `exec ${params.cmd}`;  // Simple command - use exec to replace shell
  
  const command = new Deno.Command("sh", {
    args: ["-c", wrappedCmd],
    cwd: ctx.workDir, // Use sandboxed working directory for isolation
    env: ctx.env,
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();
  let killed = false;

  // Handle abort signal - kill process when pipeline is stopped
  const abortHandler = () => {
    if (killed) return;
    killed = true;
    
    if (ctx.log) ctx.log(`[Shell] Stopping process...`);
    try {
      // Use SIGKILL to ensure immediate termination (SIGTERM may be ignored)
      process.kill("SIGKILL");
      if (ctx.log) ctx.log(`[Shell] Process killed by user`);
    } catch {
      // Process may have already exited
    }
  };

  if (ctx.signal) {
    ctx.signal.addEventListener("abort", abortHandler, { once: true });
  }

  // Helper to stream output
  const streamOutput = async (readable: ReadableStream<Uint8Array>, prefix: string = "") => {
    const reader = readable.pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Stop logging if killed
        if (killed) break;
        if (ctx.log) {
          const lines = value.split('\n');
          for (const line of lines) {
            if (line) ctx.log(prefix + line);
          }
        }
      }
    } catch (e: any) {
      // Ignore read errors if aborted/killed
      if (ctx.signal?.aborted || killed) return;
      throw e;
    } finally {
      reader.releaseLock();
    }
  };

  try {
    // Start streaming but don't wait for completion
    const streamPromise = Promise.all([
      streamOutput(process.stdout),
      streamOutput(process.stderr, "[ERR] "),
    ]);

    // Wait for process to complete
    const status = await process.status;

    // Wait for streams to finish
    await streamPromise.catch(() => {});

    // Remove abort listener if process finished normally
    if (ctx.signal) {
      ctx.signal.removeEventListener("abort", abortHandler);
    }

    // Check if we were aborted
    if (ctx.signal?.aborted || killed) {
      throw new Error("Pipeline stopped by user");
    }

    if (!status.success) {
      throw new Error(`Command failed with code ${status.code}`);
    }

    return { code: status.code };
  } catch (e: any) {
    // Remove abort listener on error
    if (ctx.signal) {
      ctx.signal.removeEventListener("abort", abortHandler);
    }
    
    if (ctx.signal?.aborted || killed) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}
