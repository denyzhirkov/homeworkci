import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Layout from "./components/Layout";
import Pipelines from "./pages/Pipelines";
import PipelineDetail from "./pages/PipelineDetail";
import Modules from "./pages/Modules";
import ModuleDetail from "./pages/ModuleDetail";
import Variables from "./pages/Variables";
import Dashboard from "./pages/Dashboard";

// Dark theme configuration
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipelines" element={<Pipelines />} />
            <Route path="/pipelines/:id" element={<PipelineDetail />} />
            <Route path="/pipelines/new" element={<PipelineDetail />} />
            <Route path="/modules" element={<Modules />} />
            <Route path="/modules/:id" element={<ModuleDetail />} />
            <Route path="/modules/new" element={<ModuleDetail />} />
            <Route path="/variables" element={<Variables />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
