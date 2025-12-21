import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { PlayArrow, Schedule, Stop } from "@mui/icons-material";
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Chip, Stack, Container, CircularProgress
} from "@mui/material";
import { getPipelines, type Pipeline, runPipeline, stopPipeline } from "../lib/api";
import { useWebSocket, type WSEvent } from "../lib/useWebSocket";
import { LiveLogChip } from "../components/LiveLogChip";

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

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
      // Mark pipeline as running
      setPipelines(prev =>
        prev.map(p => p.id === event.pipelineId ? { ...p, isRunning: true } : p)
      );
    } else if (event.type === "end" && "pipelineId" in event) {
      // Mark pipeline as not running
      setPipelines(prev =>
        prev.map(p => p.id === event.pipelineId ? { ...p, isRunning: false } : p)
      );
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Pipelines
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Manage and monitor your automation workflows.
          </Typography>
        </Box>
        <Button
          component={Link}
          to="/pipelines/new"
          variant="contained"
        >
          NEW PIPELINE
        </Button>
      </Box>

      <Grid container spacing={3}>
        {pipelines.map(p => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: '0.3s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}
              component={Link}
              to={`/pipelines/${p.id}`}
              style={{ textDecoration: 'none' }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="div" gutterBottom>
                  {p.name || p.id}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" mb={1}>
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
                </Stack>
                {p.isRunning && <LiveLogChip pipelineId={p.id} />}
              </CardContent>
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
        {pipelines.length === 0 && (
          <Grid size={{ xs: 12 }}>
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
                No pipelines found.
              </Typography>
              <Button component={Link} to="/pipelines/new">
                Create your first pipeline
              </Button>
            </Box>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
