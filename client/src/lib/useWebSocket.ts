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
  | { type: "log"; pipelineId: string; payload: { runId: string; msg: string; ts: string; stepName?: string } }
  | { type: "start"; pipelineId: string; payload: { runId: string; totalSteps: number } }
  | { type: "end"; pipelineId: string; payload: { runId: string; success: boolean } }
  | { type: "step-start"; pipelineId: string; payload: { runId: string; step: string; stepIndex: number; totalSteps: number } }
  | { type: "step-end"; pipelineId: string; payload: { runId: string; step: string; stepIndex: number; totalSteps: number; success: boolean; error?: string; skipped?: boolean } }
  | { type: "step-skipped"; pipelineId: string; payload: { runId: string; step: string; stepIndex: number; totalSteps: number } }
  | { type: "parallel-start"; pipelineId: string; payload: { runId: string; count: number } }
  | { type: "parallel-end"; pipelineId: string; payload: { runId: string; executed: string[]; skipped: string[] } }
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

// Structured log block for live display
export interface LiveLogBlock {
  id: string;
  type: "info" | "step" | "parallel";
  title: string;
  status: "running" | "success" | "error" | "skipped";
  lines: string[];
  children?: LiveLogBlock[]; // For parallel groups
  startTime?: number;
  endTime?: number;
}

// Hook for pipeline-specific logs
export function usePipelineLogs(pipelineId: string) {
  const [logs, setLogs] = useState<string>("");
  const [liveBlocks, setLiveBlocks] = useState<LiveLogBlock[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  
  // Track current parallel group for grouping steps
  const parallelGroupRef = useRef<{ id: string; count: number; children: LiveLogBlock[] } | null>(null);
  const blockIdRef = useRef(0);

  const handleEvent = useCallback(
    (event: WSEvent) => {
      if ("pipelineId" in event && event.pipelineId !== pipelineId) {
        return;
      }

      switch (event.type) {
        case "start":
          setLogs(`Pipeline started: ${event.payload.runId}\n`);
          setLiveBlocks([]);
          setIsRunning(true);
          setCurrentRunId(event.payload.runId);
          blockIdRef.current = 0;
          parallelGroupRef.current = null;
          break;
          
        case "log":
          // Append to raw logs
          setLogs((prev) => prev + `[${event.payload.ts}] ${event.payload.msg}\n`);
          
          // Add to structured blocks
          const { stepName, msg, ts } = event.payload;
          const logLine = `[${ts}] ${msg}`;
          
          if (stepName) {
            // Add log to specific step
            setLiveBlocks((prev) => {
              const updated = [...prev];
              // Find the step block (could be in parallel group)
              for (let i = updated.length - 1; i >= 0; i--) {
                const block = updated[i];
                if (block.type === "step" && block.title === stepName) {
                  block.lines.push(logLine);
                  return updated;
                }
                if (block.type === "parallel" && block.children) {
                  const child = block.children.find(c => c.title === stepName);
                  if (child) {
                    child.lines.push(logLine);
                    return updated;
                  }
                }
              }
              return prev;
            });
          } else {
            // Info log (before any step or pipeline-level)
            setLiveBlocks((prev) => {
              // Find or create info block
              const lastBlock = prev[prev.length - 1];
              if (lastBlock?.type === "info" && lastBlock.status === "running") {
                return [...prev.slice(0, -1), { ...lastBlock, lines: [...lastBlock.lines, logLine] }];
              }
              // Create new info block
              return [...prev, {
                id: `info-${blockIdRef.current++}`,
                type: "info",
                title: "Pipeline Info",
                status: "running",
                lines: [logLine]
              }];
            });
          }
          break;
          
        case "parallel-start":
          // Start collecting steps for parallel group
          parallelGroupRef.current = {
            id: `parallel-${blockIdRef.current++}`,
            count: event.payload.count,
            children: []
          };
          break;
          
        case "step-start":
          {
            const newStep: LiveLogBlock = {
              id: `step-${blockIdRef.current++}`,
              type: "step",
              title: event.payload.step,
              status: "running",
              lines: [],
              startTime: Date.now()
            };
            
            if (parallelGroupRef.current) {
              parallelGroupRef.current.children.push(newStep);
            } else {
              // Mark previous info block as success
              setLiveBlocks((prev) => {
                const updated = prev.map(b => 
                  b.type === "info" && b.status === "running" 
                    ? { ...b, status: "success" as const } 
                    : b
                );
                return [...updated, newStep];
              });
            }
          }
          break;
          
        case "step-skipped":
          {
            const skippedStep: LiveLogBlock = {
              id: `step-${blockIdRef.current++}`,
              type: "step",
              title: event.payload.step,
              status: "skipped",
              lines: [],
              startTime: Date.now(),
              endTime: Date.now()
            };
            
            if (parallelGroupRef.current) {
              parallelGroupRef.current.children.push(skippedStep);
            } else {
              setLiveBlocks((prev) => [...prev, skippedStep]);
            }
          }
          break;
          
        case "step-end":
          {
            const stepStatus = event.payload.skipped ? "skipped" : (event.payload.success ? "success" : "error");
            const endTime = Date.now();
            
            if (parallelGroupRef.current) {
              // Update step in parallel group
              const child = parallelGroupRef.current.children.find(c => c.title === event.payload.step);
              if (child) {
                child.status = stepStatus;
                child.endTime = endTime;
              }
            } else {
              // Update standalone step
              setLiveBlocks((prev) => prev.map(b => 
                b.type === "step" && b.title === event.payload.step
                  ? { ...b, status: stepStatus, endTime }
                  : b
              ));
            }
            
            if (!event.payload.success && event.payload.error) {
              setLogs((prev) => prev + `[ERROR] ${event.payload.error}\n`);
            }
          }
          break;
          
        case "parallel-end":
          if (parallelGroupRef.current) {
            const group = parallelGroupRef.current;
            const hasError = group.children.some(c => c.status === "error");
            const allDone = group.children.every(c => c.status === "success" || c.status === "skipped");
            
            const parallelBlock: LiveLogBlock = {
              id: group.id,
              type: "parallel",
              title: `Parallel Group (${group.count} steps)`,
              status: hasError ? "error" : (allDone ? "success" : "running"),
              lines: [],
              children: group.children
            };
            
            setLiveBlocks((prev) => {
              // Mark previous info block as success if exists
              const updated = prev.map(b => 
                b.type === "info" && b.status === "running" 
                  ? { ...b, status: "success" as const } 
                  : b
              );
              return [...updated, parallelBlock];
            });
            
            parallelGroupRef.current = null;
          }
          break;
          
        case "end":
          setLogs((prev) => prev + `Pipeline finished. Success: ${event.payload.success}\n`);
          setIsRunning(false);
          // Mark any remaining running blocks as complete
          setLiveBlocks((prev) => prev.map(b => 
            b.status === "running" ? { ...b, status: "success" as const } : b
          ));
          break;
      }
    },
    [pipelineId]
  );

  useWebSocket(handleEvent);

  const clearLogs = useCallback(() => {
    setLogs("");
    setLiveBlocks([]);
    setCurrentRunId(null);
  }, []);

  return { logs, liveBlocks, isRunning, currentRunId, clearLogs, setIsRunning };
}

