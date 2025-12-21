import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Pipelines from "./pages/Pipelines";
import PipelineDetail from "./pages/PipelineDetail";
import Modules from "./pages/Modules";
import ModuleDetail from "./pages/ModuleDetail";
import Variables from "./pages/Variables";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
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
  );
}

export default App;
