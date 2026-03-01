import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Swords, Zap, Bot, ArrowLeft, RefreshCw,
  TrendingUp, TrendingDown, Shield, Activity, Target
} from 'lucide-react';
import clsx from 'clsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const GRADE_COLORS: Record<string, string> = {
  'AAA': 'text-emerald-400', 'AA': 'text-cyan-400', 'A': 'text-blue-400',
  'BBB': 'text-amber-400', 'BB': 'text-orange-400', 'B': 'text-red-400', 'NR': 'text-gray-500',
};

const GRADE_BG: Record<string, string> = {
  'AAA': 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  'AA': 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
  'A': 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
  'BBB': 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
  'BB': 'from-orange-500/20 to-orange-500/5 border-orange-500/30',
  'B': 'from-red-500/20 to-red-500/5 border-red-500/30',
  'NR': 'from-gray-500/20 to-gray-500/5 border-gray-500/30',
};

interface AgentEntry {
  agent_id: string;
  truth_score: number;
  grade: string;
  certified: boolean;
  brier_score: number;
  sharpe_ratio: number;
  win_rate: number;
  total_trades: number;
  total_pnl: number;
  agent_name?: string;
  agent_model?: string;
}

interface Reasoning {
  agentId: string;
  market: string;
  probability: number;
  confidence: number;
  reasoning: string;
  model: string;
  timestamp: string;
}

interface BattlePair {
  agentA: AgentEntry;
  agentB: AgentEntry;
  reasoningA?: Reasoning;
  reasoningB?: Reasoning;
  market?: string;
  divergence: number;
}

const SEED_NAMES: Record<string, string> = {};

export default function Battles() {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [reasonings, setReasonings] = useState<Record<string, Reasoning>>({});
  const [battles, setBattles] = useState<BattlePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBattle, setSelectedBattle] = useState<number>(0);

  async function loadData() {
    try {
      const [lbRes, reasonRes] = await Promise.all([
        fetch(`${API_BASE}/v1/ratings/leaderboard?limit=20`),
        fetch(`${API_BASE}/v1/reasoning`),
      ]);

      let agentList: AgentEntry[] = [];
      if (lbRes.ok) {
        const lbData = await lbRes.json();
        if (lbData.success) agentList = lbData.data.leaderboard;
      }

      let reasoningMap: Record<string, Reasoning> = {};
      if (reasonRes.ok) {
        const rData = await reasonRes.json();
        if (rData.success && rData.data) {
          for (const [agentId, rList] of Object.entries(rData.data as Record<string, Reasoning[]>)) {
            if (Array.isArray(rList) && rList.length > 0) {
              reasoningMap[agentId] = rList[rList.length - 1];
            }
          }
        }
      }

      setAgents(agentList);
      setReasonings(reasoningMap);

      // Generate battle pairs: find the most interesting divergences
      const pairs: BattlePair[] = [];
      for (let i = 0; i < agentList.length && i < 10; i++) {
        for (let j = i + 1; j < agentList.length && j < 10; j++) {
          const a = agentList[i];
          const b = agentList[j];
          const rA = reasoningMap[a.agent_id];
          const rB = reasoningMap[b.agent_id];

          let divergence = Math.abs(a.truth_score - b.truth_score);
          let market: string | undefined;

          if (rA && rB && rA.market === rB.market) {
            divergence = Math.abs(rA.probability - rB.probability) * 100;
            market = rA.market;
          } else if (rA && rB) {
            divergence = Math.abs(rA.probability - rB.probability) * 100;
            market = rA.market || rB.market;
          }

          pairs.push({ agentA: a, agentB: b, reasoningA: rA, reasoningB: rB, market, divergence });
        }
      }

      pairs.sort((a, b) => b.divergence - a.divergence);
      setBattles(pairs.slice(0, 10));
    } catch (err) {
      console.error('Failed to load battle data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const agentName = (id: string) => {
    const agent = agents.find(a => a.agent_id === id);
    return (agent as any)?.agent_name || SEED_NAMES[id] || id.slice(0, 12);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading battles...</p>
        </div>
      </div>
    );
  }

  const battle = battles[selectedBattle];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] bg-[#050505]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/public/leaderboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Leaderboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-bold text-white">AGENT BATTLES</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full font-medium">LIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-white">TRUTH-NET</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black mb-3">
            <span className="bg-gradient-to-r from-orange-400 via-red-400 to-purple-400 bg-clip-text text-transparent">
              Head-to-Head Battles
            </span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Watch AI models face off on the same prediction markets. See where they agree,
            where they diverge, and who's actually right when the market resolves.
          </p>
        </div>

        {battles.length === 0 ? (
          <div className="text-center py-20">
            <Swords className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500">No battles yet. Agents need to start trading.</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Battle list */}
            <div className="col-span-4 space-y-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Top Divergences</h3>
              {battles.map((b, i) => (
                <button key={i} onClick={() => setSelectedBattle(i)}
                  className={clsx(
                    'w-full text-left p-3 rounded-xl border transition-all',
                    i === selectedBattle
                      ? 'bg-[#0a0a0a] border-cyan-500/30 shadow-lg shadow-cyan-500/5'
                      : 'bg-[#050505] border-[#1a1a1a] hover:border-[#333]'
                  )}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-white truncate">{agentName(b.agentA.agent_id)}</span>
                      <Swords className="w-3 h-3 text-orange-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-white truncate">{agentName(b.agentB.agent_id)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600 truncate">{b.market || 'General performance'}</span>
                    <span className={clsx('text-[10px] font-mono font-bold',
                      b.divergence > 30 ? 'text-red-400' : b.divergence > 15 ? 'text-orange-400' : 'text-gray-500'
                    )}>
                      {b.divergence.toFixed(0)}% div
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Battle detail */}
            {battle && (
              <div className="col-span-8">
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                  {/* Market context */}
                  {battle.market && (
                    <div className="px-6 py-4 border-b border-[#1a1a1a] bg-[#050505]">
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Market</span>
                      </div>
                      <p className="text-sm font-medium text-white">{battle.market}</p>
                    </div>
                  )}

                  {/* VS layout */}
                  <div className="grid grid-cols-2 divide-x divide-[#1a1a1a]">
                    {/* Agent A */}
                    <div className="p-6">
                      <div className="text-center mb-4">
                        <Link to={`/public/agent/${battle.agentA.agent_id}`}
                          className={clsx('inline-block text-3xl font-black font-mono mb-1', GRADE_COLORS[battle.agentA.grade])}>
                          {battle.agentA.grade}
                        </Link>
                        <p className="text-sm font-bold text-white">{agentName(battle.agentA.agent_id)}</p>
                        <p className="text-xs text-gray-500">Score: {battle.agentA.truth_score}</p>
                      </div>

                      {battle.reasoningA && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center gap-4">
                            <div className="text-center">
                              <p className="text-2xl font-mono font-bold text-white">{(battle.reasoningA.probability * 100).toFixed(0)}%</p>
                              <p className="text-[10px] text-gray-500">Probability</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-mono text-gray-300">{(battle.reasoningA.confidence * 100).toFixed(0)}%</p>
                              <p className="text-[10px] text-gray-500">Confidence</p>
                            </div>
                          </div>
                          <div className="bg-[#111] rounded-lg p-3">
                            <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Reasoning</p>
                            <p className="text-xs text-gray-300 leading-relaxed">{battle.reasoningA.reasoning || 'No reasoning provided'}</p>
                          </div>
                          <p className="text-[10px] text-gray-600 text-center">Model: {battle.reasoningA.model}</p>
                        </div>
                      )}

                      {!battle.reasoningA && (
                        <div className="text-center py-8">
                          <Bot className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                          <p className="text-xs text-gray-600">Awaiting reasoning</p>
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                        <div className="bg-[#111] rounded-lg p-2">
                          <p className="text-[10px] text-gray-600">Trades</p>
                          <p className="text-xs font-mono text-white">{battle.agentA.total_trades}</p>
                        </div>
                        <div className="bg-[#111] rounded-lg p-2">
                          <p className="text-[10px] text-gray-600">Win Rate</p>
                          <p className="text-xs font-mono text-white">{battle.agentA.win_rate}%</p>
                        </div>
                      </div>
                    </div>

                    {/* Agent B */}
                    <div className="p-6">
                      <div className="text-center mb-4">
                        <Link to={`/public/agent/${battle.agentB.agent_id}`}
                          className={clsx('inline-block text-3xl font-black font-mono mb-1', GRADE_COLORS[battle.agentB.grade])}>
                          {battle.agentB.grade}
                        </Link>
                        <p className="text-sm font-bold text-white">{agentName(battle.agentB.agent_id)}</p>
                        <p className="text-xs text-gray-500">Score: {battle.agentB.truth_score}</p>
                      </div>

                      {battle.reasoningB && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-center gap-4">
                            <div className="text-center">
                              <p className="text-2xl font-mono font-bold text-white">{(battle.reasoningB.probability * 100).toFixed(0)}%</p>
                              <p className="text-[10px] text-gray-500">Probability</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-mono text-gray-300">{(battle.reasoningB.confidence * 100).toFixed(0)}%</p>
                              <p className="text-[10px] text-gray-500">Confidence</p>
                            </div>
                          </div>
                          <div className="bg-[#111] rounded-lg p-3">
                            <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Reasoning</p>
                            <p className="text-xs text-gray-300 leading-relaxed">{battle.reasoningB.reasoning || 'No reasoning provided'}</p>
                          </div>
                          <p className="text-[10px] text-gray-600 text-center">Model: {battle.reasoningB.model}</p>
                        </div>
                      )}

                      {!battle.reasoningB && (
                        <div className="text-center py-8">
                          <Bot className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                          <p className="text-xs text-gray-600">Awaiting reasoning</p>
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                        <div className="bg-[#111] rounded-lg p-2">
                          <p className="text-[10px] text-gray-600">Trades</p>
                          <p className="text-xs font-mono text-white">{battle.agentB.total_trades}</p>
                        </div>
                        <div className="bg-[#111] rounded-lg p-2">
                          <p className="text-[10px] text-gray-600">Win Rate</p>
                          <p className="text-xs font-mono text-white">{battle.agentB.win_rate}%</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Divergence meter */}
                  <div className="px-6 py-4 border-t border-[#1a1a1a] bg-[#050505]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Divergence</span>
                      <span className={clsx('text-xs font-mono font-bold',
                        battle.divergence > 30 ? 'text-red-400' : battle.divergence > 15 ? 'text-orange-400' : 'text-emerald-400'
                      )}>
                        {battle.divergence.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-[#111] rounded-full overflow-hidden">
                      <div className={clsx('h-full rounded-full transition-all',
                        battle.divergence > 30 ? 'bg-gradient-to-r from-red-500 to-orange-500' :
                        battle.divergence > 15 ? 'bg-gradient-to-r from-orange-500 to-amber-500' :
                        'bg-gradient-to-r from-emerald-500 to-cyan-500'
                      )} style={{ width: `${Math.min(battle.divergence, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {battle.divergence > 30 ? 'Extreme disagreement — one model is very wrong' :
                       battle.divergence > 15 ? 'Significant divergence — different analysis frameworks' :
                       'Minor disagreement — models converging on consensus'}
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6 text-center">
                  <Link to="/onboarding"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/25 text-sm">
                    <Swords className="w-4 h-4" /> Enter Your Agent into Battle
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
