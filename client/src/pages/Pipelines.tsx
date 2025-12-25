import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { PlayArrow, Schedule, Stop, FolderOpen } from "@mui/icons-material";
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Chip, Stack, Container, CircularProgress, LinearProgress, Accordion, AccordionSummary, AccordionDetails
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { getPipelines, type Pipeline, runPipeline, stopPipeline } from "../lib/api";
import { useWebSocket, type WSEvent } from "../lib/useWebSocket";
import { LiveLogChip } from "../components/LiveLogChip";
import TagFilter, { extractUniqueTags, filterByTags, groupByTags } from "../components/TagFilter";

// Track progress for running pipelines: { pipelineId: { completed: number, total: number } }
interface ProgressInfo {
  completed: number;
  total: number;
}

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, ProgressInfo>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Extract unique tags and filter/group pipelines
  const allTags = useMemo(() => extractUniqueTags(pipelines), [pipelines]);
  const filteredPipelines = useMemo(() => filterByTags(pipelines, selectedTags), [pipelines, selectedTags]);
  const groupedPipelines = useMemo(() => groupByTags(filteredPipelines), [filteredPipelines]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Initial load
  useEffect(() => {
    getPipelines()
      .then(setPipelines)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Handle WebSocket events for real-time updates
  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === "init") {
      // Update from initial state
      setPipelines(prev => {
        return prev.map(p => {
          const status = event.pipelines.find(s => s.id === p.id);
          return status ? { ...p, isRunning: status.isRunning } : p;
        });
      });
      setLoading(false);
    } else if (event.type === "start" && "pipelineId" in event) {
      // Mark pipeline as running and init progress
      setPipelines(prev =>
        prev.map(p => p.id === event.pipelineId ? { ...p, isRunning: true } : p)
      );
      setProgress(prev => ({
        ...prev,
        [event.pipelineId]: { completed: 0, total: event.payload.totalSteps }
      }));
    } else if (event.type === "step-end" && "pipelineId" in event) {
      // Update progress on step completion
      setProgress(prev => ({
        ...prev,
        [event.pipelineId]: {
          completed: event.payload.stepIndex + 1,
          total: event.payload.totalSteps
        }
      }));
    } else if (event.type === "end" && "pipelineId" in event) {
      // Mark pipeline as not running and clear progress
      setPipelines(prev =>
        prev.map(p => p.id === event.pipelineId ? { ...p, isRunning: false } : p)
      );
      setProgress(prev => {
        const { [event.pipelineId]: _, ...rest } = prev;
        return rest;
      });
    } else if (event.type === "pipelines:changed") {
      // Refetch pipelines list when pipelines are added/removed
      getPipelines().then(setPipelines).catch(console.error);
    }
  }, []);

  useWebSocket(handleEvent);

  const handleRun = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await runPipeline(id);
      // No need to refetch - WebSocket will update the state
    } catch (err) {
      console.error("Error triggering pipeline:", err);
    }
  };

  const handleStop = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await stopPipeline(id);
    } catch (err) {
      console.error("Error stopping pipeline:", err);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 1 }}>
        <Typography variant="h5" component="h1">
          Pipelines
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
            — Manage and monitor your automation workflows
          </Typography>
        </Typography>
        <Button
          component={Link}
          to="/pipelines/new"
          variant="contained"
        >
          NEW PIPELINE
        </Button>
      </Box>

      {/* Tag Filter */}
      <TagFilter
        tags={allTags}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onClearAll={() => setSelectedTags([])}
      />

      {/* Grouped by tags */}
      {Object.keys(groupedPipelines).length > 0 ? (
        Object.entries(groupedPipelines).map(([tag, pipelinesInGroup]) => (
          <Accordion key={tag} defaultExpanded sx={{ mb: 2, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'action.hover' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderOpen fontSize="small" color="action" />
                <Typography variant="subtitle1" fontWeight="medium">
                  {tag === 'untagged' ? 'Untagged' : tag}
                </Typography>
                <Chip label={pipelinesInGroup.length} size="small" />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                {pipelinesInGroup.map(p => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: '0.3s',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 }
              }}
              component={Link}
              to={`/pipelines/${p.id}`}
              style={{ textDecoration: 'none' }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="div" gutterBottom>
                  {p.name || p.id}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mb={1}>
                  <Chip label={`${p.steps?.length || 0} steps`} size="small" />
                  {p.isDemo && (
                    <Chip label="Demo" size="small" color="info" />
                  )}
                  {p.schedule && (
                    <Chip
                      icon={<Schedule />}
                      label={p.schedule}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {p.isRunning && (
                    <Chip
                      icon={<CircularProgress size={12} color="inherit" />}
                      label="Running"
                      size="small"
                      color="success"
                    />
                  )}
                  {p.tags?.map(t => (
                    <Chip key={t} label={t} size="small" variant="outlined" color="secondary" />
                  ))}
                </Stack>
                {/* Always reserve space to prevent layout shift */}
                <Box sx={{ 
                  mt: 1,
                  height: 24,
                  bgcolor: p.isRunning ? '#1e1e1e' : 'transparent',
                  borderRadius: 1,
                  overflow: 'hidden',
                  transition: 'background-color 0.2s',
                }}>
                  {p.isRunning && <LiveLogChip pipelineId={p.id} />}
                </Box>
              </CardContent>
              {/* Progress bar at bottom of card */}
              {p.isRunning && (
                <LinearProgress
                  variant={progress[p.id] ? "determinate" : "indeterminate"}
                  value={progress[p.id] ? (progress[p.id].completed / progress[p.id].total) * 100 : undefined}
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                  }}
                />
              )}
              <CardActions disableSpacing sx={{ justifyContent: 'flex-end', borderTop: '1px solid #eee' }}>
                {!p.isRunning ? (
                  <Button
                    size="small"
                    color="success"
                    startIcon={<PlayArrow />}
                    onClick={(e) => handleRun(e, p.id)}
                  >
                    Run Now
                  </Button>
                ) : (
                  <Button
                    size="small"
                    color="error"
                    variant="contained"
                    startIcon={<Stop />}
                    onClick={(e) => handleStop(e, p.id)}
                  >
                    Stop
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        <Box
          sx={{
            p: 8,
            textAlign: 'center',
            border: '2px dashed #eee',
            borderRadius: 2,
            bgcolor: 'background.paper'
          }}
        >
          <Typography color="text.secondary" gutterBottom>
            {pipelines.length === 0 ? 'No pipelines found.' : 'No pipelines match the selected filters.'}
          </Typography>
          <Button component={Link} to="/pipelines/new">
            Create your first pipeline
          </Button>
        </Box>
      )}
    </Container>
  );
}
