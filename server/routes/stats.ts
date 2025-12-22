// Statistics routes - System and pipeline statistics

import { Hono } from "hono";
import { listPipelines } from "../engine.ts";
import { listModules } from "../modules.ts";
import { getOverviewStats, getPipelineStats } from "../db.ts";
import { getVersionSync } from "../utils/version.ts";

const app = new Hono();

// Server start time for uptime calculation
const serverStartTime = Date.now();

// System stats
app.get("/", async (c) => {
  const pipelines = await listPipelines();
  const modules = await listModules();

  return c.json({
    platform: Deno.build.os,
    denoVersion: Deno.version.deno,
    appVersion: getVersionSync(),
    pipelinesCount: pipelines.length,
    modulesCount: modules.length,
    uptime: (Date.now() - serverStartTime) / 1000,
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

