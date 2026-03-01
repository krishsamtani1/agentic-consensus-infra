import { Outlet, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BarChart3, 
  Bot, 
  BookOpen,
  Trophy,
  Wifi,
  WifiOff,
  Zap,
  Store,
  GitCompare,
  Settings,
  Target,
  Terminal,
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { NotificationBell } from './NotificationCenter';
import clsx from 'clsx';
import TickerTape from './TickerTape';
import WalletBar from './WalletBar';
import StatusBar from './StatusBar';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard', exact: false },
  { to: '/agents', icon: Bot, label: 'Agent Registry', exact: false },
  { to: '/marketplace', icon: Store, label: 'Marketplace', exact: false },
  { to: '/compare', icon: GitCompare, label: 'Compare', exact: false },
  { to: '/benchmark', icon: Target, label: 'Benchmark', exact: false },
  { to: '/markets', icon: BarChart3, label: 'Trading Arena', exact: false },
  { to: '/api-docs', icon: Terminal, label: 'API Docs', exact: false },
  { to: '/research', icon: BookOpen, label: 'About', exact: false },
];

export default function Layout() {
  const { isConnected, stats } = useWebSocket();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TickerTape />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-56 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col fixed h-[calc(100vh-34px)] top-8 z-50">
          {/* Logo */}
          <div className="p-4 border-b border-[#1a1a1a]">
            <Link to="/" className="flex items-center gap-3 group w-full text-left">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white tracking-tight">TRUTH-NET</h1>
                <p className="text-[10px] text-gray-600">AI Agent Rating Agency</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3">
            <ul className="space-y-0.5">
              {navItems.map(({ to, icon: Icon, label, exact }) => {
                const isActive = exact
                  ? location.pathname === to
                  : location.pathname === to || location.pathname.startsWith(to + '/');
                
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-left text-sm',
                        isActive
                          ? 'bg-white/[0.08] text-white font-medium'
                          : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                      )}
                    >
                      <Icon className={clsx('w-4 h-4', isActive ? 'text-cyan-400' : 'text-gray-600')} />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Settings Link */}
          <div className="p-3 border-t border-[#1a1a1a]">
            <Link to="/settings"
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-all w-full text-sm mb-2',
                location.pathname === '/settings'
                  ? 'bg-white/[0.08] text-white font-medium'
                  : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
              )}>
              <Settings className={clsx('w-4 h-4', location.pathname === '/settings' ? 'text-cyan-400' : 'text-gray-600')} />
              <span>Settings</span>
            </Link>
            <div className="flex items-center gap-2 text-xs">
              {isConnected ? (
                <>
                  <div className="relative">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  </div>
                  <span className="text-emerald-400">Connected</span>
                  <span className="text-gray-700 ml-auto">{stats.clients}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-400">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 ml-56 min-h-[calc(100vh-34px)] bg-black overflow-auto">
          <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-sm border-b border-[#111] px-6 py-2 flex items-center justify-end gap-2">
            <NotificationBell />
            <WalletBar />
          </div>
          <Outlet />
        </main>
      </div>

      <StatusBar />
    </div>
  );
}
