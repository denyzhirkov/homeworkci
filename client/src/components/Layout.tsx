import { useEffect, useState } from "react";
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Box, CssBaseline, Chip
} from "@mui/material";
import {
  AccountTree, Extension, Settings, Home
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useWebSocket } from "../lib/useWebSocket";
import { getStats } from "../lib/api";

const drawerWidth = 240;

// Empty handler to keep WebSocket connection alive across page transitions
const noop = () => {};

export default function Layout({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState<string>("");

  // Keep WebSocket connection persistent - this ensures socket stays open
  // when navigating between pages (Dashboard, Pipelines, Modules, Variables)
  useWebSocket(noop);

  // Load version once on mount
  useEffect(() => {
    getStats().then(s => setVersion(s.appVersion)).catch(() => {});
  }, []);

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <img src="/favicon.svg" alt="HomeworkCI logo" style={{ width: 28, height: 28 }} />
            HomeworkCI
            {version && (
              <Chip 
                label={`v${version}`} 
                size="small" 
                sx={{ 
                  height: 20, 
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: 'inherit'
                }} 
              />
            )}
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton component={Link} to="/">
                <ListItemIcon><Home /></ListItemIcon>
                <ListItemText primary="Dashboard" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={Link} to="/pipelines">
                <ListItemIcon><AccountTree /></ListItemIcon>
                <ListItemText primary="Pipelines" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={Link} to="/modules">
                <ListItemIcon><Extension /></ListItemIcon>
                <ListItemText primary="Modules" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={Link} to="/variables">
                <ListItemIcon><Settings /></ListItemIcon>
                <ListItemText primary="Variables" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 2 }}>
        <Toolbar variant="dense" />
        {children}
      </Box>
    </Box>
  );
}
