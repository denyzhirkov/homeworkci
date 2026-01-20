import { Box, Typography, List, ListItemButton, ListItemText } from "@mui/material";

// Navigation items
export const navItems = [
  { id: 'overview', label: 'Overview', indent: 0 },
  { id: 'pipelines', label: 'Pipelines', indent: 0 },
  { id: 'pipeline-structure', label: 'Structure', indent: 1 },
  { id: 'pipeline-steps', label: 'Steps & Parallel', indent: 1 },
  { id: 'pipeline-inputs', label: 'Inputs', indent: 1 },
  { id: 'dynamic-env', label: 'Dynamic Environment', indent: 1 },
  { id: 'pipeline-results', label: 'Results & Variables', indent: 1 },
  { id: 'modules', label: 'Modules', indent: 0 },
  { id: 'mod-shell', label: 'shell', indent: 1 },
  { id: 'mod-http', label: 'http', indent: 1 },
  { id: 'mod-git', label: 'git', indent: 1 },
  { id: 'mod-crypto', label: 'crypto', indent: 1 },
  { id: 'mod-fs', label: 'fs', indent: 1 },
  { id: 'mod-delay', label: 'delay', indent: 1 },
  { id: 'mod-wait', label: 'wait', indent: 1 },
  { id: 'mod-notify', label: 'notify', indent: 1 },
  { id: 'mod-docker', label: 'docker', indent: 1 },
  { id: 'mod-docker-remote', label: 'docker_remote', indent: 1 },
  { id: 'mod-archive', label: 'archive', indent: 1 },
  { id: 'mod-ssh', label: 'ssh', indent: 1 },
  { id: 'mod-s3', label: 's3', indent: 1 },
  { id: 'mod-json', label: 'json', indent: 1 },
  { id: 'mod-pipeline', label: 'pipeline', indent: 1 },
  { id: 'mod-queue', label: 'queue', indent: 1 },
  { id: 'variables', label: 'Variables', indent: 0 },
  { id: 'variables-ssh-keys', label: 'SSH Keys', indent: 1 },
  { id: 'editor', label: 'Smart Editor', indent: 0 },
];

export function DocumentationNav() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Box
      sx={{
        width: 200,
        flexShrink: 0,
        position: 'sticky',
        top: 80,
        height: 'fit-content',
        maxHeight: 'calc(100vh - 100px)',
        overflow: 'auto',
      }}
    >
      <Typography variant="subtitle2" color="text.secondary" sx={{ px: 2, py: 1 }}>
        Contents
      </Typography>
      <List dense disablePadding>
        {navItems.map((item) => (
          <ListItemButton
            key={item.id}
            onClick={() => scrollTo(item.id)}
            sx={{
              pl: 2 + item.indent * 2,
              py: 0.5,
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                variant: item.indent === 0 ? 'body2' : 'caption',
                fontWeight: item.indent === 0 ? 500 : 400,
                color: item.indent === 0 ? 'text.primary' : 'text.secondary',
              }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
