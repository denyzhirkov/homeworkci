import { Code } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function GitModule() {
  return (
    <ModuleDoc
      id="mod-git"
      icon={<Code fontSize="small" />}
      title="git"
      description="Performs Git operations: clone, pull, commit, push, tag, checkout, branch, status, log, info."
      params={[
        { name: 'op', type: '"clone" | "pull" | "commit" | "push" | "tag" | "checkout" | "branch" | "status" | "log" | "info"', required: true, description: 'Operation type' },
        { name: 'repo', type: 'string', description: 'Repository URL (required for clone)' },
        { name: 'dir', type: 'string', description: 'Target directory' },
        { name: 'message', type: 'string', description: 'Commit message (required for commit)' },
        { name: 'add', type: 'boolean', description: 'Add all changes before commit (for commit)' },
        { name: 'remote', type: 'string', description: 'Remote name (default: origin, for push)' },
        { name: 'branch', type: 'string', description: 'Branch name (for push, checkout, branch)' },
        { name: 'tagName', type: 'string', description: 'Tag name (for tag)' },
        { name: 'tagOp', type: '"create" | "delete"', description: 'Tag operation (for tag, default: create)' },
        { name: 'branchOp', type: '"create" | "delete"', description: 'Branch operation (for branch, default: create)' },
        { name: 'limit', type: 'number', description: 'Number of commits to return (for log, default: 10)' }
      ]}
      returns='clone/pull/commit/push/tag/checkout/branch: { "success": true } or { "skipped": true }. status: Object with branch, clean status, files array. log: Object with commits array. info: Object with branch, commit, author, email, remoteUrl.'
      example={`// Clone repository
{
  "module": "git",
  "params": {
    "op": "clone",
    "repo": "https://github.com/user/repo.git",
    "dir": "./repo"
  }
}

// Commit changes
{
  "module": "git",
  "params": {
    "op": "commit",
    "message": "Update files",
    "add": true
  }
}

// Get repository status
{
  "module": "git",
  "params": {
    "op": "status"
  }
}

// Get commit history
{
  "module": "git",
  "params": {
    "op": "log",
    "limit": 10
  }
}`}
    />
  );
}
