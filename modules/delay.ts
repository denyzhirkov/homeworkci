// Waits for a specified time.
//
// Usage Example:
// {
//   "module": "delay",
//   "params": { "ms": 1000 }
// }

export async function run(ctx: any, params: { ms: number }) {
  console.log(`[Delay] Sleeping for ${params.ms}ms...`);
  
  // Support cancellation via AbortSignal
  if (ctx.signal) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve({ waited: params.ms }), params.ms);
      
      ctx.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new Error("Pipeline stopped by user"));
      }, { once: true });
    });
  }
  
  await new Promise(r => setTimeout(r, params.ms));
  return { waited: params.ms };
}
