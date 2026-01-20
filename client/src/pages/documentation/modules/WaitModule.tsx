import { HourglassEmpty } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function WaitModule() {
  return (
    <ModuleDoc
      id="mod-wait"
      icon={<HourglassEmpty fontSize="small" />}
      title="wait"
      description="Waits for conditions to be met using polling: HTTP endpoint availability, file existence, or process completion. Supports configurable timeouts, intervals, and retry limits."
      params={[
        { name: 'op', type: '"http" | "file" | "process"', required: true, description: 'Operation type: http (wait for HTTP endpoint), file (wait for file to exist), process (wait for process to finish)' },
        { name: 'url', type: 'string', description: 'HTTP endpoint URL (required for http operation). Supports interpolation: ${env.API_URL}/health' },
        { name: 'method', type: '"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS"', description: 'HTTP method (for http operation, default: GET)' },
        { name: 'expectedStatus', type: 'number', description: 'Expected HTTP status code (for http operation, default: 200)' },
        { name: 'headers', type: 'object', description: 'Custom HTTP headers (for http operation)' },
        { name: 'path', type: 'string', description: 'File path to wait for (required for file operation). Relative to sandbox or absolute path.' },
        { name: 'pid', type: 'number', description: 'Process ID to wait for (required for process operation)' },
        { name: 'timeout', type: 'number', description: 'Maximum wait time in milliseconds (default: 60000)' },
        { name: 'interval', type: 'number', description: 'Polling interval in milliseconds (default: 1000, minimum: 100)' },
        { name: 'retries', type: 'number', description: 'Maximum number of attempts (alternative to timeout). If set, timeout is ignored.' }
      ]}
      returns='{ "success": true, "waited": <ms>, "attempts": <number>, "operation": <string> }'
      example={`// Wait for HTTP endpoint to be available
{
  "module": "wait",
  "params": {
    "op": "http",
    "url": "https://api.example.com/health",
    "timeout": 30000,
    "interval": 1000
  }
}

// Wait for file to appear
{
  "module": "wait",
  "params": {
    "op": "file",
    "path": "./output.txt",
    "timeout": 60000
  }
}

// Wait for process to finish
{
  "module": "wait",
  "params": {
    "op": "process",
    "pid": 12345,
    "timeout": 30000
  }
}

// Using retries instead of timeout
{
  "module": "wait",
  "params": {
    "op": "http",
    "url": "\${env.API_URL}/ready",
    "retries": 10,
    "interval": 2000
  }
}`}
    />
  );
}
