import { Box, Typography } from "@mui/material";
import { SectionHeader } from "../../components/DocumentationComponents.tsx";

export function EditorSection() {
  return (
    <>
      <SectionHeader id="editor" title="Smart Editor" subtitle="Intelligent autocomplete" />
      <Typography variant="body2" paragraph>
        The pipeline editor includes intelligent autocomplete powered by Monaco Editor (the same editor used in VS Code).
        It provides context-aware suggestions as you type.
      </Typography>

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Module Suggestions</Typography>
      <Typography variant="body2" paragraph>
        When typing <code>"module": "</code>, the editor suggests all available modules with descriptions.
        Built-in modules are prioritized, and custom modules are also included.
      </Typography>

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Parameter Hints</Typography>
      <Typography variant="body2" paragraph>
        Inside <code>"params": {"{}"}</code>, the editor suggests parameters specific to the selected module.
        Each parameter shows:
      </Typography>
      <Box component="ul" sx={{ pl: 3, '& li': { mb: 0.5 } }}>
        <li><Typography variant="body2"><strong>Required</strong> — Parameters that must be provided</Typography></li>
        <li><Typography variant="body2"><strong>Optional</strong> — Parameters with default values</Typography></li>
        <li><Typography variant="body2"><strong>Enum values</strong> — For parameters with predefined options (e.g., <code>op: "zip" | "unzip"</code>)</Typography></li>
        <li><Typography variant="body2"><strong>Type information</strong> — string, number, boolean, object</Typography></li>
      </Box>

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Variable Autocomplete</Typography>
      <Typography variant="body2" paragraph>
        When typing <code>{"${"}</code> inside a string value, the editor suggests available interpolation variables:
      </Typography>
      <Box component="ul" sx={{ pl: 3, '& li': { mb: 0.5 } }}>
        <li><Typography variant="body2"><code>{"${prev}"}</code> — Previous step result</Typography></li>
        <li><Typography variant="body2"><code>{"${results.stepName}"}</code> — Named step results</Typography></li>
        <li><Typography variant="body2"><code>{"${inputs.paramName}"}</code> — Pipeline input values</Typography></li>
        <li><Typography variant="body2"><code>{"${env.VAR_NAME}"}</code> — Environment variables (with suggestions from your configured variables)</Typography></li>
        <li><Typography variant="body2"><code>{"${pipelineId}"}</code> — Current pipeline ID</Typography></li>
      </Box>

      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Quick Insert Panel</Typography>
      <Typography variant="body2" paragraph>
        Above the editor, a Quick Insert panel provides one-click buttons for common variables.
        Click any variable chip to insert it at the cursor position.
      </Typography>
    </>
  );
}
