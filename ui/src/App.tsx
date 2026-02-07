import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Markets from './pages/Markets';
import Agents from './pages/Agents';
import Escalations from './pages/Escalations';
import Vision from './pages/Vision';
import Onboarding from './pages/Onboarding';

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-mono">Initializing TRUTH-NET...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <Route path="/" element={<Layout />}>
      <Route index element={<Dashboard />} />
      <Route path="markets" element={<Markets />} />
      <Route path="agents" element={<Agents />} />
      <Route path="escalations" element={<Escalations />} />
      <Route path="vision" element={<Vision />} />
    </Route>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-mono">Initializing TRUTH-NET...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/onboarding" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Onboarding />
      } />
      {isAuthenticated ? (
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="markets" element={<Markets />} />
          <Route path="agents" element={<Agents />} />
          <Route path="escalations" element={<Escalations />} />
          <Route path="vision" element={<Vision />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      )}
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
