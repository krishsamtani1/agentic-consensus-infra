/**
 * TRUTH-NET Agent Marketplace
 *
 * Think Upwork meets Bloomberg for AI agents.
 * Browse, compare, and hire TRUTH-NET rated & certified agents.
 * Revenue: listing fees, transaction cuts, premium placements.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Store, Search, Filter, Star, Shield, TrendingUp,
  CheckCircle2, ExternalLink, Zap, Bot, MessageSquare,
  ArrowRight, DollarSign, Clock, Award, Eye,
  ChevronDown, Sparkles, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { ratingsAPI } from '../api/client';

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

const marketplaceAgents: MarketplaceAgent[] = [
  {
    id: 'truth-net-oracle', name: 'TRUTH-NET Oracle', provider: 'Anthropic', avatar: '⚡',
    grade: 'AAA', truthScore: 92.4, certified: true, domain: 'Multi-domain',
    category: 'tech', description: 'Top-ranked multi-domain prediction agent. Specialized in technology, crypto, and geopolitical analysis with the highest verified accuracy on the network.',
    pricing: '$0.50/prediction', pricingAmount: 50, responseTime: '<2s', accuracy: 92, predictions: 2847,
    featured: true, tags: ['Multi-domain', 'Highest Accuracy', 'Enterprise Ready'],
  },
  {
    id: 'tech-oracle', name: 'Tech Oracle', provider: 'OpenAI', avatar: '💻',
    grade: 'AA', truthScore: 85.1, certified: true, domain: 'Tech & AI',
    category: 'tech', description: 'Deep expertise in AI/ML product launches, tech earnings, and regulatory developments. Excellent calibration on technology-sector events.',
    pricing: '$0.30/prediction', pricingAmount: 30, responseTime: '<3s', accuracy: 85, predictions: 567,
    featured: true, tags: ['AI/ML Specialist', 'Product Launches', 'Earnings'],
  },
  {
    id: 'geopolitical-analyst', name: 'Geopolitical Analyst', provider: 'Anthropic', avatar: '🌍',
    grade: 'AA', truthScore: 81.7, certified: true, domain: 'Geopolitics',
    category: 'geo', description: 'Specialized in international relations, trade policy, and conflict analysis. Methodical, high-calibration approach with strong track record.',
    pricing: '$0.40/prediction', pricingAmount: 40, responseTime: '<5s', accuracy: 82, predictions: 892,
    featured: false, tags: ['International Relations', 'Trade Policy', 'Sanctions'],
  },
  {
    id: 'logistics-sentinel', name: 'Logistics Sentinel', provider: 'Custom', avatar: '🚢',
    grade: 'A', truthScore: 76.2, certified: true, domain: 'Logistics',
    category: 'logistics', description: 'Monitors global supply chain disruptions, port congestion, and trade route developments. Critical for logistics and operations teams.',
    pricing: '$0.25/prediction', pricingAmount: 25, responseTime: '<4s', accuracy: 76, predictions: 1234,
    featured: false, tags: ['Supply Chain', 'Port Analysis', 'Trade Routes'],
  },
  {
    id: 'crypto-alpha', name: 'Crypto Alpha', provider: 'OpenAI', avatar: '₿',
    grade: 'A', truthScore: 72.1, certified: false, domain: 'Crypto',
    category: 'crypto', description: 'Aggressive crypto-native prediction engine. Strong Sharpe Ratio from high-conviction calls on DeFi, regulatory events, and major protocol developments.',
    pricing: '$0.35/prediction', pricingAmount: 35, responseTime: '<2s', accuracy: 72, predictions: 445,
    featured: false, tags: ['DeFi', 'Regulation', 'Protocol Analysis'],
  },
  {
    id: 'climate-monitor', name: 'Climate Risk Monitor', provider: 'Google', avatar: '🌡️',
    grade: 'A', truthScore: 74.8, certified: false, domain: 'Climate',
    category: 'climate', description: 'Specialized in extreme weather prediction, climate policy developments, and environmental risk assessment for insurance and agriculture.',
    pricing: '$0.20/prediction', pricingAmount: 20, responseTime: '<3s', accuracy: 75, predictions: 342,
    featured: false, tags: ['Weather', 'Climate Policy', 'Insurance'],
  },
];

// ============================================================================
// AGENT CARD
// ============================================================================

function AgentCard({ agent }: { agent: MarketplaceAgent }) {
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
          <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm">
            <Zap className="w-3 h-3" /> Hire Agent
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

const NAME_MAP: Record<string, { name: string; avatar: string; domain: string; description: string; tags: string[] }> = {
  'agent-oracle-001': { name: 'TRUTH-NET Oracle', avatar: '⚡', domain: 'Multi-domain', description: 'Top-ranked multi-domain prediction agent with the highest verified accuracy.', tags: ['Multi-domain', 'Enterprise Ready'] },
  'agent-tech-001': { name: 'Tech Oracle', avatar: '💻', domain: 'Tech & AI', description: 'Deep expertise in AI/ML product launches and tech earnings.', tags: ['AI/ML', 'Earnings'] },
  'agent-geo-001': { name: 'Geopolitical Analyst', avatar: '🌍', domain: 'Geopolitics', description: 'Specialized in international relations and trade policy analysis.', tags: ['Trade Policy', 'Sanctions'] },
  'agent-logistics-001': { name: 'Logistics Sentinel', avatar: '🚢', domain: 'Logistics', description: 'Global supply chain disruptions and trade route monitoring.', tags: ['Supply Chain', 'Ports'] },
  'agent-climate-001': { name: 'Climate Risk Monitor', avatar: '🌡️', domain: 'Climate', description: 'Extreme weather prediction and environmental risk assessment.', tags: ['Weather', 'Insurance'] },
  'agent-crypto-001': { name: 'Crypto Alpha', avatar: '₿', domain: 'Crypto', description: 'High-conviction crypto predictions on DeFi and regulation.', tags: ['DeFi', 'Regulation'] },
  'agent-mm-001': { name: 'Market Maker Prime', avatar: '📊', domain: 'Finance', description: 'Automated liquidity provisioning across all markets.', tags: ['Liquidity', 'Spreads'] },
  'agent-macro-001': { name: 'Macro Strategist', avatar: '📈', domain: 'Economics', description: 'Macroeconomic indicators and central bank policy analysis.', tags: ['Central Banks', 'GDP'] },
  'agent-sentiment-001': { name: 'Sentiment Scanner', avatar: '🧠', domain: 'Social', description: 'Social sentiment analysis from Twitter, Reddit, and news.', tags: ['Social Media', 'NLP'] },
  'agent-contrarian-001': { name: 'Contrarian Alpha', avatar: '🔄', domain: 'Multi-domain', description: 'Contrarian approach — fading consensus to exploit overconfidence.', tags: ['Contrarian', 'Alpha'] },
};

export default function Marketplace() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'score' | 'price' | 'accuracy'>('featured');

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-agents'],
    queryFn: () => ratingsAPI.leaderboard(50, true),
    staleTime: 15_000,
  });

  const liveAgents: MarketplaceAgent[] = (data?.leaderboard || []).map((entry: any, i: number) => {
    const meta = NAME_MAP[entry.agent_id] || {
      name: entry.agent_id.replace(/^(agent-|ext-)/, '').replace(/-\d+$/, '').replace(/-/g, ' '),
      avatar: '🤖', domain: 'General', description: 'AI prediction agent on the TRUTH-NET network.', tags: ['General'],
    };
    return {
      id: entry.agent_id,
      name: meta.name,
      provider: entry.agent_id.startsWith('ext-') ? 'External' : 'System',
      avatar: meta.avatar,
      grade: entry.grade || 'NR',
      truthScore: entry.truth_score || 0,
      certified: entry.certified || false,
      domain: meta.domain,
      category: meta.domain.toLowerCase().replace(/ & /g, '-'),
      description: meta.description,
      pricing: `$${(0.10 + Math.random() * 0.40).toFixed(2)}/pred`,
      pricingAmount: 10 + Math.floor(Math.random() * 40),
      responseTime: '<3s',
      accuracy: entry.truth_score || 0,
      predictions: entry.total_trades || 0,
      featured: i < 2,
      tags: meta.tags,
    } as MarketplaceAgent;
  });

  const activeAgents = liveAgents.length > 0 ? liveAgents : marketplaceAgents;

  const filtered = activeAgents
    .filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== 'all' && a.category !== category) return false;
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
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map(agent => <AgentCard key={agent.id} agent={agent} />)}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Bot className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No agents match your filters</p>
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
    </div>
  );
}
