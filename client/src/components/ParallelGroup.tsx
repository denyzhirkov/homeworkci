import { useState } from "react";
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  DragIndicator,
  Delete,
  ExpandMore,
  ExpandLess,
  Add,
  FlashOn,
} from "@mui/icons-material";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PipelineStep, ModuleInfo, ModuleSchemasMap } from "../lib/api";
import InnerStepCard from "./InnerStepCard";

interface ParallelGroupProps {
  steps: PipelineStep[];
  index: number;
  modules: ModuleInfo[];
  moduleSchemas: ModuleSchemasMap;
  availableStepNames: string[]; // Names of steps that can be used as dependencies
  onChange: (steps: PipelineStep[]) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

export default function ParallelGroup({
  steps,
  index,
  modules,
  moduleSchemas,
  availableStepNames,
  onChange,
  onDelete,
  readOnly = false,
}: ParallelGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAddStep, setShowAddStep] = useState(false);
  const [selectedModule, setSelectedModule] = useState("");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `step-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateStep = (stepIndex: number, step: PipelineStep) => {
    const newSteps = [...steps];
    newSteps[stepIndex] = step;
    onChange(newSteps);
  };

  const deleteStep = (stepIndex: number) => {
    if (steps.length <= 1) {
      // If only one step left, delete the whole group
      onDelete();
    } else {
      const newSteps = steps.filter((_, i) => i !== stepIndex);
      onChange(newSteps);
    }
  };

  const addStep = () => {
    if (!selectedModule) return;
    const newStep: PipelineStep = {
      module: selectedModule,
      params: {},
    };
    onChange([...steps, newStep]);
    setShowAddStep(false);
    setSelectedModule("");
  };

  const availableModules = modules.filter((m) => moduleSchemas[m.id]?.params);

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={isDragging ? 8 : 2}
      sx={{
        mb: 1.5,
        overflow: "hidden",
        border: "2px solid",
        borderColor: isDragging ? "warning.main" : "warning.light",
        bgcolor: "warning.50",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1,
          bgcolor: "warning.100",
          borderBottom: expanded ? "1px solid" : "none",
          borderColor: "warning.light",
        }}
      >
        <IconButton
          size="small"
          {...attributes}
          {...listeners}
          sx={{ cursor: "grab", mr: 0.5 }}
        >
          <DragIndicator fontSize="small" />
        </IconButton>

        <Chip
          label={index + 1}
          size="small"
          color="warning"
          sx={{ mr: 1, minWidth: 28, fontWeight: "bold" }}
        />

        <FlashOn fontSize="small" sx={{ mr: 0.5, color: "warning.main" }} />

        <Typography
          variant="subtitle2"
          sx={{ flexGrow: 1, fontWeight: "medium" }}
        >
          Parallel Group ({steps.length} steps)
        </Typography>

        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>

        {!readOnly && (
          <Tooltip title="Delete parallel group">
            <IconButton size="small" color="error" onClick={onDelete}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 2, display: "block" }}
          >
            Steps in this group will execute simultaneously
          </Typography>

          {steps.map((step, stepIndex) => (
            <InnerStepCard
              key={`inner-step-${stepIndex}`}
              step={step}
              index={stepIndex}
              modules={availableModules}
              moduleSchemas={moduleSchemas}
              availableStepNames={availableStepNames}
              onChange={(updated) => updateStep(stepIndex, updated)}
              onDelete={() => deleteStep(stepIndex)}
              readOnly={readOnly}
            />
          ))}

          {!readOnly && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<Add />}
                onClick={() => setShowAddStep(true)}
                sx={{ borderStyle: "dashed" }}
              >
                Add Parallel Step
              </Button>
            </Box>
          )}
        </Box>
      </Collapse>

      {/* Add Step Dialog */}
      <Dialog
        open={showAddStep}
        onClose={() => setShowAddStep(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add Parallel Step</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Select Module</InputLabel>
            <Select
              value={selectedModule}
              label="Select Module"
              onChange={(e) => setSelectedModule(e.target.value)}
            >
              {availableModules.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  <Box>
                    <Typography variant="body2">{m.id}</Typography>
                    {m.description && (
                      <Typography variant="caption" color="text.secondary">
                        {m.description}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddStep(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={addStep}
            disabled={!selectedModule}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

