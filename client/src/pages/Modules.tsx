import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Code, Extension, ExpandMore } from "@mui/icons-material";
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Grid, Container, CircularProgress, Alert, Accordion, AccordionSummary, AccordionDetails
} from "@mui/material";
import { getModules, deleteModule, type ModuleInfo } from "../lib/api";

export default function Modules() {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModules().then(setModules)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete module '${id}'?`)) return;

    try {
      await deleteModule(id);
      setModules(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      alert("Error deleting module: " + e);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Modules
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Extend functionality with custom TypeScript steps.
          </Typography>
        </Box>
        <Button
          component={Link}
          to="/modules/new"
          variant="contained"
          startIcon={<Code />}
        >
          New Module
        </Button>
      </Box>

      <Grid container spacing={3}>
        {modules.map(mod => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={mod.id}>
            <Card
              sx={{
                height: '100%',
                transition: '0.3s',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText'
                  }}>
                    <Extension />
                  </Box>
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography variant="h6" component="div" noWrap>
                      {mod.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {mod.description || `modules/${mod.id}.ts`}
                    </Typography>
                  </Box>
                </Box>

                {mod.fullDocs && (
                  <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' }, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 32, '& .MuiAccordionSummary-content': { margin: '8px 0' } }}>
                      <Typography variant="caption" fontWeight="bold">Documentation & Usage</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 1, pt: 0 }}>
                      <Box sx={{ maxHeight: 150, overflow: 'auto', p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                        <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{mod.fullDocs}</pre>
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )}
              </CardContent>
              <CardActions disableSpacing sx={{ justifyContent: 'flex-end', borderTop: '1px solid #eee', px: 2, py: 1 }}>
                {!mod.isBuiltIn && (
                  <Button
                    size="small"
                    color="error"
                    onClick={(e) => handleDelete(e, mod.id)}
                    sx={{ mr: 'auto' }}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  size="small"
                  component={Link}
                  to={`/modules/${mod.id}`}
                >
                  Edit
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {modules.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">
              No modules found. Create one to extend your pipelines!
            </Alert>
          </Grid>
        )}
      </Grid>
    </Container>
  );
}
