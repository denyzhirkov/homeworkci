// API functions for HomeworkCI client
// Uses the base api-client for all requests

import { api, API_BASE } from "./api-client";

// --- Types ---

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  schedule?: string;
  schedulePaused?: boolean; // Pause scheduled runs
  env?: string;
  keepWorkDir?: boolean;
  inputs?: PipelineInput[];
  steps: StepItem[]; // Steps can include nested arrays for parallel execution
  isRunning?: boolean;
  isDemo?: boolean;
}

export interface SkipCondition {
  variable: string; // Path to variable: "inputs.skipBuild", "env.SKIP_TEST", "results.prevStep.skip"
  equals?: string | number | boolean; // Value to compare (equals)
  notEquals?: string | number | boolean; // Value to compare (not equals)
}

export interface PipelineStep {
  name?: string;
  description?: string;
  module: string;
  params?: Record<string, unknown>;
  dependsOn?: string | string[]; // Step names this step depends on (must succeed first)
  skipWhen?: SkipCondition; // Condition to skip this step
}

// A step item can be a single step or an array of parallel steps
export type StepItem = PipelineStep | PipelineStep[];

// Helper to count total individual steps (including those in parallel groups)
export function countSteps(steps: StepItem[]): number {
  return steps.reduce((sum, item) => sum + (Array.isArray(item) ? item.length : 1), 0);
}

export interface PipelineInput {
  name: string;
  type: "string" | "boolean" | "select";
  label?: string;
  default?: string | boolean;
  options?: string[]; // for type: "select"
}

export interface ModuleInfo {
  id: string;
  description: string;
  fullDocs?: string;
  isBuiltIn?: boolean;
  tags?: string[];
}

export interface ModuleDetails {
  source: string;
  isBuiltIn: boolean;
}

// Schema types for editor hints
export interface VisibilityCondition {
  param: string;                    // Parameter name to check
  equals?: string | string[];       // Show when param equals this value (or one of values)
  notEquals?: string | string[];    // Show when param does NOT equal this value
}

export interface ParamSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  description: string;
  default?: unknown;
  enum?: string[];
  visibleWhen?: VisibilityCondition; // Conditional visibility based on another param
}

export interface ModuleSchema {
  params: Record<string, ParamSchema>;
}

export type ModuleSchemasMap = Record<string, ModuleSchema>;

export interface RunResult {
  success: boolean;
  duration: number;
  runId: string;
  workDir: string | null;
}

export interface RunHistoryEntry {
  pipelineId: string;
  runId: string;
  status: "success" | "fail" | "running" | "cancelled";
  duration?: number;
  startedAt?: number;
}

export interface SystemStats {
  platform: string;
  denoVersion: string;
  appVersion: string;
  pipelinesCount: number;
  modulesCount: number;
  uptime: number;
}

// --- Pipelines ---

export const getPipelines = () =>
  api.get<Pipeline[]>("/pipelines");

export const getPipeline = (id: string) =>
  api.get<Pipeline>(`/pipelines/${encodeURIComponent(id)}`);

export const createPipeline = (pipeline: Omit<Pipeline, "id">) =>
  api.post<{ success: boolean; id: string }>("/pipelines", pipeline);

export const savePipeline = (id: string, pipeline: Omit<Pipeline, "id">) =>
  api.post<{ success: boolean; id: string }>(`/pipelines/${encodeURIComponent(id)}`, pipeline);

export const deletePipeline = (id: string) =>
  api.delete<{ success: boolean }>(`/pipelines/${encodeURIComponent(id)}`);

export const runPipeline = (id: string, inputs?: Record<string, string | boolean>) =>
  api.post<RunResult>(`/pipelines/${encodeURIComponent(id)}/run`, inputs ? { inputs } : undefined);

export const stopPipeline = (id: string) =>
  api.post<{ success: boolean }>(`/pipelines/${encodeURIComponent(id)}/stop`);

export const toggleSchedulePause = (id: string) =>
  api.post<{ success: boolean; schedulePaused: boolean }>(`/pipelines/${encodeURIComponent(id)}/schedule/toggle`);

// --- Run History ---

export const getRunHistory = (pipelineId: string) =>
  api.get<RunHistoryEntry[]>(`/pipelines/${encodeURIComponent(pipelineId)}/runs`);

export async function getRunLog(pipelineId: string, runId: string): Promise<string> {
  const response = await fetch(
    `${API_BASE}/pipelines/${encodeURIComponent(pipelineId)}/runs/${runId}`
  );
  if (!response.ok) throw new Error("Failed to fetch log");
  return response.text();
}

// --- Modules ---

export const getModules = () =>
  api.get<ModuleInfo[]>("/modules");

export const getModuleDetails = (id: string) =>
  api.get<ModuleDetails>(`/modules/${encodeURIComponent(id)}`);

export const saveModule = (id: string, source: string) =>
  api.post<{ success: boolean }>(`/modules/${encodeURIComponent(id)}`, { source });

export const deleteModule = (id: string) =>
  api.delete<{ success: boolean }>(`/modules/${encodeURIComponent(id)}`);

export const getModuleSchemas = () =>
  api.get<ModuleSchemasMap>("/modules/schemas");

// --- Variables ---

export interface SSHKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface VariablesConfig {
  global: Record<string, string>;
  environments: Record<string, Record<string, string>>;
  sshKeys?: Record<string, SSHKeyPair>; // name -> key pair
}

export const getVariables = () =>
  api.get<VariablesConfig>("/variables");

export const saveVariables = (vars: VariablesConfig) =>
  api.post<{ success: boolean }>("/variables", vars);

export const generateSSHKey = (name: string) =>
  api.post<SSHKeyPair>("/variables/ssh-keys/generate", { name });

// --- Stats ---

export const getStats = () =>
  api.get<SystemStats>("/stats");

// --- Backup & Restore ---

export interface BackupImportResult {
  success: boolean;
  pipelines: number;
  modules: number;
  variables: boolean;
  details: {
    pipelines: {
      success: number;
      failed: number;
      errors: string[];
    };
    modules: {
      success: number;
      failed: number;
      errors: string[];
    };
    variables: {
      success: boolean;
      error?: string;
    };
  };
}

/**
 * Export system backup as ZIP file
 * Downloads the backup file directly
 */
export async function exportBackup(): Promise<void> {
  const response = await fetch(`${API_BASE}/settings/backup/export`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to export backup" }));
    throw new Error(error.error || "Failed to export backup");
  }

  // Get filename from Content-Disposition header or use default
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = "backup.zip";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) {
      filename = match[1];
    }
  }

  // Create blob and download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Import system backup from ZIP file
 */
export async function importBackup(file: File): Promise<BackupImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/settings/backup/import`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to import backup" }));
    throw new Error(error.error || "Failed to import backup");
  }

  return response.json();
}

// --- Updates ---

export interface UpdateInfo {
  available: boolean;
  current: string;
  latest: string | null;
  canAutoUpdate: boolean;
  autoUpdateReason?: string;
}

export interface SyncResult {
  pipelines: {
    updated: string[];
    skipped: string[];
    errors: string[];
  };
  modules: {
    updated: string[];
    skipped: string[];
    errors: string[];
  };
  variables: {
    updated: boolean;
    error?: string;
  };
}

export interface UpdateResult {
  success: boolean;
  manual?: boolean;
  message?: string;
  currentVersion?: string;
  newVersion?: string;
  syncResult?: SyncResult;
  instructions?: string[];
  error?: string;
}

/**
 * Check for available updates
 */
export const checkUpdates = () =>
  api.get<UpdateInfo>("/updates/check");

/**
 * Apply update (automatic or manual instructions)
 */
export const applyUpdate = () =>
  api.post<UpdateResult>("/updates/apply");

/**
 * Sync default files from repository
 */
export const syncDefaults = () =>
  api.post<{ success: boolean } & SyncResult>("/updates/sync-defaults");
