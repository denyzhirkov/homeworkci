import { Box, Typography, Paper, Chip } from "@mui/material";

// Code block component
export function CodeBlock({ children }: { children: string }) {
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'background.default',
        fontFamily: 'monospace',
        fontSize: 13,
        overflow: 'auto',
        whiteSpace: 'pre',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {children}
    </Paper>
  );
}

// Section header component
export function SectionHeader({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <Typography id={id} variant="h5" sx={{ mt: 4, mb: 1, scrollMarginTop: 80 }}>
      {title}
      {subtitle && (
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
          — {subtitle}
        </Typography>
      )}
    </Typography>
  );
}

// Module documentation component
export function ModuleDoc({
  id,
  icon,
  title,
  description,
  params,
  returns,
  example
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  params: { name: string; type: string; required?: boolean; description: string }[];
  returns: string;
  example: string;
}) {
  return (
    <Box id={id} sx={{ mb: 4, scrollMarginTop: 80 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{
          p: 0.75,
          borderRadius: 1,
          bgcolor: 'primary.dark',
          display: 'flex',
          alignItems: 'center'
        }}>
          {icon}
        </Box>
        <Typography variant="h6">{title}</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Parameters</Typography>
      <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'background.default' }}>
        {params.map((p, i) => (
          <Box key={i} sx={{ mb: i < params.length - 1 ? 1.5 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography component="code" sx={{ fontFamily: 'monospace', color: 'primary.light' }}>
                {p.name}
              </Typography>
              <Chip label={p.type} size="small" sx={{ height: 18, fontSize: 10 }} />
              {p.required && <Chip label="required" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
              {p.description}
            </Typography>
          </Box>
        ))}
      </Paper>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Returns</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: 1 }}>
        {returns}
      </Typography>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Example</Typography>
      <CodeBlock>{example}</CodeBlock>
    </Box>
  );
}
