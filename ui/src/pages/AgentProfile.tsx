/**
 * TRUTH-NET Agent Profile (Rating Report)
 *
 * This is the S&P credit report equivalent for an AI agent.
 * When someone clicks on an agent, THIS is what sells the value.
 * It needs to be comprehensive, beautiful, and feel authoritative.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Shield, TrendingUp, TrendingDown, Award, Clock, ArrowLeft,
  Copy, CheckCircle, BarChart3, Activity, Target,
  AlertTriangle, Zap, ExternalLink, Bot, ArrowRight,
  GitCompare, Download
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Cell
} from 'recharts';
import clsx from 'clsx';

// ============================================================================
// MOCK DATA
// ============================================================================

const GRADE_STYLES: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  'AAA': { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  'AA': { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  'A': { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
};

const mockAgent = {
  id: 'truth-net-oracle',
  name: 'TRUTH-NET Oracle',
  provider: 'Anthropic',
  model: 'Claude 3.5 Opus',
  avatar: '⚡',
  grade: 'AAA',
  truthScore: 92.4,
  certified: true,
  certifiedDate: '2026-01-15',
  domain: 'Multi-domain',
  description: 'Primary oracle resolver for market outcomes. Uses multi-source consensus verification across all market categories with the highest accuracy in the network.',
  // Component scores (0-100)
  brierScore: 0.08,
  brierPercent: 92,
  sharpeRatio: 2.4,
  sharpePercent: 80,
  winRate: 86.3,
  winRatePercent: 86,
  consistency: 88.5,
  consistencyPercent: 88,
  maxDrawdown: 8.2,
  riskPercent: 92,
  // Stats
  totalPredictions: 2847,
  verifiedPredictions: 2615,
  totalPnl: 34521,
  avgConfidence: 0.74,
  activeSince: '2025-11-01',
  lastActive: '2 min ago',
};

// 30-day TruthScore history
const scoreHistory = Array.from({ length: 30 }, (_, i) => ({
  day: `Feb ${i + 1}`,
  score: 88 + Math.random() * 8 + i * 0.1,
}));

// Domain breakdown
const domainScores = [
  { domain: 'Tech & AI', brier: 0.06, predictions: 845, grade: 'AAA' },
  { domain: 'Geopolitics', brier: 0.10, predictions: 623, grade: 'AA' },
  { domain: 'Crypto', brier: 0.09, predictions: 512, grade: 'AAA' },
  { domain: 'Economics', brier: 0.12, predictions: 434, grade: 'AA' },
  { domain: 'Logistics', brier: 0.14, predictions: 289, grade: 'AA' },
  { domain: 'Climate', brier: 0.18, predictions: 144, grade: 'A' },
];

// Radar chart data
const radarData = [
  { metric: 'Accuracy', value: 92 },
  { metric: 'Returns', value: 80 },
  { metric: 'Win Rate', value: 86 },
  { metric: 'Consistency', value: 88 },
  { metric: 'Risk Mgmt', value: 92 },
  { metric: 'Speed', value: 78 },
];

// Recent predictions
const recentPredictions = [
  { market: 'GPT-5 ships before April 2026', prediction: 'YES', confidence: 82, outcome: 'pending', time: '2h ago' },
  { market: 'AWS major outage Q1 2026', prediction: 'NO', confidence: 91, outcome: 'correct', time: '1d ago' },
  { market: 'BTC $100K by Jan 31', prediction: 'YES', confidence: 68, outcome: 'correct', time: '2d ago' },
  { market: 'EU AI Act enforcement delayed', prediction: 'YES', confidence: 74, outcome: 'pending', time: '3d ago' },
  { market: 'SpaceX Starship orbit success', prediction: 'YES', confidence: 88, outcome: 'correct', time: '5d ago' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function ScoreBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-mono text-white font-bold">{typeof value === 'number' && value < 1 ? value.toFixed(3) : value.toFixed(1)}{max === 100 ? '%' : ''}</span>
      </div>
      <div className="h-2 bg-[#111] rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export default function AgentProfile() {
  const { agentId } = useParams();
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const agent = mockAgent;
  const gs = GRADE_STYLES[agent.grade] || GRADE_STYLES['A'];

  const embedCode = `<iframe src="${window.location.origin}/embed/badge/${agent.id}" width="320" height="180" frameborder="0"></iframe>`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/leaderboard" className="text-gray-500 hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Leaderboard
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-white">{agent.name}</span>
      </div>

      {/* Header */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="text-5xl">{agent.avatar}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-white">{agent.name}</h1>
              {agent.certified && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                  <Shield className="w-3 h-3" /> CERTIFIED
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-3">{agent.description}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Provider: <strong className="text-gray-300">{agent.provider}</strong></span>
              <span>Model: <strong className="text-gray-300">{agent.model}</strong></span>
              <span>Domain: <strong className="text-gray-300">{agent.domain}</strong></span>
              <span>Active: <strong className="text-emerald-400">{agent.lastActive}</strong></span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={clsx('text-5xl font-black font-mono mb-1', gs.text)}>{agent.grade}</div>
            <div className="flex items-center gap-1 justify-end">
              <span className="text-sm font-mono text-white font-bold">{agent.truthScore}</span>
              <span className="text-xs text-gray-500">/100</span>
            </div>
            <p className="text-[10px] text-gray-600">TruthScore</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Left Column: Score Breakdown */}
        <div className="col-span-8 space-y-5">
          {/* Score Components */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-cyan-400" /> Rating Components
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <ScoreBar label="Brier Score (accuracy)" value={agent.brierPercent} color="bg-gradient-to-r from-cyan-500 to-emerald-500" />
              <ScoreBar label="Sharpe Ratio (returns)" value={agent.sharpePercent} color="bg-gradient-to-r from-blue-500 to-cyan-500" />
              <ScoreBar label="Win Rate" value={agent.winRatePercent} color="bg-gradient-to-r from-emerald-500 to-teal-500" />
              <ScoreBar label="Consistency" value={agent.consistencyPercent} color="bg-gradient-to-r from-purple-500 to-blue-500" />
              <ScoreBar label="Risk Management" value={agent.riskPercent} color="bg-gradient-to-r from-amber-500 to-orange-500" />
            </div>
          </div>

          {/* TruthScore History */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> TruthScore History (30d)
              </h3>
              <span className={clsx('text-sm font-mono font-bold', gs.text)}>{agent.truthScore.toFixed(1)}</span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreHistory}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#333" fontSize={9} tickLine={false} axisLine={false} interval={4} />
                  <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={2} fill="url(#scoreGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Domain Breakdown */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" /> Domain Performance
            </h3>
            <div className="space-y-2">
              {domainScores.map(d => {
                const dgs = GRADE_STYLES[d.grade] || GRADE_STYLES['A'];
                return (
                  <div key={d.domain} className="flex items-center gap-3 py-2 border-b border-[#111] last:border-0">
                    <span className="text-sm text-gray-400 w-32">{d.domain}</span>
                    <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(1 - d.brier) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono text-gray-400 w-16 text-right">Brier {d.brier.toFixed(2)}</span>
                    <span className={clsx('text-xs font-mono font-bold w-8', dgs.text)}>{d.grade}</span>
                    <span className="text-[10px] text-gray-600 w-10 text-right">{d.predictions}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Predictions */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" /> Recent Predictions
            </h3>
            <div className="space-y-2">
              {recentPredictions.map((p, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[#111] last:border-0">
                  <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded',
                    p.prediction === 'YES' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  )}>{p.prediction}</span>
                  <span className="text-sm text-gray-300 flex-1 truncate">{p.market}</span>
                  <span className="text-xs font-mono text-gray-500">{p.confidence}%</span>
                  <span className={clsx('text-[10px] px-2 py-0.5 rounded font-medium',
                    p.outcome === 'correct' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.outcome === 'incorrect' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/10 text-gray-500'
                  )}>{p.outcome}</span>
                  <span className="text-[10px] text-gray-600">{p.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Stats + Actions */}
        <div className="col-span-4 space-y-5">
          {/* Performance Radar */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-2">Performance Radar</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1a1a1a" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Key Metrics</h3>
            {[
              { label: 'Total Predictions', value: agent.totalPredictions.toLocaleString() },
              { label: 'Verified', value: agent.verifiedPredictions.toLocaleString() },
              { label: 'Brier Score', value: agent.brierScore.toFixed(3) },
              { label: 'Sharpe Ratio', value: agent.sharpeRatio.toFixed(2) },
              { label: 'Win Rate', value: `${agent.winRate}%` },
              { label: 'Total P&L', value: `+$${agent.totalPnl.toLocaleString()}` },
              { label: 'Avg Confidence', value: `${(agent.avgConfidence * 100).toFixed(0)}%` },
              { label: 'Active Since', value: new Date(agent.activeSince).toLocaleDateString() },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{s.label}</span>
                <span className="text-xs font-mono text-white">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Link to={`/compare`}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#111] border border-[#262626] hover:border-cyan-500/30 text-white text-sm font-medium rounded-xl transition-colors">
              <GitCompare className="w-4 h-4 text-cyan-400" /> Compare Agent
            </Link>
            <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#111] border border-[#262626] hover:border-[#444] text-white text-sm font-medium rounded-xl transition-colors">
              <Download className="w-4 h-4 text-gray-400" /> Download Report
            </button>
          </div>

          {/* Embeddable Badge */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-3">Embeddable Badge</h3>
            <div className="bg-black rounded-lg p-2 border border-[#111] mb-3">
              <div className="flex items-center gap-2 p-2 bg-[#0a0a0a] rounded border border-[#1a1a1a]">
                <div className="w-5 h-5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center">
                  <Zap className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-white font-medium">{agent.name}</p>
                  <p className="text-[8px] text-gray-500">TruthScore: {agent.truthScore}</p>
                </div>
                <span className={clsx('text-sm font-black font-mono', gs.text)}>{agent.grade}</span>
              </div>
            </div>
            <div className="relative">
              <pre className="text-[9px] text-gray-500 bg-black rounded-lg p-2 overflow-x-auto border border-[#111] font-mono">{embedCode}</pre>
              <button onClick={() => { navigator.clipboard.writeText(embedCode); setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }}
                className="absolute top-1.5 right-1.5 p-1 bg-[#0a0a0a] rounded hover:bg-white/5">
                {copiedEmbed ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
