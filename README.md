# HomeworkCI

Minimalist self-hosted CI/CD server built with Deno and React. Define pipelines in JSON, execute shell commands, HTTP requests, Git operations, or run steps in isolated Docker containers.

## Features

- **JSON Pipelines** — Define automation workflows in simple JSON format
- **Modular Steps** — Built-in modules: shell, docker, http, git, fs, delay, notify, archive
- **Docker Runner** — Execute steps in isolated Docker containers with resource limits
- **Parallel Execution** — Run multiple steps simultaneously
- **Variable Interpolation** — Access step results via `${results.stepName}` and `${prev}`
- **Pipeline Inputs** — Parameterize pipelines with runtime inputs (string, boolean, select)
- **Dynamic Environment** — Select environment at runtime via `${inputs.ENV}`
- **Smart Editor** — Monaco editor with autocomplete for modules, parameters, and variables
- **Sandboxed Execution** — Each pipeline run gets an isolated working directory
- **Cron Scheduling** — Schedule pipelines with cron expressions
- **Real-time Logs** — WebSocket-based live log streaming
- **Web UI** — Modern React + Material UI interface
- **Docker Ready** — Deploy with Docker Compose

## Quick Start

### Docker (Recommended)

```bash
# Clone and start
git clone <repo-url> homeworkci
cd homeworkci
docker compose up -d --build

# Open http://localhost:80
```

### Local Development

Prerequisites: [Deno](https://deno.land/) v2.0+, [Node.js](https://nodejs.org/) v20+

```bash
# Start backend
deno task start

# In another terminal - start frontend dev server
cd client && npm install && npm run dev

# Open http://localhost:5173
```

## Project Structure

```
homeworkci/
├── server/           # Deno backend (Hono, pipeline engine)
├── client/           # React frontend (Vite, Material UI)
├── modules/          # Pipeline step modules (TypeScript)
├── pipelines/        # Pipeline definitions (JSON)
├── config/           # Runtime configuration
├── docker/           # Dockerfiles and nginx config
└── data/             # SQLite database
```

## Pipeline Configuration

Pipelines are JSON files in the `pipelines/` directory:

```json
{
  "name": "My Pipeline",
  "description": "Optional description",
  "schedule": "0 */6 * * *",
  "env": "production",
  "keepWorkDir": false,
  "steps": [
    {
      "name": "step_name",
      "description": "What this step does",
      "module": "shell",
      "params": {
        "cmd": "echo 'Hello World'"
      }
    }
  ]
}
```

### Pipeline Options

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Pipeline display name |
| `description` | string | Optional description |
| `schedule` | string | Cron expression for scheduled runs |
| `env` | string | Environment name from `config/variables.json` |
| `keepWorkDir` | boolean | Keep sandbox directory after completion (debugging) |
| `steps` | array | Array of step objects |

### Step Options

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Step name (used for `${results.name}`) |
| `description` | string | Step description |
| `module` | string | Module to execute: `shell`, `docker`, `http`, `git`, `fs`, `delay` |
| `params` | object | Module-specific parameters |
| `dependsOn` | string \| string[] | Step names this step depends on (must succeed first) |

### Pipeline Inputs

Define runtime parameters that users can configure when starting a pipeline:

```json
{
  "name": "Parameterized Pipeline",
  "env": "${inputs.ENV}",
  "inputs": [
    {
      "name": "ENV",
      "type": "select",
      "label": "Environment",
      "options": ["dev", "staging", "prod"],
      "default": "dev"
    },
    {
      "name": "verbose",
      "type": "boolean",
      "label": "Verbose output",
      "default": false
    }
  ],
  "steps": [...]
}
```

| Input Type | Description |
|------------|-------------|
| `string` | Text input field |
| `boolean` | Checkbox |
| `select` | Dropdown with predefined options |

### Dynamic Environment

The `env` field supports interpolation, allowing environment selection at runtime:

```json
{
  "env": "${inputs.ENV}",
  "inputs": [
    { "name": "ENV", "type": "select", "options": ["dev", "prod"] }
  ]
}
```

### Variable Interpolation

Access data from previous steps and inputs in parameters:

- `${prev}` — Result of the previous step
- `${results.stepName}` — Result of a named step
- `${results.stepName.field}` — Nested field access
- `${env.VAR_NAME}` — Environment variable
- `${inputs.inputName}` — Runtime input value
- `${pipelineId}` — Current pipeline ID

## Variables

Store configuration values in `config/variables.json` for use across pipelines.

### Configuration Structure

```json
{
  "global": {
    "NOTIFY_CHAT_ID": "-1001234567890",
    "API_BASE_URL": "https://api.example.com"
  },
  "environments": {
    "dev": {
      "DEPLOY_HOST": "dev.example.com",
      "DEPLOY_TOKEN": "dev-token-xxx"
    },
    "prod": {
      "DEPLOY_HOST": "example.com",
      "DEPLOY_TOKEN": "prod-token-yyy"
    }
  }
}
```

### Global Variables

Available in **all pipelines** regardless of environment setting:

```json
{
  "name": "Notify Pipeline",
  "steps": [
    {
      "module": "http",
      "params": {
        "url": "${env.API_BASE_URL}/webhook"
      }
    },
    {
      "module": "notify",
      "params": {
        "type": "telegram",
        "chatId": "${env.NOTIFY_CHAT_ID}",
        "message": "Done!"
      }
    }
  ]
}
```

### Environment Variables

Available when pipeline specifies `env` field. Merged with global variables (environment values override global):

```json
{
  "name": "Deploy",
  "env": "prod",
  "steps": [
    {
      "module": "shell",
      "params": {
        "cmd": "deploy --host ${env.DEPLOY_HOST} --token ${env.DEPLOY_TOKEN}"
      }
    }
  ]
}
```

### Variable Priority

Variables are merged in order (later values override earlier):

1. **System environment** — Filtered safe variables (PATH, HOME, USER, etc.)
2. **Global variables** — From `config/variables.json`
3. **Environment variables** — From selected environment

Manage variables via the **Variables** page in the web UI.

## Modules

### shell

Execute shell commands in the sandbox directory.

```json
{
  "module": "shell",
  "params": {
    "cmd": "npm install && npm test"
  }
}
```

### docker

Run commands in isolated Docker containers. Requires `DOCKER_ENABLED=true`.

```json
{
  "module": "docker",
  "params": {
    "image": "node:20-alpine",
    "cmd": "npm test",
    "workdir": "/workspace",
    "network": "bridge",
    "memory": "512m",
    "cpus": "1",
    "reuse": false,
    "removeImage": false
  }
}
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `image` | `alpine:3.19` | Docker image |
| `cmd` | required | Command to execute |
| `workdir` | `/workspace` | Working directory in container |
| `network` | `bridge` | Network mode: `none`, `bridge`, `host` |
| `memory` | `512m` | Memory limit |
| `cpus` | `1` | CPU limit |
| `reuse` | `false` | Reuse container for all steps with `reuse: true` |
| `removeImage` | `false` | Remove image after execution |

**Reuse Mode:** When `reuse: true`, a persistent container is started on the first step and reused for subsequent steps. Installed packages and files persist between steps.

### http

Make HTTP requests.

```json
{
  "module": "http",
  "params": {
    "url": "https://api.example.com/webhook",
    "method": "POST",
    "body": { "status": "success" }
  }
}
```

### git

Git operations.

```json
{
  "module": "git",
  "params": {
    "op": "clone",
    "repo": "https://github.com/user/repo.git",
    "dir": "./repo"
  }
}
```

| Parameter | Description |
|-----------|-------------|
| `op` | Operation: `clone` or `pull` |
| `repo` | Repository URL (for clone) |
| `dir` | Target directory |

### fs

File system operations.

```json
{
  "module": "fs",
  "params": {
    "op": "read",
    "path": "./config.json"
  }
}
```

```json
{
  "module": "fs",
  "params": {
    "op": "write",
    "path": "./output.txt",
    "content": "Hello World"
  }
}
```

### delay

Wait for a specified time.

```json
{
  "module": "delay",
  "params": {
    "ms": 5000
  }
}
```

### notify

Send notifications to messaging platforms (Telegram).

```json
{
  "module": "notify",
  "params": {
    "type": "telegram",
    "token": "${env.TG_BOT_TOKEN}",
    "chatId": "${env.TG_CHAT_ID}",
    "message": "Build completed!",
    "parseMode": "HTML"
  }
}
```

### archive

Create or extract ZIP archives.

```json
{
  "module": "archive",
  "params": {
    "op": "zip",
    "source": "./dist",
    "output": "./artifacts/build.zip"
  }
}
```

## Smart Editor

The pipeline editor includes intelligent autocomplete powered by Monaco Editor:

- **Module suggestions** — Type `"module": "` to see available modules with descriptions
- **Parameter hints** — Inside `"params": {}`, get suggestions for module-specific parameters
- **Variable autocomplete** — Type `${` to see available interpolation variables
- **Required/optional indicators** — Parameters marked as required or optional with defaults

The editor also provides Quick Insert buttons for common variables like `${prev}`, `${results.}`, and environment variables.

## Parallel Execution

To run steps in parallel, wrap them in a nested array:

```json
{
  "steps": [
    { "module": "shell", "params": { "cmd": "echo 'Starting...'" } },
    [
      { "module": "http", "params": { "url": "https://api.example.com/users" } },
      { "module": "http", "params": { "url": "https://api.example.com/posts" } },
      { "module": "http", "params": { "url": "https://api.example.com/comments" } }
    ],
    { "module": "shell", "params": { "cmd": "echo 'All fetched!'" } }
  ]
}
```

Steps inside a nested array execute simultaneously. The pipeline waits for all parallel steps to complete before continuing to the next step.

## Step Dependencies

Use `dependsOn` to make a step conditional on the success of previous steps:

```json
{
  "steps": [
    { "name": "build", "module": "shell", "params": { "cmd": "npm run build" } },
    { "name": "test", "module": "shell", "params": { "cmd": "npm test" } },
    { 
      "name": "deploy", 
      "module": "shell", 
      "params": { "cmd": "./deploy.sh" },
      "dependsOn": ["build", "test"]
    }
  ]
}
```

- If any dependency fails, the pipeline stops with an error
- Dependencies must reference steps defined before the current step
- Use a string for single dependency or array for multiple

## Docker Deployment

### Basic Setup

```bash
docker compose up -d --build
```

### With Custom Configuration

```bash
# Copy example config
cp env.example .env

# Edit settings
nano .env

# Start
docker compose up -d
```

### Enable Docker Runner

To run pipeline steps in Docker containers:

```bash
# Create sandbox directory on host
mkdir -p /tmp/homeworkci

# Set environment variables
echo "DOCKER_ENABLED=true" >> .env
echo "SANDBOX_HOST_PATH=/tmp/homeworkci" >> .env

# Restart
docker compose up -d --build
```

### Development Mode

Mount local directories for live code changes:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8008` | Internal server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `ENABLE_SCHEDULER` | `true` | Enable cron scheduler |
| `SANDBOX_MAX_AGE_HOURS` | `24` | Sandbox cleanup age |

### Directories

| Variable | Default | Description |
|----------|---------|-------------|
| `PIPELINES_DIR` | `./pipelines` | Pipeline definitions |
| `MODULES_DIR` | `./modules` | Step modules |
| `DATA_DIR` | `./data` | SQLite database |
| `CONFIG_DIR` | `./config` | Configuration files |
| `SANDBOX_DIR` | `./tmp` | Temporary directories |

### Docker Runner

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_ENABLED` | `false` | Enable Docker module |
| `SANDBOX_HOST_PATH` | — | Host path for sandbox (Docker-in-Docker) |
| `DOCKER_DEFAULT_IMAGE` | `alpine:3.19` | Default container image |
| `DOCKER_MEMORY_LIMIT` | `512m` | Default memory limit |
| `DOCKER_CPU_LIMIT` | `1` | Default CPU limit |
| `DOCKER_NETWORK_DEFAULT` | `bridge` | Default network mode |
| `DOCKER_TIMEOUT_MS` | `600000` | Container timeout (10 min) |

### Client

| Variable | Default | Description |
|----------|---------|-------------|
| `CLIENT_PORT` | `80` | External web interface port |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/pipelines` | List all pipelines |
| `POST` | `/api/pipelines` | Create pipeline |
| `GET` | `/api/pipelines/:id` | Get pipeline |
| `PUT` | `/api/pipelines/:id` | Update pipeline |
| `DELETE` | `/api/pipelines/:id` | Delete pipeline |
| `POST` | `/api/pipelines/:id/run` | Run pipeline |
| `POST` | `/api/pipelines/:id/stop` | Stop running pipeline |
| `GET` | `/api/pipelines/:id/runs` | Get pipeline runs |
| `GET` | `/api/modules` | List available modules |
| `GET` | `/api/modules/:name` | Get module info |
| `GET` | `/api/variables` | Get global variables |
| `POST` | `/api/variables` | Update global variables |
| `GET` | `/api/environments` | List environments |
| `WS` | `/api/ws` | WebSocket for live logs |

## Commands Reference

### Local Development

```bash
# Start server
deno task start

# Start frontend dev server
cd client && npm run dev

# Build frontend
cd client && npm run build

# Run linter
deno lint
```

### Docker

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f
docker compose logs -f server

# Stop
docker compose down

# Stop and remove volumes
docker compose down -v

# Rebuild single service
docker compose up -d --build server

# Development mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Maintenance

```bash
# Manual sandbox cleanup
curl -X POST http://localhost:8008/api/sandbox/cleanup

# Check health
curl http://localhost:8008/api/health
```

## License

MIT
