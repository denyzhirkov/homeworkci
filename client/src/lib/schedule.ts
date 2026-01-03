// Schedule utilities for cron parsing and time formatting
import parser from "cron-parser";

/**
 * Calculate time remaining until next scheduled run
 * @param schedule - Cron expression string
 * @returns Object with formatted time string and raw milliseconds, or null if invalid
 */
export function getNextRunInfo(schedule: string): { 
  timeLeft: string; 
  nextRun: Date; 
  msLeft: number;
} | null {
  try {
    const interval = parser.parseExpression(schedule);
    const nextRun = interval.next().toDate();
    const now = new Date();
    const msLeft = nextRun.getTime() - now.getTime();
    
    if (msLeft <= 0) return null;
    
    return {
      timeLeft: formatTimeLeft(msLeft),
      nextRun,
      msLeft,
    };
  } catch {
    return null;
  }
}

/**
 * Format milliseconds to human-readable time string
 */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "now";
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  return `${seconds}s`;
}

/**
 * Hook-compatible function to get a formatted "next run" label
 */
export function getScheduleLabel(schedule: string): string {
  const info = getNextRunInfo(schedule);
  if (!info) return schedule;
  return `Next: ${info.timeLeft}`;
}

