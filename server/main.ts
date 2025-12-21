import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { cors } from "hono/cors";
import { listPipelines, loadPipeline, runPipeline, savePipeline, deletePipeline, getActivePipelines, stopPipeline, isDemoPipeline } from "./engine.ts";
import { listModules, loadModule, getModuleSource, saveModule, deleteModule, isBuiltInModule } from "./modules.ts";
import { loadVariables, saveVariables } from "./variables.ts";
import { getRunHistory, getRunLogWithStatus } from "./logger.ts";
import { Scheduler } from "./scheduler.ts";

const app = new Hono();

// Logger
app.use("*", async (c, next) => {
  await next();
  console.log(`[${c.req.method}] ${c.req.path} -> ${c.res.status}`);
});

// Enable CORS for frontend during dev (if separate port)
app.use("/*", cors());

const scheduler = new Scheduler();
scheduler.start();

// --- Static Assets (Explicit) ---
// Serve assets with higher priority to avoid fall-through to index.html
app.use("/assets/*", serveStatic({ root: "./client/dist" }));

// --- Pipelines API ---



app.get("/api/pipelines", async (c) => {
  const pipelines = await listPipelines();
  const active = new Set(getActivePipelines());
  const enhanced = pipelines.map(p => ({ 
    ...p, 
    isRunning: active.has(p.id),
    isDemo: isDemoPipeline(p.id)
  }));
  return c.json(enhanced);
});

app.get("/api/pipelines/:id/runs", (c) => {
  const id = c.req.param("id");
  const history = getRunHistory(id);
  return c.json(history);
});

app.get("/api/pipelines/:id/runs/:runId", (c) => {
  const id = c.req.param("id");
  const runId = c.req.param("runId");
  const { log, status } = getRunLogWithStatus(id, runId);
  if (log === null) {
    if (status === "running") {
      return c.text("Pipeline is currently running. View Live Output for real-time logs.");
    }
    return c.text("Log not found", 404);
  }
  return c.text(log);
});

import { streamSSE } from "hono/streaming";
import { pubsub } from "./pubsub.ts";

app.get("/api/pipelines/:id/live", (c) => {
  const id = c.req.param("id");
  return streamSSE(c, async (stream) => {
    // Subscribe to pubsub
    const unsubscribe = pubsub.subscribe(async (event) => {
      // Filter for this pipeline (only PipelineEvents have pipelineId)
      if ("pipelineId" in event && event.pipelineId === id) {
        await stream.writeSSE({
          data: JSON.stringify(event),
          event: "message",
        });
      }
    });

    // Keep connection open until client disconnects
    // Hono streamSSE handles cleanup on close? 
    // We need to detect close to unsubscribe.
    // There is stream.onAbort()
    stream.onAbort(() => {
      unsubscribe();
    });

    // Send initial ping or Keep-Alive
    while (true) {
      await stream.writeSSE({ event: 'ping', data: 'ping' });
      await stream.sleep(5000);
    }
  });
});

app.get("/api/pipelines/:id", async (c) => {
  const id = c.req.param("id");
  const p = await loadPipeline(id);
  if (!p) return c.json({ error: "Not found" }, 404);
  const active = getActivePipelines();
  return c.json({ ...p, isDemo: isDemoPipeline(id), isRunning: active.includes(id) });
});

import { v4 as uuidv4 } from "uuid";

app.post("/api/pipelines", async (c) => {
  try {
    const body = await c.req.json();
    const id = uuidv4();
    await savePipeline(id, body);
    pubsub.publish({ type: "pipelines:changed" });
    return c.json({ success: true, id });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/api/pipelines/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await savePipeline(id, body);
  return c.json({ success: true, id });
});

app.delete("/api/pipelines/:id", async (c) => {
  try {
    await deletePipeline(c.req.param("id"));
    pubsub.publish({ type: "pipelines:changed" });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/api/pipelines/:id/run", async (c) => {
  const id = c.req.param("id");
  console.log(`[API] Triggering pipeline ${id}`);
  try {
    const result = await runPipeline(id);
    return c.json(result);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/api/pipelines/:id/stop", async (c) => {
  const id = c.req.param("id");
  console.log(`[API] Stopping pipeline ${id}`);
  const stopped = stopPipeline(id);
  if (stopped) {
    return c.json({ success: true });
  }
  return c.json({ error: "Pipeline not running" }, 400);
});

// --- Variables API ---

app.get("/api/variables", async (c) => {
  const vars = await loadVariables();
  return c.json(vars);
});

app.post("/api/variables", async (c) => {
  try {
    const vars = await c.req.json();
    await saveVariables(vars);
    pubsub.publish({ type: "variables:changed" });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// --- Modules API ---

app.get("/api/modules", async (c) => {
  const modules = await listModules();
  return c.json(modules);
});

app.get("/api/modules/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const source = await getModuleSource(id);
    const isBuiltIn = isBuiltInModule(id);
    return c.json({ source, isBuiltIn });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

app.post("/api/modules/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json(); // Expect { source: string }
  if (typeof body.source !== "string") {
    return c.json({ error: "Missing source" }, 400);
  }
  await saveModule(id, body.source);
  pubsub.publish({ type: "modules:changed" });
  return c.json({ success: true });
});

app.delete("/api/modules/:id", async (c) => {
  try {
    await deleteModule(c.req.param("id"));
    pubsub.publish({ type: "modules:changed" });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Server start time for uptime calculation
const serverStartTime = Date.now();

app.get("/api/stats", async (c) => {
  const pipelines = await listPipelines();
  const modules = await listModules();
  
  return c.json({
    platform: Deno.build.os,
    denoVersion: Deno.version.deno,
    pipelinesCount: pipelines.length,
    modulesCount: modules.length,
    uptime: (Date.now() - serverStartTime) / 1000
  });
});

// --- Statistics API (from SQLite) ---

import { getPipelineStats, getOverviewStats, getStepsByRunId, getRunByRunId } from "./db.ts";

app.get("/api/stats/overview", (c) => {
  const stats = getOverviewStats();
  return c.json(stats);
});

app.get("/api/stats/pipeline/:id", (c) => {
  const id = c.req.param("id");
  const stats = getPipelineStats(id);
  return c.json(stats);
});

app.get("/api/pipelines/:id/runs/:runId/steps", (c) => {
  const pipelineId = c.req.param("id");
  const runId = c.req.param("runId");
  const run = getRunByRunId(pipelineId, runId);
  if (!run) return c.json({ error: "Run not found" }, 404);
  const steps = getStepsByRunId(run.id);
  return c.json(steps);
});

// --- WebSocket for real-time events ---

// Track all connected WebSocket clients
const wsClients = new Set<WebSocket>();

app.get("/api/ws", async (c) => {
  // Check if this is a WebSocket upgrade request
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected WebSocket upgrade", 400);
  }

  // Get the raw request for Deno.upgradeWebSocket
  const { socket, response } = Deno.upgradeWebSocket(c.req.raw);

  socket.onopen = async () => {
    console.log("[WS] Client connected");
    wsClients.add(socket);

    // Send initial state: list of pipelines with running status
    try {
      const pipelines = await listPipelines();
      const active = new Set(getActivePipelines());
      const pipelineStatuses = pipelines.map(p => ({
        id: p.id,
        name: p.name,
        isRunning: active.has(p.id),
        isDemo: isDemoPipeline(p.id),
        schedule: p.schedule,
        stepsCount: p.steps?.length || 0
      }));

      socket.send(JSON.stringify({
        type: "init",
        pipelines: pipelineStatuses
      }));
    } catch (e) {
      console.error("[WS] Error sending initial state:", e);
    }
  };

  socket.onclose = () => {
    console.log("[WS] Client disconnected");
    wsClients.delete(socket);
  };

  socket.onerror = (e) => {
    console.error("[WS] Error:", e);
    wsClients.delete(socket);
  };

  return response;
});

// Subscribe to pubsub and broadcast to all WebSocket clients
pubsub.subscribe((event) => {
  const message = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (e) {
        console.error("[WS] Failed to send message:", e);
        wsClients.delete(client);
      }
    }
  }
});

// --- Static Frontend ---

// Serve static files from client/dist
app.use("/*", serveStatic({ root: "./client/dist" }));

// SPA Fallback: Serve index.html for everything else (that isn't an API call)
app.get("*", serveStatic({ path: "./client/dist/index.html" }));

if (import.meta.main) {
  console.log("Starting NanoCI server on http://localhost:8000");
  Deno.serve({ port: 8000 }, app.fetch);
}

export default app;
