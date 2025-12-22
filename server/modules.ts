import { ensureDir } from "@std/fs";
import { join, parse } from "@std/path";
import { config } from "./config.ts";

const MODULES_DIR = config.modulesDir;

// Ensure modules dir exists
await ensureDir(MODULES_DIR);

export interface StepModule {
  run: (ctx: any, params: any) => Promise<any>;
}

const DEFAULT_MODULES = ["shell", "http", "git", "fs", "delay"];

export function isBuiltInModule(name: string): boolean {
  return DEFAULT_MODULES.includes(name);
}

export interface ModuleInfo {
  id: string;
  description: string;
  fullDocs: string;
  isBuiltIn: boolean;
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

        modules.push({ id: name, description, fullDocs, isBuiltIn: DEFAULT_MODULES.includes(name) });
      }
    }
  } catch (e) {
    console.error("Error listing modules:", e);
  }
  return modules;
}

export async function loadModule(name: string): Promise<StepModule | null> {
  try {
    // Determine absolute path
    const fullPath = join(Deno.cwd(), MODULES_DIR, `${name}.ts`);
    const importUrl = `file://${fullPath}?v=${Date.now()}`; // Cache busting
    const mod = await import(importUrl);

    if (typeof mod.run !== "function") {
      throw new Error(`Module ${name} does not export a 'run' function.`);
    }

    return mod as StepModule;
  } catch (e) {
    console.error(`Failed to load module ${name}:`, e);
    return null;
  }
}

export async function getModuleSource(name: string): Promise<string> {
  return await Deno.readTextFile(join(MODULES_DIR, `${name}.ts`));
}

export async function saveModule(name: string, content: string): Promise<void> {
  const safeName = parse(name).name; // Prevent directory traversal
  await Deno.writeTextFile(join(MODULES_DIR, `${safeName}.ts`), content);
}

export async function deleteModule(name: string): Promise<void> {
  const safeName = parse(name).name;
  if (DEFAULT_MODULES.includes(safeName)) {
    throw new Error("Cannot delete default module.");
  }
  await Deno.remove(join(MODULES_DIR, `${safeName}.ts`));
}
