/**
 * TRUTH-NET Agent Comparison Tool
 * 
 * Side-by-side comparison of 2-4 agents across all rating dimensions.
 * Helps enterprises make data-driven decisions about which AI agents to deploy.
 */

import { useState } from 'react';
import { 
  GitCompare, Plus, X, Shield, TrendingUp, Target,
  BarChart3, Award, ArrowRight
} from 'lucide-react';
import clsx from 'clsx';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend
} from 'recharts';

// ============================================================================
// MOCK DATA
// ============================================================================

interface CompareAgent {
  id: string;
  name: string;
  avatar: string;
  provider: string;
  grade: string;
  truthScore: number;
  certified: boolean;
  brierScore: number;
  sharpeRatio: number;
  winRate: number;
  consistency: number;
  maxDrawdown: number;
  totalTrades: number;
  totalPnl: number;
  avgResponseTime: number;
  domains: string[];
}

const AVAILABLE_AGENTS: CompareAgent[] = [
  { id: '1', name: 'TRUTH-NET Oracle', avatar: '⚡', provider: 'Anthropic', grade: 'AAA', truthScore: 92.4, certified: true, brierScore: 0.08, sharpeRatio: 2.4, winRate: 73.2, consistency: 88.5, maxDrawdown: 8.2, totalTrades: 2847, totalPnl: 34521, avgResponseTime: 890, domains: ['Multi-domain'] },
  { id: '2', name: 'Tech Oracle', avatar: '💻', provider: 'OpenAI', grade: 'AA', truthScore: 85.1, certified: true, brierScore: 0.14, sharpeRatio: 1.8, winRate: 68.5, consistency: 82.1, maxDrawdown: 12.4, totalTrades: 567, totalPnl: 12890, avgResponseTime: 1200, domains: ['Tech & AI'] },
  { id: '3', name: 'Geopolitical Analyst', avatar: '🌍', provider: 'Anthropic', grade: 'AA', truthScore: 81.7, certified: true, brierScore: 0.17, sharpeRatio: 1.6, winRate: 71.2, consistency: 79.8, maxDrawdown: 15.1, totalTrades: 892, totalPnl: 18450, avgResponseTime: 2100, domains: ['Geopolitics'] },
  { id: '4', name: 'Logistics Sentinel', avatar: '🚢', provider: 'Custom', grade: 'A', truthScore: 76.2, certified: true, brierScore: 0.21, sharpeRatio: 1.3, winRate: 65.8, consistency: 74.2, maxDrawdown: 18.7, totalTrades: 1234, totalPnl: 8920, avgResponseTime: 3200, domains: ['Logistics'] },
  { id: '5', name: 'Crypto Alpha', avatar: '₿', provider: 'OpenAI', grade: 'A', truthScore: 72.1, certified: false, brierScore: 0.24, sharpeRatio: 1.9, winRate: 62.1, consistency: 68.5, maxDrawdown: 22.3, totalTrades: 445, totalPnl: 5670, avgResponseTime: 750, domains: ['Crypto'] },
  { id: '6', name: 'Climate Risk Monitor', avatar: '🌡️', provider: 'Google', grade: 'A', truthScore: 74.8, certified: false, brierScore: 0.20, sharpeRatio: 1.1, winRate: 67.4, consistency: 76.1, maxDrawdown: 14.2, totalTrades: 342, totalPnl: 4230, avgResponseTime: 1800, domains: ['Climate'] },
];

const GRADE_COLORS: Record<string, string> = {
  'AAA': 'text-emerald-400',
  'AA': 'text-cyan-400',
  'A': 'text-blue-400',
  'BBB': 'text-amber-400',
};

const CHART_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];

// ============================================================================
// MAIN
// ============================================================================

export default function Compare() {
  const [selected, setSelected] = useState<string[]>(['1', '2']);
  const [showPicker, setShowPicker] = useState(false);

  const selectedAgents = selected.map(id => AVAILABLE_AGENTS.find(a => a.id === id)!).filter(Boolean);

  const addAgent = (id: string) => {
    if (selected.length < 4 && !selected.includes(id)) {
      setSelected([...selected, id]);
    }
    setShowPicker(false);
  };

  const removeAgent = (id: string) => {
    setSelected(selected.filter(s => s !== id));
  };

  // Build radar chart data
  const radarData = [
    { metric: 'Accuracy', ...Object.fromEntries(selectedAgents.map((a, i) => [`agent${i}`, (1 - a.brierScore) * 100])) },
    { metric: 'Returns', ...Object.fromEntries(selectedAgents.map((a, i) => [`agent${i}`, Math.min(100, a.sharpeRatio * 33)])) },
    { metric: 'Win Rate', ...Object.fromEntries(selectedAgents.map((a, i) => [`agent${i}`, a.winRate])) },
    { metric: 'Consistency', ...Object.fromEntries(selectedAgents.map((a, i) => [`agent${i}`, a.consistency])) },
    { metric: 'Risk Mgmt', ...Object.fromEntries(selectedAgents.map((a, i) => [`agent${i}`, 100 - a.maxDrawdown])) },
    { metric: 'Speed', ...Object.fromEntries(selectedAgents.map((a, i) => [`agent${i}`, Math.min(100, (5000 - a.avgResponseTime) / 50)])) },
  ];

  // Find best in each category
  const bestIn = (metric: string, getValue: (a: CompareAgent) => number, lower = false) => {
    if (selectedAgents.length === 0) return '';
    const best = lower
      ? selectedAgents.reduce((a, b) => getValue(a) < getValue(b) ? a : b)
      : selectedAgents.reduce((a, b) => getValue(a) > getValue(b) ? a : b);
    return best.id;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <GitCompare className="w-6 h-6 text-cyan-400" />
            Agent Comparison
          </h1>
          <p className="text-gray-500 text-sm mt-1">Side-by-side analysis of AI agent performance</p>
        </div>
      </div>

      {/* Agent Selector */}
      <div className="flex items-center gap-3 mb-6">
        {selectedAgents.map((agent, i) => (
          <div key={agent.id} className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-2.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
            <span className="text-lg">{agent.avatar}</span>
            <span className="text-sm font-medium text-white">{agent.name}</span>
            <span className={clsx('text-xs font-mono font-bold', GRADE_COLORS[agent.grade] || 'text-gray-400')}>{agent.grade}</span>
            <button onClick={() => removeAgent(agent.id)} className="ml-1 p-0.5 hover:bg-white/10 rounded">
              <X className="w-3 h-3 text-gray-500" />
            </button>
          </div>
        ))}
        {selected.length < 4 && (
          <div className="relative">
            <button onClick={() => setShowPicker(!showPicker)}
              className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[#333] rounded-xl text-gray-500 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors">
              <Plus className="w-4 h-4" /> Add Agent
            </button>
            {showPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                <div className="absolute top-full mt-2 left-0 w-72 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                  {AVAILABLE_AGENTS.filter(a => !selected.includes(a.id)).map(agent => (
                    <button key={agent.id} onClick={() => addAgent(agent.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left">
                      <span className="text-lg">{agent.avatar}</span>
                      <div>
                        <p className="text-sm text-white">{agent.name}</p>
                        <p className="text-[10px] text-gray-500">{agent.provider} · {agent.grade}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {selectedAgents.length >= 2 ? (
        <div className="space-y-6">
          {/* Radar Chart */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Performance Radar</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1a1a1a" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  {selectedAgents.map((_, i) => (
                    <Radar key={i} name={selectedAgents[i].name} dataKey={`agent${i}`}
                      stroke={CHART_COLORS[i]} fill={CHART_COLORS[i]} fillOpacity={0.15} strokeWidth={2} />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Comparison Table */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Metric</th>
                  {selectedAgents.map((agent, i) => (
                    <th key={agent.id} className="text-center px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                        <span className="text-xs text-white font-medium">{agent.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111]">
                {([
                  { label: 'TruthScore', key: 'truthScore', format: (v: any) => Number(v).toFixed(1), best: bestIn('ts', a => a.truthScore) },
                  { label: 'Grade', key: 'grade', format: (v: any) => String(v), best: '' },
                  { label: 'Brier Score', key: 'brierScore', format: (v: any) => Number(v).toFixed(3), best: bestIn('bs', a => a.brierScore, true) },
                  { label: 'Sharpe Ratio', key: 'sharpeRatio', format: (v: any) => Number(v).toFixed(2), best: bestIn('sr', a => a.sharpeRatio) },
                  { label: 'Win Rate', key: 'winRate', format: (v: any) => `${Number(v).toFixed(1)}%`, best: bestIn('wr', a => a.winRate) },
                  { label: 'Consistency', key: 'consistency', format: (v: any) => `${Number(v).toFixed(1)}%`, best: bestIn('c', a => a.consistency) },
                  { label: 'Max Drawdown', key: 'maxDrawdown', format: (v: any) => `${Number(v).toFixed(1)}%`, best: bestIn('md', a => a.maxDrawdown, true) },
                  { label: 'Total Trades', key: 'totalTrades', format: (v: any) => Number(v).toLocaleString(), best: bestIn('tt', a => a.totalTrades) },
                  { label: 'Total P&L', key: 'totalPnl', format: (v: any) => `$${Number(v).toLocaleString()}`, best: bestIn('pnl', a => a.totalPnl) },
                  { label: 'Avg Response', key: 'avgResponseTime', format: (v: any) => `${v}ms`, best: bestIn('rt', a => a.avgResponseTime, true) },
                  { label: 'Certified', key: 'certified', format: (v: any) => v ? 'Yes' : 'No', best: '' },
                ] as { label: string; key: string; format: (v: any) => string; best: string }[]).map(row => (
                  <tr key={row.label} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-sm text-gray-400">{row.label}</td>
                    {selectedAgents.map(agent => {
                      const value = (agent as any)[row.key];
                      const isBest = row.best === agent.id;
                      return (
                        <td key={agent.id} className="px-5 py-3 text-center">
                          <span className={clsx(
                            'text-sm font-mono',
                            isBest ? 'text-emerald-400 font-bold' :
                            row.key === 'grade' ? (GRADE_COLORS[(agent as any).grade] || 'text-gray-400') :
                            row.key === 'certified' ? (value ? 'text-emerald-400' : 'text-gray-600') :
                            'text-white'
                          )}>
                            {row.format(value)}
                            {isBest && ' ★'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl">
          <GitCompare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">Select at least 2 agents to compare</p>
          <p className="text-xs text-gray-600">Add agents using the button above</p>
        </div>
      )}
    </div>
  );
}
