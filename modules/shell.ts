// Executes a shell command.
//
// Usage Example:
// {
//   "module": "shell",
//   "params": {
//     "cmd": "echo 'Hello World'"
//   }
// }
//
// Returns: { "code": 0, "output": "Hello World" }

export async function run(ctx: any, params: { cmd: string }) {
  if (ctx.log) ctx.log(`[Shell] Executing: ${params.cmd}`);

  const command = new Deno.Command("sh", {
    args: ["-c", params.cmd],
    cwd: ctx.workDir, // Use sandboxed working directory for isolation
    env: ctx.env,
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();

  // Handle abort signal - kill process when pipeline is stopped
  const abortHandler = () => {
    if (ctx.log) ctx.log(`[Shell] Process killed by user`);
    try {
      process.kill("SIGTERM");
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
        if (ctx.log) {
          const lines = value.split('\n');
          for (const line of lines) {
            if (line) ctx.log(prefix + line);
          }
        }
      }
    } catch (e: any) {
      // Ignore read errors if aborted
      if (ctx.signal?.aborted) return;
      throw e;
    } finally {
      reader.releaseLock();
    }
  };

  try {
    await Promise.all([
      streamOutput(process.stdout),
      streamOutput(process.stderr, "[ERR] "),
    ]);

    const status = await process.status;

    // Remove abort listener if process finished normally
    if (ctx.signal) {
      ctx.signal.removeEventListener("abort", abortHandler);
    }

    // Check if we were aborted
    if (ctx.signal?.aborted) {
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
    
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}
