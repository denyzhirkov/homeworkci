// Git operations.
// Tags: built-in
//
// Usage Examples:
// Clone repository:
// {
//   "module": "git",
//   "params": {
//     "op": "clone",
//     "repo": "https://github.com/user/repo.git",
//     "dir": "./repo"
//   }
// }
//
// Commit changes:
// {
//   "module": "git",
//   "params": {
//     "op": "commit",
//     "message": "Update files",
//     "add": true
//   }
// }
//
// Push to remote:
// {
//   "module": "git",
//   "params": {
//     "op": "push",
//     "remote": "origin",
//     "branch": "main"
//   }
// }
//
// Get repository status:
// {
//   "module": "git",
//   "params": {
//     "op": "status"
//   }
// }
//
// Returns: { "success": true }, { "skipped": true }, or data object for status/log/info

import type { PipelineContext, ModuleResult } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    op: {
      type: "string",
      required: true,
      enum: ["clone", "pull", "commit", "push", "tag", "checkout", "branch", "status", "log", "info"],
      description: "Git operation to perform"
    },
    repo: {
      type: "string",
      required: false,
      description: "Repository URL (required for clone)",
      visibleWhen: { param: "op", equals: "clone" }
    },
    dir: {
      type: "string",
      required: false,
      description: "Target directory for clone, defaults to repo name"
    },
    message: {
      type: "string",
      required: false,
      description: "Commit message (required for commit)",
      visibleWhen: { param: "op", equals: "commit" }
    },
    add: {
      type: "boolean",
      required: false,
      default: false,
      description: "Add all changes before commit",
      visibleWhen: { param: "op", equals: "commit" }
    },
    remote: {
      type: "string",
      required: false,
      default: "origin",
      description: "Remote name (for push)",
      visibleWhen: { param: "op", equals: "push" }
    },
    branch: {
      type: "string",
      required: false,
      description: "Branch name (for push, checkout, branch operations)",
      visibleWhen: { param: "op", equals: ["push", "checkout", "branch"] }
    },
    tagName: {
      type: "string",
      required: false,
      description: "Tag name (for tag operations)",
      visibleWhen: { param: "op", equals: "tag" }
    },
    tagOp: {
      type: "string",
      required: false,
      enum: ["create", "delete"],
      default: "create",
      description: "Tag operation: create or delete",
      visibleWhen: { param: "op", equals: "tag" }
    },
    branchOp: {
      type: "string",
      required: false,
      enum: ["create", "delete"],
      default: "create",
      description: "Branch operation: create or delete",
      visibleWhen: { param: "op", equals: "branch" }
    },
    limit: {
      type: "number",
      required: false,
      default: 10,
      description: "Number of commits to return (for log)",
      visibleWhen: { param: "op", equals: "log" }
    }
  }
};

interface GitParams {
  op: "clone" | "pull" | "commit" | "push" | "tag" | "checkout" | "branch" | "status" | "log" | "info";
  repo?: string;
  dir?: string;
  message?: string;
  add?: boolean;
  remote?: string;
  branch?: string;
  tagName?: string;
  tagOp?: "create" | "delete";
  branchOp?: "create" | "delete";
  limit?: number;
}

export async function run(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  if (ctx.signal?.aborted) {
    throw new Error("Pipeline stopped by user");
  }

  switch (params.op) {
    case "clone":
      return await handleClone(ctx, params);
    case "pull":
      return await handlePull(ctx, params);
    case "commit":
      return await handleCommit(ctx, params);
    case "push":
      return await handlePush(ctx, params);
    case "tag":
      return await handleTag(ctx, params);
    case "checkout":
      return await handleCheckout(ctx, params);
    case "branch":
      return await handleBranch(ctx, params);
    case "status":
      return await handleStatus(ctx, params);
    case "log":
      return await handleLog(ctx, params);
    case "info":
      return await handleInfo(ctx, params);
    default:
      throw new Error(`Unknown git operation: ${params.op}`);
  }
}

// Helper: Execute git command and return output
async function execGit(
  ctx: PipelineContext,
  args: string[],
  cwd?: string
): Promise<{ success: boolean; stdout: string; stderr: string; code: number }> {
  if (ctx.log) ctx.log(`[Git] Executing: git ${args.join(" ")}`);

  const cmd = new Deno.Command("git", {
    args,
    cwd: cwd || ctx.workDir,
    stdout: "piped",
    stderr: "piped",
    env: ctx.env,
  });

  const process = cmd.spawn();
  let killed = false;

  const abortHandler = () => {
    if (killed) return;
    killed = true;
    if (ctx.log) ctx.log(`[Git] Stopping git command...`);
    try {
      process.kill("SIGKILL");
    } catch {
      // Process may have already exited
    }
  };

  if (ctx.signal) {
    ctx.signal.addEventListener("abort", abortHandler, { once: true });
  }

  try {
    const { code, stdout, stderr } = await process.output();

    if (ctx.signal) {
      ctx.signal.removeEventListener("abort", abortHandler);
    }

    if (ctx.signal?.aborted || killed) {
      throw new Error("Pipeline stopped by user");
    }

    const stdoutText = new TextDecoder().decode(stdout);
    const stderrText = new TextDecoder().decode(stderr);

    // Log stderr if present (git often uses stderr for info)
    if (stderrText && ctx.log) {
      const lines = stderrText.split("\n").filter(l => l.trim());
      for (const line of lines) {
        ctx.log(`[Git] ${line}`);
      }
    }

    return {
      success: code === 0,
      stdout: stdoutText,
      stderr: stderrText,
      code,
    };
  } catch (e: unknown) {
    if (ctx.signal) {
      ctx.signal.removeEventListener("abort", abortHandler);
    }
    if (ctx.signal?.aborted || killed) {
      throw new Error("Pipeline stopped by user");
    }
    throw e;
  }
}

async function handleClone(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  if (!params.repo) throw new Error("Repo URL required for clone");
  
  const result = await execGit(ctx, ["clone", params.repo, ...(params.dir ? [params.dir] : [])]);
  
  if (!result.success) {
    throw new Error(`Git clone failed: ${result.stderr || `exit code ${result.code}`}`);
  }
  
  return { success: true };
}

async function handlePull(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  const result = await execGit(ctx, ["pull"], params.dir);
  
  if (!result.success) {
    throw new Error(`Git pull failed: ${result.stderr || `exit code ${result.code}`}`);
  }
  
  return { success: true };
}

async function handleCommit(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  if (!params.message) throw new Error("Commit message required");
  
  // Add all changes if requested
  if (params.add) {
    const addResult = await execGit(ctx, ["add", "-A"], params.dir);
    if (!addResult.success) {
      throw new Error(`Git add failed: ${addResult.stderr || `exit code ${addResult.code}`}`);
    }
  }
  
  const result = await execGit(ctx, ["commit", "-m", params.message], params.dir);
  
  if (!result.success) {
    // Check if there's nothing to commit
    if (result.stderr.includes("nothing to commit")) {
      if (ctx.log) ctx.log("[Git] Nothing to commit");
      return { skipped: true };
    }
    throw new Error(`Git commit failed: ${result.stderr || `exit code ${result.code}`}`);
  }
  
  return { success: true };
}

async function handlePush(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  const remote = params.remote || "origin";
  if (!params.branch) throw new Error("Branch name required for push");
  
  const result = await execGit(ctx, ["push", remote, params.branch], params.dir);
  
  if (!result.success) {
    throw new Error(`Git push failed: ${result.stderr || `exit code ${result.code}`}`);
  }
  
  return { success: true };
}

async function handleTag(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  if (!params.tagName) throw new Error("Tag name required");
  
  const op = params.tagOp || "create";
  const args = op === "delete" ? ["tag", "-d", params.tagName] : ["tag", params.tagName];
  
  const result = await execGit(ctx, args, params.dir);
  
  if (!result.success) {
    throw new Error(`Git tag ${op} failed: ${result.stderr || `exit code ${result.code}`}`);
  }
  
  return { success: true };
}

async function handleCheckout(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  if (!params.branch) throw new Error("Branch name required for checkout");
  
  const result = await execGit(ctx, ["checkout", params.branch], params.dir);
  
  if (!result.success) {
    throw new Error(`Git checkout failed: ${result.stderr || `exit code ${result.code}`}`);
  }
  
  return { success: true };
}

async function handleBranch(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  if (!params.branch) throw new Error("Branch name required");
  
  const op = params.branchOp || "create";
  const args = op === "delete" ? ["branch", "-d", params.branch] : ["branch", params.branch];
  
  const result = await execGit(ctx, args, params.dir);
  
  if (!result.success) {
    throw new Error(`Git branch ${op} failed: ${result.stderr || `exit code ${result.code}`}`);
  }
  
  return { success: true };
}

async function handleStatus(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  const result = await execGit(ctx, ["status", "--porcelain"], params.dir);
  
  if (!result.success) {
    throw new Error(`Git status failed: ${result.stderr || `exit code ${result.code}`}`);
  }
  
  // Parse porcelain status output
  const lines = result.stdout.trim().split("\n").filter(l => l.trim());
  const files: Array<{ status: string; file: string }> = [];
  
  for (const line of lines) {
    if (line.length >= 3) {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3).trim();
      files.push({ status, file });
    }
  }
  
  // Get branch info
  const branchResult = await execGit(ctx, ["branch", "--show-current"], params.dir);
  const currentBranch = branchResult.success ? branchResult.stdout.trim() : null;
  
  return {
    branch: currentBranch,
    clean: files.length === 0,
    files: files,
    modified: files.filter(f => f.status.includes("M")).length,
    added: files.filter(f => f.status.includes("A") || f.status === "??").length,
    deleted: files.filter(f => f.status.includes("D")).length,
  };
}

async function handleLog(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  const limit = params.limit || 10;
  
  // Use --pretty=format for structured output
  const format = "%H|%an|%ae|%ad|%s";
  const dateFormat = "%Y-%m-%d %H:%M:%S";
  const result = await execGit(
    ctx,
    ["log", `--pretty=format:${format}`, `--date=format:${dateFormat}`, `-n`, String(limit)],
    params.dir
  );
  
  if (!result.success) {
    throw new Error(`Git log failed: ${result.stderr || `exit code ${result.code}`}`);
  }
  
  const commits: Array<{
    hash: string;
    author: string;
    email: string;
    date: string;
    message: string;
  }> = [];
  
  const lines = result.stdout.trim().split("\n").filter(l => l.trim());
  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length >= 5) {
      commits.push({
        hash: parts[0],
        author: parts[1],
        email: parts[2],
        date: parts[3],
        message: parts.slice(4).join("|"), // Message might contain |
      });
    }
  }
  
  return {
    commits: commits,
    count: commits.length,
  };
}

async function handleInfo(ctx: PipelineContext, params: GitParams): Promise<ModuleResult> {
  // Get current branch
  const branchResult = await execGit(ctx, ["branch", "--show-current"], params.dir);
  const branch = branchResult.success ? branchResult.stdout.trim() : null;
  
  // Get current commit hash
  const commitResult = await execGit(ctx, ["rev-parse", "HEAD"], params.dir);
  const commit = commitResult.success ? commitResult.stdout.trim() : null;
  
  // Get commit short hash
  const shortCommitResult = await execGit(ctx, ["rev-parse", "--short", "HEAD"], params.dir);
  const shortCommit = shortCommitResult.success ? shortCommitResult.stdout.trim() : null;
  
  // Get author of last commit
  const authorResult = await execGit(ctx, ["log", "-1", "--pretty=format:%an|%ae"], params.dir);
  let author = null;
  let email = null;
  if (authorResult.success) {
    const parts = authorResult.stdout.trim().split("|");
    if (parts.length >= 2) {
      author = parts[0];
      email = parts[1];
    }
  }
  
  // Get remote URL
  const remoteResult = await execGit(ctx, ["config", "--get", "remote.origin.url"], params.dir);
  const remoteUrl = remoteResult.success ? remoteResult.stdout.trim() : null;
  
  return {
    branch: branch,
    commit: commit,
    shortCommit: shortCommit,
    author: author,
    email: email,
    remoteUrl: remoteUrl,
  };
}
