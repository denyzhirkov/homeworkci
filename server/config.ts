// Centralized configuration for HomeworkCI server
// All settings can be overridden via environment variables

import { getEnv, getEnvInt, getEnvBool } from "./utils/env.ts";

export const config = {
  // --- Directories ---
  pipelinesDir: getEnv("PIPELINES_DIR", "./pipelines"),
  sandboxDir: getEnv("SANDBOX_DIR", "./tmp"),
  // Host path for sandbox (for Docker-in-Docker, must match host mount point)
  sandboxHostPath: getEnv("SANDBOX_HOST_PATH", ""),
  modulesDir: getEnv("MODULES_DIR", "./modules"),
  dataDir: getEnv("DATA_DIR", "./data"),
  configDir: getEnv("CONFIG_DIR", "./config"),

  // --- Server ---
  port: getEnvInt("PORT", 8008),
  host: getEnv("HOST", "0.0.0.0"),

  // --- Cleanup ---
  sandboxMaxAgeMs: getEnvInt("SANDBOX_MAX_AGE_HOURS", 24) * 60 * 60 * 1000,

  // --- Features ---
  enableScheduler: getEnvBool("ENABLE_SCHEDULER", true),

  // --- Pipeline Queue ---
  maxConcurrentRunsPerPipeline: getEnvInt("MAX_CONCURRENT_RUNS_PER_PIPELINE", 1),

  // --- Docker Runner ---
  dockerEnabled: getEnvBool("DOCKER_ENABLED", false),
  dockerDefaultImage: getEnv("DOCKER_DEFAULT_IMAGE", "alpine:3.19"),
  dockerMemoryLimit: getEnv("DOCKER_MEMORY_LIMIT", "512m"),
  dockerCpuLimit: getEnv("DOCKER_CPU_LIMIT", "1"),
  dockerNetworkDefault: getEnv("DOCKER_NETWORK_DEFAULT", "bridge"),
  dockerTimeoutMs: getEnvInt("DOCKER_TIMEOUT_MS", 600000), // 10 minutes

  // --- Updates ---
  githubRepo: getEnv("GITHUB_REPO", ""),
  autoUpdateEnabled: getEnvBool("AUTO_UPDATE_ENABLED", false),
  repoPath: getEnv("REPO_PATH", ""),
};

// Log configuration on startup (hide sensitive values)
export function logConfig(): void {
  console.log("[Config] Loaded configuration:");
  console.log(`  PIPELINES_DIR: ${config.pipelinesDir}`);
  console.log(`  SANDBOX_DIR: ${config.sandboxDir}`);
  console.log(`  MODULES_DIR: ${config.modulesDir}`);
  console.log(`  DATA_DIR: ${config.dataDir}`);
  console.log(`  CONFIG_DIR: ${config.configDir}`);
  console.log(`  PORT: ${config.port}`);
  console.log(`  HOST: ${config.host}`);
  console.log(`  SANDBOX_MAX_AGE: ${config.sandboxMaxAgeMs / 1000 / 60 / 60}h`);
  console.log(`  ENABLE_SCHEDULER: ${config.enableScheduler}`);
  console.log(`  MAX_CONCURRENT_RUNS_PER_PIPELINE: ${config.maxConcurrentRunsPerPipeline}`);
  console.log(`  DOCKER_ENABLED: ${config.dockerEnabled}`);
  if (config.dockerEnabled) {
    console.log(`  DOCKER_DEFAULT_IMAGE: ${config.dockerDefaultImage}`);
    console.log(`  DOCKER_MEMORY_LIMIT: ${config.dockerMemoryLimit}`);
    console.log(`  DOCKER_CPU_LIMIT: ${config.dockerCpuLimit}`);
    console.log(`  DOCKER_NETWORK_DEFAULT: ${config.dockerNetworkDefault}`);
    console.log(`  DOCKER_TIMEOUT_MS: ${config.dockerTimeoutMs}`);
  }
  if (config.githubRepo) {
    console.log(`  GITHUB_REPO: ${config.githubRepo}`);
    console.log(`  AUTO_UPDATE_ENABLED: ${config.autoUpdateEnabled}`);
    if (config.repoPath) {
      console.log(`  REPO_PATH: ${config.repoPath}`);
    }
  }
}
