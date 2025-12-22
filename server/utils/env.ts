// Environment variable utilities
// Centralized helpers for reading typed env vars

export function getEnv(key: string, defaultValue: string): string {
  return Deno.env.get(key) || defaultValue;
}

export function getEnvInt(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = Deno.env.get(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

