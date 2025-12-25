// Pipeline-specific events
export type PipelineEvent = 
  | { type: "log"; pipelineId: string; payload: { runId: string; msg: string; ts: string } }
  | { type: "start"; pipelineId: string; payload: { runId: string; totalSteps: number } }
  | { type: "end"; pipelineId: string; payload: { runId: string; success: boolean } }
  | { type: "step-start"; pipelineId: string; payload: { runId: string; step: string; stepIndex: number; totalSteps: number } }
  | { type: "step-end"; pipelineId: string; payload: { runId: string; step: string; stepIndex: number; totalSteps: number; success: boolean; error?: string } };

// System-wide events
export type SystemEvent =
  | { type: "pipelines:changed" }  // Pipeline list changed (created/deleted)
  | { type: "modules:changed" }    // Modules list changed
  | { type: "variables:changed" }; // Variables changed

export type WSEvent = PipelineEvent | SystemEvent;

type Listener = (event: WSEvent) => void;

class PubSub {
  private listeners: Listener[] = [];
  
  // Maximum number of listeners to prevent memory leaks
  private readonly MAX_LISTENERS = 100;

  subscribe(listener: Listener) {
    // Prevent listener accumulation - remove oldest if at limit
    if (this.listeners.length >= this.MAX_LISTENERS) {
      console.warn("[PubSub] Max listeners reached, removing oldest listener");
      this.listeners.shift();
    }
    
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  publish(event: WSEvent) {
    // Wrap each listener call in try-catch to prevent one failing listener
    // from breaking event delivery to other listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error("[PubSub] Listener threw an error:", e);
      }
    }
  }
  
  // Get current listener count (for monitoring)
  getListenerCount(): number {
    return this.listeners.length;
  }
}

export const pubsub = new PubSub();
