import { Lan } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function SshModule() {
  return (
    <ModuleDoc
      id="mod-ssh"
      icon={<Lan fontSize="small" />}
      title="ssh"
      description="Execute remote commands or copy files via SSH/SCP. Essential for deploying to remote servers. Use SSH keys from Variables page for secure authentication."
      params={[
        { name: 'op', type: '"exec" | "scp"', required: true, description: 'Operation: exec (command) or scp (copy files)' },
        { name: 'host', type: 'string', required: true, description: 'Remote host address' },
        { name: 'user', type: 'string', required: true, description: 'SSH username' },
        { name: 'keyName', type: 'string', description: 'SSH key name from Variables page (recommended)' },
        { name: 'privateKey', type: 'string', description: 'SSH private key content (alternative to keyName)' },
        { name: 'port', type: 'number', description: 'SSH port (default: 22)' },
        { name: 'cmd', type: 'string', description: 'Command to execute (required for exec)' },
        { name: 'source', type: 'string', description: 'Local path to copy (required for scp)' },
        { name: 'destination', type: 'string', description: 'Remote path (required for scp)' },
        { name: 'recursive', type: 'boolean', description: 'Recursive copy for directories (default: true)' },
        { name: 'timeout', type: 'number', description: 'Timeout in ms (default: 60000)' }
      ]}
      returns='exec: { "code": 0, "stdout": "...", "stderr": "..." }. scp: { "success": true, "files": 5 }'
      example={`// Execute remote command (recommended: use keyName)
{
  "module": "ssh",
  "params": {
    "op": "exec",
    "host": "server.example.com",
    "user": "deploy",
    "keyName": "production-server",
    "cmd": "cd /app && git pull && docker compose restart"
  }
}

// Copy files to remote server
{
  "module": "ssh",
  "params": {
    "op": "scp",
    "host": "server.example.com",
    "user": "deploy",
    "keyName": "production-server",
    "source": "./dist/",
    "destination": "/var/www/app/",
    "recursive": true
  }
}

// Alternative: Direct private key (less secure)
{
  "module": "ssh",
  "params": {
    "op": "exec",
    "host": "\${env.DEPLOY_HOST}",
    "user": "deploy",
    "privateKey": "\${env.SSH_PRIVATE_KEY}",
    "cmd": "systemctl restart app"
  }
}`}
    />
  );
}
