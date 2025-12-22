// Interpolation utilities for pipeline parameter resolution
// Handles ${var} syntax and prototype pollution prevention

import type { PipelineContext } from "./types/index.ts";

// Forbidden keys to prevent prototype pollution
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Interpolates variables in params using pipeline context.
 * Supports ${env.VAR}, ${results.stepName.field}, ${prev.field} syntax.
 */
export function interpolate(obj: unknown, ctx: PipelineContext): unknown {
  if (typeof obj === "string") {
    return obj.replace(/\${([\w.]+)}/g, (_, path: string) => {
      const keys = path.split(".");
      // deno-lint-ignore no-explicit-any
      let value: any = ctx;

      for (const key of keys) {
        // Validate key to prevent prototype pollution
        if (FORBIDDEN_KEYS.has(key)) {
          return "";
        }
        value = value?.[key];
      }

      return value !== undefined ? String(value) : "";
    });
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolate(item, ctx));
  }

  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      result[key] = interpolate((obj as Record<string, unknown>)[key], ctx);
    }
    return result;
  }

  return obj;
}

