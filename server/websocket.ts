// WebSocket handler for real-time events

import { listPipelines, getActivePipelines, isDemoPipeline } from "./engine.ts";
import { pubsub } from "./pubsub.ts";

// Track all connected WebSocket clients
const wsClients = new Set<WebSocket>();

// Track heartbeat intervals per socket (using WeakMap to allow GC)
const heartbeatIntervals = new WeakMap<WebSocket, number>();

// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL = 30000;

// System metrics broadcast interval
const SYSTEM_METRICS_INTERVAL = 5000;

// System metrics broadcaster
let systemMetricsInterval: number | null = null;

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

// Get system metrics
async function getSystemMetrics(): Promise<{
  memoryPercent: string;
  memoryUsed: string;
  memoryTotal: string;
  cpuLoad: string;
}> {
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

// Broadcast system metrics to all clients
async function broadcastSystemMetrics(): Promise<void> {
  if (wsClients.size === 0) return;

  const metrics = await getSystemMetrics();
  const message = JSON.stringify({
    type: "system",
    payload: metrics,
  });

  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch {
        // Will be cleaned up by heartbeat
      }
    }
  }
}

// Start system metrics broadcasting when first client connects
function startSystemMetricsBroadcast(): void {
  if (systemMetricsInterval !== null) return;
  
  // Send immediately on first connection
  broadcastSystemMetrics();
  
  systemMetricsInterval = setInterval(() => {
    broadcastSystemMetrics();
  }, SYSTEM_METRICS_INTERVAL);
}

// Stop broadcasting when no clients
function stopSystemMetricsBroadcast(): void {
  if (systemMetricsInterval !== null) {
    clearInterval(systemMetricsInterval);
    systemMetricsInterval = null;
  }
}

// Helper to cleanup a socket
function cleanupSocket(socket: WebSocket): void {
  const intervalId = heartbeatIntervals.get(socket);
  if (intervalId !== undefined) {
    clearInterval(intervalId);
    heartbeatIntervals.delete(socket);
  }
  wsClients.delete(socket);
  
  // Stop metrics broadcast if no clients left
  if (wsClients.size === 0) {
    stopSystemMetricsBroadcast();
  }
}

// Subscribe to pubsub and broadcast to all WebSocket clients
pubsub.subscribe((event) => {
  const message = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (e) {
        console.error("[WS] Failed to send message:", e);
        cleanupSocket(client);
      }
    } else {
      // Remove clients that are not in OPEN state
      cleanupSocket(client);
    }
  }
});

// Handle WebSocket upgrade
export async function handleWebSocket(req: Request): Promise<Response> {
  const upgradeHeader = req.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = async () => {
    console.log("[WS] Client connected");
    wsClients.add(socket);
    
    // Start system metrics broadcast
    startSystemMetricsBroadcast();

    // Setup heartbeat to detect dead connections
    const heartbeatId = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        } catch {
          // Failed to send heartbeat - connection is dead
          console.log("[WS] Heartbeat failed, cleaning up connection");
          cleanupSocket(socket);
        }
      } else {
        // Socket is no longer open
        cleanupSocket(socket);
      }
    }, HEARTBEAT_INTERVAL);
    heartbeatIntervals.set(socket, heartbeatId);

    // Send initial state
    try {
      const pipelines = await listPipelines();
      const active = new Set(getActivePipelines());
      const pipelineStatuses = pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        isRunning: active.has(p.id),
        isDemo: isDemoPipeline(p.id),
        schedule: p.schedule,
        stepsCount: p.steps?.length || 0,
      }));

      socket.send(
        JSON.stringify({
          type: "init",
          pipelines: pipelineStatuses,
        })
      );
    } catch (e) {
      console.error("[WS] Error sending initial state:", e);
    }
  };

  socket.onclose = () => {
    console.log("[WS] Client disconnected");
    cleanupSocket(socket);
  };

  socket.onerror = (e) => {
    console.error("[WS] Error:", e);
    cleanupSocket(socket);
  };

  return response;
}

// Get number of connected clients (for monitoring)
export function getConnectedClientsCount(): number {
  return wsClients.size;
}
