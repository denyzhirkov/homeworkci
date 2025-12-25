import { useEffect, useRef, useState, useCallback } from "react";

// Pipeline status from initial state
export interface PipelineStatus {
  id: string;
  name: string;
  isRunning: boolean;
  isDemo: boolean;
  schedule?: string;
  stepsCount: number;
}

// System metrics payload
export interface SystemMetrics {
  memoryPercent: string;
  memoryUsed: string;
  memoryTotal: string;
  cpuLoad: string;
}

// Event types matching server pubsub.ts
export type WSEvent =
  | { type: "init"; pipelines: PipelineStatus[] }
  | { type: "log"; pipelineId: string; payload: { runId: string; msg: string; ts: string } }
  | { type: "start"; pipelineId: string; payload: { runId: string; totalSteps: number } }
  | { type: "end"; pipelineId: string; payload: { runId: string; success: boolean } }
  | { type: "step-start"; pipelineId: string; payload: { runId: string; step: string; stepIndex: number; totalSteps: number } }
  | { type: "step-end"; pipelineId: string; payload: { runId: string; step: string; stepIndex: number; totalSteps: number; success: boolean; error?: string } }
  | { type: "system"; payload: SystemMetrics }
  | { type: "pipelines:changed" }
  | { type: "modules:changed" }
  | { type: "variables:changed" };

type EventCallback = (event: WSEvent) => void;

// Global state for WebSocket connection (singleton pattern)
let globalSocket: WebSocket | null = null;
let globalListeners: Set<EventCallback> = new Set();
let reconnectTimeout: number | null = null;
let isConnecting = false;

// Get WebSocket URL based on current location
function getWSUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/api/ws`;
}

function connect() {
  if (globalSocket?.readyState === WebSocket.OPEN || isConnecting) {
    return;
  }

  isConnecting = true;
  console.log("[WS] Connecting...");

  const ws = new WebSocket(getWSUrl());

  ws.onopen = () => {
    console.log("[WS] Connected");
    globalSocket = ws;
    isConnecting = false;
  };

  ws.onmessage = (e) => {
    try {
      const event: WSEvent = JSON.parse(e.data);
      // Broadcast to all listeners
      globalListeners.forEach((cb) => cb(event));
    } catch (err) {
      console.error("[WS] Failed to parse message:", err);
    }
  };

  ws.onclose = () => {
    console.log("[WS] Disconnected");
    globalSocket = null;
    isConnecting = false;

    // Reconnect after delay if there are still listeners
    if (globalListeners.size > 0 && !reconnectTimeout) {
      reconnectTimeout = window.setTimeout(() => {
        reconnectTimeout = null;
        connect();
      }, 2000);
    }
  };

  ws.onerror = (e) => {
    console.error("[WS] Error:", e);
    ws.close();
  };
}

function subscribe(callback: EventCallback): () => void {
  globalListeners.add(callback);

  // Connect if not already connected
  if (!globalSocket && !isConnecting) {
    connect();
  }

  // Return unsubscribe function
  return () => {
    globalListeners.delete(callback);

    // Disconnect if no more listeners
    if (globalListeners.size === 0) {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      globalSocket?.close();
      globalSocket = null;
    }
  };
}

// Hook to subscribe to all WebSocket events
export function useWebSocket(onEvent: EventCallback): void {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const handler: EventCallback = (event) => {
      callbackRef.current(event);
    };

    return subscribe(handler);
  }, []);
}

// Hook to get pipeline statuses with automatic updates
export function usePipelineStatuses() {
  const [pipelines, setPipelines] = useState<PipelineStatus[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === "init") {
      setPipelines(event.pipelines);
      setIsConnected(true);
    } else if (event.type === "start") {
      // Mark pipeline as running
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === event.pipelineId ? { ...p, isRunning: true } : p
        )
      );
    } else if (event.type === "end") {
      // Mark pipeline as not running
      setPipelines((prev) =>
        prev.map((p) =>
          p.id === event.pipelineId ? { ...p, isRunning: false } : p
        )
      );
    } else if (event.type === "pipelines:changed") {
      // Refetch pipelines list (could optimize by including data in event)
      fetch("/api/pipelines")
        .then((res) => res.json())
        .then((data) => {
          setPipelines(
            data.map((p: any) => ({
              id: p.id,
              name: p.name,
              isRunning: p.isRunning,
              isDemo: p.isDemo,
              schedule: p.schedule,
              stepsCount: p.steps?.length || 0,
            }))
          );
        })
        .catch(console.error);
    }
  }, []);

  useWebSocket(handleEvent);

  return { pipelines, isConnected };
}

// Hook for pipeline-specific logs
export function usePipelineLogs(pipelineId: string) {
  const [logs, setLogs] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const handleEvent = useCallback(
    (event: WSEvent) => {
      if ("pipelineId" in event && event.pipelineId !== pipelineId) {
        return;
      }

      switch (event.type) {
        case "start":
          setLogs(`Pipeline started: ${event.payload.runId}\n`);
          setIsRunning(true);
          setCurrentRunId(event.payload.runId);
          break;
        case "log":
          setLogs((prev) => prev + `[${event.payload.ts}] ${event.payload.msg}\n`);
          break;
        case "step-start":
          // Could add step tracking here
          break;
        case "step-end":
          if (!event.payload.success && event.payload.error) {
            setLogs((prev) => prev + `[ERROR] ${event.payload.error}\n`);
          }
          break;
        case "end":
          setLogs((prev) => prev + `Pipeline finished. Success: ${event.payload.success}\n`);
          setIsRunning(false);
          break;
      }
    },
    [pipelineId]
  );

  useWebSocket(handleEvent);

  const clearLogs = useCallback(() => {
    setLogs("");
    setCurrentRunId(null);
  }, []);

  return { logs, isRunning, currentRunId, clearLogs, setIsRunning };
}

