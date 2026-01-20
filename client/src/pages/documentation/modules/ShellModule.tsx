import { Terminal } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function ShellModule() {
  return (
    <ModuleDoc
      id="mod-shell"
      icon={<Terminal fontSize="small" />}
      title="shell"
      description="Executes shell commands with streaming output. Commands run in an isolated sandbox directory."
      params={[
        { name: 'cmd', type: 'string', required: true, description: 'Shell command to execute' }
      ]}
      returns='{ "code": 0 } — Exit code of the command'
      example={`{
  "module": "shell",
  "params": {
    "cmd": "npm install && npm run build"
  }
}`}
    />
  );
}
