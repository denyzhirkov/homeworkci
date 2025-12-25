import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowBack, Save, PlayArrow, CheckCircle, PriorityHigh, Cancel, Delete, Edit, Stop
} from "@mui/icons-material";
import {
  Box, Typography, Button, Paper, IconButton,
  Chip, Stack, CircularProgress, List, ListItem, Tabs, Tab,
  ListItemButton, ListItemIcon, ListItemText, Alert, TextField
} from "@mui/material";
import { Add, LocalOffer } from "@mui/icons-material";
import Editor from "@monaco-editor/react";
import { getPipeline, savePipeline, runPipeline, stopPipeline, type Pipeline, getRunHistory, getRunLog, deletePipeline, createPipeline, getVariables, type VariablesConfig } from "../lib/api";
import type { editor } from "monaco-editor";
import { useWebSocket, type WSEvent } from "../lib/useWebSocket";

type RunEntry = {
  pipelineId: string;
  runId: string;
  status: "success" | "fail" | "running" | "cancelled";
};

export default function PipelineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isNew = !id || id === "new";

  const [pipeline, setPipeline] = useState<Pipeline | null>(isNew ? { id: "", name: "New Pipeline", steps: [] } : null);
  const [json, setJson] = useState(isNew ? JSON.stringify({ name: "New Pipeline", steps: [] }, null, 2) : "");
  const [loading, setLoading] = useState(!isNew);
  const [history, setHistory] = useState<RunEntry[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [logContent, setLogContent] = useState("");
  const [logLoading, setLogLoading] = useState(false);

  // Tab: 0 = Logs, 1 = Editor
  const [activeTab, setActiveTab] = useState(isNew ? 1 : 0);

  // Live Logs State
  const [liveLogs, setLiveLogs] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Variables for quick insert
  const [variables, setVariables] = useState<VariablesConfig>({ global: {}, environments: {} });
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Tags editing
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (isNew || !id) return;
    loadPipelineData();
    loadHistory();
  }, [id]);

  // Load variables for quick insert
  useEffect(() => {
    getVariables().then(setVariables).catch(() => {});
  }, []);

  // Insert text at cursor position in editor
  const insertAtCursor = (text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    
    const selection = editor.getSelection();
    if (selection) {
      editor.executeEdits("quick-insert", [{
        range: selection,
        text,
        forceMoveMarkers: true
      }]);
      editor.focus();
    }
  };

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  // WebSocket subscription for live updates
  const handleWSEvent = useCallback((event: WSEvent) => {
    // Only process events for this pipeline
    if (!("pipelineId" in event) || event.pipelineId !== id) return;

    switch (event.type) {
      case "log":
        setLiveLogs(prev => prev + `[${event.payload.ts}] ${event.payload.msg}\n`);
        break;
      case "start":
        setLiveLogs(`Pipeline started: ${event.payload.runId}\n`);
        setSelectedRun("live");
        setIsRunning(true);
        break;
      case "end":
        setLiveLogs(prev => prev + `Pipeline finished. Success: ${event.payload.success}\n`);
        setIsRunning(false);
        loadHistory();
        break;
      case "step-start":
        // Could add step tracking visualization here
        break;
      case "step-end":
        if (!event.payload.success && event.payload.error) {
          setLiveLogs(prev => prev + `[ERROR] Step '${event.payload.step}' failed: ${event.payload.error}\n`);
        }
        break;
    }
  }, [id]);

  useWebSocket(handleWSEvent);

  // Auto-scroll for live logs
  useEffect(() => {
    if (selectedRun === 'live' && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [liveLogs, selectedRun]);

  // Auto-select latest run on load
  useEffect(() => {
    if (history.length > 0 && !selectedRun) {
      handleRunClick(history[0].runId);
    }
  }, [history]);

  const loadPipelineData = () => {
    if (!id) return;
    setLoading(true);
    getPipeline(id)
      .then(p => {
        setPipeline(p);
        // Exclude id from editable JSON
        const { id: _, ...rest } = p;
        setJson(JSON.stringify(rest, null, 2));
        setTags(p.tags || []);
        if (p.isRunning) setIsRunning(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const loadHistory = () => {
    if (isNew || !id) return;
    getRunHistory(id).then(setHistory).catch(console.error);
  };

  const handleSave = async () => {
    try {
      const updated = JSON.parse(json);
      // Merge tags from UI into the JSON
      updated.tags = tags.length > 0 ? tags : undefined;

      if (isNew) {
        if (!updated.name) updated.name = "New Pipeline";
        const { id: newId } = await createPipeline(updated);
        navigate(`/pipelines/${newId}`);
      } else {
        await savePipeline(id!, updated);
        loadPipelineData();
      }
    } catch (e) {
      console.error("Error saving:", e);
    }
  };

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleRun = async () => {
    if (!id || isRunning) return;
    try {
      setLiveLogs("Requesting run...\n");
      setSelectedRun('live');
      setActiveTab(0);
      setIsRunning(true);

      await runPipeline(id);
    } catch (e) {
      console.error("Error:", e);
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    if (!id || !isRunning) return;
    try {
      await stopPipeline(id);
      setIsRunning(false);
      setLiveLogs(prev => prev + "\n[STOPPED BY USER]\n");
    } catch (e) {
      console.error("Error stopping:", e);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deletePipeline(id);
      navigate("/pipelines");
    } catch (e) {
      console.error("Error:", e);
    }
  };

  const handleRunClick = (runId: string) => {
    setSelectedRun(runId);
    setLogLoading(true);
    if (!id) return;
    getRunLog(id, runId)
      .then(setLogContent)
      .catch(err => setLogContent("Failed to load log: " + err))
      .finally(() => setLogLoading(false));
  };

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  if (!pipeline) return <Typography>Not found</Typography>;

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton component={Link} to="/pipelines" color="inherit" size="small"><ArrowBack /></IconButton>
          <Typography variant="h6" component="h1">
            {pipeline?.name || (isNew ? "New Pipeline" : id)}
          </Typography>
          {!isNew && <Chip label={id} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 10 }} />}
          {pipeline?.env && <Chip label={`Env: ${pipeline.env}`} size="small" color="secondary" variant="outlined" />}
          {isRunning && <Chip size="small" label="Running" color="success" />}
          {pipeline?.isDemo && <Chip size="small" label="Demo" color="info" />}
        </Box>
        <Stack direction="row" spacing={1}>
          {isRunning ? (
            <Button variant="contained" color="error" size="small" startIcon={<Stop />} onClick={handleStop}>
              Stop
            </Button>
          ) : (
            <Button variant="contained" color="success" size="small" startIcon={<PlayArrow />} onClick={handleRun} disabled={isNew}>
              Run
            </Button>
          )}
          {activeTab === 1 && !pipeline?.isDemo && (
            <>
              <Button variant="outlined" size="small" startIcon={<Save />} onClick={handleSave}>
                Save
              </Button>
              {!isNew && (
                <Button variant="outlined" color="error" size="small" startIcon={<Delete />} onClick={handleDelete}>
                  Delete
                </Button>
              )}
            </>
          )}
        </Stack>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2, borderBottom: '1px solid #ddd' }}>
        <Tab label="Logs" disabled={isNew} />
        <Tab label="Editor" icon={<Edit fontSize="small" />} iconPosition="start" />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 ? (
        // Logs View
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {/* History List */}
          <Box sx={{ width: 220, borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto', bgcolor: 'background.paper' }}>
            <List dense disablePadding>
              <ListItemButton
                selected={selectedRun === 'live'}
                onClick={() => setSelectedRun('live')}
                sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {isRunning ? <CircularProgress size={18} /> : <PlayArrow color="warning" fontSize="small" />}
                </ListItemIcon>
                <ListItemText primary="Live Output" primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }} />
              </ListItemButton>

              {history.length === 0 && <ListItem><ListItemText secondary="No runs yet" /></ListItem>}

              {history.map(run => (
                <ListItemButton
                  key={run.runId}
                  selected={selectedRun === run.runId}
                  onClick={() => handleRunClick(run.runId)}
                >
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {run.status === 'success' ? (
                      <CheckCircle color="success" fontSize="small" />
                    ) : run.status === 'fail' ? (
                      <Box sx={{ 
                        width: 20, height: 20, borderRadius: '50%', 
                        bgcolor: 'error.main', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center' 
                      }}>
                        <PriorityHigh sx={{ fontSize: 14, color: 'white' }} />
                      </Box>
                    ) : run.status === 'cancelled' ? (
                      <Cancel color="warning" fontSize="small" />
                    ) : (
                      <CircularProgress size={14} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={new Date(Number(run.runId)).toLocaleTimeString()}
                    secondary={new Date(Number(run.runId)).toLocaleDateString()}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          {/* Log Content */}
          <Box
            ref={logContainerRef}
            sx={{ flex: 1, p: 2, overflowY: 'auto', bgcolor: '#1e1e1e', color: '#0f0', fontFamily: 'monospace', fontSize: 12 }}
          >
            {selectedRun === 'live' ? (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{liveLogs || "Waiting for logs..."}</pre>
            ) : selectedRun ? (
              logLoading ? <CircularProgress size={20} /> :
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{logContent}</pre>
            ) : (
              <Typography color="gray" sx={{ mt: 4, textAlign: 'center' }}>
                Select a run to view logs
              </Typography>
            )}
          </Box>
        </Box>
      ) : (
        // Editor View
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
          {pipeline?.isDemo && (
            <Alert severity="info" sx={{ mb: 1 }}>
              This is a demo pipeline showcasing all features. It is read-only.
            </Alert>
          )}
          
          {/* Tags Editor Panel */}
          {!pipeline?.isDemo && (
            <Paper variant="outlined" sx={{ p: 1, mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              <LocalOffer fontSize="small" color="action" sx={{ mr: 0.5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                Tags:
              </Typography>
              {tags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  color="secondary"
                  onDelete={() => handleRemoveTag(tag)}
                  sx={{ fontSize: 11 }}
                />
              ))}
              <TextField
                size="small"
                placeholder="Add tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                sx={{ width: 100, '& .MuiInputBase-input': { fontSize: 12, py: 0.5 } }}
              />
              <IconButton size="small" onClick={handleAddTag} disabled={!newTag.trim()}>
                <Add fontSize="small" />
              </IconButton>
            </Paper>
          )}
          
          {/* Quick Insert Variables Panel */}
          {!pipeline?.isDemo && (
            <Paper variant="outlined" sx={{ p: 1, mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                Quick Insert:
              </Typography>
              <Chip 
                label="${prev}" 
                size="small" 
                variant="outlined"
                onClick={() => insertAtCursor('${prev}')}
                sx={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
              />
              <Chip 
                label="${results.}" 
                size="small" 
                variant="outlined"
                onClick={() => insertAtCursor('${results.}')}
                sx={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
              />
              
              {Object.keys(variables.global).length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mr: 0.5 }}>
                    Global:
                  </Typography>
                  {Object.keys(variables.global).map(key => (
                    <Chip
                      key={key}
                      label={key}
                      size="small"
                      color="primary"
                      variant="outlined"
                      onClick={() => insertAtCursor(`\${env.${key}}`)}
                      sx={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                    />
                  ))}
                </>
              )}
              
              {pipeline?.env && variables.environments[pipeline.env] && 
                Object.keys(variables.environments[pipeline.env]).length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mr: 0.5 }}>
                    {pipeline.env}:
                  </Typography>
                  {Object.keys(variables.environments[pipeline.env]).map(key => (
                    <Chip
                      key={key}
                      label={key}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      onClick={() => insertAtCursor(`\${env.${key}}`)}
                      sx={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                    />
                  ))}
                </>
              )}
            </Paper>
          )}
          
          <Paper sx={{ flexGrow: 1, overflow: 'hidden', border: '1px solid #ccc' }}>
            <Editor
              height="100%"
              defaultLanguage="json"
              value={json}
              onChange={(val) => !pipeline?.isDemo && setJson(val || "")}
              onMount={handleEditorMount}
              options={{ minimap: { enabled: false }, fontSize: 14, readOnly: pipeline?.isDemo }}
            />
          </Paper>
        </Box>
      )}
    </Box>
  );
}
