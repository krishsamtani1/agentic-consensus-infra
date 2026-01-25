import { Outlet, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Bot, 
  Play, 
  Activity,
  Wifi,
  WifiOff,
  Sparkles,
  Radar
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/markets', icon: Store, label: 'Markets' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/simulation', icon: Play, label: 'Simulation' },
  { to: '/vision', icon: Sparkles, label: 'Vision', highlight: true },
];

export default function Layout() {
  const { isConnected, stats } = useWebSocket();

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white">TRUTH-NET</h1>
              <p className="text-xs text-slate-400">Consensus Engine</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map(({ to, icon: Icon, label, highlight }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                      isActive
                        ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                        : highlight
                        ? 'text-purple-400 hover:bg-purple-700/30 hover:text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                    )
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{label}</span>
                  {highlight && (
                    <span className="ml-auto text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">
                      NEW
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Status */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Connected</span>
                <span className="text-slate-500 ml-auto">{stats.clients} clients</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-400" />
                <span className="text-red-400">Disconnected</span>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
