import parser from "cron-parser";
import { listPipelines, runPipeline } from "./engine.ts";

export class Scheduler {
  private intervalId: number | null = null;

  // Track execution to prevent double runs within the same minute logic
  // In a real app we'd persist this or use a DB.
  private lastChecks: Map<string, number> = new Map();
  
  // Maximum age for lastChecks entries (5 minutes)
  private readonly MAX_CHECK_AGE_MS = 5 * 60 * 1000;

  start() {
    console.log("[Scheduler] Started");
    // Run immediately then interval
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 60000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
  
  // Cleanup old entries from lastChecks to prevent memory leaks
  private cleanupOldChecks(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.lastChecks) {
      if (now - timestamp > this.MAX_CHECK_AGE_MS) {
        this.lastChecks.delete(key);
      }
    }
  }

  async tick() {
    const now = new Date();
    
    // Periodically cleanup old entries
    this.cleanupOldChecks();
    
    const pipelines = await listPipelines();

    for (const p of pipelines) {
      if (!p.schedule) continue;

      try {
        // Check if it should run
        const interval = parser.parseExpression(p.schedule);
        const prevDate = interval.prev().toDate();

        // If the scheduled previous run was within the last minute (approx), trigger it.
        // We add a margin of error. 
        const diff = now.getTime() - prevDate.getTime();

        // If it happened in the last 70 seconds
        if (diff < 70000 && diff >= 0) {
          // Dedup: if we already ran for this specific time?
          // We can key by pipelineId + prevDate.getTime()
          const key = `${p.id}-${prevDate.getTime()}`;
          if (!this.lastChecks.has(key)) {
            console.log(`[Scheduler] Triggering scheduled pipeline: ${p.name} (${p.id})`);
            this.lastChecks.set(key, Date.now());

            runPipeline(p.id).catch(err => {
              console.error(`[Scheduler] Pipeline ${p.name} failed:`, err);
            });
          }
        }
      } catch (e) {
        console.error(`[Scheduler] Error evaluating schedule for ${p.name}:`, e);
      }
    }
  }
  
  // Get scheduler stats (for monitoring)
  getStats(): { pendingChecks: number } {
    return {
      pendingChecks: this.lastChecks.size,
    };
  }
}
