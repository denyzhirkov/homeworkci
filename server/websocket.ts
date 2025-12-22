// WebSocket handler for real-time events

import { listPipelines, getActivePipelines, isDemoPipeline } from "./engine.ts";
import { pubsub } from "./pubsub.ts";

// Track all connected WebSocket clients
const wsClients = new Set<WebSocket>();

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
    wsClients.delete(socket);
  };

  socket.onerror = (e) => {
    console.error("[WS] Error:", e);
    wsClients.delete(socket);
  };

  return response;
}

