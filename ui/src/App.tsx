import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Markets from './pages/Markets';
import Agents from './pages/Agents';
import Simulation from './pages/Simulation';
import Vision from './pages/Vision';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="markets" element={<Markets />} />
        <Route path="agents" element={<Agents />} />
        <Route path="simulation" element={<Simulation />} />
      </Route>
      <Route path="/vision" element={<Vision />} />
    </Routes>
  );
}

export default App;
