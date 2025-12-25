import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowBack, Save, Delete, Code, MenuBook, Add, LocalOffer } from "@mui/icons-material";
import {
  Box, Typography, Button, Paper, IconButton, Chip,
  CircularProgress, Stack, Tabs, Tab, Alert, TextField
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

// Parse tags from "// Tags: tag1, tag2" in module comments
function parseModuleTags(code: string): string[] {
  const match = code.match(/^\/\/\s*Tags?:\s*(.+)$/mi);
  if (!match) return [];
  return match[1].split(',').map(t => t.trim().toLowerCase()).filter(t => t);
}

// Update or add tags line in module code
function updateModuleTags(code: string, tags: string[]): string {
  const tagsLine = tags.length > 0 ? `// Tags: ${tags.join(', ')}` : '';
  const existingMatch = code.match(/^\/\/\s*Tags?:\s*.+$/mi);
  
  if (existingMatch) {
    // Replace existing tags line
    if (tags.length > 0) {
      return code.replace(/^\/\/\s*Tags?:\s*.+$/mi, tagsLine);
    } else {
      // Remove tags line if no tags
      return code.replace(/^\/\/\s*Tags?:\s*.+\n?/mi, '');
    }
  } else if (tags.length > 0) {
    // Add tags line after first comment line (description)
    const lines = code.split('\n');
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('//')) {
        insertIndex = i + 1;
        // Find end of first comment block paragraph
        if (lines[i].trim() === '//' || !lines[i + 1]?.trim().startsWith('//')) {
          break;
        }
      } else {
        break;
      }
    }
    lines.splice(insertIndex, 0, tagsLine);
    return lines.join('\n');
  }
  
  return code;
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
//
// Returns: { "success": true }
//
// Valid return types (ModuleResult):
//   - { success: true }
//   - { skipped: true }
//   - { waited: number }
//   - { code: number }
//   - string
//   - Record<string, unknown>
//
// PipelineContext properties:
//   ctx.workDir: string       - Isolated sandbox directory
//   ctx.env: Record<string, string> - Environment variables
//   ctx.prev: unknown         - Result of the previous step
//   ctx.results: Record<string, unknown> - Results from named steps
//   ctx.pipelineId: string    - Current pipeline ID
//   ctx.startTime: number     - Pipeline start timestamp
//   ctx.log(msg): void        - Log a message (sensitive data is masked)
//   ctx.signal: AbortSignal   - Signal for pipeline cancellation

import type { PipelineContext, ModuleResult } from "../server/types/index.ts";

export async function run(ctx: PipelineContext, params: { foo: string }): Promise<ModuleResult> {
  ctx.log("Hello from module: " + params.foo);
  return { success: true };
}
`;

  const [code, setCode] = useState(isNew ? defaultCode : "");
  const [isBuiltIn, setIsBuiltIn] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [activeTab, setActiveTab] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getModuleDetails(id!)
      .then((data) => {
        setCode(data.source);
        setIsBuiltIn(data.isBuiltIn);
        setTags(parseModuleTags(data.source));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const handleSave = async () => {
    if (isBuiltIn) return;

    const name = id || prompt("Enter module name (e.g. my-script):");
    if (!name) return;

    try {
      // Update tags in code before saving
      const updatedCode = updateModuleTags(code, tags);
      await saveModule(name, updatedCode);
      setCode(updatedCode);
      alert("Module saved successfully");
      if (isNew) navigate(`/modules/${name}`);
    } catch (e) {
      alert("Error saving: " + e);
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
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton component={Link} to="/modules" color="inherit" size="small"><ArrowBack /></IconButton>
          <Typography variant="h6" component="h1">
            {isNew ? "New Module" : id}
          </Typography>
          {isBuiltIn && (
            <Chip label="Built-in" size="small" color="info" />
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          {!isBuiltIn && (
            <Button variant="outlined" color="inherit" size="small" startIcon={<Save />} onClick={handleSave}>
              Save
            </Button>
          )}
          {!isNew && !isBuiltIn && (
            <Button variant="contained" color="error" size="small" startIcon={<Delete />} onClick={handleDelete}>
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
        
        {/* Tags Editor Panel */}
        {!isBuiltIn && (
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
