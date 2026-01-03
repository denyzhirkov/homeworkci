import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Box, Typography, Grid, Card, Divider, Button,
  Container, CircularProgress, Paper, Avatar, Chip, LinearProgress, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox, Select, MenuItem, FormControl, InputLabel, TextField, Stack
} from "@mui/material";
import {
  AccountTree, Extension, Timer, Storage, ArrowForward, PlayArrow, Settings, Stop, Pause, AccessTime
} from "@mui/icons-material";
import { getStats, getPipelines, runPipeline, stopPipeline, toggleSchedulePause, type Pipeline, type PipelineInput } from "../lib/api";
import { useWebSocket, type WSEvent } from "../lib/useWebSocket";
import { LiveLogChip } from "../components/LiveLogChip";
import { initializeInputValues } from "../lib/pipeline-inputs";
import { getNextRunInfo } from "../lib/schedule";

// Track progress for running pipelines
interface ProgressInfo {
  completed: number;
  total: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, ProgressInfo>>({});
  const [systemMetrics, setSystemMetrics] = useState<{ memoryPercent: string; cpuLoad: string }>({
    memoryPercent: "—",
    cpuLoad: "—",
  });

  // Run modal state
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string | boolean>>({});
  
  // Schedule countdown - force re-render every 30 seconds for countdown updates
  const [, setScheduleTick] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setScheduleTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([getStats(), getPipelines()])
      .then(([s, p]) => {
        setStats(s);
        setPipelines(p.slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Handle WebSocket events for real-time updates
  const handleEvent = useCallback((event: WSEvent) => {
    if (event.type === "system") {
      // Update system metrics in real-time
      setSystemMetrics({
        memoryPercent: event.payload.memoryPercent,
        cpuLoad: event.payload.cpuLoad,
      });
    } else if (event.type === "init") {
      // Update running status from WebSocket
      setPipelines(prev => {
        return prev.map(p => {
          const status = event.pipelines.find(s => s.id === p.id);
          return status ? { ...p, isRunning: status.isRunning } : p;
        });
      });
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
      // Refetch pipelines when list changes
      getPipelines()
        .then(p => setPipelines(p.slice(0, 5)))
        .catch(console.error);
    }
  }, []);

  useWebSocket(handleEvent);

  const executeRun = async (id: string, inputs?: Record<string, string | boolean>) => {
    try {
      setShowRunModal(false);
      setSelectedPipeline(null);
      await runPipeline(id, inputs);
    } catch (err) {
      console.error("Error triggering pipeline:", err);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopPipeline(id);
    } catch (err) {
      console.error("Error stopping pipeline:", err);
    }
  };

  const handleToggleSchedule = async (id: string) => {
    try {
      const result = await toggleSchedulePause(id);
      setPipelines(prev =>
        prev.map(p => p.id === id ? { ...p, schedulePaused: result.schedulePaused } : p)
      );
    } catch (err) {
      console.error("Error toggling schedule:", err);
    }
  };

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  const StatCard = ({ icon, title, value, color = "primary.main", to }: any) => {
    const cardContent = (
      <>
        <Avatar sx={{ bgcolor: color, width: 48, height: 48, mr: 2 }}>
          {icon}
        </Avatar>
        <Box>
          <Typography variant="h5" fontWeight="bold">{value}</Typography>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
        </Box>
      </>
    );

    return to ? (
      <Card
        component={Link}
        to={to}
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          p: 2,
          textDecoration: 'none',
          cursor: 'pointer',
          transition: '0.2s',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
        }}
      >
        {cardContent}
      </Card>
    ) : (
      <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', p: 2 }}>
        {cardContent}
      </Card>
    );
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 1, mb: 1 }}>
        <Typography variant="h5" component="h1">
          Dashboard
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
            — {stats?.platform}, Deno {stats?.denoVersion}
          </Typography>
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="pipelines">
          <StatCard icon={<AccountTree />} title="Pipelines" value={stats?.pipelinesCount} color="#1976d2" to="/pipelines" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="modules">
          <StatCard icon={<Extension />} title="Modules" value={stats?.modulesCount} color="#9c27b0" to="/modules" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="memory">
          <StatCard icon={<Storage />} title="Memory" value={systemMetrics.memoryPercent} color="#2e7d32" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="cpu">
          <StatCard icon={<Timer />} title="CPU Load" value={systemMetrics.cpuLoad} color="#ed6c02" />
        </Grid>
      </Grid>

      {/* Recent Pipelines */}
      <Box>
        <Typography variant="h6" gutterBottom>Recent Pipelines</Typography>
          <Paper variant="outlined">
            {pipelines.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>No pipelines yet.</Box>
            ) : pipelines.map((p, i) => (
              <Box key={p.id} sx={{ position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {p.isRunning ? (
                      <CircularProgress size={24} />
                    ) : (
                      <AccountTree color="action" />
                    )}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {p.name || p.id}
                        {p.isRunning && <Chip size="small" label="Running" color="success" sx={{ ml: 1 }} />}
                        {p.schedule && !p.isRunning && (() => {
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
                                size="small" 
                                label={p.schedulePaused ? "Paused" : (nextInfo ? `Next: ${nextInfo.timeLeft}` : p.schedule)} 
                                color={p.schedulePaused ? "warning" : "info"}
                                sx={{ ml: 1, fontWeight: 500, opacity: p.schedulePaused ? 0.8 : 1 }}
                              />
                            </Tooltip>
                          );
                        })()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{p.id}.json</Typography>
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
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {!p.isRunning ? (
                      <>
                        {/* Schedule pause/resume button */}
                        {p.schedule && (
                          <Tooltip title={p.schedulePaused ? "Resume schedule" : "Pause schedule"} arrow>
                            <Button
                              size="small"
                              variant={p.schedulePaused ? "contained" : "outlined"}
                              onClick={() => handleToggleSchedule(p.id)}
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
                              onClick={() => { setSelectedPipeline(p); setInputValues(initializeInputValues(p.inputs)); setShowRunModal(true); }}
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
                            onClick={() => executeRun(p.id)}
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
                          onClick={() => handleStop(p.id)}
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
                          onClick={() => handleStop(p.id)}
                        >
                          Stop
                        </Button>
                      </Tooltip>
                    )}
                    <Button component={Link} to={`/pipelines/${p.id}`} size="small" endIcon={<ArrowForward />}>
                      View
                    </Button>
                  </Box>
                </Box>
                {/* Progress bar at bottom of item */}
                {p.isRunning && (
                  <LinearProgress
                    variant={progress[p.id] ? "determinate" : "indeterminate"}
                    value={progress[p.id] ? (progress[p.id].completed / progress[p.id].total) * 100 : undefined}
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                    }}
                  />
                )}
                {i < pipelines.length - 1 && <Divider />}
              </Box>
            ))}
          </Paper>
      </Box>

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
