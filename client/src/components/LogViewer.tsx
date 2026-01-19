import { Box, Typography, Chip, Collapse } from "@mui/material";
import { CheckCircle, Error, HourglassEmpty, ExpandMore, ExpandLess, CallSplit, SkipNext } from "@mui/icons-material";
import { useState, useMemo } from "react";
import { 
  parseLogBlocks, 
  formatDuration, 
  statusColors, 
  borderColors, 
  type LogBlock 
} from "../lib/log-parser";
import type { LiveLogBlock } from "../lib/useWebSocket";

interface LogViewerProps {
  content?: string;
  liveBlocks?: LiveLogBlock[];
  isLive?: boolean;
}

function StatusIcon({ status }: { status: LogBlock["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle sx={{ fontSize: 16, color: "#4caf50" }} />;
    case "error":
      return <Error sx={{ fontSize: 16, color: "#f44336" }} />;
    case "running":
      return <HourglassEmpty sx={{ fontSize: 16, color: "#ff9800" }} />;
    case "skipped":
      return <SkipNext sx={{ fontSize: 16, color: "#9e9e9e" }} />;
    default:
      return null;
  }
}

function LogBlockComponent({ block, defaultExpanded = true, nested = false }: { 
  block: LogBlock; 
  defaultExpanded?: boolean;
  nested?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = block.children && block.children.length > 0;

  return (
    <Box sx={{ mb: nested ? 0.5 : 1 }}>
      {/* Block Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: nested ? 0.75 : 1,
          bgcolor: statusColors[block.status],
          borderLeft: `3px solid ${borderColors[block.status]}`,
          borderRadius: expanded ? "4px 4px 0 0" : "4px",
          cursor: "pointer",
          "&:hover": { opacity: 0.9 }
        }}
      >
        {hasChildren ? (
          <CallSplit sx={{ fontSize: 16, color: "#ce93d8", transform: "rotate(180deg)" }} />
        ) : (
          <StatusIcon status={block.status} />
        )}
        <Typography
          variant="body2"
          sx={{ 
            flex: 1, 
            fontWeight: 500, 
            color: "#fff", 
            fontFamily: "monospace",
            fontSize: nested ? 11 : 12
          }}
        >
          {block.title}
          {hasChildren && (
            <Typography component="span" sx={{ ml: 1, opacity: 0.7, fontSize: 10 }}>
              ({block.children!.length} steps)
            </Typography>
          )}
        </Typography>
        {block.duration !== undefined && block.duration > 0 && (
          <Chip
            label={formatDuration(block.duration)}
            size="small"
            sx={{ 
              height: 18, 
              fontSize: 10, 
              bgcolor: "rgba(255,255,255,0.2)", 
              color: "#fff",
              "& .MuiChip-label": { px: 1 }
            }}
          />
        )}
        {expanded ? (
          <ExpandLess sx={{ fontSize: 18, color: "#fff" }} />
        ) : (
          <ExpandMore sx={{ fontSize: 18, color: "#fff" }} />
        )}
      </Box>

      {/* Block Content */}
      <Collapse in={expanded}>
        {hasChildren ? (
          // Render nested blocks for parallel group
          <Box
            sx={{
              p: 1,
              bgcolor: "#1a1a2e",
              borderLeft: `3px solid ${borderColors[block.status]}`,
              borderRadius: "0 0 4px 4px"
            }}
          >
            {block.children!.map((child) => (
              <LogBlockComponent
                key={child.id}
                block={child}
                defaultExpanded={false}
                nested
              />
            ))}
          </Box>
        ) : block.lines.length > 0 ? (
          <Box
            sx={{
              p: 1.5,
              bgcolor: "#0d0d0d",
              borderLeft: `3px solid ${borderColors[block.status]}`,
              borderRadius: "0 0 4px 4px"
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "#b0b0b0",
                fontSize: 11,
                lineHeight: 1.4
              }}
            >
              {block.lines.join("\n")}
            </pre>
          </Box>
        ) : null}
      </Collapse>
    </Box>
  );
}

// Convert LiveLogBlock to LogBlock format
function convertLiveBlocks(liveBlocks: LiveLogBlock[]): LogBlock[] {
  return liveBlocks.map((lb): LogBlock => ({
    id: lb.id,
    title: lb.title,
    lines: lb.lines,
    status: lb.type === "parallel" ? "parallel" : 
            lb.type === "info" ? "info" : 
            lb.status,
    duration: lb.startTime && lb.endTime ? lb.endTime - lb.startTime : undefined,
    children: lb.children ? convertLiveBlocks(lb.children) : undefined
  }));
}

export default function LogViewer({ content, liveBlocks, isLive = false }: LogViewerProps) {
  // Use liveBlocks if provided, otherwise parse from content
  const blocks = useMemo(() => {
    if (liveBlocks && liveBlocks.length > 0) {
      return convertLiveBlocks(liveBlocks);
    }
    return content ? parseLogBlocks(content) : [];
  }, [content, liveBlocks]);

  const isEmpty = !liveBlocks?.length && (!content || content.trim() === "");

  if (isEmpty) {
    return (
      <Typography color="gray" sx={{ p: 2, textAlign: "center" }}>
        {isLive ? "Waiting for logs..." : "No logs available"}
      </Typography>
    );
  }

  // If no blocks parsed (simple log), show as plain text
  if (blocks.length === 0 && content) {
    return (
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#b0b0b0", padding: 16 }}>
        {content}
      </pre>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
      {blocks.map((block, index) => (
        <LogBlockComponent
          key={block.id}
          block={block}
          defaultExpanded={isLive || index >= blocks.length - 3}
        />
      ))}
    </Box>
  );
}
