# HomeworkCI

Minimalist CI/CD home server built with Deno and React.

## Features

- **Pipeline Automation**: Define pipelines in JSON.
- **Custom Modules**: Write steps in TypeScript (`modules/*.ts`).
- **Scheduling**: Cron-based pipeline execution.
- **Web UI**: Managed via a React + Material UI frontend.
- **Single Runtime**: Backend runs on Deno.

## Project Structure

- `server/`: Deno backend (Hono server, pipeline engine).
- `client/`: React frontend (Vite, MUI).
- `pipelines/`: JSON pipeline definitions.
- `modules/`: Deno TypeScript modules for pipeline steps.

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) (v1.x)
- [Node.js](https://nodejs.org/) (v22.12+ for frontend build)

### Running the Server

Start the backend server (api + static frontend serving):

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
