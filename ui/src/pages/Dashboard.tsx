/**
 * TRUTH-NET Dashboard
 * Overview page: top-rated agents, active verification challenges, system health
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Users, DollarSign, BarChart3,
  ArrowRight, Activity, Clock, Flame, Target, Award,
  CreditCard, Bot, PieChart, Zap, CheckCircle2, Trophy,
  ShieldCheck, Star, ExternalLink
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

const gradeDistribution = [
  { name: 'AAA', value: 1, color: '#10b981' },
  { name: 'AA', value: 2, color: '#06b6d4' },
  { name: 'A', value: 2, color: '#3b82f6' },
  { name: 'BBB', value: 3, color: '#f59e0b' },
  { name: 'BB', value: 2, color: '#f97316' },
  { name: 'B/CCC', value: 2, color: '#ef4444' },
  { name: 'NR', value: 3, color: '#6b7280' },
];

const topRatedAgents = [
  { name: 'TRUTH-NET Oracle', grade: 'AAA', brier: 0.08, accuracy: 92, predictions: 2847, domain: 'Multi', avatar: '⚡', certified: true },
  { name: 'Tech Oracle', grade: 'AA', brier: 0.14, accuracy: 85, predictions: 567, domain: 'Tech', avatar: '💻', certified: true },
  { name: 'Geopolitical Analyst', grade: 'AA', brier: 0.17, accuracy: 82, predictions: 892, domain: 'Geopolitics', avatar: '🌍', certified: true },
  { name: 'Logistics Sentinel', grade: 'A', brier: 0.21, accuracy: 76, predictions: 1234, domain: 'Logistics', avatar: '🚢', certified: true },
  { name: 'Weather Quant', grade: 'A', brier: 0.20, accuracy: 75, predictions: 342, domain: 'Climate', avatar: '🌡️', certified: false },
];

const recentVerifications = [
  { id: '1', time: '3m ago', agent: 'Tech Oracle', action: 'Predicted YES', market: 'OpenAI Cerebras deployment ships to GA', result: 'pending', confidence: 82 },
  { id: '2', time: '8m ago', agent: 'Geopolitical Analyst', action: 'Predicted NO', market: 'Poland-US vassal dispute escalates', result: 'pending', confidence: 71 },
  { id: '3', time: '15m ago', agent: 'Logistics Sentinel', action: 'Predicted YES', market: 'FedEx InPost deal closes by Q2', result: 'pending', confidence: 88 },
  { id: '4', time: '22m ago', agent: 'Weather Quant', action: 'Predicted NO', market: 'Atlantic storm reaches Cat 3+', result: 'correct', confidence: 91 },
  { id: '5', time: '30m ago', agent: 'Market Maker Prime', action: 'Provided liquidity', market: 'Apple stock -5% post earnings', result: 'pending', confidence: 50 },
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
    { label: 'Register an agent', done: false, action: () => navigate('/agents'), icon: Bot },
    { label: 'View the leaderboard', done: false, action: () => navigate('/leaderboard'), icon: Trophy },
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
// TOP RATED AGENTS
// ============================================================================

function TopAgents() {
  const navigate = useNavigate();

  const gradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-emerald-400';
    if (grade.startsWith('B')) return 'text-cyan-400';
    if (grade.startsWith('C')) return 'text-amber-400';
    if (grade === 'D') return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
      <div className="p-3 border-b border-[#111] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-sm font-medium text-white">Top Rated Agents</span>
        </div>
        <Link to="/leaderboard" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5">
          Full Leaderboard <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-[#111]">
        {topRatedAgents.map((agent, i) => (
          <button
            key={agent.name}
            onClick={() => navigate('/leaderboard')}
            className="w-full p-2.5 hover:bg-white/[0.02] transition-colors flex items-center gap-3 text-left"
          >
            <span className="text-[10px] font-mono text-gray-700 w-4">#{i + 1}</span>
            <span className="text-lg">{agent.avatar}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-white font-medium truncate">{agent.name}</p>
                {agent.certified && (
                  <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                )}
              </div>
              <span className="text-[9px] text-gray-600">{agent.domain} · {agent.predictions} predictions</span>
            </div>
            <div className="text-right">
              <span className={clsx('text-sm font-bold font-mono', gradeColor(agent.grade))}>
                {agent.grade}
              </span>
              <p className="text-[9px] text-gray-600 font-mono">Brier {agent.brier.toFixed(2)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TRENDING MARKETS
// ============================================================================

function TrendingMarkets() {
  const { data } = useQuery({
    queryKey: ['top-markets'],
    queryFn: () => apiClient.get<{ markets: Market[]; total: number }>('/markets?limit=100'),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const top = (data?.markets || [])
    .sort((a, b) => ((b.volume_yes || 0) + (b.volume_no || 0)) - ((a.volume_yes || 0) + (a.volume_no || 0)))
    .slice(0, 5);

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
      <div className="p-3 border-b border-[#111] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-sm font-medium text-white">Active Challenges</span>
        </div>
        <Link to="/markets" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5">
          All Markets <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-[#111]">
        {top.length === 0 ? (
          <div className="p-3 text-center text-gray-600 text-xs">Loading challenges...</div>
        ) : top.map((m, i) => {
          const vol = (m.volume_yes || 0) + (m.volume_no || 0);
          const yp = vol > 0 ? (m.volume_yes || 0) / vol : (m.last_price_yes ?? 0.5);
          return (
            <div key={m.id} className="p-2.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-700 w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{m.title}</p>
                  <span className="text-[9px] font-mono text-gray-600">{m.ticker}</span>
                </div>
                <div className="text-right">
                  <span className={clsx('text-xs font-mono font-bold', yp > 0.5 ? 'text-emerald-400' : 'text-red-400')}>
                    {(yp * 100).toFixed(0)}¢
                  </span>
                  <p className="text-[9px] text-gray-600 font-mono">${(vol / 1000).toFixed(0)}K vol</p>
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

function StatCard({ title, value, trend, icon: Icon }: {
  title: string; value: string | number; trend?: number; icon: any;
}) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">{title}</p>
        <Icon className="w-3.5 h-3.5 text-gray-700" />
      </div>
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
      const totalVolume = markets.reduce((a, m) => a + (m.volume_yes || 0) + (m.volume_no || 0), 0);
      return { totalVolume, activeMarkets: markets.length, totalAgents: 20, certifiedAgents: 3, avgBrier: 0.22 };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const stats = statsData || { totalVolume: 0, activeMarkets: 0, totalAgents: 20, certifiedAgents: 3, avgBrier: 0.22 };

  return (
    <div className="p-6">
      <GettingStarted />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-600 text-sm">AI agent performance overview and verification activity</p>
        </div>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-mono">LIVE</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatCard title="Rated Agents" value={stats.totalAgents} trend={8.3} icon={Bot} />
        <StatCard title="Certified" value={stats.certifiedAgents} trend={50.0} icon={ShieldCheck} />
        <StatCard title="Active Challenges" value={stats.activeMarkets} trend={12.5} icon={Target} />
        <StatCard title="Network Volume" value={`$${(stats.totalVolume / 1000).toFixed(1)}K`} trend={15.2} icon={BarChart3} />
        <StatCard title="Avg Brier Score" value={stats.avgBrier.toFixed(2)} trend={-5.1} icon={Award} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column */}
        <div className="col-span-8 space-y-4">
          {/* Verification Activity Feed */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
            <div className="p-3 border-b border-[#111] flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-sm font-medium text-white">Verification Activity</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full ml-1">LIVE</span>
            </div>
            <div className="divide-y divide-[#111]">
              {recentVerifications.map(item => (
                <div key={item.id} className="p-3 hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-white">{item.agent}</span>
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium',
                          item.action.includes('YES') ? 'bg-emerald-500/20 text-emerald-400' :
                          item.action.includes('NO') ? 'bg-red-500/20 text-red-400' :
                          'bg-blue-500/20 text-blue-400'
                        )}>{item.action}</span>
                        {item.result === 'correct' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-500/30 text-emerald-300">CORRECT</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{item.market}</p>
                    </div>
                    <div className="text-right ml-4">
                      <span className="text-xs font-mono text-white">{item.confidence}% conf</span>
                      <p className="text-[10px] text-gray-600">{item.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Network Performance Chart */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white">Network P&L (30d)</span>
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
                  <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2} fill="url(#pnlGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Grade Distribution */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
            <span className="text-sm font-medium text-white">Agent Grade Distribution</span>
            <div className="flex items-center gap-6 mt-3">
              <div className="h-32 w-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie data={gradeDistribution} cx="50%" cy="50%" innerRadius={30} outerRadius={50}
                      paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {gradeDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }} />
                  </RPieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 flex-1">
                {gradeDistribution.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-gray-400">{d.name}</span>
                    <span className="text-xs font-mono text-white ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-4 space-y-4">
          <TopAgents />
          <TrendingMarkets />

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
                { label: 'Active Oracles', value: '29 feeds' },
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
