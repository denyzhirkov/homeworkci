// Pulls a Docker image on a remote host over SSH and runs a container.
// Single mode: pull_run (always pulls, then runs).
// Tags: built-in
//
// Example:
// {
//   "module": "docker_remote",
//   "params": {
//     "host": "1.2.3.4",
//     "user": "deploy",
//     "keyName": "prod-ssh",
//     "image": "nginx:1.27",
//     "sudo": true,
//     "name": "nginx",
//     "ports": ["80:80"],
//     "restart": "always"
//   }
// }

import type { PipelineContext } from "../server/types/index.ts";
import { join } from "@std/path";

/** Schema for editor hints */
export const schema = {
  params: {
    host: {
      type: "string",
      required: true,
      description: "Remote host address"
    },
    port: {
      type: "number",
      required: false,
      default: 22,
      description: "SSH port (default: 22)"
    },
    user: {
      type: "string",
      required: true,
      description: "SSH username"
    },
    keyName: {
      type: "string",
      required: false,
      description: "SSH key name from Variables page (recommended)"
    },
    privateKey: {
      type: "string",
      required: false,
      description: "SSH private key content (alternative to keyName)"
    },
    image: {
      type: "string",
      required: true,
      description: "Docker image to pull and run (e.g., nginx:1.27)"
    },
    sudo: {
      type: "boolean",
      required: false,
      default: false,
      description: "Use sudo for docker commands"
    },
    timeout: {
      type: "number",
      required: false,
      default: 60000,
      description: "Operation timeout in milliseconds"
    },
    name: {
      type: "string",
      required: false,
      description: "Container name (will be force-removed before run if exists)"
    },
    detach: {
      type: "boolean",
      required: false,
      default: true,
      description: "Run container in detached mode (default: true)"
    },
    restart: {
      type: "string",
      required: false,
      enum: ["no", "always", "on-failure", "unless-stopped"],
      description: "Restart policy"
    },
    ports: {
      type: "array",
      required: false,
      description: "List of port mappings (host:container), e.g., 8080:80"
    },
    env: {
      type: "object",
      required: false,
      description: "Key/value map of env vars -> becomes -e KEY=VALUE"
    },
    volumes: {
      type: "array",
      required: false,
      description: "List of mounts /host:/container[:mode], e.g., /data:/app/data:ro"
    },
    extraArgs: {
      type: "string",
      required: false,
      description: "Additional raw docker run args inserted before image (e.g., \"--add-host foo:1.2.3.4\")"
    },
    cmd: {
      type: "string",
      required: false,
      description: "Command to pass after image (raw string)"
    }
  }
};

export interface DockerRemoteParams {
  host: string;
  port?: number;
  user: string;
  keyName?: string;
  privateKey?: string;
  image: string;
  sudo?: boolean;
  timeout?: number;
  name?: string;
  detach?: boolean;
  restart?: "no" | "always" | "on-failure" | "unless-stopped";
  ports?: string[];
  env?: Record<string, string>;
  volumes?: string[];
  extraArgs?: string;
  cmd?: string;
}

export interface DockerRemoteResult {
  code: number;
  stdout: string;
  stderr: string;
  previousImageId: string | null;
  newImageId: string | null;
  changed: boolean;
}

export async function run(
  ctx: PipelineContext,
  params: DockerRemoteParams
): Promise<DockerRemoteResult> {
  if (!params.host) throw new Error("docker_remote requires 'host'");
  if (!params.user) throw new Error("docker_remote requires 'user'");
  if (!params.image) throw new Error("docker_remote requires 'image'");

  // Generate container name if not provided
  const containerName = params.name || `${extractImageBaseName(params.image)}_hwci`;
  if (ctx.log) {
    if (params.name) {
      ctx.log(`[docker_remote] Using provided container name: ${containerName}`);
    } else {
      ctx.log(`[docker_remote] Generated container name: ${containerName} (from image: ${params.image})`);
    }
  }

  // Resolve private key: either from keyName or direct privateKey
  let privateKey = params.privateKey;
  if (params.keyName) {
    const key = ctx.sshKey[params.keyName];
    if (!key) {
      throw new Error(`SSH key '${params.keyName}' not found. Create it on the Variables page.`);
    }
    privateKey = key;
    if (ctx.log) ctx.log(`[docker_remote] Using SSH key: ${params.keyName}`);
  }

  if (!privateKey) {
    throw new Error("docker_remote requires 'keyName' or 'privateKey'");
  }

  if (!privateKey.includes("BEGIN") || !privateKey.includes("END")) {
    throw new Error("Invalid SSH private key format: missing BEGIN/END markers");
  }

  if (privateKey.length < 200) {
    throw new Error(`SSH private key seems too short (${privateKey.length} chars). Key may be corrupted.`);
  }

  privateKey = privateKey.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!privateKey.endsWith("\n")) privateKey += "\n";

  const port = params.port || 22;
  const timeout = params.timeout || 60000;

  const keyPath = join(ctx.workDir, `.ssh_key_${Date.now()}`);
  try {
    await Deno.writeTextFile(keyPath, privateKey);
    await Deno.chmod(keyPath, 0o600);

    if (ctx.log) {
      ctx.log(`[docker_remote] Connecting to ${params.user}@${params.host}:${port} via SSH`);
      ctx.log(`[docker_remote] Image: ${params.image}`);
      ctx.log(`[docker_remote] Container name: ${containerName}`);
      ctx.log(`[docker_remote] Timeout: ${timeout}ms`);
    }

    const { remoteCmd, dockerRunCommand } = buildRemoteCommand(params, containerName, ctx.log);
    
    if (ctx.log) {
      ctx.log(`[docker_remote] Docker run command: ${dockerRunCommand}`);
    }

    const args = [
      "-i",
      keyPath,
      "-p",
      String(port),
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "UserKnownHostsFile=/dev/null",
      "-o",
      "BatchMode=yes",
      "-o",
      `ConnectTimeout=${Math.floor(timeout / 1000)}`,
      `${params.user}@${params.host}`,
      remoteCmd
    ];

    if (ctx.log) ctx.log(`[docker_remote] Executing remote pull+run on ${params.user}@${params.host}:${port}`);

    const command = new Deno.Command("ssh", {
      args,
      stdout: "piped",
      stderr: "piped"
    });

    const process = command.spawn();
    let killed = false;

    const abortHandler = () => {
      if (killed) return;
      killed = true;
      try {
        process.kill("SIGKILL");
        if (ctx.log) ctx.log("[docker_remote] Killed by user");
      } catch {
        // Ignore
      }
    };

    if (ctx.signal) {
      ctx.signal.addEventListener("abort", abortHandler, { once: true });
    }

    const timeoutId = setTimeout(() => {
      if (!killed) {
        killed = true;
        try {
          process.kill("SIGKILL");
          if (ctx.log) ctx.log("[docker_remote] Killed due to timeout");
        } catch {
          // Ignore
        }
      }
    }, timeout);

    try {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      const streamOutput = async (
        readable: ReadableStream<Uint8Array>,
        chunks: string[],
        prefix: string = ""
      ) => {
        const reader = readable.pipeThrough(new TextDecoderStream()).getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || killed) break;
            chunks.push(value);
            if (ctx.log) {
              for (const line of value.split("\n")) {
                if (line && !line.startsWith("__HW_META__")) {
                  ctx.log(prefix + line);
                }
              }
            }
          }
        } catch (err) {
          if (ctx.log && !killed) {
            ctx.log(`[docker_remote] Error reading stream: ${err instanceof Error ? err.message : String(err)}`);
          }
        } finally {
          reader.releaseLock();
        }
      };

      const streamPromise = Promise.all([
        streamOutput(process.stdout, stdoutChunks, "[docker_remote] "),
        streamOutput(process.stderr, stderrChunks, "[docker_remote] [ERR] ")
      ]);

      const status = await process.status;
      await streamPromise.catch((err) => {
        if (ctx.log) {
          ctx.log(`[docker_remote] Error during stream processing: ${err instanceof Error ? err.message : String(err)}`);
        }
      });

      clearTimeout(timeoutId);
      if (ctx.signal) ctx.signal.removeEventListener("abort", abortHandler);

      if (ctx.signal?.aborted || killed) {
        throw new Error("Pipeline stopped by user");
      }

      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");

      if (ctx.log) {
        if (status.code !== 0) {
          ctx.log(`[docker_remote] Command failed with exit code: ${status.code}`);
          if (stderr) {
            ctx.log(`[docker_remote] Error output: ${stderr}`);
          }
        } else {
          ctx.log(`[docker_remote] Command completed successfully`);
        }
      }

      const meta = parseMeta(stdout);

      return {
        code: status.code,
        stdout,
        stderr,
        previousImageId: meta.prev || null,
        newImageId: meta.newId || null,
        changed: !!(meta.prev || meta.newId) ? meta.prev !== meta.newId : status.code === 0
      };
    } catch (err) {
      if (ctx.log) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        ctx.log(`[docker_remote] Error during execution: ${errorMsg}`);
        if (err instanceof Error && err.stack) {
          ctx.log(`[docker_remote] Stack trace: ${err.stack}`);
        }
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (ctx.signal) {
        ctx.signal.removeEventListener("abort", abortHandler);
      }
    }
  } finally {
    try {
      await Deno.remove(keyPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function buildRemoteCommand(
  params: DockerRemoteParams,
  containerName: string,
  log?: (msg: string) => void
): { remoteCmd: string; dockerRunCommand: string } {
  const sudo = params.sudo ? "sudo " : "";
  const imageArg = shEscape(params.image);
  const containerNameEscaped = shEscape(containerName);

  const runArgs: string[] = [];
  runArgs.push(`${sudo}docker run`);
  if (params.detach !== false) runArgs.push("-d");
  runArgs.push("--name", containerNameEscaped);
  if (params.restart) runArgs.push("--restart", shEscape(params.restart));

  if (Array.isArray(params.ports)) {
    for (const p of params.ports) {
      if (p) runArgs.push("-p", shEscape(p));
    }
  }

  if (params.env) {
    // Handle both object and string (JSON) formats
    let envObj: Record<string, string>;
    const envType = typeof params.env;
    
    if (envType === "string") {
      try {
        envObj = JSON.parse(params.env);
        if (log) log(`[docker_remote] Parsed env from JSON string: ${Object.keys(envObj).length} variables`);
      } catch (e) {
        throw new Error(`Invalid env format: expected object or JSON string, got: ${params.env.substring(0, 100)}`);
      }
    } else if (envType === "object" && params.env !== null && !Array.isArray(params.env)) {
      envObj = params.env;
      if (log) log(`[docker_remote] Using env object: ${Object.keys(envObj).length} variables`);
    } else {
      throw new Error(`Invalid env format: expected object, got ${envType} (${Array.isArray(params.env) ? "array" : String(params.env)})`);
    }
    
    // Ensure we're iterating over an object, not a string
    if (typeof envObj === "object" && envObj !== null && !Array.isArray(envObj)) {
      const entries = Object.entries(envObj);
      if (log) log(`[docker_remote] Processing ${entries.length} environment variables`);
      for (const [key, value] of entries) {
        if (typeof key === "string" && key.length > 0) {
          const valueStr = value !== null && value !== undefined ? String(value) : "";
          runArgs.push("-e", shEscape(`${key}=${valueStr}`));
        }
      }
    } else {
      throw new Error(`Invalid env object after processing: got ${typeof envObj}`);
    }
  }

  if (Array.isArray(params.volumes)) {
    for (const v of params.volumes) {
      if (v) runArgs.push("-v", shEscape(v));
    }
  }

  if (params.extraArgs) {
    runArgs.push(params.extraArgs);
  }

  runArgs.push(imageArg);
  if (params.cmd) runArgs.push(params.cmd);

  // Build the docker run command for logging (readable format)
  const dockerRunCommand = runArgs.join(" ");

  // Build bash script with proper multiline syntax
  // Use heredoc or proper command grouping to handle multiline if statements
  const scriptParts: string[] = [];
  
  scriptParts.push("set -euo pipefail");
  scriptParts.push(`echo "[docker_remote] Checking Docker availability..."`);
  scriptParts.push(`if ! command -v docker >/dev/null 2>&1; then echo "[docker_remote] ERROR: Docker not found" >&2; exit 127; fi`);
  scriptParts.push(`echo "[docker_remote] Docker found, inspecting previous image ID..."`);
  scriptParts.push(`prev_id=$(${sudo}docker image inspect --format '{{.Id}}' ${imageArg} 2>/dev/null || echo "")`);
  scriptParts.push(`echo "[docker_remote] Pulling image: ${params.image}"`);
  scriptParts.push(`${sudo}docker pull ${imageArg}`);
  scriptParts.push(`echo "[docker_remote] Image pulled, inspecting new image ID..."`);
  scriptParts.push(`new_id=$(${sudo}docker image inspect --format '{{.Id}}' ${imageArg} 2>/dev/null || echo "")`);
  scriptParts.push(`echo "[docker_remote] Checking if container ${containerName} exists..."`);
  
  // Use proper escaping for container name in filter - escape special regex chars
  const containerNameForFilter = containerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  scriptParts.push(`container_exists=$(${sudo}docker ps -a --filter "name=^${containerNameForFilter}$" --format '{{.Names}}' 2>/dev/null || echo "")`);
  
  // Use proper bash syntax for if/else - wrap in braces and use semicolons
  scriptParts.push(`if [ -n "$container_exists" ]; then echo "[docker_remote] Container ${containerName} exists, stopping it..."; ${sudo}docker stop ${containerNameEscaped} >/dev/null 2>&1 || true; echo "[docker_remote] Removing container ${containerName}..."; ${sudo}docker rm -f ${containerNameEscaped} >/dev/null 2>&1 || true; echo "[docker_remote] Container ${containerName} removed"; else echo "[docker_remote] Container ${containerName} does not exist, proceeding with creation"; fi`);
  
  scriptParts.push(`echo "[docker_remote] Starting new container: ${containerName}"`);
  scriptParts.push(runArgs.join(" "));
  scriptParts.push(`echo "[docker_remote] Container ${containerName} started successfully"`);
  scriptParts.push(`echo "__HW_META__ prev=$prev_id new=$new_id"`);

  // Join with && for proper error handling
  const remoteCmd = scriptParts.join(" && ");

  return {
    remoteCmd,
    dockerRunCommand
  };
}

function extractImageBaseName(image: string): string {
  // Удаляем тег (все после последнего :)
  let base = image.split(':')[0];
  // Удаляем registry и namespace (оставляем только последнюю часть после /)
  const parts = base.split('/');
  return parts[parts.length - 1];
}

function shEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function parseMeta(stdout: string): { prev?: string; newId?: string } {
  const metaLine = stdout.split("\n").find((line) => line.startsWith("__HW_META__"));
  if (!metaLine) return {};
  const matchPrev = metaLine.match(/prev=([^ ]*)/);
  const matchNew = metaLine.match(/new=([^ ]*)/);
  return {
    prev: matchPrev ? matchPrev[1] || undefined : undefined,
    newId: matchNew ? matchNew[1] || undefined : undefined
  };
}
