// Statistics routes - System and pipeline statistics

import { Hono } from "hono";
import { listPipelines } from "../engine.ts";
import { listModules } from "../modules.ts";
import { getOverviewStats, getPipelineStats } from "../db.ts";
import { getVersionSync } from "../utils/version.ts";

const app = new Hono();

// Server start time for uptime calculation
const serverStartTime = Date.now();

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

// Get system memory info
async function getSystemMemory(): Promise<{ used: string; percent: string }> {
  try {
    const info = Deno.systemMemoryInfo();
    const used = info.total - info.available;
    const percent = ((used / info.total) * 100).toFixed(0);
    return { used: formatBytes(used), percent: percent + "%" };
  } catch {
    // Fallback to process memory if system memory not available
    const mem = Deno.memoryUsage();
    return { used: formatBytes(mem.heapUsed), percent: "—" };
  }
}

// Get CPU load (platform-specific)
async function getCpuLoad(): Promise<string> {
  try {
    if (Deno.build.os === "darwin") {
      // macOS: use sysctl for load average
      const cmd = new Deno.Command("sysctl", {
        args: ["-n", "vm.loadavg"],
        stdout: "piped",
        stderr: "piped",
      });
      const output = await cmd.output();
      const text = new TextDecoder().decode(output.stdout).trim();
      // Format: "{ 1.23 1.45 1.67 }"
      const match = text.match(/\{\s*([\d.]+)/);
      if (match && match[1]) {
        return match[1];
      }
    } else if (Deno.build.os === "linux") {
      // Linux: read /proc/loadavg
      const text = await Deno.readTextFile("/proc/loadavg");
      const parts = text.trim().split(" ");
      if (parts[0]) {
        return parts[0];
      }
    }
    return "—";
  } catch {
    return "—";
  }
}

// System stats
app.get("/", async (c) => {
  const pipelines = await listPipelines();
  const modules = await listModules();
  const memory = await getSystemMemory();
  const cpuLoad = await getCpuLoad();

  return c.json({
    platform: Deno.build.os,
    denoVersion: Deno.version.deno,
    appVersion: getVersionSync(),
    pipelinesCount: pipelines.length,
    modulesCount: modules.length,
    uptime: (Date.now() - serverStartTime) / 1000,
    memoryUsed: memory.percent,
    cpuLoad: cpuLoad,
  });
});

// Overview stats (from DB)
app.get("/overview", (c) => {
  const stats = getOverviewStats();
  return c.json(stats);
});

// Pipeline stats
app.get("/pipeline/:id", (c) => {
  const id = c.req.param("id");
  const stats = getPipelineStats(id);
  return c.json(stats);
});

export default app;

