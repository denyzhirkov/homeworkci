import { CloudQueue } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function DockerRemoteModule() {
  return (
    <ModuleDoc
      id="mod-docker-remote"
      icon={<CloudQueue fontSize="small" />}
      title="docker_remote"
      description="Pulls a Docker image on a remote host over SSH and runs a container. Checks Docker availability, captures previous/new image IDs, and replaces an existing container name if provided."
      params={[
        { name: 'host', type: 'string', required: true, description: 'Remote host address' },
        { name: 'user', type: 'string', required: true, description: 'SSH username' },
        { name: 'port', type: 'number', description: 'SSH port (default: 22)' },
        { name: 'keyName', type: 'string', description: 'SSH key name from Variables page (recommended)' },
        { name: 'privateKey', type: 'string', description: 'SSH private key content (alternative to keyName)' },
        { name: 'image', type: 'string', required: true, description: 'Docker image to pull and run (e.g., nginx:1.27)' },
        { name: 'sudo', type: 'boolean', description: 'Use sudo for docker commands (default: false)' },
        { name: 'timeout', type: 'number', description: 'Timeout in ms (default: 60000)' },
        { name: 'name', type: 'string', description: 'Container name (force-removed before run if exists)' },
        { name: 'detach', type: 'boolean', description: 'Run in detached mode (default: true)' },
        { name: 'restart', type: '"no" | "always" | "on-failure" | "unless-stopped"', description: 'Restart policy' },
        { name: 'ports', type: 'array', description: 'Port mappings array, e.g., ["8080:80", "443:443"]' },
        { name: 'env', type: 'object', description: 'Env map → -e KEY=VALUE for each entry' },
        { name: 'volumes', type: 'array', description: 'Volume mounts array like "/host:/container:ro"' },
        { name: 'extraArgs', type: 'string', description: 'Raw docker run args before image (e.g., "--add-host foo:1.2.3.4")' },
        { name: 'cmd', type: 'string', description: 'Command passed after image' }
      ]}
      returns='{ "code": 0, "stdout": "...", "stderr": "...", "previousImageId": "...", "newImageId": "...", "changed": true }'
      example={`{
  "module": "docker_remote",
  "params": {
    "host": "1.2.3.4",
    "user": "deploy",
    "keyName": "prod-ssh",
    "image": "nginx:1.27",
    "sudo": true,
    "name": "nginx",
    "ports": ["80:80"],
    "restart": "always"
  }
}`}
    />
  );
}
