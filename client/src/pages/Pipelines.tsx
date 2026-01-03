import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { PlayArrow, Stop, FolderOpen, Settings, Pause, AccessTime } from "@mui/icons-material";
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Chip, Stack, Container, CircularProgress, LinearProgress, Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox, Select, MenuItem, FormControl, InputLabel, TextField, Tooltip
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { getPipelines, type Pipeline, type PipelineInput, runPipeline, stopPipeline, toggleSchedulePause, countSteps } from "../lib/api";
import { useWebSocket, type WSEvent } from "../lib/useWebSocket";
import { LiveLogChip } from "../components/LiveLogChip";
import TagFilter, { extractUniqueTags, filterByTags, groupByTags } from "../components/TagFilter";
import { initializeInputValues } from "../lib/pipeline-inputs";
import { getNextRunInfo } from "../lib/schedule";

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

  // Run modal state
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string | boolean>>({});
  
  // Schedule countdown - force re-render every minute for countdown updates
  const [, setScheduleTick] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setScheduleTick(t => t + 1), 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

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

  const handleRunDirect = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await executeRun(id);
  };

  const handleOpenModal = (e: React.MouseEvent, pipeline: Pipeline) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPipeline(pipeline);
    setInputValues(initializeInputValues(pipeline.inputs));
    setShowRunModal(true);
  };

  const executeRun = async (id: string, inputs?: Record<string, string | boolean>) => {
    try {
      setShowRunModal(false);
      setSelectedPipeline(null);
      await runPipeline(id, inputs);
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

  const handleToggleSchedule = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const result = await toggleSchedulePause(id);
      // Update local state immediately
      setPipelines(prev =>
        prev.map(p => p.id === id ? { ...p, schedulePaused: result.schedulePaused } : p)
      );
    } catch (err) {
      console.error("Error toggling schedule:", err);
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
                  <Chip label={`${p.steps ? countSteps(p.steps) : 0} steps`} size="small" />
                  {p.isDemo && (
                    <Chip label="Demo" size="small" color="info" />
                  )}
                  {p.schedule && (() => {
                    const nextInfo = !p.schedulePaused ? getNextRunInfo(p.schedule) : null;
                    return (
                      <Tooltip 
                        title={p.schedulePaused 
                          ? `Schedule paused (${p.schedule})` 
                          : nextInfo 
                            ? `Next run in ${nextInfo.timeLeft} (${p.schedule})` 
                            : `Schedule: ${p.schedule}`
                        } 
                        arrow
                      >
                        <Chip
                          icon={p.schedulePaused ? <Pause sx={{ fontSize: 14 }} /> : <AccessTime sx={{ fontSize: 14 }} />}
                          label={p.schedulePaused ? "Paused" : (nextInfo ? nextInfo.timeLeft : p.schedule)}
                          size="small"
                          color={p.schedulePaused ? "warning" : "info"}
                          variant="filled"
                          sx={{ fontWeight: 500, opacity: p.schedulePaused ? 0.8 : 1 }}
                        />
                      </Tooltip>
                    );
                  })()}
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
              <CardActions disableSpacing sx={{ justifyContent: 'flex-end', borderTop: '1px solid #eee', gap: 0.5 }}>
                {!p.isRunning ? (
                  <>
                    {/* Schedule pause/resume button */}
                    {p.schedule && (
                      <Tooltip title={p.schedulePaused ? "Resume schedule" : "Pause schedule"} arrow>
                        <Button
                          size="small"
                          variant={p.schedulePaused ? "contained" : "outlined"}
                          onClick={(e) => handleToggleSchedule(e, p.id)}
                          sx={{ 
                            minWidth: 36, 
                            px: 1,
                            ...(p.schedulePaused ? {
                              bgcolor: "warning.main",
                              color: "warning.contrastText",
                              "&:hover": { bgcolor: "warning.dark" },
                            } : {
                              borderColor: "warning.main",
                              color: "warning.main",
                              "&:hover": { borderColor: "warning.dark", bgcolor: "rgba(237, 108, 2, 0.08)" },
                            })
                          }}
                        >
                          {p.schedulePaused ? <PlayArrow fontSize="small" /> : <Pause fontSize="small" />}
                        </Button>
                      </Tooltip>
                    )}
                    {p.inputs && p.inputs.length > 0 && (
                      <Tooltip title="Configure parameters" arrow>
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={(e) => handleOpenModal(e, p)}
                          sx={{ minWidth: 36, px: 1 }}
                        >
                          <Settings fontSize="small" />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip title={p.inputs?.length ? "Run with default parameters" : "Run pipeline"} arrow>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<PlayArrow />}
                        onClick={(e) => handleRunDirect(e, p.id)}
                      >
                        Run
                      </Button>
                    </Tooltip>
                  </>
                ) : p.schedule ? (
                  // Scheduled pipeline stop button - different style (warning color, pause icon)
                  <Tooltip title="Stop scheduled pipeline run" arrow>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Pause />}
                      onClick={(e) => handleStop(e, p.id)}
                      sx={{
                        bgcolor: "warning.main",
                        color: "warning.contrastText",
                        "&:hover": { bgcolor: "warning.dark" },
                      }}
                    >
                      Stop
                    </Button>
                  </Tooltip>
                ) : (
                  // Regular pipeline stop button
                  <Tooltip title="Stop pipeline" arrow>
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      startIcon={<Stop />}
                      onClick={(e) => handleStop(e, p.id)}
                    >
                      Stop
                    </Button>
                  </Tooltip>
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

      {/* Run with Inputs Modal */}
      <Dialog open={showRunModal} onClose={() => setShowRunModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Run {selectedPipeline?.name || 'Pipeline'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {selectedPipeline?.inputs?.map((input: PipelineInput) => (
              <Box key={input.name}>
                {input.type === "string" && (
                  <TextField
                    fullWidth
                    label={input.label || input.name}
                    value={inputValues[input.name] || ""}
                    onChange={(e) => setInputValues(prev => ({ ...prev, [input.name]: e.target.value }))}
                    size="small"
                  />
                )}
                {input.type === "boolean" && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={Boolean(inputValues[input.name])}
                        onChange={(e) => setInputValues(prev => ({ ...prev, [input.name]: e.target.checked }))}
                      />
                    }
                    label={input.label || input.name}
                  />
                )}
                {input.type === "select" && (
                  <FormControl fullWidth size="small">
                    <InputLabel>{input.label || input.name}</InputLabel>
                    <Select
                      value={inputValues[input.name] || ""}
                      label={input.label || input.name}
                      onChange={(e) => setInputValues(prev => ({ ...prev, [input.name]: e.target.value }))}
                    >
                      {input.options?.map(opt => (
                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRunModal(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success" 
            startIcon={<PlayArrow />} 
            onClick={() => selectedPipeline && executeRun(selectedPipeline.id, inputValues)}
          >
            Run
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
