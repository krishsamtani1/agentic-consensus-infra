import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { NotificationProvider } from './components/NotificationCenter';
import Layout from './components/Layout';

// Eagerly loaded (critical path)
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';

// Code-split pages (lazy loaded)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Markets = lazy(() => import('./pages/Markets'));
const Agents = lazy(() => import('./pages/Agents'));
const Research = lazy(() => import('./pages/Research'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const AgentProfile = lazy(() => import('./pages/AgentProfile'));
const Compare = lazy(() => import('./pages/Compare'));
const Benchmark = lazy(() => import('./pages/Benchmark'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const Settings = lazy(() => import('./pages/Settings'));
const PublicLeaderboard = lazy(() => import('./pages/PublicLeaderboard'));
const PublicAgentProfile = lazy(() => import('./pages/PublicAgentProfile'));
const Battles = lazy(() => import('./pages/Battles'));
const EmbedBadge = lazy(() => import('./pages/EmbedBadge'));

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-600 text-xs">Loading...</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl font-black text-gray-800 mb-2">404</div>
        <h1 className="text-xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-gray-500 text-sm mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a href="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Fully public routes — no auth, no layout */}
        <Route path="/public/leaderboard" element={<PublicLeaderboard />} />
        <Route path="/public/agent/:agentId" element={<PublicAgentProfile />} />
        <Route path="/battles" element={<Battles />} />
        <Route path="/embed/badge/:agentId" element={<EmbedBadge />} />
        <Route path="/research" element={<Research />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Onboarding />
        } />

        {/* Landing page — unauthenticated root */}
        {!isAuthenticated && (
          <Route path="/" element={<Landing />} />
        )}

        {/* Authenticated app shell */}
        {isAuthenticated ? (
          <Route path="/" element={<Layout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="markets" element={<Markets />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/:agentId" element={<AgentProfile />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="compare" element={<Compare />} />
            <Route path="benchmark" element={<Benchmark />} />
            <Route path="api-docs" element={<ApiDocs />} />
            <Route path="settings" element={<Settings />} />
            <Route path="research" element={<Research />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        ) : (
          /* Unauthenticated catch-all — show landing page */
          <Route path="*" element={<Landing />} />
        )}
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppRoutes />
      </NotificationProvider>
    </AuthProvider>
  );
}
