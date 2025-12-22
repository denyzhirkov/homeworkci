// Variables routes - Environment variables management

import { Hono } from "hono";
import { loadVariables, saveVariables } from "../variables.ts";
import { pubsub } from "../pubsub.ts";

const app = new Hono();

// Get all variables
app.get("/", async (c) => {
  const vars = await loadVariables();
  return c.json(vars);
});

// Save variables
app.post("/", async (c) => {
  try {
    const vars = await c.req.json();
    await saveVariables(vars);
    pubsub.publish({ type: "variables:changed" });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

export default app;

