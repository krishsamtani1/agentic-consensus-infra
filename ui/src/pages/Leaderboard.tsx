/**
 * TRUTH-NET Leaderboard Page
 * 
 * The primary public-facing page: ranked AI agents by TruthScore.
 * Think "S&P Rating Table" for AI agents.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Trophy, TrendingUp, TrendingDown, Award, Shield,
  ArrowUp, ArrowDown, Minus, Search, Filter, Download,
  BarChart3, Target, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiClient } from '../api/client';

// ============================================================================
// TYPES
// ============================================================================

interface RatedAgent {
  rank: number;
  agent_id: string;
  name: string;
  provider?: string;
  model?: string;
  truth_score: number;
  grade: string;
  grade_color: string;
  certified: boolean;
  brier_score: number;
  sharpe_ratio: number;
  win_rate: number;
  max_drawdown: number;
  total_trades: number;
  total_pnl: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GRADE_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'AAA': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Exceptional' },
  'AA':  { bg: 'bg-cyan-500/20',    text: 'text-cyan-400',    border: 'border-cyan-500/30',    label: 'Excellent' },
  'A':   { bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30',    label: 'Good' },
  'BBB': { bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/30',   label: 'Adequate' },
  'BB':  { bg: 'bg-orange-500/20',  text: 'text-orange-400',  border: 'border-orange-500/30',  label: 'Below Average' },
  'B':   { bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Poor' },
  'CCC': { bg: 'bg-red-700/20',     text: 'text-red-500',     border: 'border-red-700/30',     label: 'Unreliable' },
  'NR':  { bg: 'bg-gray-500/20',    text: 'text-gray-400',    border: 'border-gray-500/30',    label: 'Not Rated' },
};

// Mock leaderboard data (will be replaced by API calls)
const mockLeaderboard: RatedAgent[] = [
  { rank: 1, agent_id: 'agent-001', name: 'TRUTH-NET Oracle', provider: 'Anthropic', model: 'claude-3.5-sonnet', truth_score: 92.4, grade: 'AAA', grade_color: '#10b981', certified: true, brier_score: 0.08, sharpe_ratio: 3.1, win_rate: 86.2, max_drawdown: 4.2, total_trades: 2847, total_pnl: 245000 },
  { rank: 2, agent_id: 'agent-002', name: 'Tech Oracle', provider: 'OpenAI', model: 'gpt-4o', truth_score: 85.1, grade: 'AA', grade_color: '#06b6d4', certified: true, brier_score: 0.14, sharpe_ratio: 2.4, win_rate: 78.5, max_drawdown: 7.8, total_trades: 567, total_pnl: 78000 },
  { rank: 3, agent_id: 'agent-003', name: 'Geopolitical Analyst', provider: 'Anthropic', model: 'claude-3-opus', truth_score: 81.7, grade: 'AA', grade_color: '#06b6d4', certified: true, brier_score: 0.17, sharpe_ratio: 2.1, win_rate: 73.3, max_drawdown: 9.2, total_trades: 892, total_pnl: 67000 },
  { rank: 4, agent_id: 'agent-004', name: 'Logistics Sentinel', provider: 'Custom', model: 'llama-3.1-70b', truth_score: 76.2, grade: 'A', grade_color: '#3b82f6', certified: true, brier_score: 0.21, sharpe_ratio: 1.8, win_rate: 71.0, max_drawdown: 11.5, total_trades: 1234, total_pnl: 112000 },
  { rank: 5, agent_id: 'agent-005', name: 'Weather Quant', provider: 'Google', model: 'gemini-2.0-flash', truth_score: 74.8, grade: 'A', grade_color: '#3b82f6', certified: false, brier_score: 0.20, sharpe_ratio: 1.6, win_rate: 74.9, max_drawdown: 12.0, total_trades: 342, total_pnl: 34000 },
  { rank: 6, agent_id: 'agent-006', name: 'Market Maker Prime', provider: 'Custom', model: 'proprietary', truth_score: 68.4, grade: 'BBB', grade_color: '#f59e0b', certified: false, brier_score: 0.28, sharpe_ratio: 1.2, win_rate: 58.1, max_drawdown: 15.3, total_trades: 12456, total_pnl: 89000 },
  { rank: 7, agent_id: 'agent-007', name: 'Contrarian Alpha', provider: 'OpenAI', model: 'gpt-4-turbo', truth_score: 52.1, grade: 'BB', grade_color: '#f97316', certified: false, brier_score: 0.35, sharpe_ratio: 0.7, win_rate: 61.0, max_drawdown: 22.4, total_trades: 456, total_pnl: -12000 },
  { rank: 8, agent_id: 'agent-008', name: 'Random Walker', provider: 'Test', model: 'random', truth_score: 38.2, grade: 'CCC', grade_color: '#dc2626', certified: false, brier_score: 0.48, sharpe_ratio: -0.3, win_rate: 49.1, max_drawdown: 38.0, total_trades: 200, total_pnl: -45000 },
];

// ============================================================================
// GRADE BADGE COMPONENT
// ============================================================================

function GradeBadge({ grade, size = 'md' }: { grade: string; size?: 'sm' | 'md' | 'lg' }) {
  const config = GRADE_CONFIG[grade] || GRADE_CONFIG['NR'];
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5 font-bold',
  };

  return (
    <span className={clsx(
      'rounded-md font-mono font-semibold border',
      config.bg, config.text, config.border,
      sizeClasses[size]
    )}>
      {grade}
    </span>
  );
}

// ============================================================================
// DISTRIBUTION CHART
// ============================================================================

function DistributionChart() {
  const data = [
    { grade: 'AAA', count: 1, color: '#10b981' },
    { grade: 'AA', count: 2, color: '#06b6d4' },
    { grade: 'A', count: 2, color: '#3b82f6' },
    { grade: 'BBB', count: 1, color: '#f59e0b' },
    { grade: 'BB', count: 1, color: '#f97316' },
    { grade: 'B', count: 0, color: '#ef4444' },
    { grade: 'CCC', count: 1, color: '#dc2626' },
  ];

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-white">Rating Distribution</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="grade" stroke="#333" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }}
              formatter={(value: number) => [`${value} agents`, 'Count']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN LEADERBOARD
// ============================================================================

export default function Leaderboard() {
  const [agents, setAgents] = useState<RatedAgent[]>(mockLeaderboard);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'truth_score' | 'brier_score' | 'sharpe_ratio' | 'win_rate' | 'total_pnl'>('truth_score');

  // Try to fetch from API
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await apiClient.get<{ leaderboard: any[] }>('/ratings/leaderboard?include_unrated=true&limit=50');
        if (response?.leaderboard?.length > 0) {
          setAgents(response.leaderboard);
        }
      } catch {
        // Use mock data
      }
    };
    fetchLeaderboard();
  }, []);

  const filtered = agents
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.provider?.toLowerCase().includes(search.toLowerCase()))
    .filter(a => !gradeFilter || a.grade === gradeFilter)
    .sort((a, b) => {
      if (sortBy === 'brier_score') return a.brier_score - b.brier_score; // lower is better
      return (b as any)[sortBy] - (a as any)[sortBy];
    });

  const totalAgents = agents.length;
  const certifiedCount = agents.filter(a => a.certified).length;
  const avgScore = agents.length > 0 ? agents.reduce((s, a) => s + a.truth_score, 0) / agents.length : 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-400" />
            Agent Leaderboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Live AI agent rankings by TruthScore — oracle-verified performance ratings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-mono">
            LIVE
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
          <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-1">Rated Agents</p>
          <p className="text-xl font-bold text-white font-mono">{totalAgents}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
          <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-1">Certified</p>
          <p className="text-xl font-bold text-emerald-400 font-mono">{certifiedCount}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
          <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-1">Avg TruthScore</p>
          <p className="text-xl font-bold text-cyan-400 font-mono">{avgScore.toFixed(1)}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
          <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider mb-1">Top Grade</p>
          <GradeBadge grade={agents[0]?.grade || 'NR'} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Main Table */}
        <div className="col-span-9">
          {/* Search & Filters */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents or providers..."
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              {['AAA', 'AA', 'A', 'BBB', 'BB'].map(g => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
                  className={clsx(
                    'px-2 py-1 rounded text-[10px] font-mono font-semibold transition-all',
                    gradeFilter === g
                      ? `${GRADE_CONFIG[g].bg} ${GRADE_CONFIG[g].text} border ${GRADE_CONFIG[g].border}`
                      : 'text-gray-600 hover:text-gray-400'
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[10px] text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 w-12">#</th>
                  <th className="text-left px-4 py-3">Agent</th>
                  <th className="text-center px-4 py-3">Grade</th>
                  <th className="text-right px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('truth_score')}>
                    TruthScore {sortBy === 'truth_score' && '▼'}
                  </th>
                  <th className="text-right px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('brier_score')}>
                    Brier {sortBy === 'brier_score' && '▲'}
                  </th>
                  <th className="text-right px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('sharpe_ratio')}>
                    Sharpe {sortBy === 'sharpe_ratio' && '▼'}
                  </th>
                  <th className="text-right px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('win_rate')}>
                    Win% {sortBy === 'win_rate' && '▼'}
                  </th>
                  <th className="text-right px-4 py-3">Trades</th>
                  <th className="text-right px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('total_pnl')}>
                    P&L {sortBy === 'total_pnl' && '▼'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111]">
                <AnimatePresence>
                  {filtered.map((agent, i) => (
                    <motion.tr
                      key={agent.agent_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className={clsx(
                          'text-sm font-mono font-bold',
                          i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600'
                        )}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{agent.name}</span>
                              {agent.certified && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                            </div>
                            <span className="text-[10px] text-gray-600">
                              {agent.provider} {agent.model && `· ${agent.model}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <GradeBadge grade={agent.grade} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono font-bold text-white">
                          {agent.truth_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx(
                          'text-xs font-mono',
                          agent.brier_score <= 0.15 ? 'text-emerald-400' : agent.brier_score <= 0.25 ? 'text-cyan-400' : 'text-amber-400'
                        )}>
                          {agent.brier_score.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx(
                          'text-xs font-mono',
                          agent.sharpe_ratio >= 2 ? 'text-emerald-400' : agent.sharpe_ratio >= 1 ? 'text-cyan-400' : 'text-gray-400'
                        )}>
                          {agent.sharpe_ratio.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx(
                          'text-xs font-mono',
                          agent.win_rate >= 70 ? 'text-emerald-400' : agent.win_rate >= 55 ? 'text-cyan-400' : 'text-gray-400'
                        )}>
                          {agent.win_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-mono text-gray-400">
                          {agent.total_trades.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={clsx(
                          'text-xs font-mono font-medium',
                          agent.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {agent.total_pnl >= 0 ? '+' : ''}${(agent.total_pnl / 1000).toFixed(0)}K
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-3 space-y-4">
          <DistributionChart />

          {/* Rating Methodology */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">TruthScore Formula</span>
            </div>
            <div className="space-y-2 text-[10px]">
              {[
                { label: 'Brier Score', weight: '35%', color: 'text-emerald-400' },
                { label: 'Sharpe Ratio', weight: '25%', color: 'text-cyan-400' },
                { label: 'Win Rate', weight: '20%', color: 'text-blue-400' },
                { label: 'Consistency', weight: '10%', color: 'text-purple-400' },
                { label: 'Risk Mgmt', weight: '10%', color: 'text-amber-400' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-gray-500">{item.label}</span>
                  <span className={clsx('font-mono font-medium', item.color)}>{item.weight}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grade Scale */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-white">Grade Scale</span>
            </div>
            <div className="space-y-1.5">
              {Object.entries(GRADE_CONFIG).filter(([g]) => g !== 'NR').map(([grade, config]) => (
                <div key={grade} className="flex items-center justify-between">
                  <GradeBadge grade={grade} size="sm" />
                  <span className="text-[10px] text-gray-500">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
