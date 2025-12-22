// Pipeline repository - CRUD operations for pipeline definitions
// Handles file-based storage of pipeline JSON files

import { ensureDir } from "@std/fs";
import { join, parse } from "@std/path";
import { config } from "./config.ts";
import type { Pipeline } from "./types/index.ts";

const PIPELINES_DIR = config.pipelinesDir;

// Ensure pipelines directory exists
await ensureDir(PIPELINES_DIR);

// Demo pipelines are read-only (cannot be modified or deleted)
const DEMO_PIPELINES = ["demo", "docker-demo"];

export function isDemoPipeline(id: string): boolean {
  return DEMO_PIPELINES.includes(id);
}

export async function loadPipeline(id: string): Promise<Pipeline | null> {
  try {
    const text = await Deno.readTextFile(join(PIPELINES_DIR, `${id}.json`));
    const pipeline = JSON.parse(text);
    pipeline.id = id;
    return pipeline;
  } catch (e) {
    console.error(`Failed to load pipeline ${id}:`, e);
    return null;
  }
}

export async function savePipeline(id: string, pipeline: Omit<Pipeline, "id">): Promise<void> {
  if (isDemoPipeline(id)) {
    throw new Error("Cannot modify demo pipeline");
  }
  await Deno.writeTextFile(
    join(PIPELINES_DIR, `${id}.json`),
    JSON.stringify(pipeline, null, 2)
  );
}

export async function listPipelines(): Promise<Pipeline[]> {
  const pipelines: Pipeline[] = [];
  try {
    for await (const entry of Deno.readDir(PIPELINES_DIR)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const id = parse(entry.name).name;
        const p = await loadPipeline(id);
        if (p) pipelines.push(p);
      }
    }
  } catch (e) {
    console.error("Error listing pipelines:", e);
  }
  return pipelines;
}

export async function deletePipeline(id: string): Promise<void> {
  if (isDemoPipeline(id)) {
    throw new Error("Cannot delete demo pipeline");
  }
  try {
    await Deno.remove(join(PIPELINES_DIR, `${id}.json`));
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
  }
}

