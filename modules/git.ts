// Git operations.
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

export async function run(ctx: any, params: { op: "clone" | "pull"; repo?: string; dir?: string }) {
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
