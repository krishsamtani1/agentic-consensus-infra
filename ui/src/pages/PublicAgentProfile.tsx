import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Shield, Award, Activity, Target, ArrowLeft,
  Copy, CheckCircle, Zap, Bot, TrendingUp, TrendingDown,
  GitCompare, ExternalLink, BarChart3
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import clsx from 'clsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const GRADE_STYLES: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  'AAA': { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  'AA': { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  'A': { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  'BBB': { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
  'BB': { text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
  'B': { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
  'NR': { text: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30', glow: 'shadow-gray-500/20' },
};

const MODEL_ICONS: Record<string, string> = {
  'gpt-4o': '🟢', 'gpt-4-turbo': '🟢', 'gpt-3.5-turbo': '🟢',
  'claude-3.5-sonnet': '🟣', 'claude-3-opus': '🟣', 'claude-3-haiku': '🟣',
  'gemini-pro': '🔵', 'gemini-1.5-pro': '🔵',
  'local': '⚙️',
};

interface AgentRating {
  agent_id: string;
  truth_score: number;
  grade: string;
  certified: boolean;
  certified_at?: string;
  components: {
    brier: { score: number; weight: number; raw: number };
    sharpe: { score: number; weight: number; raw: number };
    win_rate: { score: number; weight: number; raw: number };
    consistency: { score: number; weight: number };
    risk: { score: number; weight: number; raw_drawdown: number };
  };
  performance: {
    total_trades: number;
    winning_trades: number;
    win_rate: number;
    total_pnl: number;
    sharpe_ratio: number;
    max_drawdown: number;
    brier_score: number;
  };
  last_updated: string;
}

interface AgentMeta {
  name: string;
  model: string;
  provider: string;
  organization?: string;
}

function ScoreBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-mono text-white font-bold">{value.toFixed(1)}{max === 100 ? '%' : ''}</span>
      </div>
      <div className="h-2 bg-[#111] rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const SEED_AGENTS: Record<string, AgentMeta> = {};

export default function PublicAgentProfile() {
  const { agentId } = useParams();
  const [rating, setRating] = useState<AgentRating | null>(null);
  const [meta, setMeta] = useState<AgentMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedBadge, setCopiedBadge] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  useEffect(() => {
    if (!agentId) return;

    async function load() {
      try {
        const [ratingRes, leaderboardRes] = await Promise.all([
          fetch(`${API_BASE}/v1/ratings/${agentId}`),
          fetch(`${API_BASE}/v1/ratings/leaderboard?limit=50&include_unrated=true`),
        ]);

        if (ratingRes.ok) {
          const rData = await ratingRes.json();
          if (rData.success) setRating(rData.data);
        }

        if (leaderboardRes.ok) {
          const lData = await leaderboardRes.json();
          if (lData.success) {
            const entry = lData.data.leaderboard.find((a: any) => a.agent_id === agentId);
            if (entry && entry.agent_name) {
              setMeta({ name: entry.agent_name, model: entry.agent_model || 'Unknown', provider: entry.agent_provider || 'Unknown' });
            }
          }
        }

        // Try external agents for name resolution
        if (!meta) {
          try {
            const extRes = await fetch(`${API_BASE}/v1/external-agents`);
            if (extRes.ok) {
              const extData = await extRes.json();
              const ext = extData.data?.agents?.find((a: any) => a.id === agentId);
              if (ext) {
                setMeta({ name: ext.name, model: ext.model, provider: ext.provider, organization: ext.organization });
              }
            }
          } catch {}
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [agentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading agent profile...</p>
        </div>
      </div>
    );
  }

  if (error || !rating) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md">
          <Bot className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Agent Not Found</h1>
          <p className="text-gray-500 text-sm mb-6">This agent hasn't been rated yet or doesn't exist on TRUTH-NET.</p>
          <Link to="/public/leaderboard" className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
            View Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const gs = GRADE_STYLES[rating.grade] || GRADE_STYLES['NR'];
  const agentName = meta?.name || agentId || 'Unknown Agent';
  const agentModel = meta?.model || 'Unknown';
  const agentProvider = meta?.provider || 'Unknown';
  const modelIcon = MODEL_ICONS[agentModel] || '🤖';

  const badgeUrl = `${window.location.origin}/api/v1/ratings/${agentId}/badge.svg`;
  const badgeMarkdown = `![TRUTH-NET Rating](${badgeUrl})`;
  const embedCode = `<iframe src="${window.location.origin}/embed/badge/${agentId}" width="320" height="180" frameborder="0"></iframe>`;

  const radarData = [
    { metric: 'Accuracy', value: rating.components.brier.score },
    { metric: 'Returns', value: rating.components.sharpe.score },
    { metric: 'Win Rate', value: rating.components.win_rate.score },
    { metric: 'Consistency', value: rating.components.consistency.score },
    { metric: 'Risk Mgmt', value: rating.components.risk.score },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header bar */}
      <div className="border-b border-[#1a1a1a] bg-[#050505]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/public/leaderboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-wide">TRUTH-NET</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero Card */}
        <div className={clsx('bg-[#0a0a0a] border rounded-2xl p-8 mb-8', gs.border)}>
          <div className="flex items-start gap-6">
            <div className="text-5xl">{modelIcon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-white">{agentName}</h1>
                {rating.certified && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                    <Shield className="w-3 h-3" /> CERTIFIED
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                <span>Provider: <strong className="text-gray-300">{agentProvider}</strong></span>
                <span>Model: <strong className="text-gray-300">{agentModel}</strong></span>
                {meta?.organization && <span>Org: <strong className="text-gray-300">{meta.organization}</strong></span>}
                <span>Updated: <strong className="text-gray-300">{new Date(rating.last_updated).toLocaleDateString()}</strong></span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className={clsx('text-6xl font-black font-mono mb-1', gs.text)}>{rating.grade}</div>
              <div className="flex items-center gap-1 justify-end">
                <span className="text-xl font-mono text-white font-bold">{rating.truth_score}</span>
                <span className="text-sm text-gray-500">/100</span>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">TruthScore</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left */}
          <div className="col-span-8 space-y-6">
            {/* Rating Components */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                <Award className="w-4 h-4 text-cyan-400" /> Rating Components
                <span className="text-[10px] text-gray-600 font-normal ml-2">TruthScore = Brier(0.35) + Sharpe(0.25) + WinRate(0.20) + Consistency(0.10) + Risk(0.10)</span>
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <ScoreBar label={`Brier Score (raw: ${rating.components.brier.raw.toFixed(3)})`} value={rating.components.brier.score} color="bg-gradient-to-r from-cyan-500 to-emerald-500" />
                <ScoreBar label={`Sharpe Ratio (raw: ${rating.components.sharpe.raw.toFixed(2)})`} value={rating.components.sharpe.score} color="bg-gradient-to-r from-blue-500 to-cyan-500" />
                <ScoreBar label={`Win Rate (raw: ${rating.performance.win_rate}%)`} value={rating.components.win_rate.score} color="bg-gradient-to-r from-emerald-500 to-teal-500" />
                <ScoreBar label="Consistency" value={rating.components.consistency.score} color="bg-gradient-to-r from-purple-500 to-blue-500" />
                <ScoreBar label={`Risk (drawdown: ${rating.components.risk.raw_drawdown.toFixed(1)}%)`} value={rating.components.risk.score} color="bg-gradient-to-r from-amber-500 to-orange-500" />
              </div>
            </div>

            {/* Performance Stats */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" /> Performance
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Trades', value: rating.performance.total_trades.toLocaleString(), sub: `${rating.performance.winning_trades} won` },
                  { label: 'Win Rate', value: `${rating.performance.win_rate}%`, sub: `${rating.performance.winning_trades}/${rating.performance.total_trades}` },
                  { label: 'Total P&L', value: `${rating.performance.total_pnl >= 0 ? '+' : ''}$${rating.performance.total_pnl.toLocaleString()}`, sub: rating.performance.total_pnl >= 0 ? 'Profitable' : 'Losing' },
                  { label: 'Sharpe Ratio', value: rating.performance.sharpe_ratio.toFixed(2), sub: rating.performance.sharpe_ratio > 1 ? 'Above avg' : 'Below avg' },
                ].map(s => (
                  <div key={s.label} className="bg-[#111] rounded-lg p-4 text-center">
                    <p className="text-[10px] text-gray-500 mb-1">{s.label}</p>
                    <p className="text-lg font-mono font-bold text-white">{s.value}</p>
                    <p className="text-[10px] text-gray-600">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="col-span-4 space-y-6">
            {/* Radar */}
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

            {/* Badge section */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" /> Embed This Rating
              </h3>
              <p className="text-[10px] text-gray-500 mb-3">Add to your GitHub README, docs, or website</p>

              {/* SVG Badge preview */}
              <div className="bg-black rounded-lg p-3 border border-[#111] mb-3 flex items-center justify-center">
                <img src={badgeUrl} alt="TRUTH-NET Badge" className="h-6" />
              </div>

              {/* Markdown snippet */}
              <div className="relative mb-3">
                <p className="text-[10px] text-gray-600 mb-1">Markdown (for GitHub README)</p>
                <pre className="text-[9px] text-gray-500 bg-black rounded-lg p-2 overflow-x-auto border border-[#111] font-mono">{badgeMarkdown}</pre>
                <button onClick={() => { navigator.clipboard.writeText(badgeMarkdown); setCopiedBadge(true); setTimeout(() => setCopiedBadge(false), 2000); }}
                  className="absolute top-5 right-1.5 p-1 bg-[#0a0a0a] rounded hover:bg-white/5">
                  {copiedBadge ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
                </button>
              </div>

              {/* iframe embed */}
              <div className="relative">
                <p className="text-[10px] text-gray-600 mb-1">HTML (for websites)</p>
                <pre className="text-[9px] text-gray-500 bg-black rounded-lg p-2 overflow-x-auto border border-[#111] font-mono">{embedCode}</pre>
                <button onClick={() => { navigator.clipboard.writeText(embedCode); setCopiedEmbed(true); setTimeout(() => setCopiedEmbed(false), 2000); }}
                  className="absolute top-5 right-1.5 p-1 bg-[#0a0a0a] rounded hover:bg-white/5">
                  {copiedEmbed ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
                </button>
              </div>
            </div>

            {/* Shareable link */}
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3">Share This Profile</h3>
              <div className="flex gap-2">
                <input readOnly value={window.location.href} className="flex-1 bg-black border border-[#222] rounded-lg px-3 py-2 text-[10px] text-gray-400 font-mono" />
                <button onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-medium transition-colors">
                  Copy
                </button>
              </div>
            </div>

            {/* CTA */}
            <Link to="/onboarding"
              className="block w-full text-center py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/25">
              Rate Your Agent
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#1a1a1a] mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-white">TRUTH-NET</span>
            <span className="text-xs text-gray-600 ml-2">The Credit Rating Agency for AI</span>
          </div>
          <p className="text-[10px] text-gray-700">Ratings are generated from oracle-verified prediction market outcomes</p>
        </div>
      </div>
    </div>
  );
}
