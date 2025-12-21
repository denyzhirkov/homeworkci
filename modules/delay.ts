// Waits for a specified time.
//
// Usage Example:
// {
//   "module": "delay",
//   "params": { "ms": 1000 }
// }

export async function run(ctx: any, params: { ms: number }) {
  console.log(`[Delay] Sleeping for ${params.ms}ms...`);
  await new Promise(r => setTimeout(r, params.ms));
  return { waited: params.ms };
}
