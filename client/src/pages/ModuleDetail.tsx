import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowBack, Save, Delete, Code, MenuBook } from "@mui/icons-material";
import {
  Box, Typography, Button, Paper, IconButton,
  CircularProgress, Stack, Tabs, Tab, Alert
} from "@mui/material";
import Editor from "@monaco-editor/react";
import { getModuleDetails, saveModule, deleteModule } from "../lib/api";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ flexGrow: 1, display: value === index ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}
    >
      {value === index && children}
    </Box>
  );
}

// Parse module comments to extract description and usage example
function parseModuleComments(code: string): { description: string; usageExample: string; fullDocs: string } {
  const lines = code.split("\n");
  const commentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) {
      commentLines.push(trimmed.substring(2).trim());
    } else if (trimmed === "") {
      continue;
    } else {
      break;
    }
  }

  const fullDocs = commentLines.join("\n");
  const description = commentLines[0] || "No description";

  // Extract usage example (JSON block)
  let usageExample = "";
  let inExample = false;
  let braceCount = 0;
  const exampleLines: string[] = [];

  for (const line of commentLines) {
    if (line.includes("Usage Example:") || line.includes("Usage:")) {
      inExample = true;
      continue;
    }
    if (inExample) {
      if (line.includes("{")) braceCount++;
      if (braceCount > 0) exampleLines.push(line);
      if (line.includes("}")) braceCount--;
      if (braceCount === 0 && exampleLines.length > 0) break;
    }
  }

  usageExample = exampleLines.join("\n");

  return { description, usageExample, fullDocs };
}

export default function ModuleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isNew = !id;
  const defaultCode = `// My New Module
//
// Description: Describes what this module does.
//
// Usage Example:
// {
//   "module": "my-module",
//   "params": {
//     "foo": "bar"
//   }
// }

export async function run(ctx: any, params: any) {
  console.log("Hello from module", params);
  return { success: true };
}
`;

  const [code, setCode] = useState(isNew ? defaultCode : "");
  const [isBuiltIn, setIsBuiltIn] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getModuleDetails(id!)
      .then((data) => {
        setCode(data.source);
        setIsBuiltIn(data.isBuiltIn);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleSave = async () => {
    if (isBuiltIn) return;

    const name = id || prompt("Enter module name (e.g. my-script):");
    if (!name) return;

    try {
      await saveModule(name, code);
      alert("Module saved successfully");
      if (isNew) navigate(`/modules/${name}`);
    } catch (e) {
      alert("Error saving: " + e);
    }
  };

  const handleDelete = async () => {
    if (!id || isBuiltIn) return;
    if (!confirm(`Delete module '${id}'? This might break pipelines using it.`)) return;
    try {
      await deleteModule(id);
      navigate("/modules");
    } catch (e) {
      alert("Error: " + e);
    }
  };

  if (loading) return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;

  const { description, usageExample, fullDocs } = parseModuleComments(code);

  return (
    <Box sx={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={Link} to="/modules" color="inherit"><ArrowBack /></IconButton>
          <Typography variant="h5" component="h1">
            {isNew ? "New Module" : `Module: ${id}`}
          </Typography>
          {isBuiltIn && (
            <Typography variant="caption" sx={{ bgcolor: 'info.main', color: 'white', px: 1, py: 0.5, borderRadius: 1 }}>
              Built-in
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={2}>
          {!isBuiltIn && (
            <Button variant="outlined" color="inherit" startIcon={<Save />} onClick={handleSave}>
              Save
            </Button>
          )}
          {!isNew && !isBuiltIn && (
            <Button variant="contained" color="error" startIcon={<Delete />} onClick={handleDelete}>
              Delete
            </Button>
          )}
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab icon={<Code />} iconPosition="start" label="Code" />
          <Tab icon={<MenuBook />} iconPosition="start" label="Usage & Examples" />
        </Tabs>
      </Box>

      {/* Tab: Code */}
      <TabPanel value={activeTab} index={0}>
        {isBuiltIn && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This is a built-in module. The code is read-only.
          </Alert>
        )}
        <Paper sx={{ flexGrow: 1, overflow: 'hidden', border: '1px solid #ccc' }}>
          <Editor
            height="100%"
            defaultLanguage="typescript"
            value={code}
            onChange={(val) => !isBuiltIn && setCode(val || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              readOnly: isBuiltIn,
            }}
          />
        </Paper>
      </TabPanel>

      {/* Tab: Usage & Examples */}
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
          {/* Module Description */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Description</Typography>
            <Typography color="text.secondary">{description}</Typography>
            {fullDocs && fullDocs !== description && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
                  {fullDocs}
                </pre>
              </Box>
            )}
          </Paper>

          {/* Usage in Pipeline */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Usage in Pipeline</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add this step to your pipeline JSON:
            </Typography>
            {usageExample ? (
              <Box sx={{ bgcolor: '#1e1e1e', p: 2, borderRadius: 1 }}>
                <pre style={{ margin: 0, color: '#d4d4d4', fontFamily: 'monospace', fontSize: 13 }}>
                  {usageExample}
                </pre>
              </Box>
            ) : (
              <Alert severity="info">No usage example found in module comments.</Alert>
            )}
          </Paper>

          {/* Variables Reference */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Working with Variables</Typography>

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Global & Environment Variables</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Access variables defined in the Variables page via <code>ctx.env</code>:
            </Typography>
            <Box sx={{ bgcolor: '#1e1e1e', p: 2, borderRadius: 1, mb: 2 }}>
              <pre style={{ margin: 0, color: '#d4d4d4', fontFamily: 'monospace', fontSize: 13 }}>
{`// Inside module code:
const apiKey = ctx.env.API_KEY;
const dbHost = ctx.env.DATABASE_HOST;

// In pipeline params (interpolation):
{
  "module": "${id || 'my-module'}",
  "params": {
    "url": "\${env.API_URL}/endpoint"
  }
}`}
              </pre>
            </Box>

            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Using Results from Previous Steps</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Use <code>{"${prev}"}</code> to access the result of the previous step, or <code>name</code> field for named access:
            </Typography>
            <Box sx={{ bgcolor: '#1e1e1e', p: 2, borderRadius: 1 }}>
              <pre style={{ margin: 0, color: '#d4d4d4', fontFamily: 'monospace', fontSize: 13 }}>
{`// Simple chain using \${prev}:
{
  "steps": [
    {
      "module": "http",
      "params": { "url": "https://api.example.com/data" }
    },
    {
      "module": "${id || 'my-module'}",
      "params": {
        "data": "\${prev}"  // Result of previous step
      }
    }
  ]
}

// Named steps for complex pipelines:
{
  "steps": [
    {
      "name": "users",
      "module": "http",
      "params": { "url": "https://api.example.com/users" }
    },
    {
      "name": "orders",
      "module": "http", 
      "params": { "url": "https://api.example.com/orders" }
    },
    {
      "module": "${id || 'my-module'}",
      "params": {
        "userCount": "\${results.users.length}",
        "lastOrder": "\${prev}"  // Result of "orders" step
      }
    }
  ]
}`}
              </pre>
            </Box>
          </Paper>

          {/* Context Reference */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Context Object Reference</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The <code>ctx</code> object passed to the module's <code>run()</code> function:
            </Typography>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { border: '1px solid', borderColor: 'divider', p: 1.5 } }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <th style={{ textAlign: 'left' }}>Property</th>
                  <th style={{ textAlign: 'left' }}>Type</th>
                  <th style={{ textAlign: 'left' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><code>ctx.workDir</code></td><td>string</td><td>Isolated sandbox directory for this pipeline run</td></tr>
                <tr><td><code>ctx.env</code></td><td>Record&lt;string, string&gt;</td><td>Merged environment variables (whitelisted system + global + selected env)</td></tr>
                <tr><td><code>ctx.prev</code></td><td>any</td><td>Result of the previous step (use via {"${prev}"})</td></tr>
                <tr><td><code>ctx.results</code></td><td>Record&lt;string, any&gt;</td><td>Results from named steps (keyed by step name)</td></tr>
                <tr><td><code>ctx.pipelineId</code></td><td>string</td><td>Current pipeline ID</td></tr>
                <tr><td><code>ctx.startTime</code></td><td>number</td><td>Pipeline start timestamp</td></tr>
                <tr><td><code>ctx.log(msg)</code></td><td>function</td><td>Log a message (sensitive data is automatically masked)</td></tr>
                <tr><td><code>ctx.signal</code></td><td>AbortSignal</td><td>Signal for pipeline cancellation</td></tr>
              </tbody>
            </Box>
          </Paper>
        </Box>
      </TabPanel>
    </Box>
  );
}
