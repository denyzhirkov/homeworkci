import { ensureDir } from "@std/fs";
import { join, parse } from "@std/path";
import { config } from "./config.ts";

// Re-export types from central types file
export type { StepModule, PipelineContext, ModuleResult, ModuleInfo } from "./types/index.ts";
import type { StepModule, ModuleInfo } from "./types/index.ts";

const MODULES_DIR = config.modulesDir;

// Ensure modules dir exists
await ensureDir(MODULES_DIR);

const DEFAULT_MODULES = ["shell", "http", "git", "fs", "delay", "docker", "docker_remote", "notify", "archive", "ssh", "s3", "json", "pipeline", "queue"];

// Module cache with TTL to prevent memory leaks from cache busting
interface CachedModule {
  module: StepModule;
  loadedAt: number;
  importUrl: string;
}
const moduleCache = new Map<string, CachedModule>();

// Cache TTL in milliseconds (1 minute - allows hot reload during development)
const MODULE_CACHE_TTL = 60 * 1000;

// Maximum cache size to prevent unbounded growth
const MAX_CACHE_SIZE = 50;

export function isBuiltInModule(name: string): boolean {
  return DEFAULT_MODULES.includes(name);
}

export async function listModules(): Promise<ModuleInfo[]> {
  const modules: ModuleInfo[] = [];
  try {
    for await (const entry of Deno.readDir(MODULES_DIR)) {
      if (entry.isFile && entry.name.endsWith(".ts")) {
        const name = parse(entry.name).name;

        let description = "";
        let fullDocs = "";

        try {
          const content = await Deno.readTextFile(join(MODULES_DIR, entry.name));
          const lines = content.split("\n");
          const commentLines: string[] = [];

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("//")) {
              commentLines.push(trimmed.substring(2).trim());
            } else if (trimmed === "") {
              // Allow empty lines in comments block
              continue;
            } else {
              // Stop at first non-comment non-empty line
              break;
            }
          }

          if (commentLines.length > 0) {
            description = commentLines[0];
            fullDocs = commentLines.join("\n");
          }

        } catch (e) { console.error("Error parsing module " + name, e); }

        // Parse tags from "// Tags: tag1, tag2" in comments
        const tagsMatch = fullDocs.match(/^Tags?:\s*(.+)$/mi);
        const tags = tagsMatch
          ? tagsMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(t => t)
          : [];

        modules.push({ id: name, description, fullDocs, isBuiltIn: DEFAULT_MODULES.includes(name), tags });
      }
    }
  } catch (e) {
    console.error("Error listing modules:", e);
  }
  return modules;
}

export async function loadModule(name: string): Promise<StepModule | null> {
  const now = Date.now();

  // Check cache first
  const cached = moduleCache.get(name);
  if (cached && (now - cached.loadedAt) < MODULE_CACHE_TTL) {
    return cached.module;
  }

  try {
    // Determine absolute path (handle both relative and absolute MODULES_DIR)
    const fullPath = MODULES_DIR.startsWith("/")
      ? join(MODULES_DIR, `${name}.ts`)
      : join(Deno.cwd(), MODULES_DIR, `${name}.ts`);

    // Use timestamp for cache busting only when reloading (not on every call)
    const cacheVersion = cached ? now : 0;
    const importUrl = `file://${fullPath}?v=${cacheVersion}`;
    const mod = await import(importUrl);

    if (typeof mod.run !== "function") {
      throw new Error(`Module ${name} does not export a 'run' function.`);
    }

    const stepModule = mod as StepModule;

    // Cleanup old cache entries if at limit
    if (moduleCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, value] of moduleCache) {
        if (value.loadedAt < oldestTime) {
          oldestTime = value.loadedAt;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        moduleCache.delete(oldestKey);
      }
    }

    // Cache the module
    moduleCache.set(name, {
      module: stepModule,
      loadedAt: now,
      importUrl,
    });

    return stepModule;
  } catch (e) {
    console.error(`Failed to load module ${name}:`, e);
    return null;
  }
}

// Invalidate cache for a specific module (call after save/delete)
export function invalidateModuleCache(name: string): void {
  moduleCache.delete(name);
}

// Clear entire module cache
export function clearModuleCache(): void {
  moduleCache.clear();
}

// Get cache stats (for monitoring)
export function getModuleCacheStats(): { size: number; modules: string[] } {
  return {
    size: moduleCache.size,
    modules: Array.from(moduleCache.keys()),
  };
}

export async function getModuleSource(name: string): Promise<string> {
  return await Deno.readTextFile(join(MODULES_DIR, `${name}.ts`));
}

export async function saveModule(name: string, content: string): Promise<void> {
  const safeName = parse(name).name; // Prevent directory traversal
  await Deno.writeTextFile(join(MODULES_DIR, `${safeName}.ts`), content);
  // Invalidate cache so next load gets updated module
  invalidateModuleCache(safeName);
}

export async function deleteModule(name: string): Promise<void> {
  const safeName = parse(name).name;
  if (DEFAULT_MODULES.includes(safeName)) {
    throw new Error("Cannot delete default module.");
  }
  await Deno.remove(join(MODULES_DIR, `${safeName}.ts`));
  // Remove from cache
  invalidateModuleCache(safeName);
}
