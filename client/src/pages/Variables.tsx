import { useEffect, useState, useRef, useCallback } from "react";
import {
  Box, Typography, Paper, TextField, Button,
  Divider, Container, CircularProgress, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, IconButton, Snackbar, Alert, LinearProgress
} from "@mui/material";
import { Save, Add, Delete, VpnKey, ContentCopy, Check, Visibility, VisibilityOff, Refresh, Warning } from "@mui/icons-material";
import { getVariables, saveVariables, generateSSHKey, type VariablesConfig } from "../lib/api";

export default function Variables() {
  const [config, setConfig] = useState<VariablesConfig>({ global: {}, environments: {}, sshKeys: {} });
  const [loading, setLoading] = useState(true);
  const [newEnvName, setNewEnvName] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "environments" | "ssh">("global");
  
  // Visibility state for variables (key: "global:varKey" or "envName:varKey")
  const [visibleValues, setVisibleValues] = useState<Set<string>>(new Set());
  
  // Dialog state for adding variables
  const [addVarDialog, setAddVarDialog] = useState<{ open: boolean; type: "global" | "env"; envName?: string }>({ open: false, type: "global" });
  const [newVarName, setNewVarName] = useState("");
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmColor?: "primary" | "error" | "warning";
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
    confirmText: "Confirm",
    confirmColor: "primary",
  });
  
  // Snackbar state for notifications
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ 
    open: false, message: "", severity: "success" 
  });
  
  // Autosave state
  const [hasChanges, setHasChanges] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0); // 0-100
  const [isSaving, setIsSaving] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    getVariables()
      .then((data) => {
        setConfig(data);
        initialLoadRef.current = false;
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  
  // Autosave effect - triggers when config changes
  useEffect(() => {
    // Skip on initial load
    if (initialLoadRef.current || loading) return;
    
    setHasChanges(true);
    setSaveProgress(0);
    
    // Clear existing timers
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    
    // Start debounce timer (5 seconds)
    debounceTimerRef.current = window.setTimeout(() => {
      // Start progress bar animation (2 seconds = 2000ms, update every 20ms = 100 steps)
      const progressStep = 100 / 100; // 1% per step
      const progressInterval = 2000 / 100; // 20ms per step
      
      progressTimerRef.current = window.setInterval(() => {
        setSaveProgress(prev => {
          const next = prev + progressStep;
          if (next >= 100) {
            // Clear interval and trigger save
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            return 100;
          }
          return next;
        });
      }, progressInterval);
    }, 5000);
    
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [config, loading]);
  
  // Trigger save when progress reaches 100
  useEffect(() => {
    if (saveProgress >= 100 && hasChanges && !isSaving) {
      performAutoSave();
    }
  }, [saveProgress]);
  
  const performAutoSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveVariables(config);
      setHasChanges(false);
      setSaveProgress(0);
      setSnackbar({ open: true, message: "Changes saved automatically", severity: "success" });
    } catch (e) {
      setSnackbar({ open: true, message: "Error saving: " + e, severity: "error" });
    } finally {
      setIsSaving(false);
    }
  }, [config]);
  
  // Cancel autosave (for manual save)
  const cancelAutosave = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setSaveProgress(0);
  };

  const handleSave = async () => {
    cancelAutosave();
    setIsSaving(true);
    try {
      await saveVariables(config);
      setHasChanges(false);
      setSnackbar({ open: true, message: "Variables saved successfully", severity: "success" });
    } catch (e) {
      setSnackbar({ open: true, message: "Error saving variables: " + e, severity: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateGlobal = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, global: { ...prev.global, [key]: value } }));
  };

  const toggleVisibility = (type: "global" | "env", varKey: string, envName?: string) => {
    const key = type === "global" ? `global:${varKey}` : `${envName || ""}:${varKey}`;
    setVisibleValues(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleOpenAddVarDialog = (type: "global" | "env", envName?: string) => {
    setAddVarDialog({ open: true, type, envName });
    setNewVarName("");
  };

  const handleCloseAddVarDialog = () => {
    setAddVarDialog({ open: false, type: "global" });
    setNewVarName("");
  };

  const handleAddVar = () => {
    if (!newVarName.trim()) return;
    // Trim spaces, replace internal spaces with underscores, convert to uppercase
    const key = newVarName.trim().replace(/\s+/g, '_').toUpperCase();
    if (addVarDialog.type === "global") {
      updateGlobal(key, "");
    } else if (addVarDialog.envName) {
      updateEnvVar(addVarDialog.envName, key, "");
    }
    handleCloseAddVarDialog();
  };

  const addGlobal = () => {
    handleOpenAddVarDialog("global");
  };

  const removeGlobal = (key: string) => {
    setConfirmDialog({
      open: true,
      title: "Delete Variable",
      message: `Are you sure you want to delete the variable "${key}"?`,
      onConfirm: () => {
        setConfig(prev => {
          const next = { ...prev.global };
          delete next[key];
          return { ...prev, global: next };
        });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
      confirmText: "Delete",
      confirmColor: "error",
    });
  };

  const addEnv = () => {
    if (!newEnvName) return;
    setConfig(prev => ({
      ...prev,
      environments: { ...prev.environments, [newEnvName]: {} }
    }));
    setNewEnvName("");
  };

  const removeEnv = (env: string) => {
    setConfirmDialog({
      open: true,
      title: "Delete Environment",
      message: `Are you sure you want to delete the environment "${env}"? All variables in this environment will be lost.`,
      onConfirm: () => {
        setConfig(prev => {
          const next = { ...prev.environments };
          delete next[env];
          return { ...prev, environments: next };
        });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
      confirmText: "Delete",
      confirmColor: "error",
    });
  };

  const updateEnvVar = (env: string, key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      environments: {
        ...prev.environments,
        [env]: { ...prev.environments[env], [key]: value }
      }
    }));
  };

  const addEnvVar = (env: string) => {
    handleOpenAddVarDialog("env", env);
  };

  const removeEnvVar = (env: string, key: string) => {
    setConfig(prev => {
      const nextEnv = { ...prev.environments[env] };
      delete nextEnv[key];
      return {
        ...prev,
        environments: { ...prev.environments, [env]: nextEnv }
      };
    });
  };

  // SSH Keys management
  const handleGenerateKey = async () => {
    if (!newKeyName || generating) return;
    setGenerating(true);
    try {
      const keyPair = await generateSSHKey(newKeyName);
      // Normalize name same way as server
      const name = newKeyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      setConfig(prev => ({
        ...prev,
        sshKeys: { ...(prev.sshKeys || {}), [name]: keyPair }
      }));
      setNewKeyName("");
      setSnackbar({ open: true, message: `SSH key "${name}" generated successfully`, severity: "success" });
    } catch (e) {
      setSnackbar({ open: true, message: "Error generating SSH key: " + e, severity: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const removeSSHKey = (name: string) => {
    setConfirmDialog({
      open: true,
      title: "Delete SSH Key",
      message: `Are you sure you want to delete the SSH key "${name}"? This action cannot be undone.`,
      onConfirm: () => {
        setConfig(prev => {
          const next = { ...(prev.sshKeys || {}) };
          delete next[name];
          return { ...prev, sshKeys: next };
        });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
      confirmText: "Delete",
      confirmColor: "error",
    });
  };

  const handleRegenerateKey = (name: string) => {
    setConfirmDialog({
      open: true,
      title: "Regenerate SSH Key",
      message: `Are you sure you want to regenerate the SSH key "${name}"? This will invalidate the old key and you'll need to update the public key on all servers that use this key.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setRegeneratingKey(name);
        try {
          const keyPair = await generateSSHKey(name);
          // Update the key pair in config (same name, new keys)
          setConfig(prev => ({
            ...prev,
            sshKeys: { ...(prev.sshKeys || {}), [name]: keyPair }
          }));
          setSnackbar({ open: true, message: `SSH key "${name}" regenerated successfully. Update the public key on all servers.`, severity: "success" });
        } catch (e) {
          setSnackbar({ open: true, message: "Error regenerating SSH key: " + e, severity: "error" });
        } finally {
          setRegeneratingKey(null);
        }
      },
      confirmText: "Regenerate",
      confirmColor: "warning",
    });
  };

  const copyPublicKey = async (name: string, publicKey: string) => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopiedKey(name);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setSnackbar({ open: true, message: "Failed to copy to clipboard", severity: "error" });
    }
  };

  // Format public key for display (show first and last parts)
  const formatPublicKey = (key: string): string => {
    if (key.length <= 60) return key; // Show full key if short
    const start = key.substring(0, 30);
    const end = key.substring(key.length - 30);
    return `${start}...${end}`;
  };

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" component="h1">
            Variables
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
              — Manage global values, per-environment overrides, and SSH keys
            </Typography>
          </Typography>
          {hasChanges && !saveProgress && (
            <Typography variant="caption" color="warning.main" sx={{ fontStyle: 'italic' }}>
              Unsaved changes
            </Typography>
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </Box>

      <Paper sx={{ mb: 3, p: 0, position: 'relative' }}>
        {/* Autosave progress bar - absolute positioned to not shift layout */}
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            zIndex: 1,
            opacity: saveProgress > 0 && saveProgress < 100 ? 1 : 0,
            transition: 'opacity 0.2s',
            pointerEvents: saveProgress > 0 && saveProgress < 100 ? 'auto' : 'none',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5, bgcolor: 'background.paper' }}>
            <Typography variant="caption" color="text.secondary">
              Auto-saving in {Math.ceil((100 - saveProgress) / 50)}s...
            </Typography>
            <Button size="small" onClick={cancelAutosave} sx={{ minWidth: 'auto', p: 0.5, fontSize: '0.7rem' }}>
              Cancel
            </Button>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={saveProgress} 
            sx={{ 
              height: 3,
              '& .MuiLinearProgress-bar': {
                transition: 'transform 0.1s linear',
              }
            }} 
          />
        </Box>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Global" value="global" />
          <Tab label="Environments" value="environments" />
          <Tab
            label={
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <VpnKey fontSize="small" /> SSH
              </Box>
            }
            value="ssh"
          />
        </Tabs>

        <Divider />

        {/* Global Variables */}
        {activeTab === "global" && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Global Variables
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                — Available in all pipelines
              </Typography>
            </Typography>

            {Object.entries(config.global).map(([key, val]) => {
              const visibilityKey = `global:${key}`;
              const isVisible = visibleValues.has(visibilityKey);
              return (
                <Box key={key} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                  <TextField label="Key" value={key} disabled sx={{ flex: 1 }} />
                  <TextField
                    label="Value"
                    value={val}
                    onChange={e => updateGlobal(key, e.target.value)}
                    fullWidth
                    sx={{ flex: 2 }}
                    type={isVisible ? "text" : "password"}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => toggleVisibility("global", key)}
                            edge="end"
                            size="small"
                          >
                            {isVisible ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button color="error" onClick={() => removeGlobal(key)}><Delete /></Button>
                </Box>
              );
            })}

            {Object.keys(config.global).length === 0 && (
              <Typography color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                No global variables yet. Add one to make it available everywhere.
              </Typography>
            )}

            <Button startIcon={<Add />} onClick={addGlobal}>Add Variable</Button>
          </Box>
        )}

        {/* Environments */}
        {activeTab === "environments" && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Environments
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                — Variables active when pipeline selects this environment
              </Typography>
            </Typography>

            {Object.entries(config.environments).map(([envName, vars]) => (
              <Paper key={envName} sx={{ p: 3, mb: 3, borderLeft: '4px solid #1976d2' }} variant="outlined">
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{envName}</Typography>
                  <Button color="error" size="small" onClick={() => removeEnv(envName)}>Delete Env</Button>
                </Box>
                <Divider sx={{ mb: 2 }} />

                {Object.entries(vars).map(([key, val]) => {
                  const visibilityKey = `${envName}:${key}`;
                  const isVisible = visibleValues.has(visibilityKey);
                  return (
                    <Box key={key} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                      <TextField label="Key" value={key} disabled sx={{ flex: 1 }} size="small" />
                      <TextField
                        label="Value"
                        value={val}
                        onChange={e => updateEnvVar(envName, key, e.target.value)}
                        fullWidth
                        size="small"
                        sx={{ flex: 2 }}
                        type={isVisible ? "text" : "password"}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => toggleVisibility("env", key, envName)}
                                edge="end"
                                size="small"
                              >
                                {isVisible ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />
                      <Button color="error" onClick={() => removeEnvVar(envName, key)}><Delete /></Button>
                    </Box>
                  );
                })}

                {Object.keys(vars).length === 0 && (
                  <Typography color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                    No variables yet. Add values specific to this environment.
                  </Typography>
                )}

                <Button startIcon={<Add />} size="small" onClick={() => addEnvVar(envName)}>Add Variable</Button>
              </Paper>
            ))}

            <Paper sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'background.default' }} variant="outlined">
              <TextField
                placeholder="New Environment Name (e.g. staging)"
                size="small"
                value={newEnvName}
                onChange={e => setNewEnvName(e.target.value)}
              />
              <Button startIcon={<Add />} variant="outlined" onClick={addEnv} disabled={!newEnvName}>
                Create Environment
              </Button>
            </Paper>
          </Box>
        )}

        {/* SSH Keys */}
        {activeTab === "ssh" && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              <VpnKey sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1.2rem' }} />
              SSH Keys
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                — Use in SSH module with keyName parameter
              </Typography>
            </Typography>

            {Object.entries(config.sshKeys || {}).map(([name, keyPair]) => (
              <Box key={name} sx={{ mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      color="primary" 
                      size="small" 
                      onClick={() => handleRegenerateKey(name)}
                      disabled={regeneratingKey === name || generating}
                      startIcon={regeneratingKey === name ? <CircularProgress size={14} /> : <Refresh />}
                    >
                      {regeneratingKey === name ? "Regenerating..." : "Regenerate"}
                    </Button>
                    <Button color="error" size="small" onClick={() => removeSSHKey(name)}>
                      <Delete fontSize="small" />
                    </Button>
                  </Box>
                </Box>
                
                {/* Public Key - copyable */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Public Key (copy this to remote server's ~/.ssh/authorized_keys)
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1
                  }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontFamily: 'monospace', 
                        fontSize: '0.75rem',
                        flex: 1,
                        color: 'text.secondary'
                      }}
                    >
                      {formatPublicKey(keyPair.publicKey)}
                    </Typography>
                    <Button
                      size="small"
                      variant={copiedKey === name ? "contained" : "outlined"}
                      color={copiedKey === name ? "success" : "primary"}
                      onClick={() => copyPublicKey(name, keyPair.publicKey)}
                      startIcon={copiedKey === name ? <Check /> : <ContentCopy />}
                      sx={{ minWidth: 100 }}
                    >
                      {copiedKey === name ? "Copied!" : "Copy"}
                    </Button>
                  </Box>
                </Box>

                {/* Private Key - hidden */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Private Key (stored securely, used automatically)
                  </Typography>
                  <TextField
                    value={keyPair.privateKey}
                    fullWidth
                    size="small"
                    type="password"
                    disabled
                    sx={{ 
                      '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8rem' }
                    }}
                  />
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                  Usage in pipeline:{" "}
                  <Box
                    component="code"
                    sx={{
                      color: 'text.primary',
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      fontFamily: 'monospace',
                      fontSize: '0.75em',
                    }}
                  >
                    "keyName": "{name}"
                  </Box>
                </Typography>
              </Box>
            ))}

            {Object.keys(config.sshKeys || {}).length === 0 && (
              <Typography color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                No SSH keys yet. Generate one to use with SSH module.
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Key name (e.g. production-server)"
                size="small"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerateKey()}
                sx={{ flex: 1 }}
                disabled={generating}
              />
              <Button 
                startIcon={<VpnKey />} 
                variant="contained"
                onClick={handleGenerateKey} 
                disabled={!newKeyName || generating}
              >
                {generating ? "Generating..." : "Generate SSH Key"}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Add Variable Dialog */}
      <Dialog open={addVarDialog.open} onClose={handleCloseAddVarDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add {addVarDialog.type === "global" ? "Global" : "Environment"} Variable
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Variable Name"
            placeholder="e.g. API_KEY, DB_HOST"
            fullWidth
            variant="standard"
            value={newVarName}
            onChange={(e) => {
              // Allow only English letters, numbers, underscores, and spaces (spaces will be replaced)
              // Filter out invalid characters, trim spaces, replace internal spaces with underscores
              const filtered = e.target.value.replace(/[^a-zA-Z0-9_\s]/g, '');
              const processed = filtered.trim().replace(/\s+/g, '_');
              setNewVarName(processed);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newVarName.trim()) {
                handleAddVar();
              }
            }}
            helperText="Only English letters, numbers, and underscores allowed. Spaces will be replaced with underscores, name will be converted to UPPERCASE"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddVarDialog}>Cancel</Button>
          <Button onClick={handleAddVar} variant="contained" disabled={!newVarName.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog 
        open={confirmDialog.open} 
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          {confirmDialog.confirmColor === "error" && <Delete color="error" sx={{ fontSize: '1.5rem' }} />}
          {confirmDialog.confirmColor === "warning" && <Warning color="warning" sx={{ fontSize: '1.5rem' }} />}
          {confirmDialog.confirmColor === "primary" && <VpnKey color="primary" sx={{ fontSize: '1.5rem' }} />}
          <Typography variant="h6" component="span">
            {confirmDialog.title}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body1" color="text.secondary">
            {confirmDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button 
            onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDialog.onConfirm} 
            variant="contained" 
            color={confirmDialog.confirmColor}
            autoFocus
          >
            {confirmDialog.confirmText}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}
