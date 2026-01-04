import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  TextField,
  Grid,
  Paper,
  IconButton,
  InputAdornment,
} from "@mui/material";
import {
  Terminal,
  Http,
  FolderCopy,
  Timer,
  Notifications,
  CloudQueue,
  Archive,
  Code,
  Lan,
  Storage,
  DataObject,
  AccountTree,
  Search,
  Close,
} from "@mui/icons-material";
import type { ModuleInfo } from "../lib/api";

interface ModuleSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (moduleId: string) => void;
  modules: ModuleInfo[];
  title?: string;
}

// Map module IDs to icons
const moduleIcons: Record<string, React.ReactNode> = {
  shell: <Terminal />,
  http: <Http />,
  git: <Code />,
  fs: <FolderCopy />,
  delay: <Timer />,
  notify: <Notifications />,
  docker: <CloudQueue />,
  archive: <Archive />,
  ssh: <Lan />,
  s3: <Storage />,
  json: <DataObject />,
  pipeline: <AccountTree />,
  queue: <CloudQueue />,
};

// Default icon for unknown modules
const DefaultIcon = <Code />;

export default function ModuleSelector({
  open,
  onClose,
  onSelect,
  modules,
  title = "Select Module",
}: ModuleSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredModules = modules.filter((m) => {
    const query = searchQuery.toLowerCase();
    return (
      m.id.toLowerCase().includes(query) ||
      (m.description || "").toLowerCase().includes(query)
    );
  });

  const handleSelect = (moduleId: string) => {
    onSelect(moduleId);
    setSearchQuery("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: "80vh",
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6">{title}</Typography>
          <IconButton size="small" onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
        <TextField
          fullWidth
          size="small"
          placeholder="Search modules..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mt: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </DialogTitle>
      <DialogContent>
        {filteredModules.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No modules found matching "{searchQuery}"
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {filteredModules.map((module) => {
              const icon = moduleIcons[module.id] || DefaultIcon;
              return (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={module.id}>
                  <Paper
                    onClick={() => handleSelect(module.id)}
                    sx={{
                      p: 2,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      "&:hover": {
                        bgcolor: "primary.light",
                        transform: "translateY(-2px)",
                        boxShadow: 3,
                      },
                      border: "1px solid",
                      borderColor: "divider",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                    }}
                  >
                    <Box
                      sx={{
                        mb: 1,
                        color: "primary.main",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {icon}
                    </Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: "medium",
                        mb: 0.5,
                        wordBreak: "break-word",
                      }}
                    >
                      {module.id}
                    </Typography>
                    {module.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: "0.7rem",
                          lineHeight: 1.3,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {module.description}
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
      </DialogContent>
    </Dialog>
  );
}

