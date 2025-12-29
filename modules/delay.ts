// Waits for a specified time.
// Tags: built-in
//
// Usage Example:
// {
//   "module": "delay",
//   "params": { "ms": 1000 }
// }
//
// Returns: { "waited": <ms> }

import type { PipelineContext } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    ms: {
      type: "number",
      required: true,
      description: "Delay duration in milliseconds"
    }
  }
};

export async function run(ctx: PipelineContext, params: { ms: number }): Promise<{ waited: number }> {
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
