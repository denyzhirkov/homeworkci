// Git operations.
// Tags: built-in
//
// Usage Example:
// {
//   "module": "git",
//   "params": {
//     "op": "clone",
//     "repo": "https://github.com/user/repo.git",
//     "dir": "./repo"
//   }
// }
//
// Returns: { "success": true } or { "skipped": true }

import type { PipelineContext } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    op: {
      type: "string",
      required: true,
      enum: ["clone", "pull"],
      description: "Git operation to perform"
    },
    repo: {
      type: "string",
      required: false,
      description: "Repository URL (required for clone)"
    },
    dir: {
      type: "string",
      required: false,
      description: "Target directory for clone, defaults to repo name"
    }
  }
};

export async function run(ctx: PipelineContext, params: { op: "clone" | "pull"; repo?: string; dir?: string }): Promise<{ success: true } | { skipped: true }> {
  if (params.op === "clone") {
    if (!params.repo) throw new Error("Repo URL required");
    const cmd = new Deno.Command("git", {
      args: ["clone", params.repo, params.dir || ""],
      cwd: ctx.workDir,
    });
    await cmd.output();
    return { success: true };
  }
  // ... other ops
  return { skipped: true };
}
