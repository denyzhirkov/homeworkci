import { AccountTree } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function PipelineModule() {
  return (
    <ModuleDoc
      id="mod-pipeline"
      icon={<AccountTree fontSize="small" />}
      title="pipeline"
      description="Run another pipeline as a step. Allows composing pipelines and reusing common workflows. Child pipeline runs in its own isolated sandbox."
      params={[
        { name: 'pipelineId', type: 'string', required: true, description: 'ID of the pipeline to run' },
        { name: 'inputs', type: 'object', description: 'Input parameters to pass to child pipeline. Supports interpolation: ${results.stepName.field}' },
        { name: 'failOnError', type: 'boolean', description: 'Stop parent pipeline if child fails (default: true). If false, returns error in result instead of throwing' }
      ]}
      returns='On success: { success: true, runId: string, duration: number }. On failure with failOnError: false: { success: false, runId: "", duration: 0, error: string }'
      example={`// Run child pipeline with inputs
{
  "name": "deploy",
  "module": "pipeline",
  "params": {
    "pipelineId": "build-and-test",
    "inputs": {
      "version": "\${results.build.version}",
      "environment": "\${inputs.env}"
    },
    "failOnError": true
  }
}

// Run child pipeline and continue on error
{
  "name": "try-deploy",
  "module": "pipeline",
  "params": {
    "pipelineId": "deploy-staging",
    "inputs": {
      "branch": "\${inputs.branch}"
    },
    "failOnError": false
  }
}

// Access child pipeline result
{
  "name": "check-result",
  "module": "shell",
  "params": {
    "cmd": "echo 'Child pipeline success: \${prev.success}, duration: \${prev.duration}ms'"
  }
}`}
    />
  );
}
