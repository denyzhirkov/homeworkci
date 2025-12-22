import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { config } from "./config.ts";

const CONFIG_DIR = config.configDir;
const VARS_FILE = join(CONFIG_DIR, "variables.json");

await ensureDir(CONFIG_DIR);

export interface VariablesConfig {
  global: Record<string, string>;
  environments: Record<string, Record<string, string>>;
}

const DEFAULT_CONFIG: VariablesConfig = {
  global: {},
  environments: {},
};

export async function loadVariables(): Promise<VariablesConfig> {
  try {
    const text = await Deno.readTextFile(VARS_FILE);
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      await saveVariables(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
    console.error("Error loading variables:", e);
    return DEFAULT_CONFIG;
  }
}

export async function saveVariables(config: VariablesConfig): Promise<void> {
  await Deno.writeTextFile(VARS_FILE, JSON.stringify(config, null, 2));
}

// Whitelist of safe system environment variables to pass to pipelines
// This prevents leaking sensitive system secrets (API keys, tokens, etc.)
const ALLOWED_SYSTEM_ENV_KEYS = new Set([
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TZ",
  "TMPDIR",
  "TEMP",
  "TMP",
  // Add more safe keys as needed
]);

// Keys that should NEVER be passed to modules (even if in whitelist)
const BLOCKED_ENV_KEYS = new Set([
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "GITHUB_TOKEN",
  "GITLAB_TOKEN",
  "NPM_TOKEN",
  "DOCKER_PASSWORD",
  "SSH_AUTH_SOCK",
  "GPG_AGENT_INFO",
]);

function filterSystemEnv(systemEnv: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(systemEnv)) {
    // Never include blocked keys
    if (BLOCKED_ENV_KEYS.has(key)) continue;
    // Only include whitelisted keys from system env
    if (ALLOWED_SYSTEM_ENV_KEYS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export async function getMergedEnv(envName?: string): Promise<Record<string, string>> {
  const config = await loadVariables();
  const systemEnv = Deno.env.toObject();
  const globalEnv = config.global || {};
  const selectedEnv = (envName && config.environments[envName]) || {};

  // Only pass whitelisted system env vars, then merge with user-defined vars
  return {
    ...filterSystemEnv(systemEnv),
    ...globalEnv,
    ...selectedEnv,
  };
}
