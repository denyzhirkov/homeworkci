// API functions for HomeworkCI client
// Uses the base api-client for all requests

import { api, API_BASE } from "./api-client";

// --- Types ---

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  schedule?: string;
  env?: string;
  steps: PipelineStep[];
  isRunning?: boolean;
  isDemo?: boolean;
}

export interface PipelineStep {
  name?: string;
  description?: string;
  module: string;
  params?: Record<string, unknown>;
  parallel?: string;
}

export interface ModuleInfo {
  id: string;
  description: string;
  fullDocs?: string;
  isBuiltIn?: boolean;
}

export interface ModuleDetails {
  source: string;
  isBuiltIn: boolean;
}

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

export const runPipeline = (id: string) => 
  api.post<RunResult>(`/pipelines/${encodeURIComponent(id)}/run`);

export const stopPipeline = (id: string) => 
  api.post<{ success: boolean }>(`/pipelines/${encodeURIComponent(id)}/stop`);

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

// --- Variables ---

export interface VariablesConfig {
  global: Record<string, string>;
  environments: Record<string, Record<string, string>>;
}

export const getVariables = () => 
  api.get<VariablesConfig>("/variables");

export const saveVariables = (vars: VariablesConfig) => 
  api.post<{ success: boolean }>("/variables", vars);

// --- Stats ---

export const getStats = () => 
  api.get<SystemStats>("/stats");
