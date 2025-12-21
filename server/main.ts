import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { cors } from "hono/cors";
import { listPipelines, loadPipeline, runPipeline, savePipeline, deletePipeline, getActivePipelines, stopPipeline, isDemoPipeline } from "./engine.ts";
import { listModules, loadModule, getModuleSource, saveModule, deleteModule, isBuiltInModule } from "./modules.ts";
import { loadVariables, saveVariables } from "./variables.ts";
import { getRunHistory, getRunLog } from "./logger.ts";
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

app.get("/api/pipelines/:id/runs", async (c) => {
  const id = c.req.param("id");
  const history = await getRunHistory(id);
  return c.json(history);
});

app.get("/api/pipelines/:id/runs/:runId", async (c) => {
  const id = c.req.param("id");
  const runId = c.req.param("runId");
  const log = await getRunLog(id, runId);
  if (log === null) return c.text("Log not found", 404);
  return c.text(log);
});

import { streamSSE } from "hono/streaming";
import { pubsub } from "./pubsub.ts";

app.get("/api/pipelines/:id/live", (c) => {
  const id = c.req.param("id");
  return streamSSE(c, async (stream) => {
    // Subscribe to pubsub
    const unsubscribe = pubsub.subscribe(async (event) => {
      // Filter for this pipeline
      if (event.pipelineId === id) {
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
  return c.json({ ...p, isDemo: isDemoPipeline(id) });
});

import { v4 as uuidv4 } from "uuid";

app.post("/api/pipelines", async (c) => {
  try {
    const body = await c.req.json();
    const id = uuidv4();
    await savePipeline(id, body);
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
  return c.json({ success: true });
});

app.delete("/api/modules/:id", async (c) => {
  try {
    await deleteModule(c.req.param("id"));
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

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
