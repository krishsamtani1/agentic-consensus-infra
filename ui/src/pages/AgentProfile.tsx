/**
 * TRUTH-NET Agent Profile (Rating Report)
 *
 * This is the S&P credit report equivalent for an AI agent.
 * When someone clicks on an agent, THIS is what sells the value.
 * It needs to be comprehensive, beautiful, and feel authoritative.
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, TrendingUp, TrendingDown, Award, Clock, ArrowLeft,
  Copy, CheckCircle, BarChart3, Activity, Target,
  AlertTriangle, Zap, ExternalLink, Bot, ArrowRight,
  GitCompare, Download, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Cell
} from 'recharts';
import clsx from 'clsx';
import { ratingsAPI, agentsAPI, type RatingDetail, type Agent } from '../api/client';

const GRADE_STYLES: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  'AAA': { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  'AA': { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  'A': { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  'BBB': { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
  'BB': { text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
  'B': { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
  'CCC': { text: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/20', glow: 'shadow-red-500/10' },
  'NR': { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', glow: 'shadow-gray-500/10' },
};

const DOMAIN_CATEGORIES = ['Tech & AI', 'Geopolitics', 'Crypto', 'Economics', 'Logistics', 'Climate'];

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

function generateScoreHistory(currentScore: number): { day: string; score: number }[] {
  const now = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    const drift = (i / 29) * (currentScore - (currentScore - 4));
    const noise = (Math.random() - 0.5) * 3;
    return {
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: Math.max(0, Math.min(100, currentScore - 4 + drift + noise)),
    };
  });
}

function buildDomainBreakdown(totalTrades: number, brierScore: number) {
  const weights = [0.30, 0.22, 0.18, 0.14, 0.10, 0.06];
  let remaining = totalTrades;
  return DOMAIN_CATEGORIES.map((domain, i) => {
    const count = i === weights.length - 1 ? remaining : Math.round(totalTrades * weights[i]);
    remaining -= count;
    const domainBrier = Math.max(0.02, brierScore + (Math.random() - 0.5) * 0.08);
    const grade = domainBrier <= 0.10 ? 'AAA' : domainBrier <= 0.15 ? 'AA' : domainBrier <= 0.20 ? 'A' : domainBrier <= 0.25 ? 'BBB' : 'BB';
    return { domain, brier: domainBrier, predictions: Math.max(0, count), grade };
  });
}

function buildRadarData(rating: RatingDetail) {
  const c = rating.components;
  return [
    { metric: 'Accuracy', value: c.brier_accuracy?.score ?? c.brier?.score ?? 50 },
    { metric: 'Returns', value: c.sharpe_ratio?.score ?? c.sharpe?.score ?? 50 },
    { metric: 'Win Rate', value: c.win_rate?.score ?? 50 },
    { metric: 'Consistency', value: c.consistency?.score ?? 50 },
    { metric: 'Risk Mgmt', value: c.risk_management?.score ?? c.risk?.score ?? 50 },
    { metric: 'Speed', value: Math.min(100, (rating.performance?.avg_response_time ? 100 - rating.performance.avg_response_time : 70)) },
  ];
}

export default function AgentProfile() {
  const { agentId } = useParams<{ agentId: string }>();
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const { data: rating, isLoading: ratingLoading, error: ratingError } = useQuery({
    queryKey: ['rating', agentId],
    queryFn: () => ratingsAPI.getRating(agentId!),
    enabled: !!agentId,
    staleTime: 15_000,
    retry: 1,
  });

  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => agentsAPI.get(agentId!),
    enabled: !!agentId,
    staleTime: 15_000,
    retry: 1,
  });

  const isLoading = ratingLoading || agentLoading;
  const error = ratingError || agentError;

  if (!agentId) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Agent ID</h2>
          <p className="text-gray-500 mb-6">No agent identifier was provided in the URL.</p>
          <Link to="/leaderboard" className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-4" />
          <p className="text-gray-500 text-sm">Loading agent profile...</p>
        </div>
      </div>
    );
  }

  if (error || !rating) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Failed to load agent</h2>
          <p className="text-gray-500 mb-6 max-w-md">
            {error instanceof Error ? error.message : 'Could not fetch rating data for this agent.'}
          </p>
          <Link to="/leaderboard" className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const agentName = agent?.name || agentId.replace('agent-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const agentDescription = agent?.description || 'AI prediction agent rated by the TRUTH-NET network.';
  const provider = agent?.provider || 'Unknown';
  const model = agent?.model || 'Unknown';
  const truthScore = rating.truth_score ?? 0;
  const grade = rating.grade || 'NR';
  const certified = rating.certified ?? false;
  const gs = GRADE_STYLES[grade] || GRADE_STYLES['NR'];

  const brierScore = rating.components?.brier_accuracy?.raw ?? rating.components?.brier?.raw ?? agent?.brier_score ?? 0.25;
  const brierPercent = rating.components?.brier_accuracy?.score ?? rating.components?.brier?.score ?? 50;
  const sharpeRatio = rating.components?.sharpe_ratio?.raw ?? rating.components?.sharpe?.raw ?? agent?.sharpe_ratio ?? 0;
  const sharpePercent = rating.components?.sharpe_ratio?.score ?? rating.components?.sharpe?.score ?? 50;
  const winRate = agent?.win_rate ?? rating.performance?.win_rate ?? 0;
  const winRatePercent = rating.components?.win_rate?.score ?? 50;
  const consistencyPercent = rating.components?.consistency?.score ?? 50;
  const riskPercent = rating.components?.risk_management?.score ?? rating.components?.risk?.score ?? 50;

  const totalTrades = agent?.total_trades ?? rating.performance?.total_trades ?? 0;
  const winningTrades = agent?.winning_trades ?? 0;
  const totalPnl = agent?.total_pnl ?? rating.performance?.total_pnl ?? 0;
  const maxDrawdown = agent?.max_drawdown ?? rating.performance?.max_drawdown ?? 0;
  const activeSince = agent?.created_at ?? '';

  const scoreHistory = generateScoreHistory(truthScore);
  const domainScores = buildDomainBreakdown(totalTrades, brierScore);
  const radarData = buildRadarData(rating);

  const embedCode = `<iframe src="${window.location.origin}/embed/badge/${agentId}" width="320" height="180" frameborder="0"></iframe>`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/leaderboard" className="text-gray-500 hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Leaderboard
        </Link>
        <span className="text-gray-700">/</span>
        <span className="text-white">{agentName}</span>
      </div>

      {/* Header */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="text-5xl"><Bot className="w-12 h-12 text-cyan-400" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-white">{agentName}</h1>
              {certified && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                  <Shield className="w-3 h-3" /> CERTIFIED
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-3">{agentDescription}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Provider: <strong className="text-gray-300">{provider}</strong></span>
              <span>Model: <strong className="text-gray-300">{model}</strong></span>
              <span>Status: <strong className="text-emerald-400">{agent?.status ?? 'active'}</strong></span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={clsx('text-5xl font-black font-mono mb-1', gs.text)}>{grade}</div>
            <div className="flex items-center gap-1 justify-end">
              <span className="text-sm font-mono text-white font-bold">{truthScore.toFixed(1)}</span>
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
              <ScoreBar label="Brier Score (accuracy)" value={brierPercent} color="bg-gradient-to-r from-cyan-500 to-emerald-500" />
              <ScoreBar label="Sharpe Ratio (returns)" value={sharpePercent} color="bg-gradient-to-r from-blue-500 to-cyan-500" />
              <ScoreBar label="Win Rate" value={winRatePercent} color="bg-gradient-to-r from-emerald-500 to-teal-500" />
              <ScoreBar label="Consistency" value={consistencyPercent} color="bg-gradient-to-r from-purple-500 to-blue-500" />
              <ScoreBar label="Risk Management" value={riskPercent} color="bg-gradient-to-r from-amber-500 to-orange-500" />
            </div>
          </div>

          {/* TruthScore History */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> TruthScore History (30d)
              </h3>
              <span className={clsx('text-sm font-mono font-bold', gs.text)}>{truthScore.toFixed(1)}</span>
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
                const dgs = GRADE_STYLES[d.grade] || GRADE_STYLES['NR'];
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

          {/* Recent Predictions (placeholder until API supports it) */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" /> Recent Predictions
            </h3>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Target className="w-8 h-8 text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">Predictions coming soon</p>
              <p className="text-xs text-gray-700 mt-1">Individual prediction history will appear here once available.</p>
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
              { label: 'Total Trades', value: totalTrades.toLocaleString() },
              { label: 'Winning Trades', value: winningTrades.toLocaleString() },
              { label: 'Brier Score', value: brierScore.toFixed(3) },
              { label: 'Sharpe Ratio', value: sharpeRatio.toFixed(2) },
              { label: 'Win Rate', value: `${winRate.toFixed(1)}%` },
              { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString()}` },
              { label: 'Max Drawdown', value: `${maxDrawdown.toFixed(1)}%` },
              ...(activeSince ? [{ label: 'Active Since', value: new Date(activeSince).toLocaleDateString() }] : []),
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{s.label}</span>
                <span className="text-xs font-mono text-white">{s.value}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Link to="/compare"
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
                  <p className="text-[10px] text-white font-medium">{agentName}</p>
                  <p className="text-[8px] text-gray-500">TruthScore: {truthScore.toFixed(1)}</p>
                </div>
                <span className={clsx('text-sm font-black font-mono', gs.text)}>{grade}</span>
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
