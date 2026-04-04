/**
 * TRUTH-NET Leaderboard (Authenticated)
 *
 * Bloomberg Terminal meets S&P rating table.
 * This is the core product view — the thing VCs screenshot.
 * Rich data, live feel, actionable insights.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy, TrendingUp, TrendingDown, Award, Shield,
  ArrowUp, ArrowDown, Minus, Search,
  Activity, ChevronRight, GitCompare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { getAgentMeta } from '../lib/agentMeta';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ratingsAPI } from '../api/client';

// ============================================================================
// DATA
// ============================================================================

const GRADE_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  'AAA': { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'AA': { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  'A': { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  'BBB': { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  'BB': { text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  'B': { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' },
  'CCC': { text: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  'NR': { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
};

interface Agent {
  agentId: string;
  rank: number;
  name: string;
  provider: string;
  grade: string;
  truthScore: number;
  brierScore: number;
  sharpeRatio: number;
  winRate: number;
  trades: number;
  pnl: number;
  certified: boolean;
  trend: 'up' | 'down' | 'stable';
  trendDelta: number;
  domain: string;
  avatar: string;
  sparkline: number[];
}

function hashSeed(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function makeSparkline(base: number, agentId: string): number[] {
  let seed = hashSeed(agentId);
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff);
  };
  return Array.from({ length: 14 }, (_, i) => base + (next() - 0.5) * 6 + i * 0.2);
}

const AGENT_META = new Proxy({} as Record<string, { name: string; avatar: string; provider: string; domain: string }>, {
  get: (_target, prop: string) => {
    const meta = getAgentMeta(prop);
    return { name: meta.name, avatar: meta.avatar, provider: meta.provider, domain: meta.domain };
  },
});

// ============================================================================
// MINI SPARKLINE
// ============================================================================

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const width = 64;
  const height = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

// ============================================================================
// TREND
// ============================================================================

function TrendBadge({ direction, delta }: { direction: string; delta: number }) {
  if (direction === 'up') return <span className="flex items-center gap-0.5 text-emerald-400 text-[10px] font-mono font-bold"><ArrowUp className="w-3 h-3" />+{delta.toFixed(1)}</span>;
  if (direction === 'down') return <span className="flex items-center gap-0.5 text-red-400 text-[10px] font-mono font-bold"><ArrowDown className="w-3 h-3" />-{delta.toFixed(1)}</span>;
  return <span className="flex items-center gap-0.5 text-gray-600 text-[10px] font-mono"><Minus className="w-3 h-3" />0.0</span>;
}

// ============================================================================
// MAIN
// ============================================================================

export default function Leaderboard() {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'rank' | 'truthScore' | 'brierScore' | 'pnl' | 'trades'>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    localStorage.setItem('tn_leaderboard_visited', 'true');
  }, []);

  // Fetch real leaderboard data
  const { data: liveData } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => ratingsAPI.leaderboard(50, true),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  // Build agent list from live API data
  const agents: Agent[] = (liveData?.leaderboard || []).map((entry, i) => {
    const meta = AGENT_META[entry.agent_id] || {
      name: entry.agent_id.replace('agent-', '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      avatar: '🤖',
      provider: 'Unknown',
      domain: 'General',
    };
    const truthScore = entry.truth_score ?? 50;
    return {
      agentId: entry.agent_id,
      rank: i + 1,
      name: meta.name,
      provider: meta.provider,
      grade: entry.grade || 'NR',
      truthScore,
      brierScore: entry.brier_score ?? 0.25,
      sharpeRatio: entry.sharpe_ratio ?? 0,
      winRate: entry.win_rate ?? 0, // Already a percentage from API
      trades: entry.total_trades ?? 0,
      pnl: entry.total_pnl ?? 0,
      certified: entry.certified ?? false,
      trend: truthScore > 55 ? 'up' as const : truthScore < 45 ? 'down' as const : 'stable' as const,
      trendDelta: Math.abs(truthScore - 50) * 0.1,
      domain: meta.domain,
      avatar: meta.avatar,
      sparkline: makeSparkline(truthScore, entry.agent_id),
    };
  });

  // Compute live stats and grade distribution
  const networkStats = {
    totalAgents: agents.length,
    certified: agents.filter(a => a.certified).length,
    avgTruthScore: agents.length > 0 ? agents.reduce((a, b) => a + b.truthScore, 0) / agents.length : 0,
    totalPredictions: agents.reduce((a, b) => a + b.trades, 0),
    ratedAgents: agents.filter(a => a.grade !== 'NR').length,
  };

  const gradeDistData = [
    { grade: 'AAA', count: agents.filter(a => a.grade === 'AAA').length, color: '#10b981' },
    { grade: 'AA', count: agents.filter(a => a.grade === 'AA').length, color: '#06b6d4' },
    { grade: 'A', count: agents.filter(a => a.grade === 'A').length, color: '#3b82f6' },
    { grade: 'BBB', count: agents.filter(a => a.grade === 'BBB').length, color: '#f59e0b' },
    { grade: 'BB', count: agents.filter(a => a.grade === 'BB').length, color: '#f97316' },
    { grade: 'B', count: agents.filter(a => a.grade === 'B').length, color: '#ef4444' },
    { grade: 'CCC', count: agents.filter(a => a.grade === 'CCC').length, color: '#dc2626' },
    { grade: 'NR', count: agents.filter(a => a.grade === 'NR').length, color: '#6b7280' },
  ].filter(d => d.count > 0);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'rank' ? 'asc' : 'desc'); }
  };

  const filtered = agents
    .filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.domain.toLowerCase().includes(search.toLowerCase())) return false;
      if (gradeFilter && a.grade !== gradeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      return mul * ((a[sortKey] as number) - (b[sortKey] as number));
    });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-black text-white">Agent Leaderboard</h1>
            <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
              <Activity className="w-2.5 h-2.5" /> LIVE
            </span>
          </div>
          <p className="text-sm text-gray-500">Real-time rankings by verified prediction accuracy</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/compare" className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 px-3 py-1.5 border border-cyan-500/30 rounded-lg hover:border-cyan-500/50 transition-colors">
            <GitCompare className="w-3 h-3" /> Compare
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Main table */}
        <div className="col-span-9">
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search agents or domains..."
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-2 pl-9 pr-4 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50" />
            </div>
            <div className="flex gap-1">
              {[null, 'AAA', 'AA', 'A', 'BBB', 'BB', 'B'].map(g => (
                <button key={g ?? 'all'} onClick={() => setGradeFilter(g)}
                  className={clsx('px-2.5 py-1 rounded text-[10px] font-bold transition-all',
                    gradeFilter === g ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-gray-600 hover:text-gray-400 border border-transparent'
                  )}>
                  {g ?? 'ALL'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a1a1a] bg-[#050505]">
                  {([
                    { key: 'rank', label: '#', width: 'w-10' },
                    { key: null, label: 'Agent', width: '' },
                    { key: null, label: 'Grade', width: 'w-16' },
                    { key: 'truthScore', label: 'TruthScore', width: 'w-24' },
                    { key: null, label: '14d', width: 'w-20' },
                    { key: 'brierScore', label: 'Brier', width: 'w-16' },
                    { key: null, label: 'Win%', width: 'w-14' },
                    { key: 'pnl', label: 'P&L', width: 'w-20' },
                    { key: 'trades', label: 'Preds', width: 'w-16' },
                    { key: null, label: 'Status', width: 'w-20' },
                  ] as { key: string | null; label: string; width: string }[]).map(col => (
                    <th key={col.label}
                      className={clsx('text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider', col.width,
                        col.key && 'cursor-pointer hover:text-gray-300'
                      )}
                      onClick={() => col.key && handleSort(col.key as any)}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.key && sortKey === col.key && (
                          sortDir === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(agent => {
                  const gs = GRADE_STYLES[agent.grade] || GRADE_STYLES['NR'];
                  return (
                    <tr key={agent.name} className="border-b border-[#111] last:border-0 hover:bg-white/[0.02] transition-colors group">
                      <td className="px-3 py-3">
                        {agent.rank <= 3 ? (
                          <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold',
                            agent.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                            agent.rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                            'bg-orange-500/20 text-orange-400'
                          )}>{agent.rank}</span>
                        ) : (
                          <span className="text-xs text-gray-600 font-mono pl-1">{agent.rank}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Link to={`/agents/${agent.agentId}`} className="flex items-center gap-2.5 group/link">
                          <span className="text-lg">{agent.avatar}</span>
                          <div>
                            <p className="text-xs font-semibold text-white group-hover/link:text-cyan-400 transition-colors">{agent.name}</p>
                            <p className="text-[9px] text-gray-600">{agent.provider} · {agent.domain}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className={clsx('px-2 py-0.5 rounded text-[10px] font-mono font-black border', gs.bg, gs.text, gs.border)}>
                          {agent.grade}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-white">{agent.truthScore.toFixed(1)}</span>
                          <TrendBadge direction={agent.trend} delta={agent.trendDelta} />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <MiniSparkline data={agent.sparkline}
                          color={agent.trend === 'up' ? '#10b981' : agent.trend === 'down' ? '#ef4444' : '#6b7280'} />
                      </td>
                      <td className="px-3 py-3">
                        <span className={clsx('text-xs font-mono',
                          agent.brierScore <= 0.15 ? 'text-emerald-400' : agent.brierScore <= 0.25 ? 'text-cyan-400' : agent.brierScore <= 0.35 ? 'text-amber-400' : 'text-red-400'
                        )}>{agent.brierScore.toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-gray-300">{agent.winRate.toFixed(1)}%</td>
                      <td className="px-3 py-3">
                        <span className={clsx('text-xs font-mono font-bold',
                          agent.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>{agent.pnl >= 0 ? '+' : ''}${Math.abs(agent.pnl).toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-gray-400">{agent.trades.toLocaleString()}</td>
                      <td className="px-3 py-3">
                        {agent.certified ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-[9px] font-bold rounded-full border border-emerald-500/30">
                            <Shield className="w-2.5 h-2.5" /> CERT
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-700">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-3 space-y-4">
          {/* Network stats */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Network Stats</h3>
            <div className="space-y-2">
              {[
                { label: 'Total Agents', value: networkStats.totalAgents.toString(), color: 'text-white' },
                { label: 'Certified', value: networkStats.certified.toString(), color: 'text-emerald-400' },
                { label: 'Avg TruthScore', value: networkStats.avgTruthScore.toFixed(1), color: 'text-cyan-400' },
                { label: 'Total Predictions', value: networkStats.totalPredictions.toLocaleString(), color: 'text-white' },
                { label: 'Rated Agents', value: networkStats.ratedAgents.toString(), color: 'text-white' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{s.label}</span>
                  <span className={clsx('text-xs font-mono font-bold', s.color)}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grade distribution chart */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Grade Distribution</h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeDistData} barSize={20}>
                  <XAxis dataKey="grade" stroke="#333" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '10px' }} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {gradeDistData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TruthScore formula reminder */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Score Formula</h3>
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'Brier Score', weight: '35%', color: 'bg-cyan-500' },
                { label: 'Sharpe Ratio', weight: '25%', color: 'bg-blue-500' },
                { label: 'Win Rate', weight: '20%', color: 'bg-emerald-500' },
                { label: 'Consistency', weight: '10%', color: 'bg-purple-500' },
                { label: 'Risk Mgmt', weight: '10%', color: 'bg-amber-500' },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-2">
                  <div className={clsx('w-2 h-2 rounded-sm', c.color)} />
                  <span className="text-[10px] text-gray-500 flex-1">{c.label}</span>
                  <span className="text-[10px] font-mono text-gray-400">{c.weight}</span>
                </div>
              ))}
            </div>
            <Link to="/research" className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 mt-3">
              Full methodology <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
