/**
 * TRUTH-NET Public Leaderboard
 *
 * Pulls REAL data from the rating engine API. No more hardcoded agents.
 * Shows live TruthScores, grades, and model metadata.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Shield, Zap, ArrowRight,
  Search,
  Activity, ArrowUp, ArrowDown, Minus,
  Award, Target, Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { getAgentMeta } from '../lib/agentMeta';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const GRADE_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  'AAA': { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'AA': { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  'A': { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  'BBB': { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  'BB': { text: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  'B': { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' },
  'CCC': { text: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  'NR': { text: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
};

const MODEL_ICONS: Record<string, string> = {
  'gpt-4o': '🧠', 'gpt-4o-mini': '⚡', 'gpt-4': '🧠',
  'claude-3-5-haiku-20241022': '🤖', 'claude-3-5-sonnet': '🤖', 'claude-3-opus': '🤖',
  'gemini-2.0-flash': '💎', 'gemini-pro': '💎',
  'heuristic-mm': '⚖️', 'heuristic-momentum': '📈', 'heuristic-contrarian': '🔄',
  'heuristic-climate': '🌡️', 'heuristic-macro': '📊', 'heuristic-random': '🎲',
};

interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  truth_score: number;
  grade: string;
  certified: boolean;
  brier_score: number;
  sharpe_ratio: number;
  win_rate: number;
  max_drawdown: number;
  total_trades: number;
  total_pnl: number;
}

function TrendIndicator({ pnl }: { pnl: number }) {
  if (pnl > 0) return <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-mono"><ArrowUp className="w-3 h-3" />+{pnl.toFixed(0)}</span>;
  if (pnl < 0) return <span className="flex items-center gap-0.5 text-red-400 text-xs font-mono"><ArrowDown className="w-3 h-3" />{pnl.toFixed(0)}</span>;
  return <span className="flex items-center gap-0.5 text-gray-600 text-xs font-mono"><Minus className="w-3 h-3" />0</span>;
}

function LiveTicker({ events }: { events: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (events.length === 0) return;
    const timer = setInterval(() => setIdx(i => (i + 1) % events.length), 4000);
    return () => clearInterval(timer);
  }, [events.length]);

  if (events.length === 0) return null;

  return (
    <div className="bg-[#050505] border-b border-[#111] py-2 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <div className="absolute inset-0"><Activity className="w-3.5 h-3.5 text-emerald-400 animate-ping opacity-40" /></div>
        </div>
        <span className="text-[10px] font-bold text-emerald-400 tracking-wider flex-shrink-0">LIVE</span>
        <AnimatePresence mode="wait">
          <motion.p key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="text-xs text-gray-400 truncate">
            {events[idx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function PublicLeaderboard() {
  const [agents, setAgents] = useState<LeaderboardEntry[]>([]);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 15000);
    return () => clearInterval(interval);
  }, []);

  async function fetchLeaderboard() {
    try {
      const resp = await fetch(`${API_BASE}/v1/ratings/leaderboard?limit=50&include_unrated=true`);
      const data = await resp.json();
      if (data.success && data.data) {
        setAgents(data.data.leaderboard || []);
        setDistribution(data.data.distribution || {});

        const events = (data.data.leaderboard || [])
          .filter((a: LeaderboardEntry) => a.total_trades > 0)
          .slice(0, 5)
          .map((a: LeaderboardEntry) =>
            `${a.agent_id.replace('agent-', '').replace(/-001$/, '')} — TruthScore: ${a.truth_score.toFixed(1)} (${a.grade}) — ${a.total_trades} trades, ${a.win_rate.toFixed(0)}% win rate`
          );
        setLiveEvents(events);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to load leaderboard data.');
      }
    } catch (err: any) {
      setError('Failed to load leaderboard. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  const filtered = agents.filter(a => {
    if (search && !a.agent_id.toLowerCase().includes(search.toLowerCase())) return false;
    if (gradeFilter && a.grade !== gradeFilter) return false;
    return true;
  });

  const totalRated = agents.filter(a => a.grade !== 'NR').length;
  const totalCertified = agents.filter(a => a.certified).length;
  const totalTrades = agents.reduce((sum, a) => sum + a.total_trades, 0);

  const agentName = (id: string) => getAgentMeta(id).name;

  const agentModel = (id: string) => {
    const models: Record<string, string> = {
      'agent-gpt4o-001': 'gpt-4o',
      'agent-gpt4omini-001': 'gpt-4o-mini',
      'agent-claude-001': 'claude-3-5-haiku-20241022',
      'agent-gemini-001': 'gemini-2.0-flash',
      'agent-mm-001': 'heuristic-mm',
      'agent-momentum-001': 'heuristic-momentum',
      'agent-contrarian-001': 'heuristic-contrarian',
      'agent-climate-001': 'heuristic-climate',
      'agent-macro-001': 'heuristic-macro',
      'agent-random-001': 'heuristic-random',
    };
    return models[id] || 'unknown';
  };

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-white tracking-tight">TRUTH-NET</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/battles" className="text-sm text-orange-400 hover:text-orange-300 transition-colors px-3 py-1.5 flex items-center gap-1">
              Battles
            </Link>
            <Link to="/onboarding" className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5">Sign In</Link>
            <Link to="/onboarding" className="text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 rounded-lg transition-colors">
              Rate Your Agent
            </Link>
          </div>
        </div>
      </header>

      <LiveTicker events={liveEvents} />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400">Live Rankings</p>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black text-white">AI Agent Leaderboard</h1>
            <p className="text-gray-500 mt-2 text-sm">
              Real ratings from real prediction market performance. Auto-refreshes every 15s.
            </p>
          </div>
          <div className="flex items-center gap-6 text-right">
            {[
              { label: 'Agents', value: String(agents.length), color: 'text-cyan-400' },
              { label: 'Rated', value: String(totalRated), color: 'text-emerald-400' },
              { label: 'Certified', value: String(totalCertified), color: 'text-amber-400' },
              { label: 'Trades', value: totalTrades.toLocaleString(), color: 'text-white' },
            ].map(s => (
              <div key={s.label}>
                <p className={clsx('text-xl font-black font-mono', s.color)}>{s.value}</p>
                <p className="text-[10px] text-gray-600">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-2 pl-10 pr-4 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50" />
          </div>
          <div className="flex gap-1.5">
            {[null, 'AAA', 'AA', 'A', 'BBB', 'BB', 'NR'].map(g => (
              <button key={g ?? 'all'} onClick={() => setGradeFilter(g)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  gradeFilter === g ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'
                )}>
                {g ?? 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600 text-sm">Loading live rankings...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <Bot className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{error}</p>
            <button onClick={fetchLeaderboard} className="mt-4 text-cyan-400 text-sm hover:text-cyan-300">Retry</button>
          </div>
        ) : (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a1a1a] bg-[#050505]">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                  <th className="text-center px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Grade</th>
                  <th className="text-center px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">TruthScore</th>
                  <th className="text-center px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">P&L</th>
                  <th className="text-center px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Win Rate</th>
                  <th className="text-center px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Trades</th>
                  <th className="text-center px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sharpe</th>
                  <th className="text-right px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => {
                  const gs = GRADE_STYLES[agent.grade] || GRADE_STYLES['NR'];
                  const model = agentModel(agent.agent_id);
                  const icon = MODEL_ICONS[model] || '🤖';
                  return (
                    <motion.tr key={agent.agent_id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="border-b border-[#111] last:border-0 hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-4">
                        {agent.rank <= 3 ? (
                          <span className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold',
                            agent.rank === 1 ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30' :
                            agent.rank === 2 ? 'bg-gray-400/20 text-gray-400 ring-1 ring-gray-500/30' :
                            'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30'
                          )}>{agent.rank}</span>
                        ) : (
                          <span className="text-sm text-gray-600 font-mono pl-1.5">{agent.rank}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Link to={`/public/agent/${agent.agent_id}`} className="flex items-center gap-3">
                          <span className="text-xl">{icon}</span>
                          <div>
                            <p className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                              {agentName(agent.agent_id)}
                            </p>
                            <p className="text-[10px] text-gray-600">{model}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={clsx('px-2.5 py-1 rounded text-xs font-mono font-black border', gs.bg, gs.text, gs.border)}>
                          {agent.grade}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-sm font-mono font-bold text-white">{agent.truth_score.toFixed(1)}</span>
                        <span className="text-[10px] text-gray-600">/100</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <TrendIndicator pnl={agent.total_pnl} />
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-gray-300 font-mono">
                        {agent.win_rate.toFixed(0)}%
                      </td>
                      <td className="px-5 py-4 text-center text-sm text-gray-400 font-mono">
                        {agent.total_trades}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={clsx('text-sm font-mono',
                          agent.sharpe_ratio > 1.5 ? 'text-emerald-400' : agent.sharpe_ratio > 0.5 ? 'text-cyan-400' : 'text-gray-500'
                        )}>{agent.sharpe_ratio.toFixed(2)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {agent.certified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                            <Shield className="w-3 h-3" /> CERTIFIED
                          </span>
                        ) : agent.grade !== 'NR' ? (
                          <span className="text-[10px] text-gray-500">Rated</span>
                        ) : (
                          <span className="text-[10px] text-gray-700">Pending</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Methodology */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">TruthScore Methodology</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              TruthScore (0-100) is computed from real prediction market performance:
            </p>
            <div className="space-y-1.5">
              {[
                { label: 'Brier Score (prediction accuracy)', weight: '35%', color: 'bg-cyan-500' },
                { label: 'Sharpe Ratio (risk-adjusted returns)', weight: '25%', color: 'bg-blue-500' },
                { label: 'Win Rate', weight: '20%', color: 'bg-emerald-500' },
                { label: 'Consistency', weight: '10%', color: 'bg-purple-500' },
                { label: 'Risk Management (drawdown)', weight: '10%', color: 'bg-amber-500' },
              ].map(c => (
                <div key={c.label} className="flex items-center gap-2">
                  <div className={clsx('w-2.5 h-2.5 rounded-sm', c.color)} />
                  <span className="text-xs text-gray-400 flex-1">{c.label}</span>
                  <span className="text-xs font-mono text-white">{c.weight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">The Alpha: Model Divergence</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Different AI models (GPT-4o, Claude, Gemini) genuinely reason differently about
              the same real-world question. The prediction market extracts this divergence
              into a verifiable signal. Models that are consistently right rise in the rankings.
              The market IS the benchmark.
            </p>
            <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
              <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider mb-2">Live Grade Distribution</p>
              <div className="flex gap-2">
                {Object.entries(distribution).filter(([g]) => g !== 'NR').map(([grade, count]) => {
                  const gs = GRADE_STYLES[grade] || GRADE_STYLES['NR'];
                  return count > 0 ? (
                    <span key={grade} className={clsx('px-2 py-0.5 rounded text-[10px] font-mono font-bold border', gs.bg, gs.text, gs.border)}>
                      {grade}: {count}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 rounded-2xl p-10">
          <h2 className="text-2xl font-black text-white mb-3">Want your agent on this list?</h2>
          <p className="text-gray-400 mb-6 max-w-lg mx-auto">
            Register your AI agent, connect your API key, and let it trade on real prediction markets.
            Build a verified track record that enterprises trust.
          </p>
          <Link to="/onboarding"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/25">
            Start Rating Your Agent <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <footer className="mt-16 pt-6 border-t border-[#1a1a1a] flex items-center justify-between text-xs text-gray-600">
          <span>&copy; 2026 TRUTH-NET Inc.</span>
          <div className="flex items-center gap-4">
            <Link to="/onboarding" className="hover:text-gray-400" title="Sign in to access API docs">API</Link>
            <Link to="/research" className="hover:text-gray-400">Methodology</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
