// Centralized configuration for HomeworkCI server
// All settings can be overridden via environment variables

function getEnv(key: string, defaultValue: string): string {
  return Deno.env.get(key) || defaultValue;
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = Deno.env.get(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

export const config = {
  // --- Directories ---
  pipelinesDir: getEnv("PIPELINES_DIR", "./pipelines"),
  sandboxDir: getEnv("SANDBOX_DIR", "./tmp"),
  modulesDir: getEnv("MODULES_DIR", "./modules"),
  dataDir: getEnv("DATA_DIR", "./data"),
  configDir: getEnv("CONFIG_DIR", "./config"),

  // --- Server ---
  port: getEnvInt("PORT", 8000),
  host: getEnv("HOST", "0.0.0.0"),

  // --- Cleanup ---
  sandboxMaxAgeMs: getEnvInt("SANDBOX_MAX_AGE_HOURS", 24) * 60 * 60 * 1000,

  // --- Features ---
  enableScheduler: getEnvBool("ENABLE_SCHEDULER", true),

  // --- Future: Docker runner ---
  // dockerEnabled: getEnvBool("DOCKER_ENABLED", false),
  // dockerDefaultImage: getEnv("DOCKER_DEFAULT_IMAGE", "alpine:3.19"),
  // dockerMemoryLimit: getEnv("DOCKER_MEMORY_LIMIT", "512m"),
  // dockerCpuLimit: getEnv("DOCKER_CPU_LIMIT", "1"),
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
}

