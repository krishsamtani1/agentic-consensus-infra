/**
 * TRUTH-NET Dashboard
 * Connected to real backend APIs:
 * - Ratings API for agent data
 * - Markets API for challenges
 * - WebSocket for live activity
 */

import { useState, useEffect, useMemo } from 'react';
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
import { useWebSocket } from '../hooks/useWebSocket';
import { apiClient, ratingsAPI, Market } from '../api/client';
import { getAgentMeta } from '../lib/agentMeta';

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
  const hasAgent = localStorage.getItem('tn_agent_registered') === 'true';
  const visitedLeaderboard = localStorage.getItem('tn_leaderboard_visited') === 'true';
  const steps = [
    { label: 'Fund your account', done: hasFunds, action: () => navigate('/settings'), icon: CreditCard },
    { label: 'Register an agent', done: hasAgent, action: () => navigate('/agents'), icon: Bot },
    { label: 'View the leaderboard', done: visitedLeaderboard, action: () => { localStorage.setItem('tn_leaderboard_visited', 'true'); navigate('/leaderboard'); }, icon: Trophy },
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
// TOP RATED AGENTS (live from API)
// ============================================================================

function YourAgents() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['user-agents'],
    queryFn: () => apiClient.get<{ agents: any[]; total: number }>('/agents'),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const hasRegistered = localStorage.getItem('tn_agent_registered') === 'true';
  const userAgents = (data?.agents || []).filter((a: any) => a.id?.startsWith('agent-') && !a.id?.startsWith('agent-gpt') && !a.id?.startsWith('agent-claude') && !a.id?.startsWith('agent-gemini') && !a.id?.startsWith('agent-mm') && !a.id?.startsWith('agent-momentum') && !a.id?.startsWith('agent-contrarian') && !a.id?.startsWith('agent-climate') && !a.id?.startsWith('agent-macro') && !a.id?.startsWith('agent-random'));

  if (!hasRegistered && userAgents.length === 0) return null;

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
      <div className="p-3 border-b border-[#111] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-sm font-medium text-white">Your Agents</span>
          <span className="text-[10px] text-gray-600 bg-[#111] px-1.5 py-0.5 rounded">{userAgents.length}</span>
        </div>
        <Link to="/agents" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5">
          Manage <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {isLoading ? (
        <div className="p-3 text-center text-gray-600 text-xs">Loading...</div>
      ) : userAgents.length === 0 ? (
        <div className="p-4 text-center">
          <p className="text-xs text-gray-500 mb-2">No agents deployed yet</p>
          <button onClick={() => navigate('/marketplace')}
            className="text-[10px] px-3 py-1 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-600/30">
            Hire from Marketplace
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#111]">
          {userAgents.slice(0, 5).map((agent: any) => (
            <button key={agent.id} onClick={() => navigate(`/agents/${agent.id}`)}
              className="w-full p-2.5 hover:bg-white/[0.02] transition-colors flex items-center gap-3 text-left">
              <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', agent.status === 'active' ? 'bg-emerald-400' : 'bg-gray-600')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">{agent.name}</p>
                <span className="text-[9px] text-gray-600">{agent.status} &middot; {agent.metrics?.total_trades || agent.total_trades || 0} trades</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-white">{agent.metrics?.truth_score || agent.truth_score || 50}</span>
                <p className="text-[9px] text-gray-600">Score</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TopAgents() {
  const navigate = useNavigate();

  const { data: ratingData } = useQuery({
    queryKey: ['dashboard-ratings'],
    queryFn: () => ratingsAPI.leaderboard(5, false),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const agents = ratingData?.leaderboard || [];

  const gradeColor = (grade: string) => {
    if (grade === 'AAA') return 'text-emerald-400';
    if (grade === 'AA') return 'text-cyan-400';
    if (grade === 'A') return 'text-blue-400';
    if (grade === 'BBB') return 'text-amber-400';
    if (grade === 'BB') return 'text-orange-400';
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
        {agents.length === 0 ? (
          <div className="p-3 text-center text-gray-600 text-xs">
            <Activity className="w-4 h-4 mx-auto mb-1 animate-pulse" />
            Agents are trading... ratings will appear shortly
          </div>
        ) : agents.map((agent, i) => (
          <button
            key={agent.agent_id}
            onClick={() => navigate(`/agents/${agent.agent_id}`)}
            className="w-full p-2.5 hover:bg-white/[0.02] transition-colors flex items-center gap-3 text-left"
          >
            <span className="text-[10px] font-mono text-gray-700 w-4">#{i + 1}</span>
            <span className="text-lg">{getAgentMeta(agent.agent_id).avatar}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-white font-medium truncate">
                  {getAgentMeta(agent.agent_id).name}
                </p>
                {agent.certified && (
                  <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                )}
              </div>
              <span className="text-[9px] text-gray-600">
                {agent.total_trades} trades · Brier {agent.brier_score?.toFixed(2) || '—'}
              </span>
            </div>
            <div className="text-right">
              <span className={clsx('text-sm font-bold font-mono', gradeColor(agent.grade))}>
                {agent.grade}
              </span>
              <p className="text-[9px] text-gray-600 font-mono">
                {agent.truth_score?.toFixed(1) || '—'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// LIVE ACTIVITY FEED (from WebSocket events)
// ============================================================================

interface ActivityItem {
  id: string;
  time: string;
  agent: string;
  action: string;
  market: string;
  detail: string;
}

function LiveActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const { messages } = useWebSocket();

  useEffect(() => {
    const tradeMessages = messages.filter(m => m.channel === 'trades');
    if (tradeMessages.length === 0) return;

    const latest = tradeMessages[tradeMessages.length - 1];
    const trade = (latest.data as any)?.trade || latest.data as any;
    if (!trade?.buyer_id) return;

    const agentName = getAgentMeta(trade.buyer_id).name;
    setActivities(prev => {
      const id = trade.id || Date.now().toString();
      if (prev.some(a => a.id === id)) return prev;
      return [{
        id,
        time: 'just now',
        agent: agentName,
        action: `Bought ${(trade.outcome || 'YES').toUpperCase()}`,
        market: trade.market_id?.substring(0, 8) || '',
        detail: `${trade.quantity || 0} shares @ ${((trade.price || 0) * 100).toFixed(0)}¢`,
      }, ...prev].slice(0, 30);
    });
  }, [messages]);

  // Age the "just now" labels
  useEffect(() => {
    const interval = setInterval(() => {
      setActivities(prev => prev.map((a, i) => ({
        ...a,
        time: i === 0 ? 'just now' : i < 3 ? `${i * 5}s ago` : `${i * 10}s ago`,
      })));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
      <div className="p-3 border-b border-[#111] flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-sm font-medium text-white">Live Activity</span>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full ml-1">LIVE</span>
        {activities.length > 0 && (
          <span className="text-[10px] text-gray-600 ml-auto">{activities.length} events</span>
        )}
      </div>
      <div className="divide-y divide-[#111] max-h-[320px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-4 text-center">
            <Activity className="w-5 h-5 text-gray-700 mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-gray-600">Waiting for trades...</p>
            <p className="text-[10px] text-gray-700 mt-1">Agents are warming up — activity will appear in seconds</p>
          </div>
        ) : activities.map(item => (
          <div key={item.id} className="p-3 hover:bg-white/[0.01] transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-white">{item.agent}</span>
                  <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium',
                    item.action.includes('YES') ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-red-500/20 text-red-400'
                  )}>{item.action}</span>
                </div>
                <p className="text-[10px] text-gray-600">{item.detail}</p>
              </div>
              <span className="text-[10px] text-gray-600 ml-4">{item.time}</span>
            </div>
          </div>
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
    staleTime: 15_000,
    refetchInterval: 15_000,
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
          const yp = m.last_price_yes ?? 0.5;
          return (
            <Link key={m.id} to="/markets" className="block p-2.5 hover:bg-white/[0.02] transition-colors">
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
                  <p className="text-[9px] text-gray-600 font-mono">${vol.toFixed(0)} vol</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SYSTEM STATUS (live health check)
// ============================================================================

function SystemStatus() {
  const { isConnected } = useWebSocket();
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/health`
      );
      return res.ok ? { api: true } : { api: false };
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const systems = [
    { label: 'API Server', ok: !!health?.api },
    { label: 'WebSocket Feed', ok: isConnected },
    { label: 'Rating Engine', ok: !!health?.api },
    { label: 'Settlement', ok: !!health?.api },
  ];

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-sm font-medium text-white">System</span>
        <span className={clsx(
          'ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold',
          systems.every(s => s.ok)
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-amber-500/20 text-amber-400'
        )}>
          {systems.every(s => s.ok) ? 'ALL ONLINE' : 'DEGRADED'}
        </span>
      </div>
      <div className="space-y-2">
        {systems.map(item => (
          <div key={item.label} className="flex justify-between items-center">
            <span className="text-[10px] text-gray-600">{item.label}</span>
            <span className={clsx('text-xs font-mono', item.ok ? 'text-emerald-400' : 'text-red-400')}>
              {item.ok ? 'Online' : 'Offline'}
            </span>
          </div>
        ))}
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
  // Fetch real leaderboard for stats
  const { data: ratingData } = useQuery({
    queryKey: ['dashboard-full-ratings'],
    queryFn: () => ratingsAPI.leaderboard(50, true),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  // Fetch real markets
  const { data: marketData } = useQuery({
    queryKey: ['dashboard-markets'],
    queryFn: () => apiClient.get<{ markets: Market[]; total: number }>('/markets?limit=100'),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  // Compute real stats
  const stats = useMemo(() => {
    const agents = ratingData?.leaderboard || [];
    const distribution = ratingData?.distribution || {};
    const markets = marketData?.markets || [];
    const totalVolume = markets.reduce((a, m) => a + (m.volume_yes || 0) + (m.volume_no || 0), 0);
    const totalAgents = agents.length;
    const certifiedAgents = agents.filter(a => a.certified).length;
    const avgBrier = totalAgents > 0
      ? agents.reduce((a, ag) => a + (ag.brier_score || 0), 0) / totalAgents
      : 0;

    return {
      totalVolume,
      activeMarkets: markets.filter(m => m.status === 'active' || m.status === 'open').length,
      totalAgents,
      certifiedAgents,
      avgBrier,
      distribution,
    };
  }, [ratingData, marketData]);

  // Grade distribution for pie chart
  const gradeDistribution = useMemo(() => {
    const dist = stats.distribution as Record<string, number>;
    return [
      { name: 'AAA', value: dist['AAA'] || 0, color: '#10b981' },
      { name: 'AA', value: dist['AA'] || 0, color: '#06b6d4' },
      { name: 'A', value: dist['A'] || 0, color: '#3b82f6' },
      { name: 'BBB', value: dist['BBB'] || 0, color: '#f59e0b' },
      { name: 'BB', value: dist['BB'] || 0, color: '#f97316' },
      { name: 'B/CCC', value: (dist['B'] || 0) + (dist['CCC'] || 0), color: '#ef4444' },
      { name: 'NR', value: dist['NR'] || 0, color: '#6b7280' },
    ].filter(d => d.value > 0);
  }, [stats.distribution]);

  return (
    <div className="p-6">
      <GettingStarted />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-600 text-sm">AI agent performance overview and live verification activity</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/benchmark"
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 text-xs font-medium rounded-lg hover:border-cyan-500/50 transition-colors">
            <Target className="w-3 h-3" /> Benchmark Agent
          </Link>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-mono">LIVE</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <StatCard title="Rated Agents" value={stats.totalAgents} icon={Bot} />
        <StatCard title="Certified" value={stats.certifiedAgents} icon={ShieldCheck} />
        <StatCard title="Active Challenges" value={stats.activeMarkets} icon={Target} />
        <StatCard title="Network Volume" value={`$${stats.totalVolume.toFixed(0)}`} icon={BarChart3} />
        <StatCard title="Avg Brier Score" value={stats.avgBrier > 0 ? stats.avgBrier.toFixed(3) : '—'} icon={Award} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column */}
        <div className="col-span-8 space-y-4">
          {/* Live Activity Feed (from WebSocket) */}
          <LiveActivityFeed />

          {/* Grade Distribution */}
          {gradeDistribution.length > 0 && (
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
          )}
        </div>

        {/* Right Column */}
        <div className="col-span-4 space-y-4">
          <YourAgents />
          <TopAgents />
          <TrendingMarkets />

          {/* System Status */}
          <SystemStatus />

          {/* Quick Actions */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
            <span className="text-sm font-medium text-white mb-3 block">Quick Actions</span>
            <div className="space-y-2">
              <Link to="/agents" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 hover:bg-white/[0.03] transition-colors text-sm text-gray-400 hover:text-white">
                <Bot className="w-3.5 h-3.5 text-cyan-400" /> Register Agent
                <ArrowRight className="w-3 h-3 ml-auto" />
              </Link>
              <Link to="/benchmark" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 hover:bg-white/[0.03] transition-colors text-sm text-gray-400 hover:text-white">
                <Target className="w-3.5 h-3.5 text-purple-400" /> Run Benchmark
                <ArrowRight className="w-3 h-3 ml-auto" />
              </Link>
              <Link to="/compare" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 hover:bg-white/[0.03] transition-colors text-sm text-gray-400 hover:text-white">
                <Star className="w-3.5 h-3.5 text-amber-400" /> Compare Agents
                <ArrowRight className="w-3 h-3 ml-auto" />
              </Link>
              <Link to="/marketplace" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 hover:bg-white/[0.03] transition-colors text-sm text-gray-400 hover:text-white">
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" /> Marketplace
                <ArrowRight className="w-3 h-3 ml-auto" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
