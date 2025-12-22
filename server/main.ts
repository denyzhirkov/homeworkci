// HomeworkCI Server - Main entry point
// Lightweight CI/CD pipeline runner

import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { cors } from "hono/cors";
import { Scheduler } from "./scheduler.ts";
import { config, logConfig } from "./config.ts";
import { initVersion, getVersionSync } from "./utils/index.ts";
import { cleanupOldSandboxes } from "./engine.ts";
import { handleWebSocket } from "./websocket.ts";
import { pipelines, modules, variables, stats, handleSandboxCleanup } from "./routes/index.ts";

const app = new Hono();

// --- Middleware ---

// Request logger
app.use("*", async (c, next) => {
  await next();
  console.log(`[${c.req.method}] ${c.req.path} -> ${c.res.status}`);
});

// Enable CORS for frontend during dev
app.use("/*", cors());

// --- Health Check ---
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: Date.now(),
    version: getVersionSync(),
  });
});

// --- API Routes ---
app.route("/api/pipelines", pipelines);
app.route("/api/modules", modules);
app.route("/api/variables", variables);
app.route("/api/stats", stats);

// Sandbox cleanup endpoint
app.post("/api/sandbox/cleanup", handleSandboxCleanup);

// WebSocket endpoint
app.get("/api/ws", (c) => handleWebSocket(c.req.raw));

// --- Static Assets ---
app.use("/assets/*", serveStatic({ root: "./client/dist" }));
app.use("/*", serveStatic({ root: "./client/dist" }));
app.get("*", serveStatic({ path: "./client/dist/index.html" }));

// --- Server startup ---
if (import.meta.main) {
  // Initialize version cache
  await initVersion();

  // Log configuration
  logConfig();

  // Start scheduler if enabled
  if (config.enableScheduler) {
    const scheduler = new Scheduler();
    scheduler.start();
  }

  // Cleanup old sandbox directories on startup
  cleanupOldSandboxes(config.sandboxMaxAgeMs).then((cleaned) => {
    if (cleaned > 0) {
      console.log(`[Startup] Cleaned up ${cleaned} old sandbox directories`);
    }
  });

  console.log(`Starting HomeworkCI server on http://${config.host}:${config.port}`);
  Deno.serve({ port: config.port, hostname: config.host }, app.fetch);
}

export default app;
