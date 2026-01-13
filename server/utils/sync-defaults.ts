// Sync Default Files Utility
// Intelligently syncs default files (pipelines, modules, variables) after updates
// Preserves custom user data while updating built-in files

import { join } from "@std/path";
import { exists } from "@std/fs";
import { config } from "../config.ts";
import { isDemoPipeline, loadPipeline } from "../pipeline-repository.ts";
import { isBuiltInModule } from "../modules.ts";
import { loadVariables, saveVariables, type VariablesConfig } from "../variables.ts";

interface SyncResult {
  pipelines: { updated: string[]; skipped: string[]; errors: string[] };
  modules: { updated: string[]; skipped: string[]; errors: string[] };
  variables: { updated: boolean; error?: string };
}

/**
 * Get path to default files source
 * If REPO_PATH is set, use it; otherwise use defaults directory
 */
function getDefaultsSourcePath(): string | null {
  const repoPath = Deno.env.get("REPO_PATH");
  if (repoPath) {
    // Check if repo is mounted at /app/repo
    const mountedPath = "/app/repo";
    return mountedPath;
  }

  // Fallback to defaults directory in container
  const defaultsPath = "/app/defaults";
  return defaultsPath;
}

/**
 * Check if file exists and read its content
 */
async function readFileIfExists(path: string): Promise<string | null> {
  try {
    if (await exists(path)) {
      return await Deno.readTextFile(path);
    }
  } catch (e) {
    console.error(`Failed to read file ${path}:`, e);
  }
  return null;
}

/**
 * Sync demo pipelines (always update, they are read-only)
 */
async function syncDemoPipelines(
  defaultsPath: string,
  result: SyncResult
): Promise<void> {
  const pipelinesDir = join(defaultsPath, "pipelines");
  const targetDir = config.pipelinesDir;

  const demoPipelines = ["demo", "docker-demo"];

  for (const pipelineId of demoPipelines) {
    try {
      const defaultFile = join(pipelinesDir, `${pipelineId}.json`);
      const defaultContent = await readFileIfExists(defaultFile);

      if (!defaultContent) {
        console.log(`[Sync] Default pipeline ${pipelineId}.json not found, skipping`);
        continue;
      }

      const defaultPipeline = JSON.parse(defaultContent);
      const existingPipeline = await loadPipeline(pipelineId);

      // Always update demo pipelines (they are read-only for users)
      // Update directly via file system (bypassing savePipeline which blocks demo updates)
      const targetFile = join(targetDir, `${pipelineId}.json`);
      // Remove id if present before saving
      const { id: _, ...pipelineData } = defaultPipeline;
      await Deno.writeTextFile(targetFile, JSON.stringify(pipelineData, null, 2));
      result.pipelines.updated.push(pipelineId);
      console.log(`[Sync] ${existingPipeline ? "Updated" : "Created"} demo pipeline: ${pipelineId}`);
    } catch (e) {
      const error = `Failed to sync pipeline ${pipelineId}: ${String(e)}`;
      result.pipelines.errors.push(error);
      console.error(`[Sync] ${error}`);
    }
  }
}

/**
 * Sync built-in modules (update only if not modified by user)
 */
async function syncBuiltInModules(
  defaultsPath: string,
  result: SyncResult
): Promise<void> {
  const modulesDir = join(defaultsPath, "modules");
  const targetDir = config.modulesDir;

  const builtInModules = [
    "shell", "http", "git", "fs", "delay", "docker", "docker_remote", "notify",
    "archive", "ssh", "s3", "json", "pipeline", "queue"
  ];

  for (const moduleName of builtInModules) {
    try {
      const defaultFile = join(modulesDir, `${moduleName}.ts`);
      const defaultContent = await readFileIfExists(defaultFile);

      if (!defaultContent) {
        console.log(`[Sync] Default module ${moduleName}.ts not found, skipping`);
        continue;
      }

      // Check if module exists in target
      const targetFile = join(targetDir, `${moduleName}.ts`);
      const existingContent = await readFileIfExists(targetFile);

      if (!existingContent) {
        // Module doesn't exist, create it
        await Deno.writeTextFile(targetFile, defaultContent);
        result.modules.updated.push(moduleName);
        console.log(`[Sync] Created built-in module: ${moduleName}`);
      } else {
        // Compare content to see if user modified it
        // Simple comparison: if content differs, assume user modified it
        // For safety, we'll update only if content is identical (meaning it's still default)
        // This is conservative - we don't want to overwrite user changes

        // Normalize content for comparison (remove trailing whitespace)
        const normalizedDefault = defaultContent.trim();
        const normalizedExisting = existingContent.trim();

        if (normalizedDefault === normalizedExisting) {
          // Content matches default, safe to update
          await Deno.writeTextFile(targetFile, defaultContent);
          result.modules.updated.push(moduleName);
          console.log(`[Sync] Updated built-in module: ${moduleName}`);
        } else {
          // Content differs - user may have modified it, skip
          result.modules.skipped.push(moduleName);
          console.log(`[Sync] Skipped module ${moduleName} (may have user modifications)`);
        }
      }
    } catch (e) {
      const error = `Failed to sync module ${moduleName}: ${String(e)}`;
      result.modules.errors.push(error);
      console.error(`[Sync] ${error}`);
    }
  }
}

/**
 * Sync variables using merge strategy
 * Preserves user values, adds new fields from defaults
 */
async function syncVariables(
  defaultsPath: string,
  result: SyncResult
): Promise<void> {
  try {
    const defaultFile = join(defaultsPath, "config", "variables.json");
    const defaultContent = await readFileIfExists(defaultFile);

    if (!defaultContent) {
      console.log(`[Sync] Default variables.json not found, skipping`);
      return;
    }

    const defaultVars: VariablesConfig = JSON.parse(defaultContent);
    const existingVars = await loadVariables();

    // Merge strategy: user values take priority
    const merged: VariablesConfig = {
      global: {
        ...defaultVars.global,
        ...existingVars.global, // User values override defaults
      },
      environments: {
        ...defaultVars.environments,
        ...existingVars.environments, // User environments override defaults
      },
      sshKeys: existingVars.sshKeys || defaultVars.sshKeys || {},
    };

    // Only update if there are actual changes
    const existingJson = JSON.stringify(existingVars, null, 2);
    const mergedJson = JSON.stringify(merged, null, 2);

    if (existingJson !== mergedJson) {
      await saveVariables(merged);
      result.variables.updated = true;
      console.log(`[Sync] Updated variables.json (merged with defaults)`);
    } else {
      console.log(`[Sync] Variables.json already up to date`);
    }
  } catch (e) {
    result.variables.error = String(e);
    console.error(`[Sync] Failed to sync variables:`, e);
  }
}

/**
 * Sync all default files
 * Returns summary of what was updated
 */
export async function syncDefaultFiles(repoPath?: string): Promise<SyncResult> {
  const result: SyncResult = {
    pipelines: { updated: [], skipped: [], errors: [] },
    modules: { updated: [], skipped: [], errors: [] },
    variables: { updated: false },
  };

  // Determine source path
  let defaultsPath = getDefaultsSourcePath();

  // If repoPath is provided, use it (for explicit sync from specific repo)
  if (repoPath) {
    defaultsPath = repoPath;
  }

  if (!defaultsPath) {
    console.log(`[Sync] No defaults source available, skipping sync`);
    return result;
  }

  // Check if source exists
  try {
    if (!(await exists(defaultsPath))) {
      console.log(`[Sync] Defaults source ${defaultsPath} does not exist, skipping sync`);
      return result;
    }
  } catch (e) {
    console.error(`[Sync] Failed to check defaults source:`, e);
    return result;
  }

  console.log(`[Sync] Starting sync from ${defaultsPath}`);

  // Sync pipelines
  await syncDemoPipelines(defaultsPath, result);

  // Sync modules
  await syncBuiltInModules(defaultsPath, result);

  // Sync variables
  await syncVariables(defaultsPath, result);

  console.log(`[Sync] Sync completed`);
  console.log(`[Sync] Pipelines: ${result.pipelines.updated.length} updated, ${result.pipelines.skipped.length} skipped, ${result.pipelines.errors.length} errors`);
  console.log(`[Sync] Modules: ${result.modules.updated.length} updated, ${result.modules.skipped.length} skipped, ${result.modules.errors.length} errors`);
  console.log(`[Sync] Variables: ${result.variables.updated ? "updated" : "no changes"}`);

  return result;
}
