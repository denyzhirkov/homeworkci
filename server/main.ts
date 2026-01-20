// HomeworkCI Server - Main entry point
// Lightweight CI/CD pipeline runner

import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { cors } from "hono/cors";
import { Scheduler } from "./scheduler.ts";
import { config, logConfig } from "./config.ts";
import { initVersion, getVersionSync } from "./utils/index.ts";
import { cleanupOldSandboxes, stopAllPipelines } from "./engine.ts";
import { handleWebSocket, closeAllWebSocketConnections } from "./websocket.ts";
import { pipelines, modules, variables, stats, settings, updates, handleSandboxCleanup } from "./routes/index.ts";
import { recoverInterruptedRuns } from "./db.ts";

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
app.route("/api/settings", settings);
app.route("/api/updates", updates);

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

  // Recovery: Mark all running pipelines as interrupted (from previous crash/stop)
  const interruptedCount = recoverInterruptedRuns();

  // Start scheduler if enabled
  let scheduler: Scheduler | null = null;
  if (config.enableScheduler) {
    scheduler = new Scheduler();
    scheduler.start();
  }

  // Cleanup old sandbox directories on startup
  cleanupOldSandboxes(config.sandboxMaxAgeMs).then((cleaned) => {
    if (cleaned > 0) {
      console.log(`[Startup] Cleaned up ${cleaned} old sandbox directories`);
    }
  });

  // Graceful shutdown handler
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log(`[Shutdown] Received ${signal} again, forcing exit...`);
      Deno.exit(1);
    }
    
    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}, shutting down gracefully...`);

    try {
      // 1. Stop accepting new requests (server will stop after current requests)
      console.log("[Shutdown] Stopping scheduler...");
      if (scheduler) {
        scheduler.stop();
      }

      // 2. Stop all running pipelines
      console.log("[Shutdown] Stopping active pipelines...");
      const stoppedCount = await stopAllPipelines();

      // 3. Close all WebSocket connections
      console.log("[Shutdown] Closing WebSocket connections...");
      const closedConnections = closeAllWebSocketConnections();

      // 4. Give a moment for cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log(`[Shutdown] Graceful shutdown complete (stopped ${stoppedCount} pipeline(s), closed ${closedConnections} connection(s))`);
      Deno.exit(0);
    } catch (e) {
      console.error("[Shutdown] Error during shutdown:", e);
      Deno.exit(1);
    }
  };

  // Register signal handlers for graceful shutdown
  Deno.addSignalListener("SIGINT", () => shutdown("SIGINT"));
  Deno.addSignalListener("SIGTERM", () => shutdown("SIGTERM"));

  console.log(`Starting HomeworkCI server on http://${config.host}:${config.port}`);
  Deno.serve({ port: config.port, hostname: config.host }, app.fetch);
}

export default app;
