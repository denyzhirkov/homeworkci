import { Box, Typography, Divider } from "@mui/material";
import { SectionHeader } from "../../components/DocumentationComponents.tsx";

export function OverviewSection() {
  return (
    <>
      <SectionHeader id="overview" title="Overview" subtitle="What is HomeworkCI" />
      <Typography variant="body2" paragraph>
        HomeworkCI is a lightweight automation platform built with Deno and React. It allows you to define
        automation workflows (pipelines) using JSON configuration and execute them with built-in or custom modules.
      </Typography>
      <Typography variant="body2" paragraph>
        <strong>Key concepts:</strong>
      </Typography>
      <Box component="ul" sx={{ pl: 3, '& li': { mb: 1 } }}>
        <li><Typography variant="body2"><strong>Pipelines</strong> — JSON files defining a sequence of steps to execute</Typography></li>
        <li><Typography variant="body2"><strong>Modules</strong> — TypeScript functions that perform specific actions (shell, http, git, etc.)</Typography></li>
        <li><Typography variant="body2"><strong>Variables</strong> — Global and environment-specific values available in pipelines</Typography></li>
        <li><Typography variant="body2"><strong>Inputs</strong> — Runtime parameters that can be provided when starting a pipeline</Typography></li>
      </Box>
      <Divider sx={{ my: 4 }} />
    </>
  );
}
