import { CloudQueue } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function DockerModule() {
  return (
    <ModuleDoc
      id="mod-docker"
      icon={<CloudQueue fontSize="small" />}
      title="docker"
      description="Executes commands inside Docker containers. Provides isolated environment with resource limits and optional container reuse."
      params={[
        { name: 'image', type: 'string', required: true, description: 'Docker image name' },
        { name: 'cmd', type: 'string', required: true, description: 'Command to run' },
        { name: 'workdir', type: 'string', description: 'Working directory in container (default: /workspace)' },
        { name: 'network', type: '"none" | "bridge" | "host"', description: 'Network mode' },
        { name: 'memory', type: 'string', description: 'Memory limit (e.g., "512m")' },
        { name: 'cpus', type: 'string', description: 'CPU limit (e.g., "1")' },
        { name: 'env', type: 'object', description: 'Additional environment variables' },
        { name: 'reuse', type: 'boolean', description: 'Reuse container for multiple steps' },
        { name: 'removeImage', type: 'boolean', description: 'Remove image after execution' }
      ]}
      returns='{ "code": 0 }'
      example={`{
  "module": "docker",
  "params": {
    "image": "node:20-alpine",
    "cmd": "npm install && npm test",
    "memory": "512m",
    "reuse": true
  }
}`}
    />
  );
}
