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
    cwd: ctx.cwd,
    env: ctx.env,
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();

  // Helper to stream output
  const streamOutput = async (readable: ReadableStream<Uint8Array>, prefix: string = "") => {
    const reader = readable.pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // value can be partial lines, but for simplicity let's log chunks or split lines
        // For better UX, splitting by line is preferred, but simple chunk logging works for "tailing"
        if (ctx.log) {
          // Basic line buffering could be improved, but direct logging is safe enough for now
          const lines = value.split('\n');
          for (const line of lines) {
            if (line) ctx.log(line);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  await Promise.all([
    streamOutput(process.stdout),
    streamOutput(process.stderr, "[ERR] "),
  ]);

  const status = await process.status;

  if (!status.success) {
    throw new Error(`Command failed with code ${status.code}`);
  }

  return { code: status.code };
}
