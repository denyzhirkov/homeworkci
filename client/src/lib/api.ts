// API base URL - defaults to /api for production (nginx proxy)
// Can be overridden via VITE_API_BASE env var for development
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  schedule?: string;
  env?: string;
  steps: {
    name?: string; // Step name for results reference via ${results.name}
    description?: string;
    module: string;
    params?: any;
    parallel?: string; // Group name for parallel execution
  }[];
  isRunning?: boolean;
  isDemo?: boolean; // Read-only demo pipeline
}

export async function getPipelines(): Promise<Pipeline[]> {
  const res = await fetch(`${API_BASE}/pipelines`);
  return res.json();
}

export async function getPipeline(id: string): Promise<Pipeline> {
  const res = await fetch(`${API_BASE}/pipelines/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Pipeline not found");
  return res.json();
}
export async function createPipeline(pipeline: any): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/pipelines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pipeline),
  });
  if (!res.ok) throw new Error("Failed to create");
  return res.json();
}

export async function savePipeline(id: string, pipeline: any) {
  const res = await fetch(`${API_BASE}/pipelines/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pipeline),
  });
  if (!res.ok) throw new Error("Failed to save");
}

export async function runPipeline(id: string) {
  const res = await fetch(`${API_BASE}/pipelines/${encodeURIComponent(id)}/run`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to run");
  return res.json();
}

export async function stopPipeline(id: string) {
  const res = await fetch(`${API_BASE}/pipelines/${encodeURIComponent(id)}/stop`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to stop");
  return res.json();
}

export async function deletePipeline(id: string) {
  const res = await fetch(`${API_BASE}/pipelines/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete");
  return res.json();
}

export interface ModuleInfo {
  id: string;
  description: string;
  fullDocs?: string;
  isBuiltIn?: boolean;
}

export async function getModules(): Promise<ModuleInfo[]> {
  const res = await fetch(`${API_BASE}/modules`);
  return res.json();
}

export interface ModuleDetails {
  source: string;
  isBuiltIn: boolean;
}

export async function getModuleDetails(id: string): Promise<ModuleDetails> {
  const res = await fetch(`${API_BASE}/modules/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Module not found");
  return res.json();
}

export async function saveModule(id: string, content: string) {
  const res = await fetch(`${API_BASE}/modules/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: content }),
  });
  if (!res.ok) throw new Error("Failed to save");
}

export async function deleteModule(id: string) {
  const res = await fetch(`${API_BASE}/modules/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete module");
  return res.json();
}

export async function getVariables() {
  const res = await fetch(`${API_BASE}/variables`);
  if (!res.ok) throw new Error("Failed to fetch variables");
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function saveVariables(vars: any) {
  const res = await fetch(`${API_BASE}/variables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vars),
  });
  if (!res.ok) throw new Error("Failed to save variables");
  return res.json();
}

export async function getRunHistory(pipelineId: string) {
  const res = await fetch(`${API_BASE}/pipelines/${encodeURIComponent(pipelineId)}/runs`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function getRunLog(pipelineId: string, runId: string) {
  const res = await fetch(`${API_BASE}/pipelines/${encodeURIComponent(pipelineId)}/runs/${runId}`);
  if (!res.ok) throw new Error("Failed to fetch log");
  return res.text();
}
