import { useEffect, useState } from "react";
import {
  Box, Typography, Paper, TextField, Button,
  Divider, Container, CircularProgress
} from "@mui/material";
import { Save, Add, Delete } from "@mui/icons-material";
import { getVariables, saveVariables } from "../lib/api";

type VariablesConfig = {
  global: Record<string, string>;
  environments: Record<string, Record<string, string>>;
};

export default function Variables() {
  const [config, setConfig] = useState<VariablesConfig>({ global: {}, environments: {} });
  const [loading, setLoading] = useState(true);
  const [newEnvName, setNewEnvName] = useState("");

  useEffect(() => {
    getVariables()
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      await saveVariables(config);
      alert("Variables saved successfully");
    } catch (e) {
      alert("Error saving variables: " + e);
    }
  };

  const updateGlobal = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, global: { ...prev.global, [key]: value } }));
  };

  const addGlobal = () => {
    const key = prompt("Enter variable name (e.g. API_KEY):");
    if (!key) return;
    updateGlobal(key.toUpperCase(), "");
  };

  const removeGlobal = (key: string) => {
    if (!confirm("Delete variable?")) return;
    setConfig(prev => {
      const next = { ...prev.global };
      delete next[key];
      return { ...prev, global: next };
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
    if (!confirm(`Delete environment '${env}'?`)) return;
    setConfig(prev => {
      const next = { ...prev.environments };
      delete next[env];
      return { ...prev, environments: next };
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
    const key = prompt("Enter variable name (e.g. DB_HOST):");
    if (!key) return;
    updateEnvVar(env, key.toUpperCase(), "");
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

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Variables
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Manage global and environment-specific variables.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </Box>

      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>Global Variables</Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Available in all pipelines.
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        {Object.entries(config.global).map(([key, val]) => (
          <Box key={key} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <TextField label="Key" value={key} disabled sx={{ flex: 1 }} />
            <TextField
              label="Value"
              value={val}
              onChange={e => updateGlobal(key, e.target.value)}
              fullWidth
              sx={{ flex: 2 }}
              type="password"
            />
            <Button color="error" onClick={() => removeGlobal(key)}><Delete /></Button>
          </Box>
        ))}
        <Button startIcon={<Add />} onClick={addGlobal}>Add Variable</Button>
      </Paper>

      <Typography variant="h5" gutterBottom>Environments</Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Specific sets of variables active only when a pipeline selects this environment.
      </Typography>

      {Object.entries(config.environments).map(([envName, vars]) => (
        <Paper key={envName} sx={{ p: 3, mb: 4, borderLeft: '4px solid #1976d2' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">{envName}</Typography>
            <Button color="error" size="small" onClick={() => removeEnv(envName)}>Delete Env</Button>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {Object.entries(vars).map(([key, val]) => (
            <Box key={key} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
              <TextField label="Key" value={key} disabled sx={{ flex: 1 }} size="small" />
              <TextField
                label="Value"
                value={val}
                onChange={e => updateEnvVar(envName, key, e.target.value)}
                fullWidth
                size="small"
                sx={{ flex: 2 }}
                type="password"
              />
              <Button color="error" onClick={() => removeEnvVar(envName, key)}><Delete /></Button>
            </Box>
          ))}
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

    </Container>
  );
}
