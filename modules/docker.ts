// Executes a command inside a Docker container.
// Provides isolated execution environment with resource limits.
// Tags: built-in
//
// Usage Example:
// {
//   "module": "docker",
//   "params": {
//     "image": "node:20-alpine",
//     "cmd": "npm test"
//   }
// }
//
// Full params:
// {
//   "module": "docker",
//   "params": {
//     "image": "node:20-alpine",    // Docker image (required, or uses default)
//     "cmd": "npm install && npm test", // Command to run (required)
//     "workdir": "/workspace",      // Working directory in container
//     "network": "bridge",          // none, bridge, host
//     "memory": "512m",             // Memory limit
//     "cpus": "1",                  // CPU limit
//     "env": { "NODE_ENV": "test" },// Additional env vars
//     "reuse": true,                // Reuse container for all steps with reuse:true
//     "removeImage": true           // Remove image after execution (cleanup)
//   }
// }
//
// Returns: { "code": 0 }
//
// Note: The pipeline's sandbox directory (ctx.workDir) is mounted as /workspace
// in the container. All env vars from ctx.env are passed to the container.
//
// Reuse mode:
// When reuse: true, a persistent container is started on first use and kept
// running. All subsequent steps with reuse: true will execute in the same
// container using 'docker exec'. This is useful for:
// - Installing dependencies once and reusing them
// - Keeping state between steps
// - Faster execution (no container startup overhead)
//
// The persistent container is automatically stopped when:
// - Pipeline completes
// - Pipeline is stopped/cancelled
// - Pipeline fails

import type { PipelineContext } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    image: {
      type: "string",
      required: false,
      default: "node:20-alpine",
      description: "Docker image to use. If not specified, uses default from config."
    },
    cmd: {
      type: "string",
      required: true,
      description: "Command to execute inside container"
    },
    workdir: {
      type: "string",
      required: false,
      default: "/workspace",
      description: "Working directory inside container"
    },
    network: {
      type: "string",
      required: false,
      default: "bridge",
      enum: ["none", "bridge", "host"],
      description: "Docker network mode"
    },
    memory: {
      type: "string",
      required: false,
      description: "Memory limit (e.g., '512m', '1g')"
    },
    cpus: {
      type: "string",
      required: false,
      description: "CPU limit (e.g., '1', '0.5')"
    },
    env: {
      type: "object",
      required: false,
      description: "Additional environment variables for container"
    },
    timeout: {
      type: "number",
      required: false,
      description: "Timeout in milliseconds"
    },
    reuse: {
      type: "boolean",
      required: false,
      default: false,
      description: "Reuse container across steps with reuse:true (faster execution)"
    },
    removeImage: {
      type: "boolean",
      required: false,
      default: false,
      description: "Remove Docker image after execution (cleanup)"
    }
  }
};

// Import dynamically to work both in server and standalone contexts
let runContainer: typeof import("../server/docker-manager.ts").runContainer;
let config: typeof import("../server/config.ts").config;

// Lazy initialization of imports
async function initImports() {
  if (!runContainer) {
    const dockerManager = await import("../server/docker-manager.ts");
    runContainer = dockerManager.runContainer;
  }
  if (!config) {
    const configModule = await import("../server/config.ts");
    config = configModule.config;
  }
}

export interface DockerParams {
  image?: string;
  cmd: string;
  workdir?: string;
  network?: "none" | "bridge" | "host";
  memory?: string;
  cpus?: string;
  env?: Record<string, string>;
  timeout?: number;
  reuse?: boolean; // Reuse persistent container for this pipeline run
  removeImage?: boolean; // Remove image after execution
}

export async function run(ctx: PipelineContext, params: DockerParams): Promise<{ code: number }> {
  await initImports();

  if (!params.cmd) {
    throw new Error("Docker module requires 'cmd' parameter");
  }

  if (!config.dockerEnabled) {
    throw new Error(
      "Docker runner is disabled. Enable with DOCKER_ENABLED=true or use 'shell' module instead."
    );
  }

  const image = params.image || config.dockerDefaultImage;
  if (ctx.log) ctx.log(`[Docker] Using image: ${image}`);

  // Merge ctx.env with params.env (params.env takes priority)
  const mergedEnv = { ...ctx.env, ...params.env };

  // Get step index from context if available (for unique container naming)
  const stepIdx = ctx.stepIndex ?? 0;

  const result = await runContainer(
    ctx.pipelineId,
    String(ctx.startTime), // Use startTime as runId
    stepIdx,
    {
      image,
      cmd: params.cmd,
      workDir: ctx.workDir,
      env: mergedEnv,
      workdir: params.workdir,
      network: params.network,
      memory: params.memory,
      cpus: params.cpus,
      timeout: params.timeout,
      reuse: params.reuse,
      removeImage: params.removeImage,
    },
    ctx.log,
    ctx.signal
  );

  return { code: result.code };
}
