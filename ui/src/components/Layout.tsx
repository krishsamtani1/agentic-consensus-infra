import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BarChart3, 
  Bot, 
  BookOpen,
  Trophy,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import clsx from 'clsx';
import TickerTape from './TickerTape';
import WalletBar from './WalletBar';
import StatusBar from './StatusBar';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/agents', icon: Bot, label: 'Agent Registry' },
  { to: '/markets', icon: BarChart3, label: 'Benchmark Arena' },
  { to: '/research', icon: BookOpen, label: 'Methodology' },
];

export default function Layout() {
  const { isConnected, stats } = useWebSocket();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TickerTape />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-56 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col fixed h-[calc(100vh-34px)] top-8 z-50">
          {/* Logo */}
          <div className="p-4 border-b border-[#1a1a1a]">
            <button onClick={() => navigate('/')} className="flex items-center gap-3 group w-full text-left">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white tracking-tight">TRUTH-NET</h1>
                <p className="text-[10px] text-gray-600">AI Agent Ratings</p>
              </div>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3">
            <ul className="space-y-0.5">
              {navItems.map(({ to, icon: Icon, label, end }) => {
                const isActive = end 
                  ? location.pathname === to 
                  : location.pathname.startsWith(to);
                
                return (
                  <li key={to}>
                    <button
                      onClick={() => navigate(to)}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-left text-sm',
                        isActive
                          ? 'bg-white/[0.08] text-white font-medium'
                          : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                      )}
                    >
                      <Icon className={clsx('w-4 h-4', isActive ? 'text-cyan-400' : 'text-gray-600')} />
                      <span>{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Connection Status */}
          <div className="p-3 border-t border-[#1a1a1a]">
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
          <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-sm border-b border-[#111] px-6 py-2 flex items-center justify-end">
            <WalletBar />
          </div>
          <Outlet />
        </main>
      </div>

      <StatusBar />
    </div>
  );
}
