// Module routes - CRUD for pipeline step modules

import { Hono } from "hono";
import { listModules, getModuleSource, saveModule, deleteModule, isBuiltInModule } from "../modules.ts";
import { pubsub } from "../pubsub.ts";

const app = new Hono();

// List all modules
app.get("/", async (c) => {
  const modules = await listModules();
  return c.json(modules);
});

// Get module details
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const source = await getModuleSource(id);
    const isBuiltIn = isBuiltInModule(id);
    return c.json({ source, isBuiltIn });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

// Save/update module
app.post("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  if (typeof body.source !== "string") {
    return c.json({ error: "Missing source" }, 400);
  }
  await saveModule(id, body.source);
  pubsub.publish({ type: "modules:changed" });
  return c.json({ success: true });
});

// Delete module
app.delete("/:id", async (c) => {
  try {
    await deleteModule(c.req.param("id"));
    pubsub.publish({ type: "modules:changed" });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

export default app;

