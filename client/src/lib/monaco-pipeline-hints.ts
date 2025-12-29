/**
 * Monaco Editor hints for pipeline JSON editing
 * Provides autocomplete for modules, params, and interpolation variables
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor, Position } from "monaco-editor";
import type { ModuleSchemasMap, ModuleInfo, ParamSchema, VariablesConfig } from "./api";

interface HintsContext {
  moduleSchemas: ModuleSchemasMap;
  modules: ModuleInfo[];
  variables: VariablesConfig;
  pipelineEnv?: string;
}

// Disposable reference for cleanup
let completionDisposable: { dispose: () => void } | null = null;

/**
 * Register pipeline-specific completion provider for Monaco
 */
export function registerPipelineHints(monaco: Monaco, context: HintsContext): void {
  // Dispose previous registration if any
  if (completionDisposable) {
    completionDisposable.dispose();
  }

  completionDisposable = monaco.languages.registerCompletionItemProvider("json", {
    triggerCharacters: ['"', "{", ".", "$"],

    provideCompletionItems: (model: editor.ITextModel, position: Position) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const lineContent = model.getLineContent(position.lineNumber);
      const lineUntilPosition = lineContent.substring(0, position.column - 1);

      // 1. Suggest modules for "module": "|"
      if (isModuleValueContext(lineUntilPosition)) {
        return {
          suggestions: context.modules.map((mod) => ({
            label: mod.id,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: mod.id,
            detail: mod.isBuiltIn ? "(built-in)" : "(custom)",
            documentation: {
              value: `**${mod.id}**\n\n${mod.description || ""}${mod.fullDocs ? `\n\n${mod.fullDocs}` : ""}`,
            },
            sortText: mod.isBuiltIn ? "0" + mod.id : "1" + mod.id,
          })),
        };
      }

      // 2. Suggest params for module inside "params": { | }
      const currentModule = findModuleInCurrentStep(textUntilPosition);
      if (currentModule && isInsideParamsObject(textUntilPosition)) {
        const schema = context.moduleSchemas[currentModule];
        if (schema?.params) {
          const existingParams = getExistingParamKeys(textUntilPosition);
          const word = model.getWordUntilPosition(position);

          return {
            suggestions: Object.entries(schema.params)
              .filter(([key]) => !existingParams.includes(key))
              .map(([key, param]) => ({
                label: key,
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: createParamInsertText(key, param),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: param.required ? "(required)" : `(optional${param.default !== undefined ? `, default: ${JSON.stringify(param.default)}` : ""})`,
                documentation: {
                  value: buildParamDocumentation(key, param),
                },
                sortText: param.required ? "0" + key : "1" + key,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: word.startColumn,
                  endLineNumber: position.lineNumber,
                  endColumn: word.endColumn,
                },
              })),
          };
        }
      }

      // 3. Suggest interpolation variables for ${
      if (isInterpolationContext(lineUntilPosition)) {
        return {
          suggestions: buildInterpolationSuggestions(monaco, context, lineUntilPosition),
        };
      }

      // 4. Suggest step fields (name, description, module, params, parallel)
      if (isInsideStepObject(textUntilPosition) && !isInsideParamsObject(textUntilPosition)) {
        const existingFields = getExistingStepFields(textUntilPosition);
        const word = model.getWordUntilPosition(position);

        const stepFields = [
          { key: "name", desc: "Step name for referencing via ${results.name}", required: false },
          { key: "description", desc: "Human-readable step description", required: false },
          { key: "module", desc: "Module to execute (required)", required: true },
          { key: "params", desc: "Module parameters", required: false },
          { key: "parallel", desc: "Parallel group name for concurrent execution", required: false },
        ];

        return {
          suggestions: stepFields
            .filter((f) => !existingFields.includes(f.key))
            .map((f) => ({
              label: f.key,
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: f.key === "params" ? `"${f.key}": {\n\t$0\n}` : `"${f.key}": "$0"`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: f.required ? "(required)" : "(optional)",
              documentation: f.desc,
              sortText: f.required ? "0" + f.key : "1" + f.key,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn,
              },
            })),
        };
      }

      return { suggestions: [] };
    },
  });
}

/**
 * Dispose registered completion provider
 */
export function disposePipelineHints(): void {
  if (completionDisposable) {
    completionDisposable.dispose();
    completionDisposable = null;
  }
}

// --- Helper functions ---

function isModuleValueContext(line: string): boolean {
  // Match: "module": "| or "module": "|xxx
  return /"module"\s*:\s*"[^"]*$/.test(line);
}

function isInsideParamsObject(text: string): boolean {
  // Find last "params": { and check if we're inside it
  const paramsMatch = text.lastIndexOf('"params"');
  if (paramsMatch === -1) return false;

  const afterParams = text.substring(paramsMatch);
  const openBraces = (afterParams.match(/{/g) || []).length;
  const closeBraces = (afterParams.match(/}/g) || []).length;

  return openBraces > closeBraces;
}

function isInsideStepObject(text: string): boolean {
  // Check if we're inside an object within "steps" array
  const stepsMatch = text.lastIndexOf('"steps"');
  if (stepsMatch === -1) return false;

  const afterSteps = text.substring(stepsMatch);
  // Must be inside array and inside an object
  const hasArrayOpen = afterSteps.includes("[");
  const openBraces = (afterSteps.match(/{/g) || []).length;
  const closeBraces = (afterSteps.match(/}/g) || []).length;

  return hasArrayOpen && openBraces > closeBraces;
}

function findModuleInCurrentStep(text: string): string | null {
  // Find the start of current step object
  let braceCount = 0;
  let stepStart = text.length;

  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "}") braceCount++;
    if (text[i] === "{") {
      if (braceCount === 0) {
        stepStart = i;
        break;
      }
      braceCount--;
    }
  }

  // Look for "module": "xxx" in the current step
  const stepText = text.substring(stepStart);
  const match = stepText.match(/"module"\s*:\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function getExistingParamKeys(text: string): string[] {
  // Find last "params": { and extract keys from it
  const paramsMatch = text.lastIndexOf('"params"');
  if (paramsMatch === -1) return [];

  const afterParams = text.substring(paramsMatch);
  const matches = afterParams.matchAll(/"(\w+)"\s*:/g);
  return Array.from(matches)
    .map((m) => m[1])
    .filter((k) => k !== "params");
}

function getExistingStepFields(text: string): string[] {
  // Find current step object and extract existing field keys
  let braceCount = 0;
  let stepStart = text.length;

  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "}") braceCount++;
    if (text[i] === "{") {
      if (braceCount === 0) {
        stepStart = i;
        break;
      }
      braceCount--;
    }
  }

  const stepText = text.substring(stepStart);
  const matches = stepText.matchAll(/"(\w+)"\s*:/g);
  return Array.from(matches).map((m) => m[1]);
}

function isInterpolationContext(line: string): boolean {
  // Match: ${| or ${xxx|
  return /\$\{[^}]*$/.test(line);
}

function createParamInsertText(key: string, param: ParamSchema): string {
  const prefix = `"${key}": `;

  if (param.enum && param.enum.length > 0) {
    // Create choice snippet for enums
    return prefix + `"\${1|${param.enum.join(",")}|}"`;
  }

  switch (param.type) {
    case "string":
      return prefix + '"$1"';
    case "number":
      return prefix + "${1:0}";
    case "boolean":
      return prefix + "${1|true,false|}";
    case "object":
      return prefix + "{\n\t$1\n}";
    case "array":
      return prefix + "[$1]";
    default:
      return prefix + '"$1"';
  }
}

function buildParamDocumentation(key: string, param: ParamSchema): string {
  let doc = `**${key}**\n\n${param.description || ""}`;

  doc += `\n\n**Type:** \`${param.type}\``;

  if (param.enum && param.enum.length > 0) {
    doc += `\n\n**Values:** ${param.enum.map((v) => `\`${v}\``).join(", ")}`;
  }

  if (param.default !== undefined) {
    doc += `\n\n**Default:** \`${JSON.stringify(param.default)}\``;
  }

  return doc;
}

function buildInterpolationSuggestions(
  monaco: Monaco,
  context: HintsContext,
  line: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suggestions: any[] = [];

  // Extract what's after ${
  const match = line.match(/\$\{([^}]*)$/);
  const prefix = match ? match[1] : "";

  // Base interpolation variables
  if (!prefix || "prev".startsWith(prefix)) {
    suggestions.push({
      label: "prev",
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: "prev",
      detail: "Previous step result",
      documentation: "Access the result of the previous step",
      sortText: "0prev",
    });
  }

  if (!prefix || "results.".startsWith(prefix) || prefix.startsWith("results.")) {
    suggestions.push({
      label: "results.",
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: "results.",
      detail: "Named step results",
      documentation: 'Access results of named steps, e.g., ${results.myStep.field}',
      sortText: "0results",
    });
  }

  if (!prefix || "inputs.".startsWith(prefix) || prefix.startsWith("inputs.")) {
    suggestions.push({
      label: "inputs.",
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: "inputs.",
      detail: "Pipeline input parameters",
      documentation: 'Access pipeline input values, e.g., ${inputs.userId}',
      sortText: "0inputs",
    });
  }

  if (!prefix || "pipelineId".startsWith(prefix)) {
    suggestions.push({
      label: "pipelineId",
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: "pipelineId",
      detail: "Current pipeline ID",
      documentation: "The ID of the currently running pipeline",
      sortText: "0pipelineId",
    });
  }

  // Environment variables
  if (!prefix || "env.".startsWith(prefix) || prefix.startsWith("env.")) {
    suggestions.push({
      label: "env.",
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: "env.",
      detail: "Environment variables",
      documentation: 'Access environment variables, e.g., ${env.API_KEY}',
      sortText: "0env",
    });

    // Add specific env vars if prefix starts with "env."
    if (prefix.startsWith("env.")) {
      const envPrefix = prefix.substring(4);

      // Global variables
      for (const key of Object.keys(context.variables.global)) {
        if (!envPrefix || key.toLowerCase().startsWith(envPrefix.toLowerCase())) {
          suggestions.push({
            label: `env.${key}`,
            kind: monaco.languages.CompletionItemKind.Constant,
            insertText: `env.${key}`,
            detail: "(global)",
            documentation: `Global variable: ${key}`,
            sortText: "1" + key,
          });
        }
      }

      // Environment-specific variables
      if (context.pipelineEnv && context.variables.environments[context.pipelineEnv]) {
        for (const key of Object.keys(context.variables.environments[context.pipelineEnv])) {
          if (!envPrefix || key.toLowerCase().startsWith(envPrefix.toLowerCase())) {
            suggestions.push({
              label: `env.${key}`,
              kind: monaco.languages.CompletionItemKind.Constant,
              insertText: `env.${key}`,
              detail: `(${context.pipelineEnv})`,
              documentation: `Environment variable: ${key} (${context.pipelineEnv})`,
              sortText: "2" + key,
            });
          }
        }
      }
    }
  }

  return suggestions;
}

