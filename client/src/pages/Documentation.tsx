import { Box, Typography, Paper, List, ListItemButton, ListItemText, Divider, Chip } from "@mui/material";
import { Terminal, Http, FolderCopy, Timer, Notifications, CloudQueue, Archive, Code, Lan, Storage, DataObject, AccountTree } from "@mui/icons-material";

// Code block component
function CodeBlock({ children }: { children: string }) {
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'background.default',
        fontFamily: 'monospace',
        fontSize: 13,
        overflow: 'auto',
        whiteSpace: 'pre',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {children}
    </Paper>
  );
}

// Section header component
function SectionHeader({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <Typography id={id} variant="h5" sx={{ mt: 4, mb: 1, scrollMarginTop: 80 }}>
      {title}
      {subtitle && (
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
          — {subtitle}
        </Typography>
      )}
    </Typography>
  );
}

// Module documentation component
function ModuleDoc({ 
  id, 
  icon, 
  title, 
  description, 
  params, 
  returns, 
  example 
}: { 
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  params: { name: string; type: string; required?: boolean; description: string }[];
  returns: string;
  example: string;
}) {
  return (
    <Box id={id} sx={{ mb: 4, scrollMarginTop: 80 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ 
          p: 0.75, 
          borderRadius: 1, 
          bgcolor: 'primary.dark', 
          display: 'flex', 
          alignItems: 'center' 
        }}>
          {icon}
        </Box>
        <Typography variant="h6">{title}</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>
      
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Parameters</Typography>
      <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'background.default' }}>
        {params.map((p, i) => (
          <Box key={i} sx={{ mb: i < params.length - 1 ? 1.5 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography component="code" sx={{ fontFamily: 'monospace', color: 'primary.light' }}>
                {p.name}
              </Typography>
              <Chip label={p.type} size="small" sx={{ height: 18, fontSize: 10 }} />
              {p.required && <Chip label="required" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
              {p.description}
            </Typography>
          </Box>
        ))}
      </Paper>
      
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Returns</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: 1 }}>
        {returns}
      </Typography>
      
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Example</Typography>
      <CodeBlock>{example}</CodeBlock>
    </Box>
  );
}

// Navigation items
const navItems = [
  { id: 'overview', label: 'Overview', indent: 0 },
  { id: 'pipelines', label: 'Pipelines', indent: 0 },
  { id: 'pipeline-structure', label: 'Structure', indent: 1 },
  { id: 'pipeline-steps', label: 'Steps & Parallel', indent: 1 },
  { id: 'pipeline-inputs', label: 'Inputs', indent: 1 },
  { id: 'dynamic-env', label: 'Dynamic Environment', indent: 1 },
  { id: 'pipeline-results', label: 'Results & Variables', indent: 1 },
  { id: 'modules', label: 'Modules', indent: 0 },
  { id: 'mod-shell', label: 'shell', indent: 1 },
  { id: 'mod-http', label: 'http', indent: 1 },
  { id: 'mod-git', label: 'git', indent: 1 },
  { id: 'mod-fs', label: 'fs', indent: 1 },
  { id: 'mod-delay', label: 'delay', indent: 1 },
  { id: 'mod-notify', label: 'notify', indent: 1 },
  { id: 'mod-docker', label: 'docker', indent: 1 },
  { id: 'mod-docker-remote', label: 'docker_remote', indent: 1 },
  { id: 'mod-archive', label: 'archive', indent: 1 },
  { id: 'mod-ssh', label: 'ssh', indent: 1 },
  { id: 'mod-s3', label: 's3', indent: 1 },
  { id: 'mod-json', label: 'json', indent: 1 },
  { id: 'mod-pipeline', label: 'pipeline', indent: 1 },
  { id: 'mod-queue', label: 'queue', indent: 1 },
  { id: 'variables', label: 'Variables', indent: 0 },
  { id: 'variables-ssh-keys', label: 'SSH Keys', indent: 1 },
  { id: 'editor', label: 'Smart Editor', indent: 0 },
];

export default function Documentation() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Box sx={{ display: 'flex', gap: 3 }}>
      {/* Sticky Navigation */}
      <Box
        sx={{
          width: 200,
          flexShrink: 0,
          position: 'sticky',
          top: 80,
          height: 'fit-content',
          maxHeight: 'calc(100vh - 100px)',
          overflow: 'auto',
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" sx={{ px: 2, py: 1 }}>
          Contents
        </Typography>
        <List dense disablePadding>
          {navItems.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() => scrollTo(item.id)}
              sx={{ 
                pl: 2 + item.indent * 2,
                py: 0.5,
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <ListItemText 
                primary={item.label} 
                primaryTypographyProps={{ 
                  variant: item.indent === 0 ? 'body2' : 'caption',
                  fontWeight: item.indent === 0 ? 500 : 400,
                  color: item.indent === 0 ? 'text.primary' : 'text.secondary',
                }}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0, pb: 8 }}>
        {/* Header */}
        <Box sx={{ mt: 1, mb: 1 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Documentation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Complete guide to HomeworkCI pipelines and modules
          </Typography>
        </Box>

        {/* Overview */}
        <SectionHeader id="overview" title="Overview" subtitle="What is HomeworkCI" />
        <Typography variant="body2" paragraph>
          HomeworkCI is a lightweight automation platform built with Deno and React. It allows you to define 
          automation workflows (pipelines) using JSON configuration and execute them with built-in or custom modules.
        </Typography>
        <Typography variant="body2" paragraph>
          <strong>Key concepts:</strong>
        </Typography>
        <Box component="ul" sx={{ pl: 3, '& li': { mb: 1 } }}>
          <li><Typography variant="body2"><strong>Pipelines</strong> — JSON files defining a sequence of steps to execute</Typography></li>
          <li><Typography variant="body2"><strong>Modules</strong> — TypeScript functions that perform specific actions (shell, http, git, etc.)</Typography></li>
          <li><Typography variant="body2"><strong>Variables</strong> — Global and environment-specific values available in pipelines</Typography></li>
          <li><Typography variant="body2"><strong>Inputs</strong> — Runtime parameters that can be provided when starting a pipeline</Typography></li>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* Pipelines */}
        <SectionHeader id="pipelines" title="Pipelines" subtitle="Automation workflows" />
        <Typography variant="body2" paragraph>
          Pipelines are defined as JSON files in the <code>pipelines/</code> directory. Each pipeline has a name, 
          optional description, and a list of steps to execute.
        </Typography>

        <Typography id="pipeline-structure" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
          Structure
        </Typography>
        <CodeBlock>{`{
  "name": "My Pipeline",
  "description": "Pipeline description",
  "tags": ["deploy", "backend"],
  "env": "production",
  "keepWorkDir": false,
  "inputs": [...],
  "steps": [...]
}`}</CodeBlock>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" paragraph>
            <strong>name</strong> — Display name of the pipeline<br/>
            <strong>description</strong> — Optional description<br/>
            <strong>tags</strong> — Array of tags for organizing pipelines<br/>
            <strong>env</strong> — Environment name (loads variables from that environment)<br/>
            <strong>keepWorkDir</strong> — Keep sandbox directory after run (for debugging)<br/>
            <strong>inputs</strong> — Input parameters for parameterized runs<br/>
            <strong>steps</strong> — Array of steps to execute
          </Typography>
        </Box>

        <Typography id="pipeline-steps" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
          Steps & Parallel Execution
        </Typography>
        <Typography variant="body2" paragraph>
          Each step specifies a module to run and its parameters. Steps execute sequentially by default.
          To run steps in parallel, wrap them in a nested array.
        </Typography>
        <CodeBlock>{`{
  "steps": [
    {
      "name": "step1",
      "description": "First step",
      "module": "shell",
      "params": { "cmd": "echo 'Hello'" }
    },
    [
      {
        "name": "api1",
        "module": "http",
        "params": { "url": "https://api.example.com/users" }
      },
      {
        "name": "api2",
        "module": "http", 
        "params": { "url": "https://api.example.com/posts" }
      }
    ]
  ]
}`}</CodeBlock>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Steps inside a nested array execute simultaneously. The pipeline waits for all 
          parallel steps to complete before continuing to the next step.
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
          Step Dependencies (dependsOn)
        </Typography>
        <Typography variant="body2" paragraph>
          Use <code>dependsOn</code> to specify that a step should only run if certain previous steps succeeded.
          The value can be a single step name or an array of step names.
        </Typography>
        <CodeBlock>{`{
  "steps": [
    { "name": "build", "module": "shell", "params": { "cmd": "npm run build" } },
    { "name": "test", "module": "shell", "params": { "cmd": "npm test" } },
    { 
      "name": "deploy", 
      "module": "shell", 
      "params": { "cmd": "deploy.sh" },
      "dependsOn": ["build", "test"]
    }
  ]
}`}</CodeBlock>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          If any dependency fails, the pipeline stops with an error. Dependencies must reference 
          steps defined before the current step.
        </Typography>

        <Typography id="pipeline-inputs" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
          Inputs
        </Typography>
        <Typography variant="body2" paragraph>
          Inputs allow you to parameterize pipelines. When running a pipeline with inputs, a form is displayed 
          to enter values.
        </Typography>
        <CodeBlock>{`{
  "inputs": [
    {
      "name": "userId",
      "type": "select",
      "label": "User ID",
      "options": ["1", "2", "3"],
      "default": "1"
    },
    {
      "name": "verbose",
      "type": "boolean",
      "label": "Verbose output",
      "default": false
    },
    {
      "name": "message",
      "type": "string",
      "label": "Custom message",
      "default": "Hello"
    }
  ]
}`}</CodeBlock>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Input types: <code>string</code>, <code>boolean</code>, <code>select</code>. 
          Access inputs in steps via <code>{"${inputs.name}"}</code>.
        </Typography>

        <Typography id="dynamic-env" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
          Dynamic Environment
        </Typography>
        <Typography variant="body2" paragraph>
          The <code>env</code> field supports interpolation, allowing you to select the environment at runtime 
          based on input parameters. This is useful for pipelines that need to run against different environments.
        </Typography>
        <CodeBlock>{`{
  "name": "Deploy Pipeline",
  "env": "\${inputs.ENV}",
  "inputs": [
    {
      "name": "ENV",
      "type": "select",
      "label": "Target Environment",
      "options": ["dev", "staging", "prod"],
      "default": "dev"
    }
  ],
  "steps": [
    {
      "module": "shell",
      "params": {
        "cmd": "echo 'Deploying to \${inputs.ENV}...'"
      }
    }
  ]
}`}</CodeBlock>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          When the pipeline runs, the user selects an environment, and variables from that environment 
          are loaded automatically. The environment chip in the header will animate to show it's dynamic.
        </Typography>

        <Typography id="pipeline-results" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
          Results & Variables
        </Typography>
        <Typography variant="body2" paragraph>
          Pipeline steps can reference results from previous steps and environment variables using template syntax.
        </Typography>
        <CodeBlock>{`// Access previous step result
{ "cmd": "echo 'Previous result: \${prev}'" }

// Access named step result
{ "cmd": "echo 'User: \${results.api1.name}'" }

// Access environment variables
{ "cmd": "echo 'Token: \${env.API_TOKEN}'" }

// Access inputs
{ "url": "https://api.example.com/users/\${inputs.userId}" }

// Access pipeline metadata
{ "cmd": "echo 'Pipeline: \${pipelineId}'" }
{ "cmd": "echo 'Pipeline name: \${PIPELINE_NAME}'" }

// Access build information
{ "cmd": "echo 'Build ID: \${BUILD_ID}'" }
{ "cmd": "echo 'Started at: \${UNIXTIMESTAMP}'" }

// Access date and time
{ "cmd": "echo 'Date: \${DATE}'" }
{ "cmd": "echo 'Time: \${TIME}'" }
{ "cmd": "echo 'DateTime: \${DATETIME}'" }

// Access date components
{ "output": "logs/\${YEAR}/\${MONTH}/build-\${DAY}.log" }

// Access working directory
{ "output": "\${WORK_DIR}/artifacts/\${BUILD_ID}.zip" }`}</CodeBlock>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Available interpolation variables: <code>{"${prev}"}</code>, <code>{"${results.stepName}"}</code>, 
          <code>{"${env.VAR_NAME}"}</code>, <code>{"${inputs.inputName}"}</code>, <code>{"${pipelineId}"}</code>,
          <code>{"${BUILD_ID}"}</code>, <code>{"${UNIXTIMESTAMP}"}</code>, <code>{"${WORK_DIR}"}</code>,
          <code>{"${DATE}"}</code>, <code>{"${TIME}"}</code>, <code>{"${DATETIME}"}</code>, <code>{"${YEAR}"}</code>,
          <code>{"${MONTH}"}</code>, <code>{"${DAY}"}</code>, <code>{"${PIPELINE_NAME}"}</code>.
        </Typography>

        <Divider sx={{ my: 4 }} />

        {/* Modules */}
        <SectionHeader id="modules" title="Modules" subtitle="Built-in functionality" />
        <Typography variant="body2" paragraph>
          Modules are TypeScript functions that perform specific actions. HomeworkCI includes 12 built-in modules. 
          You can also create custom modules by adding <code>.ts</code> files to the <code>modules/</code> directory.
        </Typography>

        <ModuleDoc
          id="mod-shell"
          icon={<Terminal fontSize="small" />}
          title="shell"
          description="Executes shell commands with streaming output. Commands run in an isolated sandbox directory."
          params={[
            { name: 'cmd', type: 'string', required: true, description: 'Shell command to execute' }
          ]}
          returns='{ "code": 0 } — Exit code of the command'
          example={`{
  "module": "shell",
  "params": {
    "cmd": "npm install && npm run build"
  }
}`}
        />

        <ModuleDoc
          id="mod-http"
          icon={<Http fontSize="small" />}
          title="http"
          description="Performs HTTP requests. Supports GET, POST, PUT, DELETE methods with JSON body."
          params={[
            { name: 'url', type: 'string', required: true, description: 'Request URL' },
            { name: 'method', type: 'string', description: 'HTTP method (default: GET)' },
            { name: 'body', type: 'object', description: 'Request body (JSON)' }
          ]}
          returns="Response body as JSON object or string"
          example={`{
  "module": "http",
  "params": {
    "url": "https://api.example.com/users",
    "method": "POST",
    "body": { "name": "John", "email": "john@example.com" }
  }
}`}
        />

        <ModuleDoc
          id="mod-git"
          icon={<Code fontSize="small" />}
          title="git"
          description="Performs Git operations like clone and pull."
          params={[
            { name: 'op', type: '"clone" | "pull"', required: true, description: 'Operation type' },
            { name: 'repo', type: 'string', description: 'Repository URL (required for clone)' },
            { name: 'dir', type: 'string', description: 'Target directory' }
          ]}
          returns='{ "success": true } or { "skipped": true }'
          example={`{
  "module": "git",
  "params": {
    "op": "clone",
    "repo": "https://github.com/user/repo.git",
    "dir": "./repo"
  }
}`}
        />

        <ModuleDoc
          id="mod-fs"
          icon={<FolderCopy fontSize="small" />}
          title="fs"
          description="File system operations for reading and writing files."
          params={[
            { name: 'op', type: '"read" | "write"', required: true, description: 'Operation type' },
            { name: 'path', type: 'string', required: true, description: 'File path' },
            { name: 'content', type: 'string', description: 'Content to write (required for write)' }
          ]}
          returns='Read: file content as string. Write: { "success": true }'
          example={`// Read file
{
  "module": "fs",
  "params": { "op": "read", "path": "./config.json" }
}

// Write file
{
  "module": "fs",
  "params": { "op": "write", "path": "./output.txt", "content": "Hello!" }
}`}
        />

        <ModuleDoc
          id="mod-delay"
          icon={<Timer fontSize="small" />}
          title="delay"
          description="Pauses execution for a specified time. Useful for rate limiting or waiting for external processes."
          params={[
            { name: 'ms', type: 'number', required: true, description: 'Delay in milliseconds' }
          ]}
          returns='{ "waited": <ms> }'
          example={`{
  "module": "delay",
  "params": { "ms": 2000 }
}`}
        />

        <ModuleDoc
          id="mod-notify"
          icon={<Notifications fontSize="small" />}
          title="notify"
          description="Sends notifications to messaging platforms. Supports Telegram and Slack."
          params={[
            { name: 'type', type: '"telegram" | "slack"', required: true, description: 'Notification platform' },
            { name: 'message', type: 'string', required: true, description: 'Message text' },
            { name: 'token', type: 'string', description: 'Telegram: Bot API token' },
            { name: 'chatId', type: 'string', description: 'Telegram: Chat or channel ID' },
            { name: 'parseMode', type: '"HTML" | "Markdown"', description: 'Telegram: Message formatting mode' },
            { name: 'webhook', type: 'string', description: 'Slack: Incoming Webhook URL' },
            { name: 'channel', type: 'string', description: 'Slack: Channel override (e.g., #deploys)' },
            { name: 'username', type: 'string', description: 'Slack: Username override' },
            { name: 'iconEmoji', type: 'string', description: 'Slack: Icon emoji (e.g., :rocket:)' },
            { name: 'attachments', type: 'array', description: 'Slack: Rich message attachments' }
          ]}
          returns='Telegram: { "success": true, "messageId": 12345 }. Slack: { "success": true }'
          example={`// Telegram notification
{
  "module": "notify",
  "params": {
    "type": "telegram",
    "token": "\${env.TG_BOT_TOKEN}",
    "chatId": "\${env.TG_CHAT_ID}",
    "message": "<b>Build completed!</b>\\nStatus: ✅",
    "parseMode": "HTML"
  }
}

// Slack notification
{
  "module": "notify",
  "params": {
    "type": "slack",
    "webhook": "\${env.SLACK_WEBHOOK_URL}",
    "message": "✅ Deploy successful!",
    "channel": "#deploys",
    "iconEmoji": ":rocket:"
  }
}`}
        />

        <ModuleDoc
          id="mod-docker"
          icon={<CloudQueue fontSize="small" />}
          title="docker"
          description="Executes commands inside Docker containers. Provides isolated environment with resource limits and optional container reuse."
          params={[
            { name: 'image', type: 'string', required: true, description: 'Docker image name' },
            { name: 'cmd', type: 'string', required: true, description: 'Command to run' },
            { name: 'workdir', type: 'string', description: 'Working directory in container (default: /workspace)' },
            { name: 'network', type: '"none" | "bridge" | "host"', description: 'Network mode' },
            { name: 'memory', type: 'string', description: 'Memory limit (e.g., "512m")' },
            { name: 'cpus', type: 'string', description: 'CPU limit (e.g., "1")' },
            { name: 'env', type: 'object', description: 'Additional environment variables' },
            { name: 'reuse', type: 'boolean', description: 'Reuse container for multiple steps' },
            { name: 'removeImage', type: 'boolean', description: 'Remove image after execution' }
          ]}
          returns='{ "code": 0 }'
          example={`{
  "module": "docker",
  "params": {
    "image": "node:20-alpine",
    "cmd": "npm install && npm test",
    "memory": "512m",
    "reuse": true
  }
}`}
        />

        <ModuleDoc
          id="mod-docker-remote"
          icon={<CloudQueue fontSize="small" />}
          title="docker_remote"
          description="Pulls a Docker image on a remote host over SSH and runs a container. Checks Docker availability, captures previous/new image IDs, and replaces an existing container name if provided."
          params={[
            { name: 'host', type: 'string', required: true, description: 'Remote host address' },
            { name: 'user', type: 'string', required: true, description: 'SSH username' },
            { name: 'port', type: 'number', description: 'SSH port (default: 22)' },
            { name: 'keyName', type: 'string', description: 'SSH key name from Variables page (recommended)' },
            { name: 'privateKey', type: 'string', description: 'SSH private key content (alternative to keyName)' },
            { name: 'image', type: 'string', required: true, description: 'Docker image to pull and run (e.g., nginx:1.27)' },
            { name: 'sudo', type: 'boolean', description: 'Use sudo for docker commands (default: false)' },
            { name: 'timeout', type: 'number', description: 'Timeout in ms (default: 60000)' },
            { name: 'name', type: 'string', description: 'Container name (force-removed before run if exists)' },
            { name: 'detach', type: 'boolean', description: 'Run in detached mode (default: true)' },
            { name: 'restart', type: '"no" | "always" | "on-failure" | "unless-stopped"', description: 'Restart policy' },
            { name: 'ports', type: 'array', description: 'Port mappings array, e.g., ["8080:80", "443:443"]' },
            { name: 'env', type: 'object', description: 'Env map → -e KEY=VALUE for each entry' },
            { name: 'volumes', type: 'array', description: 'Volume mounts array like "/host:/container:ro"' },
            { name: 'extraArgs', type: 'string', description: 'Raw docker run args before image (e.g., "--add-host foo:1.2.3.4")' },
            { name: 'cmd', type: 'string', description: 'Command passed after image' }
          ]}
          returns='{ "code": 0, "stdout": "...", "stderr": "...", "previousImageId": "...", "newImageId": "...", "changed": true }'
          example={`{
  "module": "docker_remote",
  "params": {
    "host": "1.2.3.4",
    "user": "deploy",
    "keyName": "prod-ssh",
    "image": "nginx:1.27",
    "sudo": true,
    "name": "nginx",
    "ports": ["80:80"],
    "restart": "always"
  }
}`}
        />

        <ModuleDoc
          id="mod-archive"
          icon={<Archive fontSize="small" />}
          title="archive"
          description="Creates and extracts ZIP archives. Useful for packaging build artifacts."
          params={[
            { name: 'op', type: '"zip" | "unzip"', required: true, description: 'Operation type' },
            { name: 'source', type: 'string', required: true, description: 'Source file or directory' },
            { name: 'output', type: 'string', required: true, description: 'Output path' }
          ]}
          returns='{ "success": true, "files": 42 }'
          example={`// Create archive
{
  "module": "archive",
  "params": {
    "op": "zip",
    "source": "./dist",
    "output": "./artifacts/build.zip"
  }
}

// Extract archive
{
  "module": "archive",
  "params": {
    "op": "unzip",
    "source": "./build.zip",
    "output": "./extracted"
  }
}`}
        />

        <ModuleDoc
          id="mod-ssh"
          icon={<Lan fontSize="small" />}
          title="ssh"
          description="Execute remote commands or copy files via SSH/SCP. Essential for deploying to remote servers. Use SSH keys from Variables page for secure authentication."
          params={[
            { name: 'op', type: '"exec" | "scp"', required: true, description: 'Operation: exec (command) or scp (copy files)' },
            { name: 'host', type: 'string', required: true, description: 'Remote host address' },
            { name: 'user', type: 'string', required: true, description: 'SSH username' },
            { name: 'keyName', type: 'string', description: 'SSH key name from Variables page (recommended)' },
            { name: 'privateKey', type: 'string', description: 'SSH private key content (alternative to keyName)' },
            { name: 'port', type: 'number', description: 'SSH port (default: 22)' },
            { name: 'cmd', type: 'string', description: 'Command to execute (required for exec)' },
            { name: 'source', type: 'string', description: 'Local path to copy (required for scp)' },
            { name: 'destination', type: 'string', description: 'Remote path (required for scp)' },
            { name: 'recursive', type: 'boolean', description: 'Recursive copy for directories (default: true)' },
            { name: 'timeout', type: 'number', description: 'Timeout in ms (default: 60000)' }
          ]}
          returns='exec: { "code": 0, "stdout": "...", "stderr": "..." }. scp: { "success": true, "files": 5 }'
          example={`// Execute remote command (recommended: use keyName)
{
  "module": "ssh",
  "params": {
    "op": "exec",
    "host": "server.example.com",
    "user": "deploy",
    "keyName": "production-server",
    "cmd": "cd /app && git pull && docker compose restart"
  }
}

// Copy files to remote server
{
  "module": "ssh",
  "params": {
    "op": "scp",
    "host": "server.example.com",
    "user": "deploy",
    "keyName": "production-server",
    "source": "./dist/",
    "destination": "/var/www/app/",
    "recursive": true
  }
}

// Alternative: Direct private key (less secure)
{
  "module": "ssh",
  "params": {
    "op": "exec",
    "host": "\${env.DEPLOY_HOST}",
    "user": "deploy",
    "privateKey": "\${env.SSH_PRIVATE_KEY}",
    "cmd": "systemctl restart app"
  }
}`}
        />

        <ModuleDoc
          id="mod-s3"
          icon={<Storage fontSize="small" />}
          title="s3"
          description="S3-compatible storage operations. Works with AWS S3, MinIO, DigitalOcean Spaces, and other compatible services."
          params={[
            { name: 'op', type: '"upload" | "download" | "list" | "delete"', required: true, description: 'Operation type' },
            { name: 'bucket', type: 'string', required: true, description: 'S3 bucket name' },
            { name: 'endpoint', type: 'string', required: true, description: 'S3-compatible endpoint URL' },
            { name: 'accessKey', type: 'string', required: true, description: 'Access key ID' },
            { name: 'secretKey', type: 'string', required: true, description: 'Secret access key' },
            { name: 'key', type: 'string', description: 'Object key (path in bucket)' },
            { name: 'source', type: 'string', description: 'Local file path for upload' },
            { name: 'output', type: 'string', description: 'Local path for download' },
            { name: 'prefix', type: 'string', description: 'Prefix filter for list operation' },
            { name: 'region', type: 'string', description: 'AWS region (default: us-east-1)' },
            { name: 'contentType', type: 'string', description: 'Content-Type for upload (auto-detected)' },
            { name: 'acl', type: 'string', description: 'ACL: private, public-read, etc.' }
          ]}
          returns='upload/download: { "success": true, "key": "...", "size": 12345 }. list: { "objects": [...], "count": 10 }'
          example={`// Upload build artifacts
{
  "module": "s3",
  "params": {
    "op": "upload",
    "bucket": "my-artifacts",
    "source": "./dist/build.zip",
    "key": "releases/\${pipelineId}/build.zip",
    "endpoint": "\${env.S3_ENDPOINT}",
    "accessKey": "\${env.S3_ACCESS_KEY}",
    "secretKey": "\${env.S3_SECRET_KEY}"
  }
}

// Download artifact
{
  "module": "s3",
  "params": {
    "op": "download",
    "bucket": "my-artifacts",
    "key": "releases/latest.zip",
    "output": "./download.zip",
    "endpoint": "\${env.S3_ENDPOINT}",
    "accessKey": "\${env.S3_ACCESS_KEY}",
    "secretKey": "\${env.S3_SECRET_KEY}"
  }
}

// List objects
{
  "module": "s3",
  "params": {
    "op": "list",
    "bucket": "my-artifacts",
    "prefix": "releases/",
    "endpoint": "\${env.S3_ENDPOINT}",
    "accessKey": "\${env.S3_ACCESS_KEY}",
    "secretKey": "\${env.S3_SECRET_KEY}"
  }
}`}
        />

        <ModuleDoc
          id="mod-json"
          icon={<DataObject fontSize="small" />}
          title="json"
          description="JSON manipulation operations: parse strings, extract/modify values by path, stringify objects, and merge."
          params={[
            { name: 'op', type: '"parse" | "get" | "set" | "stringify" | "merge"', required: true, description: 'Operation type' },
            { name: 'input', type: 'any', required: true, description: 'Input data (string for parse, object for others)' },
            { name: 'path', type: 'string', description: 'JSONPath for get/set (e.g., $.data.items[0].id)' },
            { name: 'value', type: 'any', description: 'Value for set operation' },
            { name: 'merge', type: 'object', description: 'Object to merge with input' },
            { name: 'pretty', type: 'boolean', description: 'Pretty print for stringify (default: false)' },
            { name: 'indent', type: 'number', description: 'Indentation spaces (default: 2)' }
          ]}
          returns='parse: object. get: extracted value. set: modified object. stringify: string. merge: merged object'
          example={`// Parse JSON string
{
  "module": "json",
  "params": {
    "op": "parse",
    "input": "\${prev}"
  }
}

// Extract value by path
{
  "module": "json",
  "params": {
    "op": "get",
    "input": "\${results.apiResponse}",
    "path": "$.data.users[0].email"
  }
}

// Modify value at path
{
  "module": "json",
  "params": {
    "op": "set",
    "input": "\${results.config}",
    "path": "$.version",
    "value": "2.0.0"
  }
}

// Merge objects
{
  "module": "json",
  "params": {
    "op": "merge",
    "input": "\${results.defaults}",
    "merge": { "override": true, "extra": "value" }
  }
}`}
        />

        <Divider sx={{ my: 4 }}         />

        <ModuleDoc
          id="mod-pipeline"
          icon={<AccountTree fontSize="small" />}
          title="pipeline"
          description="Run another pipeline as a step. Allows composing pipelines and reusing common workflows. Child pipeline runs in its own isolated sandbox."
          params={[
            { name: 'pipelineId', type: 'string', required: true, description: 'ID of the pipeline to run' },
            { name: 'inputs', type: 'object', description: 'Input parameters to pass to child pipeline. Supports interpolation: ${results.stepName.field}' },
            { name: 'failOnError', type: 'boolean', description: 'Stop parent pipeline if child fails (default: true). If false, returns error in result instead of throwing' }
          ]}
          returns='On success: { success: true, runId: string, duration: number }. On failure with failOnError: false: { success: false, runId: "", duration: 0, error: string }'
          example={`// Run child pipeline with inputs
{
  "name": "deploy",
  "module": "pipeline",
  "params": {
    "pipelineId": "build-and-test",
    "inputs": {
      "version": "\${results.build.version}",
      "environment": "\${inputs.env}"
    },
    "failOnError": true
  }
}

// Run child pipeline and continue on error
{
  "name": "try-deploy",
  "module": "pipeline",
  "params": {
    "pipelineId": "deploy-staging",
    "inputs": {
      "branch": "\${inputs.branch}"
    },
    "failOnError": false
  }
}

// Access child pipeline result
{
  "name": "check-result",
  "module": "shell",
  "params": {
    "cmd": "echo 'Child pipeline success: \${prev.success}, duration: \${prev.duration}ms'"
  }
}`}
        />

        <ModuleDoc
          id="mod-queue"
          icon={<CloudQueue fontSize="small" />}
          title="queue"
          description="Message queue operations for RabbitMQ, Redis, AWS SQS, and Google Cloud Pub/Sub. Supports publish (send) and consume (receive) operations."
          params={[
            { name: 'op', type: 'string', required: true, description: 'Operation: publish (send) or consume (receive)' },
            { name: 'provider', type: 'string', required: true, description: 'Provider: rabbitmq, redis, sqs, pubsub' },
            { name: 'message', type: 'string | object', description: 'Message to publish (string or JSON object). Supports interpolation: ${BUILD_ID}' },
            { name: 'timeout', type: 'number', description: 'Timeout in seconds for consume operation (default: 10)' },
            { name: 'host', type: 'string', description: 'RabbitMQ/Redis: Management API endpoint (e.g., http://localhost:15672)' },
            { name: 'username', type: 'string', description: 'RabbitMQ: Username' },
            { name: 'password', type: 'string', description: 'RabbitMQ: Password' },
            { name: 'vhost', type: 'string', description: 'RabbitMQ: Virtual host (default: /)' },
            { name: 'exchange', type: 'string', description: 'RabbitMQ: Exchange name (for publish)' },
            { name: 'routingKey', type: 'string', description: 'RabbitMQ: Routing key (for publish)' },
            { name: 'queue', type: 'string', description: 'RabbitMQ: Queue name (for consume)' },
            { name: 'apiKey', type: 'string', description: 'Redis: API key (if required)' },
            { name: 'channel', type: 'string', description: 'Redis: Pub/Sub channel name' },
            { name: 'list', type: 'string', description: 'Redis: List name (alternative to channel)' },
            { name: 'queueUrl', type: 'string', description: 'AWS SQS: Queue URL' },
            { name: 'region', type: 'string', description: 'AWS SQS: AWS region (default: us-east-1)' },
            { name: 'accessKey', type: 'string', description: 'AWS SQS: Access key ID' },
            { name: 'secretKey', type: 'string', description: 'AWS SQS: Secret access key' },
            { name: 'project', type: 'string', description: 'Google Cloud Pub/Sub: Project ID' },
            { name: 'topic', type: 'string', description: 'Google Cloud Pub/Sub: Topic name (for publish)' },
            { name: 'subscription', type: 'string', description: 'Google Cloud Pub/Sub: Subscription name (for consume)' },
            { name: 'serviceAccount', type: 'object', description: 'Google Cloud Pub/Sub: Service account JSON object' }
          ]}
          returns='Publish: { success: true, messageId: string, provider: string }. Consume (success): { success: true, message: string, messageId: string, provider: string }. Consume (no message): { success: false, timeout: true }'
          example={`// RabbitMQ: Publish message
{
  "module": "queue",
  "params": {
    "op": "publish",
    "provider": "rabbitmq",
    "host": "http://localhost:15672",
    "username": "\${env.RABBITMQ_USER}",
    "password": "\${env.RABBITMQ_PASS}",
    "exchange": "notifications",
    "routingKey": "build.completed",
    "message": "Build \${BUILD_ID} completed successfully"
  }
}

// RabbitMQ: Consume message
{
  "module": "queue",
  "params": {
    "op": "consume",
    "provider": "rabbitmq",
    "host": "http://localhost:15672",
    "username": "\${env.RABBITMQ_USER}",
    "password": "\${env.RABBITMQ_PASS}",
    "queue": "build-queue",
    "timeout": 10
  }
}

// AWS SQS: Publish message
{
  "module": "queue",
  "params": {
    "op": "publish",
    "provider": "sqs",
    "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
    "region": "us-east-1",
    "accessKey": "\${env.AWS_ACCESS_KEY}",
    "secretKey": "\${env.AWS_SECRET_KEY}",
    "message": {
      "buildId": "\${BUILD_ID}",
      "status": "success",
      "timestamp": "\${UNIXTIMESTAMP}"
    }
  }
}

// AWS SQS: Consume message
{
  "module": "queue",
  "params": {
    "op": "consume",
    "provider": "sqs",
    "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789/my-queue",
    "region": "us-east-1",
    "accessKey": "\${env.AWS_ACCESS_KEY}",
    "secretKey": "\${env.AWS_SECRET_KEY}",
    "timeout": 20
  }
}

// Google Cloud Pub/Sub: Publish message
{
  "module": "queue",
  "params": {
    "op": "publish",
    "provider": "pubsub",
    "project": "my-project",
    "topic": "build-events",
    "serviceAccount": \${env.GCP_SERVICE_ACCOUNT},
    "message": "Build \${BUILD_ID} completed"
  }
}

// Google Cloud Pub/Sub: Consume message
{
  "module": "queue",
  "params": {
    "op": "consume",
    "provider": "pubsub",
    "project": "my-project",
    "subscription": "build-subscription",
    "serviceAccount": \${env.GCP_SERVICE_ACCOUNT},
    "timeout": 10
  }
}

// Redis: Publish to channel (requires HTTP API)
{
  "module": "queue",
  "params": {
    "op": "publish",
    "provider": "redis",
    "host": "http://localhost:8080",
    "channel": "notifications",
    "message": "Build \${BUILD_ID} started"
  }
}`}
        />

        {/* Variables */}
        <SectionHeader id="variables" title="Variables" subtitle="Configuration management" />
        <Typography variant="body2" paragraph>
          Variables allow you to store configuration values that can be used across pipelines. 
          All variables are accessed via <code>{"${env.VARIABLE_NAME}"}</code> in step parameters.
          There are two types of variables:
        </Typography>
        
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Global Variables</Typography>
        <Typography variant="body2" paragraph>
          Available in <strong>all pipelines</strong> regardless of environment. Use for values that don't change 
          between environments (API base URLs, notification settings, common paths, etc.).
        </Typography>
        <CodeBlock>{`// Example: Global variables in config/variables.json
{
  "global": {
    "NOTIFY_CHAT_ID": "-1001234567890",
    "API_BASE_URL": "https://api.example.com",
    "DEFAULT_TIMEOUT": "30000"
  },
  "environments": { ... }
}

// Using global variables in any pipeline (no "env" required)
{
  "name": "Simple Pipeline",
  "steps": [
    {
      "module": "http",
      "params": {
        "url": "\${env.API_BASE_URL}/health"
      }
    },
    {
      "module": "notify",
      "params": {
        "type": "telegram",
        "chatId": "\${env.NOTIFY_CHAT_ID}",
        "message": "Health check completed!"
      }
    }
  ]
}`}</CodeBlock>
        
        <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Environment Variables</Typography>
        <Typography variant="body2" paragraph>
          Defined per environment (e.g., "production", "staging", "dev"). When a pipeline specifies an environment 
          via the <code>env</code> field, those variables are <strong>merged</strong> with global variables.
          Environment-specific values override global values with the same name.
        </Typography>
        <CodeBlock>{`// Example: Environment variables in config/variables.json
{
  "global": {
    "LOG_LEVEL": "info"
  },
  "environments": {
    "dev": {
      "DEPLOY_HOST": "dev.example.com",
      "DEPLOY_TOKEN": "dev-token-xxx",
      "LOG_LEVEL": "debug"
    },
    "prod": {
      "DEPLOY_HOST": "example.com",
      "DEPLOY_TOKEN": "prod-token-yyy"
    }
  }
}

// Pipeline using "dev" environment
{
  "name": "Deploy to Dev",
  "env": "dev",
  "steps": [
    {
      "module": "shell",
      "params": {
        "cmd": "deploy --host \${env.DEPLOY_HOST} --token \${env.DEPLOY_TOKEN}"
      }
    }
  ]
}
// Result: DEPLOY_HOST=dev.example.com, LOG_LEVEL=debug (overridden)`}</CodeBlock>

        <Typography id="variables-ssh-keys" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>SSH Keys</Typography>
        <Typography variant="body2" paragraph>
          SSH keys allow secure authentication to remote servers without storing private keys in pipeline configurations. 
          Generate SSH keys on the <strong>Variables</strong> page and reference them by name in SSH module steps.
        </Typography>
        <Typography variant="body2" paragraph>
          <strong>How to use SSH keys:</strong>
        </Typography>
        <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>
          <li><Typography variant="body2">Go to <strong>Variables</strong> page → <strong>SSH Keys</strong> section</Typography></li>
          <li><Typography variant="body2">Click <strong>Generate SSH Key</strong> and enter a name (e.g., <code>production-server</code>)</Typography></li>
          <li><Typography variant="body2">Copy the <strong>public key</strong> and add it to the remote server's <code>~/.ssh/authorized_keys</code></Typography></li>
          <li><Typography variant="body2">Use <code>keyName</code> parameter in SSH module steps (see <a href="#mod-ssh" style={{ color: 'primary.main' }}>ssh module</a>)</Typography></li>
        </Box>
        <CodeBlock>{`// Example: Using SSH key in pipeline
{
  "module": "ssh",
  "params": {
    "op": "exec",
    "host": "server.example.com",
    "user": "deploy",
    "keyName": "production-server",
    "cmd": "systemctl restart app"
  }
}

// SSH keys are stored securely in config/variables.json
// Private keys are never exposed in pipeline configurations`}</CodeBlock>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          SSH keys are generated as Ed25519 key pairs without passphrases, optimized for automation. 
          Each key has a unique name that you can reference in your pipelines.
        </Typography>

        <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Variable Priority</Typography>
        <Typography variant="body2" paragraph>
          Variables are merged in the following order (later values override earlier):
        </Typography>
        <Box component="ol" sx={{ pl: 3, '& li': { mb: 0.5 } }}>
          <li><Typography variant="body2"><strong>System environment</strong> — Filtered safe variables (PATH, HOME, USER, etc.)</Typography></li>
          <li><Typography variant="body2"><strong>Global variables</strong> — From <code>config/variables.json</code></Typography></li>
          <li><Typography variant="body2"><strong>Environment variables</strong> — From selected environment</Typography></li>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Manage variables on the <strong>Variables</strong> page. Changes take effect immediately for new pipeline runs.
        </Typography>

        <Divider sx={{ my: 4 }} />

        {/* Smart Editor */}
        <SectionHeader id="editor" title="Smart Editor" subtitle="Intelligent autocomplete" />
        <Typography variant="body2" paragraph>
          The pipeline editor includes intelligent autocomplete powered by Monaco Editor (the same editor used in VS Code). 
          It provides context-aware suggestions as you type.
        </Typography>
        
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Module Suggestions</Typography>
        <Typography variant="body2" paragraph>
          When typing <code>"module": "</code>, the editor suggests all available modules with descriptions. 
          Built-in modules are prioritized, and custom modules are also included.
        </Typography>
        
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Parameter Hints</Typography>
        <Typography variant="body2" paragraph>
          Inside <code>"params": {"{}"}</code>, the editor suggests parameters specific to the selected module. 
          Each parameter shows:
        </Typography>
        <Box component="ul" sx={{ pl: 3, '& li': { mb: 0.5 } }}>
          <li><Typography variant="body2"><strong>Required</strong> — Parameters that must be provided</Typography></li>
          <li><Typography variant="body2"><strong>Optional</strong> — Parameters with default values</Typography></li>
          <li><Typography variant="body2"><strong>Enum values</strong> — For parameters with predefined options (e.g., <code>op: "zip" | "unzip"</code>)</Typography></li>
          <li><Typography variant="body2"><strong>Type information</strong> — string, number, boolean, object</Typography></li>
        </Box>
        
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Variable Autocomplete</Typography>
        <Typography variant="body2" paragraph>
          When typing <code>{"${"}</code> inside a string value, the editor suggests available interpolation variables:
        </Typography>
        <Box component="ul" sx={{ pl: 3, '& li': { mb: 0.5 } }}>
          <li><Typography variant="body2"><code>{"${prev}"}</code> — Previous step result</Typography></li>
          <li><Typography variant="body2"><code>{"${results.stepName}"}</code> — Named step results</Typography></li>
          <li><Typography variant="body2"><code>{"${inputs.paramName}"}</code> — Pipeline input values</Typography></li>
          <li><Typography variant="body2"><code>{"${env.VAR_NAME}"}</code> — Environment variables (with suggestions from your configured variables)</Typography></li>
          <li><Typography variant="body2"><code>{"${pipelineId}"}</code> — Current pipeline ID</Typography></li>
        </Box>
        
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Quick Insert Panel</Typography>
        <Typography variant="body2" paragraph>
          Above the editor, a Quick Insert panel provides one-click buttons for common variables. 
          Click any variable chip to insert it at the cursor position.
        </Typography>
      </Box>
    </Box>
  );
}
