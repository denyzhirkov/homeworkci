// Pipeline queue management
// Handles queuing of pipeline runs when max concurrent limit is reached

import { config } from "./config.ts";

// Queue item for a pipeline run request
interface QueueItem {
  runtimeInputs?: Record<string, string | boolean>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// Per-pipeline queue state
interface PipelineQueueState {
  queue: QueueItem[];
  runningCount: number; // Number of currently running instances
}

// Queue state for all pipelines
const pipelineQueues = new Map<string, PipelineQueueState>();

/**
 * Get or create queue state for a pipeline
 */
function getQueueState(pipelineId: string): PipelineQueueState {
  let state = pipelineQueues.get(pipelineId);
  if (!state) {
    state = { queue: [], runningCount: 0 };
    pipelineQueues.set(pipelineId, state);
  }
  return state;
}

/**
 * Check if a pipeline can be run immediately (not at max concurrent limit)
 */
export function canRunImmediately(pipelineId: string): boolean {
  const state = getQueueState(pipelineId);
  const maxConcurrent = config.maxConcurrentRunsPerPipeline;
  return state.runningCount < maxConcurrent;
}

/**
 * Increment running count for a pipeline (called when starting execution)
 */
export function incrementRunningCount(pipelineId: string): void {
  const state = getQueueState(pipelineId);
  state.runningCount++;
}

/**
 * Decrement running count and process queue (called when execution finishes)
 */
export function decrementRunningCount(pipelineId: string): void {
  const state = getQueueState(pipelineId);
  if (state.runningCount > 0) {
    state.runningCount--;
  }
  
  // Process queue if there are waiting items and we're below limit
  processQueue(pipelineId);
}

/**
 * Add a pipeline run request to the queue
 * Returns a Promise that resolves when the run can start
 */
export function enqueuePipeline(
  pipelineId: string,
  runtimeInputs?: Record<string, string | boolean>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const state = getQueueState(pipelineId);
    
    const queueItem: QueueItem = {
      runtimeInputs,
      resolve,
      reject,
      timestamp: Date.now(),
    };
    
    state.queue.push(queueItem);
    console.log(`[Queue] Pipeline ${pipelineId} queued (position: ${state.queue.length}, running: ${state.runningCount}/${config.maxConcurrentRunsPerPipeline})`);
    
    // Try to process immediately (in case queue was empty and we just added)
    processQueue(pipelineId);
  });
}

/**
 * Process queue for a pipeline - start queued runs if under limit
 */
function processQueue(pipelineId: string): void {
  const state = getQueueState(pipelineId);
  const maxConcurrent = config.maxConcurrentRunsPerPipeline;
  
  // Start queued items while under limit
  while (state.runningCount < maxConcurrent && state.queue.length > 0) {
    const item = state.queue.shift();
    if (!item) break;
    
    // Resolve the promise to allow the run to start
    item.resolve(undefined);
    console.log(`[Queue] Pipeline ${pipelineId} dequeued and starting (queue length: ${state.queue.length})`);
  }
}

/**
 * Remove a pipeline from queue (e.g., when pipeline is deleted or stopped)
 */
export function clearQueue(pipelineId: string, reason?: string): void {
  const state = pipelineQueues.get(pipelineId);
  if (!state) return;
  
  // Reject all queued items
  for (const item of state.queue) {
    item.reject(new Error(reason || "Pipeline queue cleared"));
  }
  
  // Clear queue and reset count
  state.queue = [];
  state.runningCount = 0;
  
  pipelineQueues.delete(pipelineId);
  console.log(`[Queue] Cleared queue for pipeline ${pipelineId}${reason ? `: ${reason}` : ""}`);
}

/**
 * Get queue statistics for a pipeline
 */
export function getQueueStats(pipelineId: string): { queued: number; running: number; maxConcurrent: number } {
  const state = getQueueState(pipelineId);
  return {
    queued: state.queue.length,
    running: state.runningCount,
    maxConcurrent: config.maxConcurrentRunsPerPipeline,
  };
}

/**
 * Get queue statistics for all pipelines
 */
export function getAllQueueStats(): Record<string, { queued: number; running: number; maxConcurrent: number }> {
  const stats: Record<string, { queued: number; running: number; maxConcurrent: number }> = {};
  for (const [pipelineId] of pipelineQueues) {
    stats[pipelineId] = getQueueStats(pipelineId);
  }
  return stats;
}
