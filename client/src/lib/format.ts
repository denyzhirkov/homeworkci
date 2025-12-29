// Formatting utilities for client-side display

/**
 * Formats duration in milliseconds to human-readable string
 * Examples: 500 -> "500ms", 1500 -> "1.5s", 90000 -> "1m 30s"
 */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}


