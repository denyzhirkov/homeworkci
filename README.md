# HomeworkCI

Minimalist CI/CD home server built with Deno and React.

## Features

- **Pipeline Automation**: Define pipelines in JSON.
- **Custom Modules**: Write steps in TypeScript (`modules/*.ts`).
- **Scheduling**: Cron-based pipeline execution.
- **Sandboxed Execution**: Each pipeline run gets an isolated working directory.
- **Web UI**: Managed via a React + Material UI frontend.
- **Single Runtime**: Backend runs on Deno.
- **Docker Ready**: Deploy with Docker Compose.

## Project Structure

```
├── server/         # Deno backend (Hono server, pipeline engine)
├── client/         # React frontend (Vite, MUI)
├── pipelines/      # JSON pipeline definitions
├── modules/        # TypeScript modules for pipeline steps
├── docker/         # Docker configuration files
├── config/         # Runtime configuration (variables.json)
└── data/           # SQLite database
```

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) v2.0+ (tested with v2.1.4)
- [Node.js](https://nodejs.org/) v20+ (for frontend build)

### Running Locally

Start the backend server (API + static frontend serving):

```bash
deno task start
```

The server will be available at [http://localhost:8000](http://localhost:8000).

### Developing the Frontend

To work on the UI with hot-reload:

```bash
cd client
npm install
npm run dev
```

To build the frontend for production:

```bash
cd client
npm run build
```

## Docker Deployment

### Quick Start

```bash
# Build and run
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

### With Custom Configuration

```bash
# Copy example config
cp env.example .env

# Edit .env as needed
nano .env

# Start with custom config
docker compose up -d
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Internal server port |
| `CLIENT_PORT` | `80` | External web interface port |
| `SANDBOX_MAX_AGE_HOURS` | `24` | Sandbox directory lifetime |
| `ENABLE_SCHEDULER` | `true` | Enable cron scheduler |

### Development with Docker

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Configuration

Environment variables can be set in `.env` file or passed directly:

- `PIPELINES_DIR` - Path to pipeline definitions
- `MODULES_DIR` - Path to step modules  
- `DATA_DIR` - Path to SQLite database
- `CONFIG_DIR` - Path to configuration files
- `SANDBOX_DIR` - Path to temporary sandbox directories

## License

MIT
