import { Box, Typography, Divider } from "@mui/material";
import { SectionHeader, CodeBlock } from "../../components/DocumentationComponents.tsx";

export function PipelinesSection() {
  return (
    <>
      <SectionHeader id="pipelines" title="Pipelines" subtitle="Automation workflows" />
      <Typography variant="body2" paragraph>
        Pipelines are defined as JSON files in the <code>pipelines/</code> directory. Each pipeline has a name,
        optional description, and a list of steps to execute.
      </Typography>

      <Typography id="pipeline-structure" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
        Structure
      </Typography>
      <CodeBlock>{`{
  "name": "My Pipeline",
  "description": "Pipeline description",
  "tags": ["deploy", "backend"],
  "env": "production",
  "keepWorkDir": false,
  "inputs": [...],
  "steps": [...]
}`}</CodeBlock>
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>name</strong> — Display name of the pipeline<br/>
          <strong>description</strong> — Optional description<br/>
          <strong>tags</strong> — Array of tags for organizing pipelines<br/>
          <strong>env</strong> — Environment name (loads variables from that environment)<br/>
          <strong>keepWorkDir</strong> — Keep sandbox directory after run (for debugging)<br/>
          <strong>inputs</strong> — Input parameters for parameterized runs<br/>
          <strong>steps</strong> — Array of steps to execute
        </Typography>
      </Box>

      <Typography id="pipeline-steps" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
        Steps & Parallel Execution
      </Typography>
      <Typography variant="body2" paragraph>
        Each step specifies a module to run and its parameters. Steps execute sequentially by default.
        To run steps in parallel, wrap them in a nested array.
      </Typography>
      <CodeBlock>{`{
  "steps": [
    {
      "name": "step1",
      "description": "First step",
      "module": "shell",
      "params": { "cmd": "echo 'Hello'" }
    },
    [
      {
        "name": "api1",
        "module": "http",
        "params": { "url": "https://api.example.com/users" }
      },
      {
        "name": "api2",
        "module": "http",
        "params": { "url": "https://api.example.com/posts" }
      }
    ]
  ]
}`}</CodeBlock>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Steps inside a nested array execute simultaneously. The pipeline waits for all
        parallel steps to complete before continuing to the next step.
      </Typography>

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        Step Dependencies (dependsOn)
      </Typography>
      <Typography variant="body2" paragraph>
        Use <code>dependsOn</code> to specify that a step should only run if certain previous steps succeeded.
        The value can be a single step name or an array of step names.
      </Typography>
      <CodeBlock>{`{
  "steps": [
    { "name": "build", "module": "shell", "params": { "cmd": "npm run build" } },
    { "name": "test", "module": "shell", "params": { "cmd": "npm test" } },
    {
      "name": "deploy",
      "module": "shell",
      "params": { "cmd": "deploy.sh" },
      "dependsOn": ["build", "test"]
    }
  ]
}`}</CodeBlock>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        If any dependency fails, the pipeline stops with an error. Dependencies must reference
        steps defined before the current step.
      </Typography>

      <Typography id="pipeline-inputs" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
        Inputs
      </Typography>
      <Typography variant="body2" paragraph>
        Inputs allow you to parameterize pipelines. When running a pipeline with inputs, a form is displayed
        to enter values.
      </Typography>
      <CodeBlock>{`{
  "inputs": [
    {
      "name": "userId",
      "type": "select",
      "label": "User ID",
      "options": ["1", "2", "3"],
      "default": "1"
    },
    {
      "name": "verbose",
      "type": "boolean",
      "label": "Verbose output",
      "default": false
    },
    {
      "name": "message",
      "type": "string",
      "label": "Custom message",
      "default": "Hello"
    }
  ]
}`}</CodeBlock>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Input types: <code>string</code>, <code>boolean</code>, <code>select</code>.
        Access inputs in steps via <code>{"${inputs.name}"}</code>.
      </Typography>

      <Typography id="dynamic-env" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
        Dynamic Environment
      </Typography>
      <Typography variant="body2" paragraph>
        The <code>env</code> field supports interpolation, allowing you to select the environment at runtime
        based on input parameters. This is useful for pipelines that need to run against different environments.
      </Typography>
      <CodeBlock>{`{
  "name": "Deploy Pipeline",
  "env": "\${inputs.ENV}",
  "inputs": [
    {
      "name": "ENV",
      "type": "select",
      "label": "Target Environment",
      "options": ["dev", "staging", "prod"],
      "default": "dev"
    }
  ],
  "steps": [
    {
      "module": "shell",
      "params": {
        "cmd": "echo 'Deploying to \${inputs.ENV}...'"
      }
    }
  ]
}`}</CodeBlock>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        When the pipeline runs, the user selects an environment, and variables from that environment
        are loaded automatically. The environment chip in the header will animate to show it's dynamic.
      </Typography>

      <Typography id="pipeline-results" variant="h6" sx={{ mt: 3, mb: 1, scrollMarginTop: 80 }}>
        Results & Variables
      </Typography>
      <Typography variant="body2" paragraph>
        Pipeline steps can reference results from previous steps and environment variables using template syntax.
      </Typography>
      <CodeBlock>{`// Access previous step result
{ "cmd": "echo 'Previous result: \${prev}'" }

// Access named step result
{ "cmd": "echo 'User: \${results.api1.name}'" }

// Access environment variables
{ "cmd": "echo 'Token: \${env.API_TOKEN}'" }

// Access inputs
{ "url": "https://api.example.com/users/\${inputs.userId}" }

// Access pipeline metadata
{ "cmd": "echo 'Pipeline: \${pipelineId}'" }
{ "cmd": "echo 'Pipeline name: \${PIPELINE_NAME}'" }

// Access build information
{ "cmd": "echo 'Build ID: \${BUILD_ID}'" }
{ "cmd": "echo 'Started at: \${UNIXTIMESTAMP}'" }

// Access date and time
{ "cmd": "echo 'Date: \${DATE}'" }
{ "cmd": "echo 'Time: \${TIME}'" }
{ "cmd": "echo 'DateTime: \${DATETIME}'" }

// Access date components
{ "output": "logs/\${YEAR}/\${MONTH}/build-\${DAY}.log" }

// Access working directory
{ "output": "\${WORK_DIR}/artifacts/\${BUILD_ID}.zip" }`}</CodeBlock>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Available interpolation variables: <code>{"${prev}"}</code>, <code>{"${results.stepName}"}</code>,
        <code>{"${env.VAR_NAME}"}</code>, <code>{"${inputs.inputName}"}</code>, <code>{"${pipelineId}"}</code>,
        <code>{"${BUILD_ID}"}</code>, <code>{"${UNIXTIMESTAMP}"}</code>, <code>{"${WORK_DIR}"}</code>,
        <code>{"${DATE}"}</code>, <code>{"${TIME}"}</code>, <code>{"${DATETIME}"}</code>, <code>{"${YEAR}"}</code>,
        <code>{"${MONTH}"}</code>, <code>{"${DAY}"}</code>, <code>{"${PIPELINE_NAME}"}</code>.
      </Typography>

      <Divider sx={{ my: 4 }} />
    </>
  );
}
