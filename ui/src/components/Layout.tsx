import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Bot, 
  Shield,
  Wifi,
  WifiOff,
  Zap,
  Target
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import clsx from 'clsx';
import TickerTape from './TickerTape';
import WalletBar from './WalletBar';
import StatusBar from './StatusBar';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Command Center', end: true },
  { to: '/markets', icon: Store, label: 'Clearinghouse' },
  { to: '/agents', icon: Bot, label: 'Counterparties' },
  { to: '/escalations', icon: Shield, label: 'Escalations' },
  { to: '/vision', icon: Target, label: 'Doctrine', highlight: true },
];

export default function Layout() {
  const { isConnected, stats } = useWebSocket();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Ticker Tape - Full width top */}
      <TickerTape />

      <div className="flex flex-1">
        {/* Sidebar - Fixed position for reliable navigation */}
        <aside className="w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col fixed h-[calc(100vh-34px)] top-8 z-50">
          {/* Logo */}
          <div className="p-5 border-b border-[#1a1a1a]">
            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-white tracking-tight">TRUTH-NET</h1>
                <p className="text-xs text-cyan-400/70 font-medium">v2.0 Production</p>
              </div>
            </NavLink>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              {navItems.map(({ to, icon: Icon, label, highlight, end }) => {
                const isActive = end 
                  ? location.pathname === to 
                  : location.pathname.startsWith(to);
                
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative',
                        isActive
                          ? 'bg-gradient-to-r from-cyan-600/20 to-blue-600/10 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                          : highlight
                          ? 'text-purple-400 hover:bg-purple-600/20 hover:text-purple-300 border border-transparent hover:border-purple-500/30'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full" />
                      )}
                      <Icon className={clsx('w-5 h-5', isActive && 'text-cyan-400')} />
                      <span className="font-medium">{label}</span>
                      {highlight && (
                        <span className="ml-auto text-[10px] bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-0.5 rounded-full font-semibold">
                          NEW
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Live Stats */}
          <div className="p-4 border-t border-[#1a1a1a] space-y-3">
            <div className="flex items-center gap-2 text-sm">
              {isConnected ? (
                <>
                  <div className="relative">
                    <Wifi className="w-4 h-4 text-emerald-400" />
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  </div>
                  <span className="text-emerald-400 font-medium">Live</span>
                  <span className="text-gray-600 ml-auto text-xs">{stats.clients} connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-red-400">Offline</span>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 ml-64 min-h-[calc(100vh-34px)] bg-gradient-to-br from-black via-[#050505] to-[#0a0a0a] overflow-auto">
          {/* Top bar with wallet */}
          <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-sm border-b border-[#111] px-6 py-2 flex items-center justify-end">
            <WalletBar />
          </div>
          <Outlet />
        </main>
      </div>

      {/* Status Bar - Bottom */}
      <StatusBar />
    </div>
  );
}
