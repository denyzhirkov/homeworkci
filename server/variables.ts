import { ensureDir } from "@std/fs";
import { join } from "@std/path";

const CONFIG_DIR = "./config";
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

export async function getMergedEnv(envName?: string): Promise<Record<string, string>> {
  const config = await loadVariables();
  const systemEnv = Deno.env.toObject();
  const globalEnv = config.global || {};
  const selectedEnv = (envName && config.environments[envName]) || {};

  return {
    ...systemEnv,
    ...globalEnv,
    ...selectedEnv,
  };
}
