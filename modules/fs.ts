// File system operations.
//
// Usage Examples:
// Read:
// { "module": "fs", "params": { "op": "read", "path": "./config.json" } }
//
// Write:
// { "module": "fs", "params": { "op": "write", "path": "./out.txt", "content": "data" } }

import { ensureDir } from "@std/fs";
import { dirname } from "@std/path";

export async function run(ctx: any, params: { op: "read" | "write"; path: string; content?: string }) {
  if (params.op === "read") {
    return await Deno.readTextFile(params.path);
  } else if (params.op === "write") {
    if (params.content === undefined) throw new Error("Content required for write");
    await ensureDir(dirname(params.path));
    await Deno.writeTextFile(params.path, params.content);
    return { success: true };
  }
  throw new Error(`Unknown op: ${params.op}`);
}
