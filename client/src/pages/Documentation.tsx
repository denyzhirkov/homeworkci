import { Box, Typography } from "@mui/material";
import { DocumentationNav } from "../components/DocumentationNav.tsx";
import { OverviewSection } from "./documentation/OverviewSection.tsx";
import { PipelinesSection } from "./documentation/PipelinesSection.tsx";
import { ModulesSection } from "./documentation/ModulesSection.tsx";
import { VariablesSection } from "./documentation/VariablesSection.tsx";
import { EditorSection } from "./documentation/EditorSection.tsx";

export default function Documentation() {
  return (
    <Box sx={{ display: 'flex', gap: 3 }}>
      {/* Sticky Navigation */}
      <DocumentationNav />

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0, pb: 8 }}>
        {/* Header */}
        <Box sx={{ mt: 1, mb: 1 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Documentation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Complete guide to HomeworkCI pipelines and modules
          </Typography>
        </Box>

        {/* Content Sections */}
        <OverviewSection />
        <PipelinesSection />
        <ModulesSection />
        <VariablesSection />
        <EditorSection />
      </Box>
    </Box>
  );
}
