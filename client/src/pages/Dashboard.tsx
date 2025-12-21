import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Box, Typography, Grid, Card, CardContent, Divider, Button,
  Container, CircularProgress, Paper, Avatar, Chip
} from "@mui/material";
import {
  AccountTree, Extension, Timer, Storage, ArrowForward
} from "@mui/icons-material";
import { getStats, getPipelines } from "../lib/api";

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

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Polling for real-time updates (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      getPipelines()
        .then(p => setPipelines(p.slice(0, 5)))
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  const StatCard = ({ icon, title, value, color = "primary.main" }: any) => (
    <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', p: 2 }}>
      <Avatar sx={{ bgcolor: color, width: 56, height: 56, mr: 2 }}>
        {icon}
      </Avatar>
      <Box>
        <Typography variant="h4" fontWeight="bold">{value}</Typography>
        <Typography variant="body2" color="text.secondary">{title}</Typography>
      </Box>
    </Card>
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Welcome back
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          System operational on <strong>{stats?.platform}</strong> (Deno {stats?.denoVersion}).
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="pipelines">
          <StatCard icon={<AccountTree />} title="Pipelines" value={stats?.pipelinesCount} color="#1976d2" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="modules">
          <StatCard icon={<Extension />} title="Modules" value={stats?.modulesCount} color="#9c27b0" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="uptime">
          <StatCard icon={<Timer />} title="Uptime (s)" value={Math.floor(stats?.uptime || 0)} color="#2e7d32" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key="vars">
          <StatCard icon={<Storage />} title="Environment" value="Active" color="#ed6c02" />
        </Grid>
      </Grid>

      {/* Quick Actions & Recent */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }} key="recent">
          <Typography variant="h6" gutterBottom>Recent Pipelines</Typography>
          <Paper variant="outlined">
            {pipelines.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>No pipelines yet.</Box>
            ) : pipelines.map((p, i) => (
              <Box key={p.id}>
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
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{p.id}.json</Typography>
                      {p.isRunning && <LiveLogChip pipelineId={p.id} />}
                    </Box>
                  </Box>
                  <Button component={Link} to={`/pipelines/${p.id}`} size="small" endIcon={<ArrowForward />}>
                    View
                  </Button>
                </Box>
                {i < pipelines.length - 1 && <Divider />}
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }} key="actions">
          <Typography variant="h6" gutterBottom>Quick Actions</Typography>
          <Card variant="outlined">
            <CardContent>
              <Button fullWidth variant="contained" component={Link} to="/pipelines/new" sx={{ mb: 2 }}>
                Create Pipeline
              </Button>
              <Button fullWidth variant="outlined" component={Link} to="/modules/new" sx={{ mb: 2 }}>
                Create Module
              </Button>
              <Button fullWidth variant="text" component={Link} to="/variables">
                Manage Variables
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
