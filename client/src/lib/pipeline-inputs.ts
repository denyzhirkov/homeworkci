// Pipeline input utilities
// Shared logic for handling pipeline input parameters

import type { PipelineInput } from "./api";

/**
 * Initialize input values with defaults from pipeline definition
 * Handles string, boolean, and select input types
 */
export function initializeInputValues(
  inputs: PipelineInput[] | undefined
): Record<string, string | boolean> {
  const defaults: Record<string, string | boolean> = {};
  
  if (!inputs) return defaults;
  
  for (const input of inputs) {
    if (input.default !== undefined) {
      defaults[input.name] = input.default;
    } else if (input.type === "boolean") {
      defaults[input.name] = false;
    } else if (input.type === "select" && input.options?.length) {
      defaults[input.name] = input.options[0];
    } else {
      defaults[input.name] = "";
    }
  }
  
  return defaults;
}


