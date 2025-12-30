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
} from "@mui/material";
import { Delete, ExpandMore, ExpandLess } from "@mui/icons-material";
import type { PipelineStep, ModuleInfo, ParamSchema, ModuleSchemasMap } from "../lib/api";

interface InnerStepCardProps {
  step: PipelineStep;
  index: number;
  modules: ModuleInfo[];
  moduleSchemas: ModuleSchemasMap;
  availableStepNames: string[]; // Names of steps that can be used as dependencies
  onChange: (step: PipelineStep) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

// Simplified step card without drag-n-drop for use inside ParallelGroup
export default function InnerStepCard({
  step,
  index,
  modules,
  moduleSchemas,
  availableStepNames,
  onChange,
  onDelete,
  readOnly = false,
}: InnerStepCardProps) {
  const [expanded, setExpanded] = useState(true);

  const schema = step.module ? moduleSchemas[step.module] : null;
  const paramSchemas = schema?.params || {};

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
            value={value !== undefined ? JSON.stringify(value, null, 2) : ""}
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

  const requiredParams = Object.entries(paramSchemas).filter(
    ([, s]) => s.required
  );
  const optionalParams = Object.entries(paramSchemas).filter(
    ([, s]) => !s.required
  );

  return (
    <Paper
      elevation={1}
      sx={{
        mb: 1,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
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
        <Chip
          label={String.fromCharCode(65 + index)} // A, B, C...
          size="small"
          variant="outlined"
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
                onChange={(e) =>
                  updateStep({ name: e.target.value || undefined })
                }
                placeholder="Optional identifier"
                disabled={readOnly}
                sx={{ flex: 1 }}
              />
              <FormControl
                size="small"
                sx={{ minWidth: 180 }}
                disabled={readOnly}
              >
                <InputLabel>Module *</InputLabel>
                <Select
                  value={step.module || ""}
                  label="Module *"
                  onChange={(e) =>
                    updateStep({ module: e.target.value, params: {} })
                  }
                >
                  {modules.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              size="small"
              label="Description"
              value={step.description || ""}
              onChange={(e) =>
                updateStep({ description: e.target.value || undefined })
              }
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
                    placeholder="Select dependencies"
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
                No schema available for this module. Edit parameters in JSON
                mode.
              </Typography>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}

