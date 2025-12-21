// HTTP Requests.
//
// Usage Example:
// {
//   "module": "http",
//   "params": {
//     "url": "https://api.example.com/data",
//     "method": "POST",
//     "body": { "key": "value" }
//   }
// }

export async function run(ctx: any, params: { url: string; method?: string; body?: any }) {
  const res = await fetch(params.url, {
    method: params.method || "GET",
    body: params.body ? JSON.stringify(params.body) : undefined,
    headers: params.body ? { "Content-Type": "application/json" } : undefined
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
