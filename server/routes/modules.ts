// Module routes - CRUD for pipeline step modules

import { Hono } from "hono";
import { listModules, getModuleSource, saveModule, deleteModule, isBuiltInModule, loadModule } from "../modules.ts";
import { pubsub } from "../pubsub.ts";

const app = new Hono();

// List all modules
app.get("/", async (c) => {
  const modules = await listModules();
  return c.json(modules);
});

// Get all module schemas for editor hints
app.get("/schemas", async (c) => {
  const modules = await listModules();
  const schemas: Record<string, unknown> = {};
  
  for (const mod of modules) {
    try {
      const loaded = await loadModule(mod.id);
      if (loaded && "schema" in loaded && loaded.schema) {
        schemas[mod.id] = loaded.schema;
      }
    } catch {
      // Skip modules without schema or with load errors
    }
  }
  
  return c.json(schemas);
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

