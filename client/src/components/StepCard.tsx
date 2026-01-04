import { useState } from "react";
import {
  Paper,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  IconButton,
  Collapse,
  Chip,
  Stack,
  Tooltip,
  Autocomplete,
  Button,
} from "@mui/material";
import {
  DragIndicator,
  Delete,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PipelineStep, ModuleInfo, ParamSchema, ModuleSchemasMap } from "../lib/api";
import ModuleSelector from "./ModuleSelector";

interface StepCardProps {
  step: PipelineStep;
  index: number;
  modules: ModuleInfo[];
  moduleSchemas: ModuleSchemasMap;
  availableStepNames: string[]; // Names of steps that can be used as dependencies
  onChange: (step: PipelineStep) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

export default function StepCard({
  step,
  index,
  modules,
  moduleSchemas,
  availableStepNames,
  onChange,
  onDelete,
  readOnly = false,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [showModuleSelector, setShowModuleSelector] = useState(false);

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

  const schema = step.module ? moduleSchemas[step.module] : null;
  const paramSchemas = schema?.params || {};

  // Check if a parameter should be visible based on visibleWhen condition
  const isParamVisible = (paramSchema: ParamSchema): boolean => {
    if (!paramSchema.visibleWhen) return true;
    
    const condition = paramSchema.visibleWhen;
    const triggerValue = step.params?.[condition.param];
    
    // Handle equals condition
    if (condition.equals !== undefined) {
      if (Array.isArray(condition.equals)) {
        return condition.equals.includes(triggerValue as string);
      }
      return triggerValue === condition.equals;
    }
    
    // Handle notEquals condition
    if (condition.notEquals !== undefined) {
      if (Array.isArray(condition.notEquals)) {
        return !condition.notEquals.includes(triggerValue as string);
      }
      return triggerValue !== condition.notEquals;
    }
    
    return true;
  };

  const updateStep = (updates: Partial<PipelineStep>) => {
    onChange({ ...step, ...updates });
  };

  const updateParam = (key: string, value: unknown) => {
    onChange({
      ...step,
      params: { ...step.params, [key]: value },
    });
  };

  const removeParam = (key: string) => {
    const newParams = { ...step.params };
    delete newParams[key];
    onChange({ ...step, params: newParams });
  };

  const renderParamInput = (key: string, paramSchema: ParamSchema) => {
    const value = step.params?.[key];
    const hasValue = value !== undefined && value !== "";

    if (paramSchema.enum && paramSchema.enum.length > 0) {
      return (
        <FormControl fullWidth size="small" key={key} disabled={readOnly}>
          <InputLabel>
            {key}
            {paramSchema.required && " *"}
          </InputLabel>
          <Select
            value={(value as string) || ""}
            label={`${key}${paramSchema.required ? " *" : ""}`}
            onChange={(e) => updateParam(key, e.target.value)}
          >
            <MenuItem value="">
              <em>Not set</em>
            </MenuItem>
            {paramSchema.enum.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    switch (paramSchema.type) {
      case "boolean":
        return (
          <FormControlLabel
            key={key}
            disabled={readOnly}
            control={
              <Checkbox
                checked={Boolean(value)}
                onChange={(e) => updateParam(key, e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                {key}
                {paramSchema.required && " *"}
              </Typography>
            }
          />
        );

      case "number":
        return (
          <TextField
            key={key}
            fullWidth
            size="small"
            type="number"
            label={`${key}${paramSchema.required ? " *" : ""}`}
            value={value ?? ""}
            disabled={readOnly}
            onChange={(e) => {
              const num = e.target.value ? Number(e.target.value) : undefined;
              if (num !== undefined) {
                updateParam(key, num);
              } else {
                removeParam(key);
              }
            }}
            placeholder={
              paramSchema.default !== undefined
                ? `Default: ${paramSchema.default}`
                : undefined
            }
            helperText={paramSchema.description}
            error={paramSchema.required && !hasValue}
          />
        );

      case "object":
      case "array":
        return (
          <TextField
            key={key}
            fullWidth
            size="small"
            multiline
            rows={3}
            label={`${key}${paramSchema.required ? " *" : ""} (JSON)`}
            value={
              value !== undefined ? JSON.stringify(value, null, 2) : ""
            }
            disabled={readOnly}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                updateParam(key, parsed);
              } catch {
                // Keep raw value for editing
              }
            }}
            placeholder={paramSchema.description}
            helperText={paramSchema.description}
            error={paramSchema.required && !hasValue}
          />
        );

      default:
        // string
        return (
          <TextField
            key={key}
            fullWidth
            size="small"
            label={`${key}${paramSchema.required ? " *" : ""}`}
            value={(value as string) ?? ""}
            disabled={readOnly}
            onChange={(e) => {
              if (e.target.value) {
                updateParam(key, e.target.value);
              } else {
                removeParam(key);
              }
            }}
            placeholder={
              paramSchema.default !== undefined
                ? `Default: ${paramSchema.default}`
                : undefined
            }
            helperText={paramSchema.description}
            error={paramSchema.required && !hasValue}
          />
        );
    }
  };

  // Split params into required and optional, filtering by visibility
  const requiredParams = Object.entries(paramSchemas).filter(
    ([, s]) => s.required && isParamVisible(s)
  );
  const optionalParams = Object.entries(paramSchemas).filter(
    ([, s]) => !s.required && isParamVisible(s)
  );

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={isDragging ? 8 : 2}
      sx={{
        mb: 1.5,
        overflow: "hidden",
        border: "1px solid",
        borderColor: isDragging ? "primary.main" : "divider",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1,
          bgcolor: "action.hover",
          borderBottom: expanded ? "1px solid" : "none",
          borderColor: "divider",
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
          sx={{ mr: 1, minWidth: 28, fontWeight: "bold" }}
        />

        <Typography
          variant="subtitle2"
          sx={{ flexGrow: 1, fontWeight: "medium" }}
        >
          {step.name || step.module || "New Step"}
        </Typography>

        <IconButton size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>

        {!readOnly && (
          <Tooltip title="Delete step">
            <IconButton size="small" color="error" onClick={onDelete}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            {/* Basic fields */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                size="small"
                label="Step Name"
                value={step.name || ""}
                onChange={(e) => updateStep({ name: e.target.value || undefined })}
                placeholder="Optional identifier"
                disabled={readOnly}
                sx={{ flex: 1 }}
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowModuleSelector(true)}
                disabled={readOnly}
                sx={{ minWidth: 180, justifyContent: "flex-start", textTransform: "none" }}
              >
                {step.module || "Select Module *"}
              </Button>
              <ModuleSelector
                open={showModuleSelector}
                onClose={() => setShowModuleSelector(false)}
                onSelect={(moduleId) => {
                  updateStep({ module: moduleId, params: {} });
                }}
                modules={modules}
                title="Select Module"
              />
            </Box>

            <TextField
              size="small"
              label="Description"
              value={step.description || ""}
              onChange={(e) => updateStep({ description: e.target.value || undefined })}
              placeholder="What this step does"
              disabled={readOnly}
              fullWidth
            />

            {/* Dependencies */}
            {availableStepNames.length > 0 && (
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={availableStepNames}
                value={
                  step.dependsOn
                    ? Array.isArray(step.dependsOn)
                      ? step.dependsOn
                      : [step.dependsOn]
                    : []
                }
                onChange={(_, newValue) =>
                  updateStep({
                    dependsOn: newValue.length > 0 ? newValue : undefined,
                  })
                }
                disabled={readOnly}
                renderTags={(value, getTagProps) =>
                  value.map((option, i) => (
                    <Chip
                      {...getTagProps({ index: i })}
                      key={option}
                      label={option}
                      size="small"
                      color="info"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Depends On"
                    placeholder="Select steps this depends on"
                    helperText="This step will only run if all dependencies succeed"
                  />
                )}
              />
            )}

            {/* Module parameters */}
            {step.module && schema && (
              <>
                {requiredParams.length > 0 && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 1, display: "block" }}
                    >
                      Required Parameters
                    </Typography>
                    <Stack spacing={1.5}>
                      {requiredParams.map(([key, paramSchema]) =>
                        renderParamInput(key, paramSchema)
                      )}
                    </Stack>
                  </Box>
                )}

                {optionalParams.length > 0 && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 1, display: "block" }}
                    >
                      Optional Parameters
                    </Typography>
                    <Stack spacing={1.5}>
                      {optionalParams.map(([key, paramSchema]) =>
                        renderParamInput(key, paramSchema)
                      )}
                    </Stack>
                  </Box>
                )}
              </>
            )}

            {step.module && !schema && (
              <Typography variant="body2" color="text.secondary">
                No schema available for this module. Edit parameters in JSON mode.
              </Typography>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}

