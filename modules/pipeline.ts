// Run another pipeline as a step.
// Tags: built-in
//
// Usage Example:
// {
//   "module": "pipeline",
//   "params": {
//     "pipelineId": "build-and-test",
//     "inputs": {
//       "version": "${results.build.version}",
//       "environment": "${inputs.env}"
//     },
//     "failOnError": true
//   }
// }
//
// Returns: { "success": true, "runId": "...", "duration": 1234, "result": ... }
//
// Full params:
// {
//   "module": "pipeline",
//   "params": {
//     "pipelineId": "child-pipeline-id",  // ID of pipeline to run (required)
//     "inputs": {                           // Input parameters for child pipeline (optional)
//       "param1": "value1",
//       "param2": "${results.stepName.field}"
//     },
//     "failOnError": true                   // Stop parent pipeline if child fails (optional, default: true)
//   }
// }
//
// Returns:
// - On success: { "success": true, "runId": "...", "duration": 1234, "result": ... }
// - On failure with failOnError: false: { "success": false, "runId": "", "duration": 0, "error": "..." }
//
// Note: Child pipeline runs in its own isolated sandbox. Results from child pipeline
// can be accessed via ${prev} or ${results.stepName} in subsequent steps.

import type { PipelineContext, ModuleResult } from "../server/types/index.ts";
import { runPipeline, loadPipeline } from "../server/engine.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    pipelineId: {
      type: "string",
      required: true,
      description: "ID of pipeline to run as a child pipeline"
    },
    inputs: {
      type: "object",
      required: false,
      description: "Input parameters to pass to child pipeline. Supports interpolation: ${results.stepName.field}"
    },
    failOnError: {
      type: "boolean",
      required: false,
      default: true,
      description: "Stop parent pipeline if child pipeline fails. If false, returns error in result instead of throwing"
    }
  }
};

export async function run(
  ctx: PipelineContext,
  params: { pipelineId: string; inputs?: Record<string, string | boolean>; failOnError?: boolean }
): Promise<ModuleResult> {
  const { pipelineId, inputs, failOnError = true } = params;

  // Validate pipelineId
  if (!pipelineId || typeof pipelineId !== "string") {
    throw new Error("Pipeline module requires 'pipelineId' parameter");
  }

  // Check if child pipeline exists
  const childPipeline = await loadPipeline(pipelineId);
  if (!childPipeline) {
    throw new Error(`Pipeline '${pipelineId}' not found`);
  }

  ctx.log(`[Pipeline] Starting child pipeline: ${childPipeline.name} (${pipelineId})`);

  try {
    // Run child pipeline and wait for completion
    // Pass parent pipeline context for future tracking
    const result = await runPipeline(pipelineId, inputs, ctx.pipelineId, ctx.BUILD_ID);

    ctx.log(`[Pipeline] Child pipeline completed: success=${result.success}, duration=${result.duration}ms, runId=${result.runId}`);

    // If child pipeline failed and failOnError is true, throw error
    if (!result.success && failOnError) {
      throw new Error(`Child pipeline '${pipelineId}' failed`);
    }

    // Return result object
    return {
      success: result.success,
      runId: result.runId,
      duration: result.duration,
      // Include result from child pipeline if available (last step result)
      result: result.success ? undefined : undefined, // Child pipeline result is not directly accessible, but we can return metadata
      error: result.success ? undefined : "Child pipeline failed",
    };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);

    // Check if error is due to pipeline already running
    if (errorMsg.includes("already running")) {
      ctx.log(`[Pipeline] Child pipeline '${pipelineId}' is already running`);
      if (failOnError) {
        throw new Error(`Child pipeline '${pipelineId}' is already running`);
      }
      return {
        success: false,
        runId: "",
        duration: 0,
        error: `Child pipeline '${pipelineId}' is already running`,
      };
    }

    ctx.log(`[Pipeline] Child pipeline error: ${errorMsg}`);

    // If failOnError is true, re-throw the error to stop parent pipeline
    if (failOnError) {
      throw e;
    }

    // Otherwise, return error in result
    return {
      success: false,
      runId: "",
      duration: 0,
      error: errorMsg,
    };
  }
}

