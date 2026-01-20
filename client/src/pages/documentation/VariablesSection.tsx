import { Box, Typography, Divider } from "@mui/material";
import { SectionHeader, CodeBlock } from "../../components/DocumentationComponents.tsx";

export function VariablesSection() {
  return (
    <>
      <SectionHeader id="variables" title="Variables" subtitle="Configuration management" />
      <Typography variant="body2" paragraph>
        Variables allow you to store configuration values that can be used across pipelines.
        All variables are accessed via <code>{"${env.VARIABLE_NAME}"}</code> in step parameters.
        There are two types of variables:
      </Typography>

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Global Variables</Typography>
      <Typography variant="body2" paragraph>
        Available in <strong>all pipelines</strong> regardless of environment. Use for values that don't change
        between environments (API base URLs, notification settings, common paths, etc.).
      </Typography>
      <CodeBlock>{`// Example: Global variables in config/variables.json
{
  "global": {
    "NOTIFY_CHAT_ID": "-1001234567890",
    "API_BASE_URL": "https://api.example.com",
    "DEFAULT_TIMEOUT": "30000"
  },
  "environments": { ... }
}

// Using global variables in any pipeline (no "env" required)
{
  "name": "Simple Pipeline",
  "steps": [
    {
      "module": "http",
      "params": {
        "url": "\${env.API_BASE_URL}/health"
      }
    },
    {
      "module": "notify",
      "params": {
        "type": "telegram",
        "chatId": "\${env.NOTIFY_CHAT_ID}",
        "message": "Health check completed!"
      }
    }
  ]
}`}</CodeBlock>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Environment Variables</Typography>
      <Typography variant="body2" paragraph>
        Defined per environment (e.g., "production", "staging", "dev"). When a pipeline specifies an environment
        via the <code>env</code> field, those variables are <strong>merged</strong> with global variables.
        Environment-specific values override global values with the same name.
      </Typography>
      <CodeBlock>{`// Example: Environment variables in config/variables.json
{
  "global": {
    "LOG_LEVEL": "info"
  },
  "environments": {
    "dev": {
      "DEPLOY_HOST": "dev.example.com",
      "DEPLOY_TOKEN": "dev-token-xxx",
      "LOG_LEVEL": "debug"
    },
    "prod": {
      "DEPLOY_HOST": "example.com",
      "DEPLOY_TOKEN": "prod-token-yyy"
    }
  }
}

// Pipeline using "dev" environment
{
  "name": "Deploy to Dev",
  "env": "dev",
  "steps": [
    {
      "module": "shell",
      "params": {
        "cmd": "deploy --host \${env.DEPLOY_HOST} --token \${env.DEPLOY_TOKEN}"
      }
    }
  ]
}
// Result: DEPLOY_HOST=dev.example.com, LOG_LEVEL=debug (overridden)`}</CodeBlock>

      <Typography id="variables-ssh-keys" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>SSH Keys</Typography>
      <Typography variant="body2" paragraph>
        SSH keys allow secure authentication to remote servers without storing private keys in pipeline configurations.
        Generate SSH keys on the <strong>Variables</strong> page and reference them by name in SSH module steps.
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>How to use SSH keys:</strong>
      </Typography>
      <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>
        <li><Typography variant="body2">Go to <strong>Variables</strong> page → <strong>SSH Keys</strong> section</Typography></li>
        <li><Typography variant="body2">Click <strong>Generate SSH Key</strong> and enter a name (e.g., <code>production-server</code>)</Typography></li>
        <li><Typography variant="body2">Copy the <strong>public key</strong> and add it to the remote server's <code>~/.ssh/authorized_keys</code></Typography></li>
        <li><Typography variant="body2">Use <code>keyName</code> parameter in SSH module steps (see <a href="#mod-ssh" style={{ color: 'primary.main' }}>ssh module</a>)</Typography></li>
      </Box>
      <CodeBlock>{`// Example: Using SSH key in pipeline
{
  "module": "ssh",
  "params": {
    "op": "exec",
    "host": "server.example.com",
    "user": "deploy",
    "keyName": "production-server",
    "cmd": "systemctl restart app"
  }
}

// SSH keys are stored securely in config/variables.json
// Private keys are never exposed in pipeline configurations`}</CodeBlock>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        SSH keys are generated as Ed25519 key pairs without passphrases, optimized for automation.
        Each key has a unique name that you can reference in your pipelines.
      </Typography>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Variable Priority</Typography>
      <Typography variant="body2" paragraph>
        Variables are merged in the following order (later values override earlier):
      </Typography>
      <Box component="ol" sx={{ pl: 3, '& li': { mb: 0.5 } }}>
        <li><Typography variant="body2"><strong>System environment</strong> — Filtered safe variables (PATH, HOME, USER, etc.)</Typography></li>
        <li><Typography variant="body2"><strong>Global variables</strong> — From <code>config/variables.json</code></Typography></li>
        <li><Typography variant="body2"><strong>Environment variables</strong> — From selected environment</Typography></li>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Manage variables on the <strong>Variables</strong> page. Changes take effect immediately for new pipeline runs.
      </Typography>

      <Divider sx={{ my: 4 }} />
    </>
  );
}
