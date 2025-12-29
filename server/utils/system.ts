// System metrics utilities
// Provides cross-platform system information

import { formatBytes } from "./format.ts";

export interface SystemMetrics {
  memoryPercent: string;
  memoryUsed: string;
  memoryTotal: string;
  cpuLoad: string;
}

/**
 * Get system metrics (memory usage and CPU load)
 * Works on macOS and Linux
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  let memoryPercent = "—";
  let memoryUsed = "—";
  let memoryTotal = "—";
  let cpuLoad = "—";

  try {
    const info = Deno.systemMemoryInfo();
    const used = info.total - info.available;
    memoryPercent = ((used / info.total) * 100).toFixed(0) + "%";
    memoryUsed = formatBytes(used);
    memoryTotal = formatBytes(info.total);
  } catch {
    // Fallback to process memory
    try {
      const mem = Deno.memoryUsage();
      memoryUsed = formatBytes(mem.heapUsed);
    } catch { /* ignore */ }
  }

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
        cpuLoad = match[1];
      }
    } else if (Deno.build.os === "linux") {
      // Linux: read /proc/loadavg
      const text = await Deno.readTextFile("/proc/loadavg");
      const parts = text.trim().split(" ");
      if (parts[0]) {
        cpuLoad = parts[0];
      }
    }
  } catch { /* ignore */ }

  return { memoryPercent, memoryUsed, memoryTotal, cpuLoad };
}


