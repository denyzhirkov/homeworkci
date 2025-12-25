import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Code, Extension, ExpandMore, FolderOpen } from "@mui/icons-material";
import {
  Box, Typography, Button, Card, CardContent,
  Grid, Container, CircularProgress, Alert, Accordion, AccordionSummary, AccordionDetails, Chip
} from "@mui/material";
import { getModules, deleteModule, type ModuleInfo } from "../lib/api";
import TagFilter, { extractUniqueTags, filterByTags, groupByTags } from "../components/TagFilter";

export default function Modules() {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Extract unique tags and filter/group modules
  const allTags = useMemo(() => extractUniqueTags(modules), [modules]);
  const filteredModules = useMemo(() => filterByTags(modules, selectedTags), [modules, selectedTags]);
  const groupedModules = useMemo(() => groupByTags(filteredModules), [filteredModules]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 1 }}>
        <Typography variant="h5" component="h1">
          Modules
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1.5 }}>
            — Extend functionality with custom TypeScript steps
          </Typography>
        </Typography>
        <Button
          component={Link}
          to="/modules/new"
          variant="contained"
          startIcon={<Code />}
        >
          New Module
        </Button>
      </Box>

      {/* Tag Filter */}
      <TagFilter
        tags={allTags}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onClearAll={() => setSelectedTags([])}
      />

      {/* Grouped by tags */}
      {Object.keys(groupedModules).length > 0 ? (
        Object.entries(groupedModules).map(([tag, modulesInGroup]) => (
          <Accordion key={tag} defaultExpanded sx={{ mb: 2, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: 'action.hover' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderOpen fontSize="small" color="action" />
                <Typography variant="subtitle1" fontWeight="medium">
                  {tag === 'untagged' ? 'Untagged' : tag}
                </Typography>
                <Chip label={modulesInGroup.length} size="small" />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                {modulesInGroup.map(mod => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={mod.id}>
            <Card
              component={Link}
              to={`/modules/${mod.id}`}
              sx={{
                height: '100%',
                transition: '0.2s',
                display: 'flex',
                flexDirection: 'column',
                textDecoration: 'none',
                cursor: 'pointer',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
                <Box sx={{
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  display: 'flex'
                }}>
                  <Extension fontSize="small" />
                </Box>
                <Box sx={{ overflow: 'hidden', flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" component="div" noWrap fontWeight="medium">
                      {mod.id}
                    </Typography>
                    {mod.isBuiltIn && <Chip label="Built-in" size="small" color="info" sx={{ height: 18, fontSize: 10 }} />}
                  </Box>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {mod.description || `modules/${mod.id}.ts`}
                  </Typography>
                </Box>
                {!mod.isBuiltIn && (
                  <Button
                    size="small"
                    color="error"
                    onClick={(e) => handleDelete(e, mod.id)}
                  >
                    Delete
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))
      ) : (
        <Alert severity="info">
          {modules.length === 0 ? 'No modules found. Create one to extend your pipelines!' : 'No modules match the selected filters.'}
        </Alert>
      )}
    </Container>
  );
}
