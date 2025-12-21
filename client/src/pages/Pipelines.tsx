import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { PlayArrow, Schedule } from "@mui/icons-material";
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Chip, Stack, Container, CircularProgress
} from "@mui/material";
import { getPipelines, type Pipeline, runPipeline } from "../lib/api";

// Component to show live log for a running pipeline
function LiveLogChip({ pipelineId }: { pipelineId: string }) {
  const [lastLog, setLastLog] = useState("");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/pipelines/${encodeURIComponent(pipelineId)}/live`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'log' && event.payload?.msg) {
          // Keep only last line, truncate if too long
          const msg = event.payload.msg.slice(0, 80);
          setLastLog(msg);
        }
      } catch { }
    };

    return () => {
      es.close();
    };
  }, [pipelineId]);

  if (!lastLog) return null;

  return (
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        mt: 1,
        px: 1,
        py: 0.5,
        bgcolor: '#1e1e1e',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 10,
        borderRadius: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {lastLog}
    </Typography>
  );
}

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPipelines().then(setPipelines)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Polling to refresh running state
  useEffect(() => {
    const interval = setInterval(() => {
      getPipelines().then(setPipelines).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRun = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await runPipeline(id);
      getPipelines().then(setPipelines).catch(console.error);
    } catch (err) {
      console.error("Error triggering pipeline:", err);
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
                {!p.isRunning && (
                  <Button
                    size="small"
                    color="success"
                    startIcon={<PlayArrow />}
                    onClick={(e) => handleRun(e, p.id)}
                  >
                    Run Now
                  </Button>
                )}
                {p.isRunning && (
                  <Chip size="small" icon={<CircularProgress size={12} />} label="Running..." color="success" />
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
