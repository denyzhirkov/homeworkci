// Creates and extracts ZIP archives.
// Tags: built-in
//
// Usage Example (zip):
// {
//   "module": "archive",
//   "params": {
//     "op": "zip",
//     "source": "./dist",
//     "output": "./artifacts/build.zip"
//   }
// }
//
// Usage Example (unzip):
// {
//   "module": "archive",
//   "params": {
//     "op": "unzip",
//     "source": "./build.zip",
//     "output": "./extracted"
//   }
// }
//
// Full params:
// {
//   "module": "archive",
//   "params": {
//     "op": "zip",           // Operation: "zip" or "unzip" (required)
//     "source": "./dist",    // Source path: file or directory (required)
//     "output": "./out.zip"  // Output path (required)
//   }
// }
//
// Returns: { "success": true, "files": 42 }
//
// Usage in Pipeline:
// {
//   "name": "Build and Archive",
//   "steps": [
//     {
//       "name": "clone",
//       "module": "git",
//       "params": { "op": "clone", "repo": "https://github.com/user/app.git", "dir": "./app" }
//     },
//     {
//       "name": "build",
//       "module": "shell",
//       "params": { "cmd": "cd app && npm install && npm run build" }
//     },
//     {
//       "name": "package",
//       "description": "Create ZIP archive of build artifacts",
//       "module": "archive",
//       "params": {
//         "op": "zip",
//         "source": "./app/dist",
//         "output": "./artifacts/build-${pipelineId}.zip"
//       }
//     },
//     {
//       "description": "Log archive result",
//       "module": "shell",
//       "params": { "cmd": "echo 'Archived ${prev.files} files'" }
//     }
//   ]
// }
//
// Note: Paths are relative to the pipeline's sandbox directory.
// Absolute paths are also supported.
// For "zip" operation: source can be a file or directory.
// For "unzip" operation: source must be a ZIP file, output is the extraction directory.

import { ensureDir, walk } from "@std/fs";
import { dirname, join, relative } from "@std/path";
import JSZip from "jszip";
import type { PipelineContext } from "../server/types/index.ts";

export interface ArchiveParams {
  op: "zip" | "unzip";
  source: string;
  output: string;
}

export async function run(
  ctx: PipelineContext,
  params: ArchiveParams
): Promise<{ success: true; files: number }> {
  if (!params.op) {
    throw new Error("Archive module requires 'op' parameter (zip or unzip)");
  }
  if (!params.source) {
    throw new Error("Archive module requires 'source' parameter");
  }
  if (!params.output) {
    throw new Error("Archive module requires 'output' parameter");
  }

  // Resolve paths relative to workDir
  const sourcePath = params.source.startsWith("/")
    ? params.source
    : join(ctx.workDir, params.source);
  const outputPath = params.output.startsWith("/")
    ? params.output
    : join(ctx.workDir, params.output);

  if (params.op === "zip") {
    return await createZip(ctx, sourcePath, outputPath);
  } else if (params.op === "unzip") {
    return await extractZip(ctx, sourcePath, outputPath);
  }

  throw new Error(`Unknown operation: ${params.op}. Use 'zip' or 'unzip'.`);
}

async function createZip(
  ctx: PipelineContext,
  sourcePath: string,
  outputPath: string
): Promise<{ success: true; files: number }> {
  if (ctx.log) ctx.log(`[Archive] Creating ZIP: ${outputPath} from ${sourcePath}`);

  // Check if source exists
  try {
    await Deno.stat(sourcePath);
  } catch {
    throw new Error(`Source path does not exist: ${sourcePath}`);
  }

  const zip = new JSZip();
  let fileCount = 0;

  // Check if source is a file or directory
  const sourceInfo = await Deno.stat(sourcePath);

  if (sourceInfo.isFile) {
    // Single file - add it directly
    const content = await Deno.readFile(sourcePath);
    const fileName = sourcePath.split("/").pop() || "file";
    zip.file(fileName, content);
    fileCount = 1;
    if (ctx.log) ctx.log(`[Archive] Added file: ${fileName}`);
  } else {
    // Directory - walk and add all files
    for await (const entry of walk(sourcePath, { includeDirs: false })) {
      // Check for cancellation
      if (ctx.signal?.aborted) {
        throw new Error("Pipeline stopped by user");
      }

      const relativePath = relative(sourcePath, entry.path);
      const content = await Deno.readFile(entry.path);
      zip.file(relativePath, content);
      fileCount++;

      if (ctx.log && fileCount <= 10) {
        ctx.log(`[Archive] Added: ${relativePath}`);
      } else if (ctx.log && fileCount === 11) {
        ctx.log(`[Archive] ... (more files)`);
      }
    }
  }

  // Ensure output directory exists
  await ensureDir(dirname(outputPath));

  // Generate ZIP and write to file
  const zipContent = await zip.generateAsync({ type: "uint8array" });
  await Deno.writeFile(outputPath, zipContent);

  if (ctx.log) ctx.log(`[Archive] ZIP created: ${fileCount} files, ${zipContent.length} bytes`);

  return { success: true, files: fileCount };
}

async function extractZip(
  ctx: PipelineContext,
  sourcePath: string,
  outputPath: string
): Promise<{ success: true; files: number }> {
  if (ctx.log) ctx.log(`[Archive] Extracting ZIP: ${sourcePath} to ${outputPath}`);

  // Check if source exists
  try {
    await Deno.stat(sourcePath);
  } catch {
    throw new Error(`ZIP file does not exist: ${sourcePath}`);
  }

  // Read ZIP file
  const zipData = await Deno.readFile(sourcePath);
  const zip = await JSZip.loadAsync(zipData);

  // Ensure output directory exists
  await ensureDir(outputPath);

  let fileCount = 0;

  // Extract all files
  for (const [relativePath, file] of Object.entries(zip.files)) {
    // Check for cancellation
    if (ctx.signal?.aborted) {
      throw new Error("Pipeline stopped by user");
    }

    // Skip directories (JSZip includes them as entries)
    if (file.dir) continue;

    const fullPath = join(outputPath, relativePath);

    // Ensure parent directory exists
    await ensureDir(dirname(fullPath));

    // Extract file content
    const content = await file.async("uint8array");
    await Deno.writeFile(fullPath, content);
    fileCount++;

    if (ctx.log && fileCount <= 10) {
      ctx.log(`[Archive] Extracted: ${relativePath}`);
    } else if (ctx.log && fileCount === 11) {
      ctx.log(`[Archive] ... (more files)`);
    }
  }

  if (ctx.log) ctx.log(`[Archive] Extraction complete: ${fileCount} files`);

  return { success: true, files: fileCount };
}

