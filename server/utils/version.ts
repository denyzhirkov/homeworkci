// Version utility - reads version from deno.json

let cachedVersion: string | null = null;

export async function getVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  
  try {
    const text = await Deno.readTextFile("./deno.json");
    const denoConfig = JSON.parse(text);
    cachedVersion = denoConfig.version || "0.0.0";
  } catch {
    cachedVersion = "0.0.0";
  }
  
  return cachedVersion ?? "0.0.0";
}

// Sync version for places where async isn't available
export function getVersionSync(): string {
  return cachedVersion ?? "0.0.0";
}

// Initialize version cache
export async function initVersion(): Promise<void> {
  await getVersion();
}

