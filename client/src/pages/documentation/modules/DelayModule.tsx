import { Timer } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function DelayModule() {
  return (
    <ModuleDoc
      id="mod-delay"
      icon={<Timer fontSize="small" />}
      title="delay"
      description="Pauses execution for a specified time. Useful for rate limiting or waiting for external processes."
      params={[
        { name: 'ms', type: 'number', required: true, description: 'Delay in milliseconds' }
      ]}
      returns='{ "waited": <ms> }'
      example={`{
  "module": "delay",
  "params": { "ms": 2000 }
}`}
    />
  );
}
