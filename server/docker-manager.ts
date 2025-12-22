// Docker container manager for running pipeline steps in isolated containers
// Provides functions to run, kill, and track Docker containers

import { config } from "./config.ts";

// Container naming convention: homeworkci-{pipelineId}-{runId}-{stepIdx}
const CONTAINER_PREFIX = "homeworkci";

// Track running containers for cleanup
const runningContainers = new Map<string, Set<string>>();

// Track persistent (reusable) containers per pipeline run
const persistentContainers = new Map<string, string>();

export interface DockerRunOptions {
  image: string;
  cmd: string;
  workDir: string; // Host path to mount as /workspace
  env?: Record<string, string>;
  workdir?: string; // Working directory inside container (default: /workspace)
  network?: string; // none, bridge, host
  memory?: string; // e.g., "512m"
  cpus?: string; // e.g., "1"
  timeout?: number; // ms
  removeImage?: boolean; // Remove image after execution
  reuse?: boolean; // Reuse persistent container for this pipeline run
}

export interface DockerRunResult {
  code: number;
  output: string;
}

// Generate unique container name
function generateContainerName(pipelineId: string, runId: string, stepIdx: number | string): string {
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "-").substring(0, 32);
  return `${CONTAINER_PREFIX}-${sanitize(pipelineId)}-${sanitize(runId)}-${stepIdx}`;
}

// Track container for a run
function trackContainer(runKey: string, containerName: string): void {
  if (!runningContainers.has(runKey)) {
    runningContainers.set(runKey, new Set());
  }
  runningContainers.get(runKey)!.add(containerName);
}

// Untrack container
function untrackContainer(runKey: string, containerName: string): void {
  const containers = runningContainers.get(runKey);
  if (containers) {
    containers.delete(containerName);
    if (containers.size === 0) {
      runningContainers.delete(runKey);
    }
  }
}

// Patterns for Docker informational messages (not real errors)
const dockerInfoPatterns = [
  /^Unable to find image/,
  /^[a-f0-9]+: (Pulling|Waiting|Downloading|Extracting|Verifying|Pull complete|Download complete|Already exists)/,
  /^Pulling from/,
  /^[0-9a-z.-]+: Pulling from/,
  /^Digest: sha256:/,
  /^Status: (Downloaded|Image is up to date)/,
  /^Untagged:/,
  /^Deleted:/,
];

const isDockerInfo = (line: string): boolean => {
  return dockerInfoPatterns.some(pattern => pattern.test(line));
};

// Stream output helper
async function streamOutput(
  readable: ReadableStream<Uint8Array>,
  log: (msg: string) => void,
  isStderr: boolean = false,
  killed: { value: boolean }
): Promise<void> {
  const reader = readable.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (killed.value) break;
      const lines = value.split('\n');
      for (const line of lines) {
        if (line) {
          if (isStderr && !isDockerInfo(line)) {
            log("[ERR] " + line);
          } else {
            log(line);
          }
        }
      }
    }
  } catch {
    // Ignore read errors if killed
  } finally {
    reader.releaseLock();
  }
}

// Remove a Docker image
export async function removeImage(image: string, log: (msg: string) => void): Promise<void> {
  log(`[Docker] Removing image: ${image}`);
  try {
    const command = new Deno.Command("docker", {
      args: ["rmi", image],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    if (!output.success) {
      const stderr = new TextDecoder().decode(output.stderr);
      log(`[Docker] Warning: Could not remove image: ${stderr.trim()}`);
    } else {
      log(`[Docker] Image removed: ${image}`);
    }
  } catch (e) {
    log(`[Docker] Warning: Failed to remove image: ${e}`);
  }
}

// Start a persistent container (for reuse mode)
async function startPersistentContainer(
  containerName: string,
  image: string,
  hostWorkDir: string,
  workdir: string,
  network: string,
  memory: string,
  cpus: string,
  env: Record<string, string> | undefined,
  log: (msg: string) => void
): Promise<void> {
  const args: string[] = [
    "run",
    "-d", // Detached mode
    "--name", containerName,
    "-v", `${hostWorkDir}:/workspace`,
    "-w", workdir,
    "--network", network,
  ];

  if (memory) args.push("--memory", memory);
  if (cpus) args.push("--cpus", cpus);

  if (env) {
    for (const [key, value] of Object.entries(env)) {
      if (key.startsWith("DENO_") || key === "PATH") continue;
      args.push("-e", `${key}=${value}`);
    }
  }

  // Use tail -f /dev/null to keep container running
  args.push(image, "tail", "-f", "/dev/null");

  log(`[Docker] Starting persistent container: ${containerName}`);
  log(`[Docker] Image: ${image}, Network: ${network}`);

  const command = new Deno.Command("docker", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const killed = { value: false };
  const process = command.spawn();

  await Promise.all([
    streamOutput(process.stdout, log, false, killed),
    streamOutput(process.stderr, log, true, killed),
  ]).catch(() => {});

  const status = await process.status;
  if (!status.success) {
    throw new Error("Failed to start persistent container");
  }
}

// Execute command in existing container
async function execInContainer(
  containerName: string,
  cmd: string,
  workdir: string,
  log: (msg: string) => void,
  signal: AbortSignal | undefined,
  timeout: number
): Promise<DockerRunResult> {
  const args = ["exec", "-w", workdir, containerName, "sh", "-c", cmd];

  log(`[Docker] Executing in container: ${containerName}`);
  log(`[Docker] Command: ${cmd}`);

  const command = new Deno.Command("docker", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();
  const killed = { value: false };

  const abortHandler = async () => {
    if (killed.value) return;
    killed.value = true;
    log(`[Docker] Stopping execution in container`);
    // For exec, we need to kill the exec process, not the container
    try {
      process.kill("SIGKILL");
    } catch { /* ignore */ }
  };

  if (signal) {
    signal.addEventListener("abort", abortHandler, { once: true });
  }

  const timeoutId = setTimeout(() => {
    if (!killed.value) {
      killed.value = true;
      log(`[Docker] Execution timeout after ${timeout}ms`);
      try {
        process.kill("SIGKILL");
      } catch { /* ignore */ }
    }
  }, timeout);

  try {
    await Promise.all([
      streamOutput(process.stdout, log, false, killed),
      streamOutput(process.stderr, log, true, killed),
    ]).catch(() => {});

    const status = await process.status;

    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", abortHandler);

    if (signal?.aborted || killed.value) {
      throw new Error("Execution stopped by user");
    }

    if (!status.success) {
      throw new Error(`Command failed with code ${status.code}`);
    }

    return { code: status.code, output: "" };
  } catch (e) {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", abortHandler);
    if (signal?.aborted || killed.value) {
      throw new Error("Execution stopped by user");
    }
    throw e;
  }
}

// Run a command in a Docker container
export async function runContainer(
  pipelineId: string,
  runId: string,
  stepIdx: number,
  options: DockerRunOptions,
  log: (msg: string) => void,
  signal?: AbortSignal
): Promise<DockerRunResult> {
  if (!config.dockerEnabled) {
    throw new Error("Docker runner is not enabled. Set DOCKER_ENABLED=true");
  }

  const runKey = `${pipelineId}:${runId}`;
  const image = options.image || config.dockerDefaultImage;
  const network = options.network || config.dockerNetworkDefault;
  const memory = options.memory || config.dockerMemoryLimit;
  const cpus = options.cpus || config.dockerCpuLimit;
  const timeout = options.timeout || config.dockerTimeoutMs;
  const workdir = options.workdir || "/workspace";

  // Convert container path to host path for Docker-in-Docker
  let hostWorkDir = options.workDir;
  if (config.sandboxHostPath && options.workDir.startsWith(config.sandboxDir)) {
    hostWorkDir = options.workDir.replace(config.sandboxDir, config.sandboxHostPath);
  }

  let result: DockerRunResult;

  // Check if we should reuse a persistent container
  if (options.reuse) {
    const persistentName = generateContainerName(pipelineId, runId, "persistent");

    // Start persistent container if not exists
    if (!persistentContainers.has(runKey)) {
      await startPersistentContainer(
        persistentName, image, hostWorkDir, workdir, network, memory, cpus, options.env, log
      );
      persistentContainers.set(runKey, persistentName);
      trackContainer(runKey, persistentName);
    }

    // Execute command in persistent container
    result = await execInContainer(persistentName, options.cmd, workdir, log, signal, timeout);
  } else {
    // One-shot container (original behavior)
    const containerName = generateContainerName(pipelineId, runId, stepIdx);

    const args: string[] = [
      "run",
      "--rm",
      "--name", containerName,
      "-v", `${hostWorkDir}:/workspace`,
      "-w", workdir,
      "--network", network,
    ];

    if (memory) args.push("--memory", memory);
    if (cpus) args.push("--cpus", cpus);

    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        if (key.startsWith("DENO_") || key === "PATH") continue;
        args.push("-e", `${key}=${value}`);
      }
    }

    args.push(image, "sh", "-c", options.cmd);

    log(`[Docker] Running in container: ${containerName}`);
    log(`[Docker] Image: ${image}, Network: ${network}, Memory: ${memory}, CPUs: ${cpus}`);
    log(`[Docker] Command: ${options.cmd}`);

    const command = new Deno.Command("docker", { args, stdout: "piped", stderr: "piped" });
    const process = command.spawn();
    const killed = { value: false };

    trackContainer(runKey, containerName);

    const abortHandler = async () => {
      if (killed.value) return;
      killed.value = true;
      log(`[Docker] Stopping container: ${containerName}`);
      await killContainer(containerName);
    };

    if (signal) {
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    const timeoutId = setTimeout(async () => {
      if (!killed.value) {
        killed.value = true;
        log(`[Docker] Container timeout after ${timeout}ms`);
        await killContainer(containerName);
      }
    }, timeout);

    try {
      await Promise.all([
        streamOutput(process.stdout, log, false, killed),
        streamOutput(process.stderr, log, true, killed),
      ]).catch(() => {});

      const status = await process.status;

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", abortHandler);
      untrackContainer(runKey, containerName);

      if (signal?.aborted || killed.value) {
        throw new Error("Container stopped by user");
      }

      if (!status.success) {
        throw new Error(`Container exited with code ${status.code}`);
      }

      result = { code: status.code, output: "" };
    } catch (e) {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", abortHandler);
      untrackContainer(runKey, containerName);

      if (signal?.aborted || killed.value) {
        throw new Error("Container stopped by user");
      }
      throw e;
    }
  }

  // Remove image if requested
  if (options.removeImage) {
    await removeImage(image, log);
  }

  return result;
}

// Kill a specific container by name
export async function killContainer(containerName: string): Promise<void> {
  try {
    const command = new Deno.Command("docker", {
      args: ["kill", containerName],
      stdout: "null",
      stderr: "null",
    });
    await command.output();
  } catch {
    // Container may already be stopped
  }
}

// Stop and remove a persistent container
export async function stopPersistentContainer(pipelineId: string, runId: string): Promise<void> {
  const runKey = `${pipelineId}:${runId}`;
  const containerName = persistentContainers.get(runKey);
  
  if (containerName) {
    try {
      // Stop container
      const stopCmd = new Deno.Command("docker", {
        args: ["stop", containerName],
        stdout: "null",
        stderr: "null",
      });
      await stopCmd.output();
    } catch { /* ignore */ }

    try {
      // Remove container (in case --rm wasn't used)
      const rmCmd = new Deno.Command("docker", {
        args: ["rm", "-f", containerName],
        stdout: "null",
        stderr: "null",
      });
      await rmCmd.output();
    } catch { /* ignore */ }

    persistentContainers.delete(runKey);
    untrackContainer(runKey, containerName);
  }
}

// Kill all containers for a specific pipeline run
export async function killContainersForRun(pipelineId: string, runId: string): Promise<number> {
  const runKey = `${pipelineId}:${runId}`;
  
  // Stop persistent container if exists
  await stopPersistentContainer(pipelineId, runId);

  const containers = runningContainers.get(runKey);
  
  if (!containers || containers.size === 0) {
    return 0;
  }

  let killed = 0;
  for (const containerName of containers) {
    await killContainer(containerName);
    killed++;
  }

  runningContainers.delete(runKey);
  return killed;
}

// Get list of running containers for a pipeline
export function getRunningContainers(pipelineId?: string): string[] {
  const result: string[] = [];
  
  for (const [runKey, containers] of runningContainers) {
    if (!pipelineId || runKey.startsWith(`${pipelineId}:`)) {
      result.push(...containers);
    }
  }
  
  return result;
}

// Check if Docker is available
export async function isDockerAvailable(): Promise<boolean> {
  try {
    const command = new Deno.Command("docker", {
      args: ["info"],
      stdout: "null",
      stderr: "null",
    });
    const status = await command.output();
    return status.success;
  } catch {
    return false;
  }
}
