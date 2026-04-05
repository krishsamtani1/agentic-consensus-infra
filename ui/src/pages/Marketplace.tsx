/**
 * TRUTH-NET Agent Marketplace
 *
 * Think Upwork meets Bloomberg for AI agents.
 * Browse, compare, and hire TRUTH-NET rated & certified agents.
 * Revenue: listing fees, transaction cuts, premium placements.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Store, Search, Shield, TrendingUp,
  Zap, Bot,
  ArrowRight, DollarSign, Clock, Award, Eye,
  Sparkles, X, CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Link, useNavigate } from 'react-router-dom';
import { ratingsAPI, apiClient } from '../api/client';
import { getAgentMeta } from '../lib/agentMeta';

// ============================================================================
// DATA
// ============================================================================

const GRADE_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  'AAA': { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'AA': { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  'A': { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  'BBB': { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
};

const CATEGORIES = [
  { id: 'all', label: 'All Agents', count: 38 },
  { id: 'tech', label: 'Tech & AI', count: 12 },
  { id: 'geo', label: 'Geopolitics', count: 8 },
  { id: 'crypto', label: 'Crypto', count: 7 },
  { id: 'logistics', label: 'Logistics', count: 5 },
  { id: 'climate', label: 'Climate', count: 4 },
  { id: 'economics', label: 'Economics', count: 2 },
];

interface MarketplaceAgent {
  id: string;
  name: string;
  provider: string;
  avatar: string;
  grade: string;
  truthScore: number;
  certified: boolean;
  domain: string;
  category: string;
  description: string;
  pricing: string;
  pricingAmount: number;
  responseTime: string;
  accuracy: number;
  predictions: number;
  featured: boolean;
  tags: string[];
}


// ============================================================================
// AGENT CARD
// ============================================================================

function AgentCard({ agent, onHire }: { agent: MarketplaceAgent; onHire: (a: MarketplaceAgent) => void }) {
  const gs = GRADE_STYLES[agent.grade] || GRADE_STYLES['BBB'];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'bg-[#0a0a0a] border rounded-xl overflow-hidden hover:border-[#333] transition-all group',
        agent.featured ? 'border-cyan-500/30 ring-1 ring-cyan-500/10' : 'border-[#1a1a1a]'
      )}>
      {agent.featured && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-cyan-500/20 px-4 py-1.5 flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] font-bold text-cyan-400">FEATURED</span>
        </div>
      )}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl">{agent.avatar}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">{agent.name}</h3>
              {agent.certified && <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
            </div>
            <p className="text-[10px] text-gray-500">{agent.provider} · {agent.domain}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className={clsx('text-xl font-black font-mono', gs.text)}>{agent.grade}</span>
            <p className="text-[10px] text-gray-500 font-mono">{agent.truthScore.toFixed(1)}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-400 leading-relaxed mb-4 line-clamp-2">{agent.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {agent.tags.map(tag => (
            <span key={tag} className="text-[10px] px-2 py-0.5 bg-[#111] border border-[#1a1a1a] rounded text-gray-400">{tag}</span>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-3 mb-4 py-3 border-t border-b border-[#111]">
          {[
            { label: 'Accuracy', value: `${agent.accuracy}%`, icon: TrendingUp },
            { label: 'Predictions', value: agent.predictions.toLocaleString(), icon: Award },
            { label: 'Response', value: agent.responseTime, icon: Clock },
            { label: 'Price', value: agent.pricing.split('/')[0], icon: DollarSign },
          ].map(s => (
            <div key={s.label} className="text-center">
              <s.icon className="w-3 h-3 text-gray-600 mx-auto mb-1" />
              <p className="text-xs font-mono text-white font-bold">{s.value}</p>
              <p className="text-[9px] text-gray-600">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link to={`/agents/${agent.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#111] border border-[#262626] hover:border-cyan-500/30 text-white text-xs font-medium rounded-lg transition-colors">
            <Eye className="w-3 h-3" /> View Profile
          </Link>
          <button onClick={() => onHire(agent)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm">
            <Zap className="w-3 h-3" /> Hire Agent
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// HIRE MODAL
// ============================================================================

const HIRE_METHODOLOGIES = [
  { id: 'bayesian', label: 'Bayesian Updating', desc: 'Incremental evidence weighting from base rates' },
  { id: 'trend_analysis', label: 'Trend / Momentum', desc: 'Follow persistent directional moves' },
  { id: 'contrarian_analysis', label: 'Contrarian', desc: 'Fade extremes, exploit herding bias' },
  { id: 'ensemble', label: 'Ensemble Methods', desc: 'Combine multiple frameworks, weight by accuracy' },
  { id: 'expert_consensus', label: 'Expert Consensus', desc: 'Aggregate domain expert views' },
];

const HIRE_SOURCES = [
  { id: 'news', label: 'News & Headlines' },
  { id: 'filings', label: 'Financial Filings' },
  { id: 'academic', label: 'Academic Research' },
  { id: 'social_sentiment', label: 'Social Sentiment' },
  { id: 'blockchain', label: 'Blockchain / On-Chain' },
  { id: 'government', label: 'Government Data' },
  { id: 'weather', label: 'Weather / Climate' },
  { id: 'satellite', label: 'Satellite / Geospatial' },
];

function HireModal({ agent, onClose }: { agent: MarketplaceAgent; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = getAgentMeta(agent.id);
  const [step, setStep] = useState<'configure' | 'deploying' | 'success'>('configure');
  const [agentName, setAgentName] = useState(`My ${meta.name}`);
  const [methodology, setMethodology] = useState('bayesian');
  const [sources, setSources] = useState<string[]>(['news']);
  const [riskTolerance, setRiskTolerance] = useState(35);
  const [budget, setBudget] = useState(5000);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const toggleSource = (id: string) => setSources(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  const handleDeploy = async () => {
    if (!agentName.trim() || sources.length === 0) { setError('Name and at least one data source required'); return; }
    setStep('deploying'); setError(null);
    try {
      const body = {
        name: agentName.trim(),
        strategy_persona: meta.persona || 'informed',
        staked_budget: budget,
        description: `Hired from marketplace. Based on ${meta.name}. Methodology: ${methodology}. Sources: ${sources.join(', ')}.`,
        config: {
          data_sources: sources,
          methodology,
          risk_tolerance: (riskTolerance / 100).toFixed(2),
          max_position_pct: 25,
          max_exposure_pct: 80,
        },
      };
      const result = await apiClient.post<{ id: string }>('/agents', body);
      setCreatedId(result.id);
      localStorage.setItem('tn_agent_registered', 'true');
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      setStep('success');
    } catch (e: any) {
      setError(e.message || 'Failed to deploy agent');
      setStep('configure');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {step === 'success' ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Agent Deployed</h2>
            <p className="text-sm text-gray-400 mb-1">{agentName} is now live and trading.</p>
            <p className="text-xs text-gray-600 mb-6">It will appear on the leaderboard after its first trades are rated.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={onClose} className="px-4 py-2 bg-[#111] border border-[#262626] text-gray-400 text-sm rounded-lg">Close</button>
              <button onClick={() => { onClose(); navigate(`/agents/${createdId}`); }}
                className="px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg">
                View Agent
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{meta.avatar}</span>
                <div>
                  <h2 className="text-lg font-bold text-white">Hire {meta.name}</h2>
                  <p className="text-xs text-gray-500">{meta.domain} &middot; TruthScore: {agent.truthScore}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Agent Name</label>
                <input value={agentName} onChange={e => setAgentName(e.target.value)}
                  className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-3 text-white text-sm focus:border-cyan-500 focus:outline-none" />
              </div>

              {/* Methodology */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Analytical Methodology</label>
                <div className="grid grid-cols-1 gap-2">
                  {HIRE_METHODOLOGIES.map(m => (
                    <button key={m.id} onClick={() => setMethodology(m.id)}
                      className={clsx('text-left px-3 py-2.5 rounded-lg border transition-colors',
                        methodology === m.id ? 'bg-cyan-600/10 border-cyan-500/40 text-white' : 'bg-black border-[#1a1a1a] text-gray-400 hover:border-gray-600')}>
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="text-[10px] text-gray-500 ml-2">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Sources */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Data Sources</label>
                <div className="flex flex-wrap gap-2">
                  {HIRE_SOURCES.map(s => (
                    <button key={s.id} onClick={() => toggleSource(s.id)}
                      className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-colors',
                        sources.includes(s.id) ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-400' : 'bg-black border-[#1a1a1a] text-gray-500 hover:border-gray-600')}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk + Budget */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Risk Tolerance</label>
                  <input type="range" min={10} max={90} value={riskTolerance} onChange={e => setRiskTolerance(Number(e.target.value))}
                    className="w-full accent-cyan-500" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>Conservative</span>
                    <span className="text-cyan-400 font-mono">{riskTolerance}%</span>
                    <span>Aggressive</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Staking Budget</label>
                  <select value={budget} onChange={e => setBudget(Number(e.target.value))}
                    className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-3 text-white text-sm focus:border-cyan-500 focus:outline-none">
                    {[1000, 2500, 5000, 10000, 25000, 50000].map(v => (
                      <option key={v} value={v}>${v.toLocaleString()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <button onClick={handleDeploy} disabled={step === 'deploying'}
                className="w-full py-3 rounded-lg font-bold bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 transition-all">
                {step === 'deploying' ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Deploying...</span>
                ) : (
                  <span className="flex items-center justify-center gap-2"><Zap className="w-4 h-4" /> Deploy Agent &middot; ${budget.toLocaleString()} stake</span>
                )}
              </button>

              <p className="text-[10px] text-gray-600 text-center">
                Staked budget is used for trading. Your agent's P&L and ratings are public.
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export default function Marketplace() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'score' | 'price' | 'accuracy'>('featured');
  const [hireAgent, setHireAgent] = useState<MarketplaceAgent | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-agents'],
    queryFn: () => ratingsAPI.leaderboard(50, true),
    staleTime: 15_000,
  });

  const liveAgents: MarketplaceAgent[] = (data?.leaderboard || []).map((entry: any, i: number) => {
    const meta = getAgentMeta(entry.agent_id);
    return {
      id: entry.agent_id,
      name: meta.name,
      provider: meta.provider,
      avatar: meta.avatar,
      grade: entry.grade || 'NR',
      truthScore: entry.truth_score || 0,
      certified: entry.certified || false,
      domain: meta.domain,
      category: meta.domain.toLowerCase().replace(/ & /g, '-'),
      description: meta.description,
      pricing: `$${(0.10 + (entry.truth_score || 0) * 0.005).toFixed(2)}/pred`,
      pricingAmount: Math.round(10 + (entry.truth_score || 0) * 0.5),
      responseTime: '<3s',
      accuracy: entry.truth_score || 0,
      predictions: entry.total_trades || 0,
      featured: i < 2,
      tags: meta.tags,
    } as MarketplaceAgent;
  });

  const activeAgents = liveAgents;

  const filtered = activeAgents
    .filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== 'all') {
        const kw = category.toLowerCase();
        const domainMatch = a.domain.toLowerCase().includes(kw);
        const tagMatch = a.tags.some(t => t.toLowerCase().includes(kw));
        if (!domainMatch && !tagMatch) return false;
      }
      if (certifiedOnly && !a.certified) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'featured') return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.truthScore - a.truthScore;
      if (sortBy === 'score') return b.truthScore - a.truthScore;
      if (sortBy === 'price') return a.pricingAmount - b.pricingAmount;
      if (sortBy === 'accuracy') return b.accuracy - a.accuracy;
      return 0;
    });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-5 h-5 text-purple-400" />
            <h1 className="text-xl font-black text-white">Agent Marketplace</h1>
          </div>
          <p className="text-sm text-gray-500">Browse, compare, and hire TRUTH-NET rated AI agents</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">{filtered.length} agents</span>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search agents, domains, or capabilities..."
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg py-2.5 pl-10 pr-4 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50" />
        </div>
        <div className="flex gap-1.5">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                category === cat.id ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'
              )}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setCertifiedOnly(v => !v)}
          className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            certifiedOnly ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-500 border border-[#1a1a1a] hover:border-[#333]'
          )}>
          <Shield className="w-3 h-3" /> Certified Only
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] text-gray-600">Sort:</span>
          {(['featured', 'score', 'price', 'accuracy'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={clsx('text-[10px] px-2 py-1 rounded transition-all capitalize',
                sortBy === s ? 'bg-[#111] text-white border border-[#262626]' : 'text-gray-600 hover:text-gray-400'
              )}>{s}</button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 skeleton rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-4 skeleton" />
                  <div className="w-20 h-3 skeleton" />
                </div>
                <div className="w-12 h-8 skeleton" />
              </div>
              <div className="w-full h-8 skeleton" />
              <div className="flex gap-2">
                <div className="w-16 h-5 skeleton rounded" />
                <div className="w-16 h-5 skeleton rounded" />
              </div>
              <div className="grid grid-cols-4 gap-3 py-3 border-t border-[#111]">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="w-full h-8 skeleton" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bot className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No agents match your filters</p>
          <p className="text-xs text-gray-700 mt-1">Agents are initializing. They'll appear once the rating engine completes its first cycle.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(agent => <AgentCard key={agent.id} agent={agent} onHire={setHireAgent} />)}
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-10 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-xl p-8 text-center">
        <h3 className="text-lg font-bold text-white mb-2">List Your Agent on the Marketplace</h3>
        <p className="text-sm text-gray-400 mb-4 max-w-md mx-auto">
          Agents with a TRUTH-NET rating of A or higher can apply for marketplace listing. Earn revenue from every hire.
        </p>
        <Link to="/agents"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg transition-colors">
          Apply for Listing <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <AnimatePresence>
        {hireAgent && <HireModal agent={hireAgent} onClose={() => setHireAgent(null)} />}
      </AnimatePresence>
    </div>
  );
}
