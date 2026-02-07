import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, TrendingDown, Users, DollarSign, BarChart3,
  ArrowRight, Activity, Clock, Flame, Target,
  CreditCard, Bot, PieChart, Zap, CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart as RPieChart, Pie, Cell 
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { apiClient, Market } from '../api/client';

// ============================================================================
// MOCK DATA
// ============================================================================

const pnlData = Array.from({ length: 30 }, (_, i) => {
  const pnl = (Math.random() - 0.4) * 2000 + (i * 50);
  return { day: `Day ${i + 1}`, pnl, cumulative: 0 };
});
let cum = 0;
pnlData.forEach(d => { cum += d.pnl; d.cumulative = cum; });

const portfolioData = [
  { name: 'Geopolitics', value: 35, color: '#06b6d4' },
  { name: 'Tech & AI', value: 25, color: '#8b5cf6' },
  { name: 'Crypto', value: 20, color: '#f59e0b' },
  { name: 'Economics', value: 12, color: '#10b981' },
  { name: 'Other', value: 8, color: '#6b7280' },
];

const volumeData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  volume: Math.random() * 50000 + 10000,
}));

const recentActivity = [
  { id: '1', time: '2m ago', agent: 'Geopolitical Analyst', action: 'Bought YES', market: 'US-China Trade Deal by Q2', amount: '$4,500', confidence: 82 },
  { id: '2', time: '5m ago', agent: 'Logistics Sentinel', action: 'Sold NO', market: 'Panama Canal Restrictions Lifted', amount: '$2,800', confidence: 91 },
  { id: '3', time: '12m ago', agent: 'Tech Oracle', action: 'Bought YES', market: 'GPT-5 Released Q1 2026', amount: '$1,800', confidence: 73 },
  { id: '4', time: '18m ago', agent: 'Contrarian Alpha', action: 'Bought NO', market: 'Bitcoin Above $150K by March', amount: '$5,500', confidence: 67 },
  { id: '5', time: '25m ago', agent: 'Market Maker Prime', action: 'Provided Liquidity', market: 'Fed Rate Cut March FOMC', amount: '$12,000', confidence: 50 },
];

// ============================================================================
// GETTING STARTED
// ============================================================================

function GettingStarted() {
  const { balance } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('tn_started_dismissed') === 'true') setDismissed(true);
  }, []);

  if (dismissed) return null;

  const hasFunds = (balance?.available ?? 0) > 0;
  const steps = [
    { label: 'Fund your account', done: hasFunds, action: () => {}, icon: CreditCard },
    { label: 'Deploy an agent', done: false, action: () => navigate('/agents'), icon: Bot },
    { label: 'Place your first trade', done: false, action: () => navigate('/markets'), icon: TrendingUp },
  ];

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-white">Getting Started</span>
        <button onClick={() => { setDismissed(true); localStorage.setItem('tn_started_dismissed', 'true'); }}
          className="text-[10px] text-gray-600 hover:text-gray-400">Dismiss</button>
      </div>
      <div className="flex gap-3">
        {steps.map((s, i) => (
          <button key={i} onClick={s.action}
            className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg transition-all flex-1 text-left',
              s.done ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-black border border-[#1a1a1a] hover:border-[#333]')}>
            {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <s.icon className="w-4 h-4 text-gray-600" />}
            <span className={clsx('text-xs', s.done ? 'text-emerald-400 line-through' : 'text-gray-300')}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TOP MARKETS
// ============================================================================

function TopMarkets() {
  const { data } = useQuery({
    queryKey: ['top-markets'],
    queryFn: () => apiClient.get<{ markets: Market[]; total: number }>('/markets?limit=100'),
    refetchInterval: 10000,
  });

  const top = (data?.markets || [])
    .sort((a, b) => ((b.volume_yes||0)+(b.volume_no||0)) - ((a.volume_yes||0)+(a.volume_no||0)))
    .slice(0, 5);

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
      <div className="p-3 border-b border-[#111] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-sm font-medium text-white">Trending Markets</span>
        </div>
        <Link to="/markets" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5">
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-[#111]">
        {top.length === 0 ? (
          <div className="p-3 text-center text-gray-600 text-xs">Loading markets...</div>
        ) : top.map((m, i) => {
          const vol = (m.volume_yes||0)+(m.volume_no||0);
          const yp = vol > 0 ? (m.volume_yes||0)/vol : (m.last_price_yes ?? 0.5);
          return (
            <div key={m.id} className="p-2.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-700 w-4">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{m.title}</p>
                  <span className="text-[9px] font-mono text-gray-600">{m.ticker}</span>
                </div>
                <div className="text-right">
                  <span className={clsx('text-xs font-mono font-bold', yp > 0.5 ? 'text-emerald-400' : 'text-red-400')}>
                    {(yp * 100).toFixed(0)}¢
                  </span>
                  <p className="text-[9px] text-gray-600 font-mono">${(vol/1000).toFixed(0)}K vol</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({ title, value, trend, color }: {
  title: string; value: string | number; trend?: number; color: string;
}) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-1">{title}</p>
      <p className="text-xl font-bold text-white font-mono tabular-nums">{value}</p>
      {trend !== undefined && (
        <div className="mt-1.5 flex items-center gap-1">
          {trend >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
          <span className={clsx('text-xs font-mono', trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DASHBOARD
// ============================================================================

export default function Dashboard() {
  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get<{ markets: Market[]; total: number }>('/markets?limit=100');
      const markets = response?.markets || [];
      const totalVolume = markets.reduce((a, m) => a + (m.volume_yes||0) + (m.volume_no||0), 0);
      return { totalVolume, activeMarkets: markets.length, totalAgents: 10, avgAccuracy: 0.72 };
    },
    refetchInterval: 10000,
  });

  const stats = statsData || { totalVolume: 0, activeMarkets: 0, totalAgents: 10, avgAccuracy: 0.72 };

  return (
    <div className="p-6">
      <GettingStarted />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-600 text-sm">Portfolio overview and market activity</p>
        </div>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-mono">LIVE</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard title="Total Volume" value={`$${(stats.totalVolume/1000).toFixed(1)}K`} trend={12.5} color="cyan" />
        <StatCard title="Active Markets" value={stats.activeMarkets} trend={8.3} color="purple" />
        <StatCard title="Active Agents" value={stats.totalAgents} trend={-2.1} color="orange" />
        <StatCard title="Avg Accuracy" value={(stats.avgAccuracy * 100).toFixed(0) + '%'} trend={3.2} color="green" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column */}
        <div className="col-span-8 space-y-4">
          {/* P&L Chart */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white">Portfolio P&L (30d)</span>
              <span className={clsx('text-sm font-mono font-bold', cum >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {cum >= 0 ? '+' : ''}${cum.toFixed(0)}
              </span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pnlData}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#333" fontSize={9} tickLine={false} axisLine={false} interval={4} />
                  <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2} fill="url(#pnlGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
            <div className="p-3 border-b border-[#111] flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-sm font-medium text-white">Recent Activity</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full ml-1">LIVE</span>
            </div>
            <div className="divide-y divide-[#111]">
              {recentActivity.map(item => (
                <div key={item.id} className="p-3 hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-white">{item.agent}</span>
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium',
                          item.action.includes('Bought YES') ? 'bg-emerald-500/20 text-emerald-400' :
                          item.action.includes('Sold') || item.action.includes('NO') ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        )}>{item.action}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{item.market}</p>
                    </div>
                    <div className="text-right ml-4">
                      <span className="text-xs font-mono text-white">{item.amount}</span>
                      <p className="text-[10px] text-gray-600">{item.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Volume Chart */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
            <span className="text-sm font-medium text-white">24h Trading Volume</span>
            <div className="h-32 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData}>
                  <defs>
                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="volume" stroke="#06b6d4" strokeWidth={2} fill="url(#volGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-4 space-y-4">
          {/* Portfolio Allocation */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
            <span className="text-sm font-medium text-white">Portfolio Allocation</span>
            <div className="h-36 flex items-center justify-center mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart>
                  <Pie data={portfolioData} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                    paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {portfolioData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }} />
                </RPieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {portfolioData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-gray-500">{d.name} {d.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <TopMarkets />

          {/* System Status */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-sm font-medium text-white">System</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Throughput', value: '42 tx/s' },
                { label: 'Latency (p99)', value: '2.3ms' },
                { label: 'Order Book Depth', value: '1,832' },
                { label: 'Circuit Breakers', value: 'OK' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-600">{item.label}</span>
                  <span className="text-xs font-mono text-emerald-400">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
