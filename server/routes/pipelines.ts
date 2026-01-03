// Pipeline routes - CRUD and execution endpoints

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { v4 as uuidv4 } from "uuid";
import {
  listPipelines,
  loadPipeline,
  runPipeline,
  savePipeline,
  deletePipeline,
  getActivePipelines,
  stopPipeline,
  isDemoPipeline,
  cleanupOldSandboxes,
} from "../engine.ts";
import { getRunHistory, getRunLogWithStatus } from "../logger.ts";
import { getPipelineStats, getRunByRunId, getStepsByRunId } from "../db.ts";
import { pubsub } from "../pubsub.ts";

const app = new Hono();

// List all pipelines
app.get("/", async (c) => {
  const pipelines = await listPipelines();
  const active = new Set(getActivePipelines());
  const enhanced = pipelines.map((p) => ({
    ...p,
    isRunning: active.has(p.id),
    isDemo: isDemoPipeline(p.id),
  }));
  return c.json(enhanced);
});

// Get single pipeline
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const p = await loadPipeline(id);
  if (!p) return c.json({ error: "Not found" }, 404);
  const active = getActivePipelines();
  return c.json({ ...p, isDemo: isDemoPipeline(id), isRunning: active.includes(id) });
});

// Create new pipeline
app.post("/", async (c) => {
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

// Update pipeline
app.post("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await savePipeline(id, body);
  return c.json({ success: true, id });
});

// Delete pipeline
app.delete("/:id", async (c) => {
  try {
    await deletePipeline(c.req.param("id"));
    pubsub.publish({ type: "pipelines:changed" });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Run pipeline
app.post("/:id/run", async (c) => {
  const id = c.req.param("id");
  console.log(`[API] Triggering pipeline ${id}`);
  try {
    // Parse optional inputs from request body
    const body = await c.req.json().catch(() => ({}));
    const inputs = body.inputs as Record<string, string | boolean> | undefined;
    const result = await runPipeline(id, inputs);
    return c.json(result);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Stop pipeline
app.post("/:id/stop", async (c) => {
  const id = c.req.param("id");
  console.log(`[API] Stopping pipeline ${id}`);
  const stopped = await stopPipeline(id);
  if (stopped) {
    return c.json({ success: true });
  }
  return c.json({ error: "Pipeline not running" }, 400);
});

// Toggle schedule pause (pause/resume scheduled runs)
app.post("/:id/schedule/toggle", async (c) => {
  const id = c.req.param("id");
  const pipeline = await loadPipeline(id);
  if (!pipeline) return c.json({ error: "Not found" }, 404);
  if (!pipeline.schedule) return c.json({ error: "Pipeline has no schedule" }, 400);
  
  const newPaused = !pipeline.schedulePaused;
  // Extract id before saving (savePipeline expects Omit<Pipeline, "id">)
  const { id: _pipelineId, ...pipelineData } = pipeline;
  await savePipeline(id, { ...pipelineData, schedulePaused: newPaused });
  console.log(`[API] Schedule ${newPaused ? 'paused' : 'resumed'} for pipeline ${id}`);
  
  pubsub.publish({ type: "pipelines:changed" });
  return c.json({ success: true, schedulePaused: newPaused });
});

// Get run history
app.get("/:id/runs", (c) => {
  const id = c.req.param("id");
  const history = getRunHistory(id);
  return c.json(history);
});

// Get specific run log
app.get("/:id/runs/:runId", (c) => {
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

// Get steps for a specific run
app.get("/:id/runs/:runId/steps", (c) => {
  const pipelineId = c.req.param("id");
  const runId = c.req.param("runId");
  const run = getRunByRunId(pipelineId, runId);
  if (!run) return c.json({ error: "Run not found" }, 404);
  const steps = getStepsByRunId(run.id);
  return c.json(steps);
});

// Live log stream (SSE)
app.get("/:id/live", (c) => {
  const id = c.req.param("id");
  return streamSSE(c, async (stream) => {
    const unsubscribe = pubsub.subscribe(async (event) => {
      if ("pipelineId" in event && event.pipelineId === id) {
        await stream.writeSSE({
          data: JSON.stringify(event),
          event: "message",
        });
      }
    });

    stream.onAbort(() => {
      unsubscribe();
    });

    // Keep-alive
    while (true) {
      await stream.writeSSE({ event: "ping", data: "ping" });
      await stream.sleep(5000);
    }
  });
});

// Pipeline statistics
app.get("/:id/stats", (c) => {
  const id = c.req.param("id");
  const stats = getPipelineStats(id);
  return c.json(stats);
});

// Sandbox cleanup
export async function handleSandboxCleanup(c: any) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const maxAgeMs = body.maxAgeMs ?? 24 * 60 * 60 * 1000;
    const cleaned = await cleanupOldSandboxes(maxAgeMs);
    console.log(`[API] Cleaned up ${cleaned} old sandbox directories`);
    return c.json({ success: true, cleaned });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
}

export default app;

