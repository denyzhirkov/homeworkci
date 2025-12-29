// Log parsing utilities for structured log display

import { formatDuration } from "./format";

export interface LogBlock {
  id: string;
  title: string;
  lines: string[];
  status: "running" | "success" | "error" | "info" | "parallel";
  duration?: number; // milliseconds
  parallelGroup?: string; // group name for parallel steps
  children?: LogBlock[]; // nested blocks for parallel groups
}

// Status colors for log blocks
export const statusColors: Record<LogBlock["status"], string> = {
  success: "#1b5e20",
  error: "#b71c1c",
  running: "#e65100",
  info: "#0d47a1",
  parallel: "#4a148c"
};

// Border colors for log blocks
export const borderColors: Record<LogBlock["status"], string> = {
  success: "#4caf50",
  error: "#f44336",
  running: "#ff9800",
  info: "#2196f3",
  parallel: "#9c27b0"
};

/**
 * Extract timestamp from log line: [2024-12-26T10:30:45.123Z]
 */
export function parseTimestamp(line: string): number | null {
  const match = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/);
  if (match) {
    const date = new Date(match[1]);
    return isNaN(date.getTime()) ? null : date.getTime();
  }
  return null;
}

/**
 * Calculate duration between first and last timestamp in lines
 */
export function calculateDuration(lines: string[]): number | undefined {
  let firstTs: number | null = null;
  let lastTs: number | null = null;

  for (const line of lines) {
    const ts = parseTimestamp(line);
    if (ts !== null) {
      if (firstTs === null) firstTs = ts;
      lastTs = ts;
    }
  }

  if (firstTs !== null && lastTs !== null) {
    return lastTs - firstTs;
  }
  return undefined;
}

/**
 * Parse log content into structured blocks by step
 */
export function parseLogBlocks(content: string): LogBlock[] {
  const lines = content.split("\n");
  const rawBlocks: LogBlock[] = [];
  const blocksByTitle = new Map<string, LogBlock>();
  let currentBlock: LogBlock | null = null;
  let headerLines: string[] = [];
  let blockId = 0;
  
  // Track parallel groups: { groupName: { count: N, startIndex: idx } }
  const parallelGroupInfo = new Map<number, { groupName: string; count: number }>();
  let pendingParallelGroup: { groupName: string; count: number; startBlockIndex: number } | null = null;

  // First pass: create blocks
  for (const line of lines) {
    // Check for parallel group marker: "Running N steps in parallel (group: ...)"
    const parallelMatch = line.match(/Running (\d+) steps in parallel \(group: (.+?)\)/);
    if (parallelMatch) {
      const count = parseInt(parallelMatch[1], 10);
      const groupName = parallelMatch[2];
      // Mark where parallel group starts (next block index)
      pendingParallelGroup = { 
        groupName, 
        count, 
        startBlockIndex: rawBlocks.length + (currentBlock ? 1 : 0)
      };
    }

    // Check for step start marker: "Running step: ..."
    const stepStartMatch = line.match(/\[.*?\] Running step: (.+)$/);
    
    if (stepStartMatch) {
      // Save previous block with duration
      if (currentBlock) {
        currentBlock.duration = calculateDuration(currentBlock.lines);
        rawBlocks.push(currentBlock);
        blocksByTitle.set(currentBlock.title, currentBlock);
      } else if (headerLines.length > 0) {
        // Save header as info block
        rawBlocks.push({
          id: `header-${blockId++}`,
          title: "Pipeline Info",
          lines: headerLines,
          status: "info"
        });
        headerLines = [];
      }
      
      // Check if this block is part of a pending parallel group
      let parallelGroup: string | undefined;
      if (pendingParallelGroup) {
        const currentIndex = rawBlocks.length;
        if (currentIndex >= pendingParallelGroup.startBlockIndex && 
            currentIndex < pendingParallelGroup.startBlockIndex + pendingParallelGroup.count) {
          parallelGroup = pendingParallelGroup.groupName;
        }
        // Store info for later grouping
        if (currentIndex === pendingParallelGroup.startBlockIndex) {
          parallelGroupInfo.set(currentIndex, {
            groupName: pendingParallelGroup.groupName,
            count: pendingParallelGroup.count
          });
        }
      }
      
      // Start new step block
      currentBlock = {
        id: `step-${blockId++}`,
        title: stepStartMatch[1],
        lines: [line],
        status: "running",
        parallelGroup
      };
    } else if (currentBlock) {
      currentBlock.lines.push(line);
      
      // Check for error in current block
      const errorMatch = line.match(/\[ERROR\]|\[.*?\] Pipeline failed:/);
      if (errorMatch) {
        currentBlock.status = "error";
      }
    } else {
      // Lines before first step (header info)
      if (line.trim()) {
        headerLines.push(line);
      }
    }
  }

  // Add remaining block with duration
  if (currentBlock) {
    currentBlock.duration = calculateDuration(currentBlock.lines);
    rawBlocks.push(currentBlock);
    blocksByTitle.set(currentBlock.title, currentBlock);
  } else if (headerLines.length > 0) {
    rawBlocks.push({
      id: `header-${blockId++}`,
      title: "Pipeline Info",
      lines: headerLines,
      status: "info"
    });
  }

  // Second pass: find all "Step '...' completed" messages and update block statuses
  for (const line of lines) {
    const completedMatch = line.match(/\[.*?\] Step '(.+?)' completed/);
    if (completedMatch) {
      const stepTitle = completedMatch[1];
      const block = blocksByTitle.get(stepTitle);
      if (block && block.status !== "error") {
        block.status = "success";
        // Update duration with the completion timestamp
        const completionTs = parseTimestamp(line);
        if (completionTs && block.lines.length > 0) {
          const startTs = parseTimestamp(block.lines[0]);
          if (startTs) {
            block.duration = completionTs - startTs;
          }
        }
      }
    }
  }

  // Third pass: group parallel blocks together
  const finalBlocks: LogBlock[] = [];
  let i = 0;
  while (i < rawBlocks.length) {
    const groupInfo = parallelGroupInfo.get(i);
    if (groupInfo && i + groupInfo.count <= rawBlocks.length) {
      // Create a parallel group container
      const children = rawBlocks.slice(i, i + groupInfo.count);
      const allSuccess = children.every(b => b.status === "success");
      const hasError = children.some(b => b.status === "error");
      const maxDuration = Math.max(...children.map(b => b.duration || 0));
      
      finalBlocks.push({
        id: `parallel-${blockId++}`,
        title: `Parallel: ${groupInfo.groupName}`,
        lines: [],
        status: hasError ? "error" : allSuccess ? "success" : "running",
        duration: maxDuration > 0 ? maxDuration : undefined,
        children
      });
      i += groupInfo.count;
    } else {
      finalBlocks.push(rawBlocks[i]);
      i++;
    }
  }

  // Check for pipeline finish in last block
  const lastLine = lines[lines.length - 1] || "";
  if (lastLine.includes("Pipeline finished")) {
    finalBlocks.push({
      id: `footer-${blockId++}`,
      title: "Summary",
      lines: [lastLine],
      status: "success"
    });
  }

  return finalBlocks;
}

// Re-export formatDuration for convenience
export { formatDuration };


