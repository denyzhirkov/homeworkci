import { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Button,
  Paper,
  IconButton,
  Stack,
  Divider,
  Chip,
  Autocomplete,
} from "@mui/material";
import { Add, Delete, DragIndicator, FlashOn } from "@mui/icons-material";
import ModuleSelector from "./ModuleSelector";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  Pipeline,
  PipelineStep,
  PipelineInput,
  ModuleInfo,
  ModuleSchemasMap,
  VariablesConfig,
  StepItem,
} from "../lib/api";
import StepCard from "./StepCard";
import ParallelGroup from "./ParallelGroup";

interface VisualPipelineEditorProps {
  pipeline: Omit<Pipeline, "id">;
  modules: ModuleInfo[];
  moduleSchemas: ModuleSchemasMap;
  variables: VariablesConfig;
  onChange: (pipeline: Omit<Pipeline, "id">) => void;
  readOnly?: boolean;
}

// Input item component for drag-n-drop
function SortableInputItem({
  input,
  index,
  onChange,
  onDelete,
  readOnly = false,
}: {
  input: PipelineInput;
  index: number;
  onChange: (input: PipelineInput) => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `input-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      variant="outlined"
      sx={{ p: 1.5, mb: 1, display: "flex", alignItems: "flex-start", gap: 1 }}
    >
      <IconButton size="small" {...attributes} {...listeners} sx={{ cursor: "grab", mt: 0.5 }}>
        <DragIndicator fontSize="small" />
      </IconButton>

      <Box sx={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
        <TextField
          size="small"
          label="Name"
          value={input.name}
          onChange={(e) => onChange({ ...input, name: e.target.value.replace(/\s+/g, "") })}
          disabled={readOnly}
          sx={{ width: 120 }}
        />
        <TextField
          size="small"
          label="Label"
          value={input.label || ""}
          onChange={(e) => onChange({ ...input, label: e.target.value || undefined })}
          disabled={readOnly}
          sx={{ width: 150 }}
        />
        <FormControl size="small" sx={{ width: 100 }} disabled={readOnly}>
          <InputLabel>Type</InputLabel>
          <Select
            value={input.type}
            label="Type"
            onChange={(e) =>
              onChange({
                ...input,
                type: e.target.value as PipelineInput["type"],
                options: e.target.value === "select" ? input.options || [] : undefined,
              })
            }
          >
            <MenuItem value="string">string</MenuItem>
            <MenuItem value="boolean">boolean</MenuItem>
            <MenuItem value="select">select</MenuItem>
          </Select>
        </FormControl>
        {input.type === "string" && (
          <TextField
            size="small"
            label="Default"
            value={(input.default as string) || ""}
            onChange={(e) => onChange({ ...input, default: e.target.value || undefined })}
            disabled={readOnly}
            sx={{ width: 120 }}
          />
        )}
        {input.type === "boolean" && (
          <FormControlLabel
            disabled={readOnly}
            control={
              <Checkbox
                checked={Boolean(input.default)}
                onChange={(e) => onChange({ ...input, default: e.target.checked })}
                size="small"
              />
            }
            label="Default"
          />
        )}
        {input.type === "select" && (
          <Autocomplete
            multiple
            freeSolo
            size="small"
            options={[]}
            value={input.options || []}
            onChange={(_, newValue) =>
              onChange({
                ...input,
                options: newValue as string[],
              })
            }
            disabled={readOnly}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={option}
                    size="small"
                    {...tagProps}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Options"
                placeholder="Type and press Enter"
                size="small"
              />
            )}
            sx={{ flex: 1, minWidth: 200 }}
          />
        )}
      </Box>

      {!readOnly && (
        <IconButton size="small" color="error" onClick={onDelete}>
          <Delete fontSize="small" />
        </IconButton>
      )}
    </Paper>
  );
}

export default function VisualPipelineEditor({
  pipeline,
  modules,
  moduleSchemas,
  variables,
  onChange,
  readOnly = false,
}: VisualPipelineEditorProps) {
  const [showAddStep, setShowAddStep] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const environments = Object.keys(variables.environments);

  // Filter modules to only those with valid schemas
  const availableModules = modules.filter((m) => moduleSchemas[m.id]?.params);

  const updatePipeline = (updates: Partial<Omit<Pipeline, "id">>) => {
    onChange({ ...pipeline, ...updates });
  };

  const updateStepItem = (index: number, item: StepItem) => {
    const newSteps = [...pipeline.steps];
    newSteps[index] = item;
    updatePipeline({ steps: newSteps });
  };

  const deleteStepItem = (index: number) => {
    const newSteps = pipeline.steps.filter((_, i) => i !== index);
    updatePipeline({ steps: newSteps });
  };

  // addStep is now handled directly in ModuleSelector onSelect

  const addParallelGroup = () => {
    // Create a parallel group with one empty http step as placeholder
    const parallelGroup: PipelineStep[] = [
      { module: "http", params: {} },
      { module: "http", params: {} },
    ];
    updatePipeline({ steps: [...pipeline.steps, parallelGroup] });
  };

  // Helper to check if item is a parallel group
  const isParallelGroup = (item: StepItem): item is PipelineStep[] => {
    return Array.isArray(item);
  };

  // Get step names defined before a given step index (for dependsOn options)
  const getStepNamesBeforeIndex = (stepIndex: number): string[] => {
    const names: string[] = [];
    for (let i = 0; i < stepIndex; i++) {
      const item = pipeline.steps[i];
      if (Array.isArray(item)) {
        // Parallel group: collect all named steps
        for (const step of item) {
          if (step.name) names.push(step.name);
        }
      } else {
        if (item.name) names.push(item.name);
      }
    }
    return names;
  };

  // Count total individual steps for display
  const totalStepCount = pipeline.steps.reduce(
    (sum, item) => sum + (Array.isArray(item) ? item.length : 1),
    0
  );

  const handleStepDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parseInt(String(active.id).replace("step-", ""));
    const newIndex = parseInt(String(over.id).replace("step-", ""));

    updatePipeline({ steps: arrayMove(pipeline.steps, oldIndex, newIndex) });
  };

  // Inputs handling
  const updateInput = (index: number, input: PipelineInput) => {
    const newInputs = [...(pipeline.inputs || [])];
    newInputs[index] = input;
    updatePipeline({ inputs: newInputs });
  };

  const deleteInput = (index: number) => {
    const newInputs = (pipeline.inputs || []).filter((_, i) => i !== index);
    updatePipeline({ inputs: newInputs.length > 0 ? newInputs : undefined });
  };

  const addInput = () => {
    const newInput: PipelineInput = { name: "", type: "string" };
    updatePipeline({ inputs: [...(pipeline.inputs || []), newInput] });
  };

  const handleInputDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parseInt(String(active.id).replace("input-", ""));
    const newIndex = parseInt(String(over.id).replace("input-", ""));

    updatePipeline({ inputs: arrayMove(pipeline.inputs || [], oldIndex, newIndex) });
  };

  return (
    <Box sx={{ p: 2, overflowY: "auto", height: "100%" }}>
      {/* Pipeline Metadata */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: "bold" }}>
          Pipeline Settings
        </Typography>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField
              size="small"
              label="Name"
              value={pipeline.name}
              onChange={(e) => updatePipeline({ name: e.target.value })}
              disabled={readOnly}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Environment</InputLabel>
              <Select
                value={pipeline.env || ""}
                label="Environment"
                onChange={(e) => updatePipeline({ env: e.target.value || undefined })}
                disabled={readOnly}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {environments.map((env) => (
                  <MenuItem key={env} value={env}>
                    {env}
                  </MenuItem>
                ))}
                <MenuItem value="${inputs.ENV}">
                  <em>Dynamic: {"${inputs.ENV}"}</em>
                </MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(pipeline.keepWorkDir)}
                  onChange={(e) => updatePipeline({ keepWorkDir: e.target.checked })}
                  disabled={readOnly}
                  size="small"
                />
              }
              label="Keep Work Dir"
            />
          </Box>
          <TextField
            size="small"
            label="Description"
            value={pipeline.description || ""}
            onChange={(e) => updatePipeline({ description: e.target.value || undefined })}
            disabled={readOnly}
            fullWidth
            multiline
            rows={2}
          />
          <TextField
            size="small"
            label="Schedule (cron)"
            value={pipeline.schedule || ""}
            onChange={(e) => updatePipeline({ schedule: e.target.value || undefined })}
            disabled={readOnly}
            placeholder="e.g., 0 */6 * * *"
            sx={{ maxWidth: 300 }}
          />
        </Stack>
      </Paper>

      {/* Inputs */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", flexGrow: 1 }}>
            Inputs
          </Typography>
          <Chip label={pipeline.inputs?.length || 0} size="small" sx={{ mr: 1 }} />
          {!readOnly && (
            <Button size="small" startIcon={<Add />} onClick={addInput}>
              Add Input
            </Button>
          )}
        </Box>

        {(pipeline.inputs?.length || 0) > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleInputDragEnd}
          >
            <SortableContext
              items={(pipeline.inputs || []).map((_, i) => `input-${i}`)}
              strategy={verticalListSortingStrategy}
            >
              {(pipeline.inputs || []).map((input, index) => (
                <SortableInputItem
                  key={`input-${index}`}
                  input={input}
                  index={index}
                  onChange={(updated) => updateInput(index, updated)}
                  onDelete={() => deleteInput(index)}
                  readOnly={readOnly}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No inputs defined. Inputs allow parameterizing pipeline runs.
          </Typography>
        )}
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Steps */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: "bold", flexGrow: 1 }}>
          Steps
        </Typography>
        <Chip label={totalStepCount} size="small" />
      </Box>

      {pipeline.steps.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleStepDragEnd}
        >
          <SortableContext
            items={pipeline.steps.map((_, i) => `step-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            {pipeline.steps.map((stepItem, index) => (
              <Box key={`step-wrapper-${index}`}>
                {isParallelGroup(stepItem) ? (
                  <ParallelGroup
                    steps={stepItem}
                    index={index}
                    modules={availableModules}
                    moduleSchemas={moduleSchemas}
                    availableStepNames={getStepNamesBeforeIndex(index)}
                    onChange={(updated) => updateStepItem(index, updated)}
                    onDelete={() => deleteStepItem(index)}
                    readOnly={readOnly}
                  />
                ) : (
                  <StepCard
                    step={stepItem}
                    index={index}
                    modules={availableModules}
                    moduleSchemas={moduleSchemas}
                    availableStepNames={getStepNamesBeforeIndex(index)}
                    onChange={(updated) => updateStepItem(index, updated)}
                    onDelete={() => deleteStepItem(index)}
                    readOnly={readOnly}
                  />
                )}
                {/* Add Step/Parallel Group buttons after each step */}
                {!readOnly && (
                  <Box sx={{ display: "flex", justifyContent: "center", gap: 1, my: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Add />}
                      onClick={() => setShowAddStep(true)}
                      sx={{ borderStyle: "dashed" }}
                    >
                      Add Step
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<FlashOn />}
                      onClick={addParallelGroup}
                      sx={{ borderStyle: "dashed" }}
                    >
                      Add Parallel Group
                    </Button>
                  </Box>
                )}
              </Box>
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: "center",
            borderStyle: "dashed",
          }}
        >
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No steps yet. Add your first step to start building the pipeline.
          </Typography>
          {!readOnly && (
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setShowAddStep(true)}
              >
                Add Step
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<FlashOn />}
                onClick={addParallelGroup}
              >
                Add Parallel Group
              </Button>
            </Stack>
          )}
        </Paper>
      )}

      {/* Add Step Dialog */}
      <ModuleSelector
        open={showAddStep}
        onClose={() => setShowAddStep(false)}
        onSelect={(moduleId) => {
          const newStep: PipelineStep = {
            module: moduleId,
            params: {},
          };
          updatePipeline({ steps: [...pipeline.steps, newStep] });
        }}
        modules={availableModules}
        title="Add New Step"
      />
    </Box>
  );
}
