/**
 * TRUTH-NET Agent Registry
 * 
 * AI Agent Rating Cards with:
 * - TruthScore rating and grade (AAA → CCC)
 * - Brier Score (prediction accuracy) and oracle verification
 * - Data source permissions (Google News, MarineTraffic, etc.)
 * - MCP (Model Context Protocol) integration
 * - Certification status
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Bot, 
  Search,
  Plug,
  Filter,
  Trash2,
  Copy,
  Brain,
  Shield,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Settings,
  Key,
  Globe,
  Anchor,
  Lock,
  Link2,
  Pencil,
  Loader2,
  Rocket,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { apiClient, ratingsAPI } from '../api/client';
import { getAgentMeta } from '../lib/agentMeta';

// ============================================================================
// TYPES
// ============================================================================

interface AgentData {
  id: string;
  name: string;
  description: string;
  avatar: string;
  strategyPersona: string;
  mcpEndpoint: string;
  
  // Reputation Metrics
  truthScore: number;
  brierScore: number;
  reputationHash: string; // ERC-8004 style
  
  // Trading Stats
  totalTrades: number;
  winningTrades: number;
  totalPnl: number;
  stakedBudget: number;
  
  // Permissions
  permissions: {
    googleNews: boolean;
    marineTraffic: boolean;
    privateLiquidity: boolean;
    noaaWeather: boolean;
    githubActivity: boolean;
    socialSentiment: boolean;
  };
  
  // Configuration
  topics: string[];
  maxPositionPct: number;
  maxExposurePct: number;
  status: 'active' | 'paused' | 'suspended';
  type: 'system' | 'custom' | 'external';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TOPIC_CLUSTERS = [
  { id: 'logistics', label: '#LogisticsWar', color: 'blue' },
  { id: 'ai', label: '#AIWar', color: 'purple' },
  { id: 'weather', label: '#ClimateRisk', color: 'green' },
  { id: 'crypto', label: '#CryptoAlpha', color: 'orange' },
  { id: 'tech', label: '#TechEarnings', color: 'cyan' },
  { id: 'geopolitics', label: '#Geopolitics', color: 'red' },
];

const DATA_SOURCES = [
  { id: 'googleNews', name: 'Google News', icon: Globe, description: 'Real-time news aggregation' },
  { id: 'marineTraffic', name: 'MarineTraffic API', icon: Anchor, description: 'Ship tracking & port data' },
  { id: 'privateLiquidity', name: 'Private Liquidity', icon: Lock, description: 'Dark pool access' },
  { id: 'noaaWeather', name: 'NOAA Weather', icon: Globe, description: 'Weather forecasts & alerts' },
  { id: 'githubActivity', name: 'GitHub Activity', icon: Globe, description: 'Code commit monitoring' },
  { id: 'socialSentiment', name: 'Social Sentiment', icon: Globe, description: 'Twitter/Reddit analysis' },
];

function ratingEntryToAgentData(entry: any, meta: { name: string; avatar: string; description: string; persona: string; tags: string[] }): AgentData {
  const winRate = entry.win_rate ?? (entry.total_trades > 0 ? (entry.winning_trades ?? 0) / entry.total_trades : 0);
  return {
    id: entry.agent_id,
    name: meta.name,
    description: meta.description,
    avatar: meta.avatar,
    strategyPersona: meta.persona,
    mcpEndpoint: '',
    truthScore: (entry.truth_score ?? 0) / 100,
    brierScore: entry.brier_score ?? 0.5,
    reputationHash: `0x${entry.agent_id.replace(/[^a-f0-9]/gi, '').slice(0, 4)}...${entry.agent_id.replace(/[^a-f0-9]/gi, '').slice(-4)}`,
    totalTrades: entry.total_trades ?? 0,
    winningTrades: Math.round((entry.total_trades ?? 0) * winRate),
    totalPnl: entry.total_pnl ?? 0,
    stakedBudget: 100_000,
    permissions: {
      googleNews: true,
      marineTraffic: false,
      privateLiquidity: false,
      noaaWeather: false,
      githubActivity: false,
      socialSentiment: true,
    },
    topics: meta.tags
      .map(t => t.toLowerCase())
      .filter(t => TOPIC_CLUSTERS.some(c => c.id === t)),
    maxPositionPct: 15,
    maxExposurePct: 40,
    status: 'active',
    type: entry.agent_id.startsWith('ext-') ? 'external' : 'system',
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Brier Score Badge with explanation
function BrierScoreBadge({ score }: { score: number }) {
  // Lower is better for Brier score (0 = perfect, 1 = worst)
  const quality = score <= 0.15 ? 'excellent' : score <= 0.25 ? 'good' : score <= 0.35 ? 'fair' : 'poor';
  const color = {
    excellent: 'text-emerald-400 bg-emerald-400',
    good: 'text-cyan-400 bg-cyan-400',
    fair: 'text-amber-400 bg-amber-400',
    poor: 'text-red-400 bg-red-400',
  }[quality];

  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full', color.split(' ')[1])}
          style={{ width: `${(1 - score) * 100}%` }}
        />
      </div>
      <span className={clsx('font-mono text-xs font-medium', color.split(' ')[0])}>
        {score.toFixed(2)}
      </span>
    </div>
  );
}

// KYA Agent Card
function AgentCard({ agent, onToggleStatus, onDelete, onEdit }: { 
  agent: AgentData; 
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (agent: AgentData) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const winRate = agent.totalTrades > 0 
    ? (agent.winningTrades / agent.totalTrades * 100).toFixed(1) 
    : '0.0';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={clsx(
        'bg-[#0a0a0a] border rounded-xl overflow-hidden transition-all',
        agent.status === 'active' ? 'border-slate-800' : 'border-amber-500/30',
        agent.type === 'external' && 'border-purple-500/30'
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="text-3xl">{agent.avatar}</div>
              {agent.truthScore >= 0.8 && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Shield className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{agent.name}</h3>
                <span className={clsx(
                  'text-[10px] font-bold font-mono px-1.5 py-0.5 rounded',
                  agent.truthScore >= 0.9 ? 'bg-emerald-500/20 text-emerald-400' :
                  agent.truthScore >= 0.8 ? 'bg-cyan-500/20 text-cyan-400' :
                  agent.truthScore >= 0.7 ? 'bg-blue-500/20 text-blue-400' :
                  agent.truthScore >= 0.6 ? 'bg-amber-500/20 text-amber-400' :
                  'bg-gray-500/20 text-gray-400'
                )}>
                  {agent.truthScore >= 0.9 ? 'AAA' : agent.truthScore >= 0.8 ? 'AA' : agent.truthScore >= 0.7 ? 'A' : agent.truthScore >= 0.6 ? 'BBB' : 'BB'}
                </span>
                {agent.mcpEndpoint && (
                  <span className="flex items-center gap-1 text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                    <Plug className="w-3 h-3" /> MCP
                  </span>
                )}
                {agent.type === 'external' && (
                  <span className="flex items-center gap-1 text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded">
                    <ExternalLink className="w-3 h-3" /> External
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{agent.description}</p>
            </div>
          </div>
          
          {/* Status Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onToggleStatus(agent.id)}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                agent.status === 'active' 
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              )}
              title={agent.status === 'active' ? 'Pause' : 'Resume'}
            >
              {agent.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onEdit(agent)}
              className="p-1.5 rounded-lg bg-slate-800 text-gray-400 hover:bg-cyan-500/20 hover:text-cyan-400 transition-colors"
              title="Edit agent"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg bg-slate-800 text-gray-400 hover:bg-slate-700 transition-colors"
              title="Details"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reputation Metrics Row */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div className="bg-black/50 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 mb-1">Truth Score</p>
            <p className={clsx(
              'text-lg font-bold font-mono',
              agent.truthScore >= 0.8 ? 'text-emerald-400' : agent.truthScore >= 0.7 ? 'text-cyan-400' : 'text-amber-400'
            )}>
              {(agent.truthScore * 100).toFixed(0)}%
            </p>
          </div>
          <div className="bg-black/50 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 mb-1">Brier Score</p>
            <BrierScoreBadge score={agent.brierScore} />
          </div>
          <div className="bg-black/50 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 mb-1">Win Rate</p>
            <p className="text-lg font-bold font-mono text-white">{winRate}%</p>
          </div>
          <div className="bg-black/50 rounded-lg p-2">
            <p className="text-[10px] text-gray-500 mb-1">P&L</p>
            <p className={clsx(
              'text-lg font-bold font-mono',
              agent.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}>
              {agent.totalPnl >= 0 ? '+' : ''}${(agent.totalPnl / 1000).toFixed(0)}K
            </p>
          </div>
        </div>

        {/* ERC-8004 Reputation Hash */}
        <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 mb-3">
          <div className="flex items-center gap-2">
            <Key className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-500">ERC-8004 Reputation</span>
          </div>
          <code className="text-xs font-mono text-cyan-400">{agent.reputationHash}</code>
        </div>

        {/* Topic Tags */}
        {agent.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {agent.topics.map(topic => {
              const cluster = TOPIC_CLUSTERS.find(c => c.id === topic);
              return (
                <span 
                  key={topic}
                  className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full',
                    cluster?.color === 'blue' && 'bg-blue-500/20 text-blue-400',
                    cluster?.color === 'purple' && 'bg-purple-500/20 text-purple-400',
                    cluster?.color === 'green' && 'bg-green-500/20 text-green-400',
                    cluster?.color === 'orange' && 'bg-orange-500/20 text-orange-400',
                    cluster?.color === 'cyan' && 'bg-cyan-500/20 text-cyan-400',
                    cluster?.color === 'red' && 'bg-red-500/20 text-red-400',
                    !cluster && 'bg-slate-700 text-slate-300'
                  )}
                >
                  {cluster?.label || topic}
                </span>
              );
            })}
          </div>
        )}

        {/* Budget & Position Limits */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Staked: <strong className="text-white">${(agent.stakedBudget / 1000).toFixed(0)}K</strong></span>
          <span>Max Position: <strong className="text-white">{agent.maxPositionPct}%</strong></span>
          <span>Max Exposure: <strong className="text-white">{agent.maxExposurePct}%</strong></span>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-800"
          >
            <div className="p-4 space-y-4">
              {/* Strategy Persona */}
              <div>
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Strategy Persona
                </p>
                {agent.strategyPersona ? (
                  <p className="text-sm text-gray-300 italic bg-black/30 rounded-lg p-3">
                    "{agent.strategyPersona}"
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 bg-black/30 rounded-lg p-3">
                    No custom persona configured. This agent uses default reasoning.
                  </p>
                )}
              </div>

              {/* Agent ID */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>ID: <code className="text-cyan-400 font-mono">{agent.id}</code></span>
                <span>Type: <strong className="text-gray-300 capitalize">{agent.type}</strong></span>
              </div>

              {/* MCP Endpoint */}
              {agent.mcpEndpoint && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> MCP Endpoint
                  </p>
                  <code className="text-xs text-purple-400 bg-black/30 rounded-lg p-2 block font-mono">
                    {agent.mcpEndpoint}
                  </code>
                </div>
              )}

              {/* Data Source Permissions */}
              <div>
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Data Source Permissions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DATA_SOURCES.map(source => {
                    const enabled = agent.permissions[source.id as keyof typeof agent.permissions];
                    return (
                      <div 
                        key={source.id}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
                          enabled ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-black/30 border border-transparent'
                        )}
                      >
                        {enabled ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3 h-3 text-gray-600" />
                        )}
                        <span className={enabled ? 'text-emerald-400' : 'text-gray-500'}>
                          {source.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button 
                  onClick={() => navigator.clipboard.writeText(agent.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy ID
                </button>
                <button 
                  onClick={() => onDelete(agent.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors ml-auto"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Agent creation config constants
const AGENT_DATA_SOURCES = [
  { id: 'google_news', label: 'Google News', description: 'Real-time news aggregation & analysis' },
  { id: 'financial_filings', label: 'Financial Filings (SEC, etc.)', description: '10-K, 10-Q, 8-K filings' },
  { id: 'academic_papers', label: 'Academic Papers', description: 'ArXiv, SSRN, PubMed research' },
  { id: 'social_sentiment', label: 'Social Sentiment (Twitter/X)', description: 'Real-time social media analysis' },
  { id: 'blockchain_data', label: 'Blockchain Data', description: 'On-chain analytics & whale tracking' },
  { id: 'government_reports', label: 'Government Reports', description: 'BLS, Census, Fed data releases' },
  { id: 'weather_data', label: 'Weather Data', description: 'NOAA, satellite, climate models' },
  { id: 'satellite_data', label: 'Satellite Data', description: 'Imagery analysis for supply chain' },
];

const ANALYTICAL_METHODOLOGIES = [
  { id: 'bayesian', label: 'Bayesian Updating', description: 'Systematic probability revision using prior beliefs and new evidence' },
  { id: 'momentum', label: 'Trend / Momentum Analysis', description: 'Follow prevailing trends and price momentum signals' },
  { id: 'contrarian', label: 'Contrarian Analysis', description: 'Bet against consensus when crowd conviction is extreme' },
  { id: 'ensemble', label: 'Ensemble', description: 'Combine multiple analytical approaches for robust estimates' },
  { id: 'expert_consensus', label: 'Expert Consensus', description: 'Weight forecasts toward domain expert opinion' },
];

const RISK_TOLERANCE_LEVELS = [
  { id: 'low', label: 'Low', description: 'Conservative — prioritize capital preservation', color: 'emerald' },
  { id: 'medium', label: 'Medium', description: 'Balanced risk/reward tradeoff', color: 'cyan' },
  { id: 'high', label: 'High', description: 'Aggressive — pursue higher expected returns', color: 'amber' },
  { id: 'aggressive', label: 'Aggressive', description: 'Maximum risk — concentrated high-conviction bets', color: 'red' },
];

// Create Agent Modal
function CreateAgentModal({ isOpen, onClose }: { 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [persona, setPersona] = useState('');
  const [mcpEndpoint, setMcpEndpoint] = useState('');
  const [stakedBudget, setStakedBudget] = useState(100000);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [permissions, setPermissions] = useState({
    googleNews: true,
    marineTraffic: false,
    privateLiquidity: false,
    noaaWeather: false,
    githubActivity: false,
    socialSentiment: true,
  });

  // New sophisticated fields
  const [dataSources, setDataSources] = useState<string[]>(['google_news', 'social_sentiment']);
  const [methodology, setMethodology] = useState('bayesian');
  const [maxPositionPct, setMaxPositionPct] = useState(15);
  const [maxExposurePct, setMaxExposurePct] = useState(40);
  const [riskTolerance, setRiskTolerance] = useState<string>('medium');

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [deployStatus, setDeployStatus] = useState<'waiting' | 'first-trade' | 'live' | null>(null);
  const [firstReasoning, setFirstReasoning] = useState<{ market_title: string; probability: number; reasoning: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (!createdAgentId || deployStatus === 'live') return;
    if (pollRef.current) clearInterval(pollRef.current);

    setDeployStatus('waiting');
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiClient.get<{ entries: Array<{ market_title: string; probability: number; reasoning: string }> }>(`/v1/reasoning/${createdAgentId}`);
        if (data?.entries?.length > 0) {
          const entry = data.entries[0];
          setFirstReasoning(entry);
          setDeployStatus('first-trade');
          setTimeout(() => setDeployStatus('live'), 3000);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* keep polling */ }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [createdAgentId]);

  const toggleDataSource = (id: string) => {
    setDataSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const resetForm = () => {
    setName(''); setDescription(''); setPersona(''); setMcpEndpoint('');
    setStakedBudget(100000); setSelectedTopics([]);
    setDataSources(['google_news', 'social_sentiment']);
    setMethodology('bayesian'); setMaxPositionPct(15); setMaxExposurePct(40);
    setRiskTolerance('medium'); setSuccess(null); setCreatedAgentId(null);
    setDeployStatus(null); setFirstReasoning(null);
  };

  const handleCreate = async () => {
    if (!name) return;
    setIsCreating(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await apiClient.post<any>('/agents', {
        name,
        description: description || undefined,
        strategy_persona: persona || description || 'General prediction agent',
        staked_budget: stakedBudget,
        allowed_topics: selectedTopics,
        mcp_endpoint: mcpEndpoint || undefined,
        max_position_pct: maxPositionPct,
        max_exposure_pct: maxExposurePct,
        config: {
          data_sources: dataSources,
          methodology,
          risk_tolerance: riskTolerance,
          max_position_pct: maxPositionPct,
          max_exposure_pct: maxExposurePct,
        },
      });

      const agentId = result?.id || 'new-agent';
      setCreatedAgentId(agentId);
      setSuccess(`Agent "${name}" deployed (${agentId}).`);
      localStorage.setItem('tn_agent_registered', 'true');

      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agents-ratings'] });
    } catch (e: any) {
      setError(e?.message || 'Failed to deploy agent. Check the console for details.');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0a0a0a] border border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Deploy New Counterparty</h2>
          <p className="text-sm text-gray-500 mt-1">Configure agent identity, data sources, methodology, and risk parameters</p>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Identity ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Agent Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Alpha-Sentinel-001"
                  className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Staked Budget ($)</label>
                <input
                  type="number"
                  value={stakedBudget}
                  onChange={(e) => setStakedBudget(Number(e.target.value))}
                  className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the agent's role"
                className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">Strategy Persona (System Prompt)</label>
              <textarea
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                placeholder="You are a strategic trader specialized in..."
                rows={3}
                className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
              />
            </div>

            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">
                <Plug className="w-3 h-3 inline mr-1" />
                MCP Endpoint (Optional — bring your own agent)
              </label>
              <input
                type="url"
                value={mcpEndpoint}
                onChange={(e) => setMcpEndpoint(e.target.value)}
                placeholder="https://api.example.com/mcp/your-agent"
                className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none font-mono text-sm"
              />
            </div>
          </div>

          {/* ── Market Topics ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Market Topics</h3>
            <div className="flex flex-wrap gap-2">
              {TOPIC_CLUSTERS.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopics(prev => 
                    prev.includes(topic.id) ? prev.filter(t => t !== topic.id) : [...prev, topic.id]
                  )}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    selectedTopics.includes(topic.id)
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-slate-800 text-gray-400 border border-transparent hover:border-slate-600'
                  )}
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Data Sources ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Data Sources</h3>
            <p className="text-[11px] text-gray-600 mb-3">Select the data feeds this agent can consume for reasoning</p>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_DATA_SOURCES.map(source => {
                const selected = dataSources.includes(source.id);
                return (
                  <label
                    key={source.id}
                    className={clsx(
                      'flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all',
                      selected
                        ? 'bg-cyan-500/10 border border-cyan-500/30'
                        : 'bg-black/30 border border-slate-700 hover:border-slate-600'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleDataSource(source.id)}
                      className="sr-only"
                    />
                    {selected ? (
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-600 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <span className={clsx('text-xs font-medium', selected ? 'text-cyan-400' : 'text-gray-400')}>
                        {source.label}
                      </span>
                      <p className="text-[10px] text-gray-600 mt-0.5">{source.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Analytical Methodology ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Analytical Methodology</h3>
            <p className="text-[11px] text-gray-600 mb-3">How this agent forms probability estimates</p>
            <div className="space-y-2">
              {ANALYTICAL_METHODOLOGIES.map(m => (
                <label
                  key={m.id}
                  className={clsx(
                    'flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all',
                    methodology === m.id
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'bg-black/30 border border-slate-700 hover:border-slate-600'
                  )}
                >
                  <input
                    type="radio"
                    name="methodology"
                    value={m.id}
                    checked={methodology === m.id}
                    onChange={() => setMethodology(m.id)}
                    className="sr-only"
                  />
                  <div className={clsx(
                    'w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center',
                    methodology === m.id ? 'border-purple-400' : 'border-slate-600'
                  )}>
                    {methodology === m.id && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                  </div>
                  <div>
                    <span className={clsx('text-xs font-medium', methodology === m.id ? 'text-purple-400' : 'text-gray-400')}>
                      {m.label}
                    </span>
                    <p className="text-[10px] text-gray-600 mt-0.5">{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── Risk Parameters ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Risk Parameters</h3>
            <div className="space-y-4">
              {/* Max Position Size */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-500">Max Position Size</label>
                  <span className="text-xs font-mono font-medium text-white">{maxPositionPct}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={1}
                  value={maxPositionPct}
                  onChange={(e) => setMaxPositionPct(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>5%</span>
                  <span>50%</span>
                </div>
              </div>

              {/* Max Single Market Exposure */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-500">Max Single Market Exposure</label>
                  <span className="text-xs font-mono font-medium text-white">{maxExposurePct}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={maxExposurePct}
                  onChange={(e) => setMaxExposurePct(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>10%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Risk Tolerance */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Risk Tolerance</label>
                <div className="grid grid-cols-4 gap-2">
                  {RISK_TOLERANCE_LEVELS.map(level => (
                    <button
                      key={level.id}
                      onClick={() => setRiskTolerance(level.id)}
                      className={clsx(
                        'px-2 py-2 rounded-lg text-center transition-all border',
                        riskTolerance === level.id
                          ? level.color === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                          : level.color === 'cyan' ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                          : level.color === 'amber' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                          : 'bg-red-500/15 border-red-500/40 text-red-400'
                          : 'bg-black/30 border-slate-700 text-gray-500 hover:border-slate-600'
                      )}
                    >
                      <span className="text-xs font-medium block">{level.label}</span>
                      <span className="text-[9px] block mt-0.5 opacity-70">{level.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Legacy Data Source Permissions ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">MCP Tool Permissions</h3>
            <div className="grid grid-cols-2 gap-2">
              {DATA_SOURCES.map(source => (
                <label
                  key={source.id}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all',
                    permissions[source.id as keyof typeof permissions]
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-black/30 border border-slate-700 hover:border-slate-600'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={permissions[source.id as keyof typeof permissions]}
                    onChange={(e) => setPermissions(prev => ({ ...prev, [source.id]: e.target.checked }))}
                    className="sr-only"
                  />
                  {permissions[source.id as keyof typeof permissions] ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-600" />
                  )}
                  <span className={clsx(
                    'text-xs',
                    permissions[source.id as keyof typeof permissions] ? 'text-emerald-400' : 'text-gray-400'
                  )}>
                    {source.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 space-y-2">
              <p>{success}</p>
              {deployStatus === 'waiting' && (
                <div className="flex items-center gap-2 text-amber-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Waiting for first trade…</span>
                </div>
              )}
              {deployStatus === 'first-trade' && firstReasoning && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Rocket className="w-3.5 h-3.5" />
                    <span className="font-medium">First prediction made!</span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    <strong className="text-white">{firstReasoning.market_title}</strong> — {(firstReasoning.probability * 100).toFixed(0)}% probability
                  </p>
                  <p className="text-gray-500 text-[10px] line-clamp-2">{firstReasoning.reasoning}</p>
                </div>
              )}
              {deployStatus === 'live' && createdAgentId && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-medium">Agent is live and trading!</span>
                  </div>
                  <Link to={`/agents/${createdAgentId}`} onClick={() => { resetForm(); onClose(); }}
                    className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-[11px]">
                    View Agent Profile <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { resetForm(); onClose(); }}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              {success ? 'Close' : 'Cancel'}
            </button>
            {!success && (
              <button
                onClick={handleCreate}
                disabled={!name || isCreating}
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isCreating ? 'Deploying...' : 'Deploy Agent'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Edit Agent Modal
function EditAgentModal({ agent, isOpen, onClose }: {
  agent: AgentData | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [persona, setPersona] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [methodology, setMethodology] = useState('bayesian');
  const [maxPositionPct, setMaxPositionPct] = useState(15);
  const [maxExposurePct, setMaxExposurePct] = useState(40);
  const [riskTolerance, setRiskTolerance] = useState('medium');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (agent && isOpen) {
      setPersona(agent.strategyPersona || '');
      setSelectedTopics(agent.topics || []);
      setMaxPositionPct(agent.maxPositionPct || 15);
      setMaxExposurePct(agent.maxExposurePct || 40);
      setDataSources(['google_news', 'social_sentiment']);
      setMethodology('bayesian');
      setRiskTolerance('medium');
      setError(null);
      setSaved(false);
    }
  }, [agent, isOpen]);

  const handleSave = async () => {
    if (!agent) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.put(`/agents/${agent.id}/config`, {
        strategy_persona: persona,
        allowed_topics: selectedTopics,
        max_position_pct: maxPositionPct,
        max_exposure_pct: maxExposurePct,
        config: {
          data_sources: dataSources,
          methodology,
          risk_tolerance: riskTolerance,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agents-ratings'] });
      setSaved(true);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setError(e?.message || 'Failed to update agent config.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0a0a0a] border border-slate-800 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Edit Agent — {agent.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Update configuration for <code className="text-cyan-400 font-mono text-xs">{agent.id}</code></p>
        </div>

        <div className="p-6 space-y-6">
          {/* Strategy Persona */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Strategy Persona</label>
            <textarea value={persona} onChange={e => setPersona(e.target.value)} rows={3}
              className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none resize-none" />
          </div>

          {/* Topics */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Market Topics</label>
            <div className="flex flex-wrap gap-2">
              {TOPIC_CLUSTERS.map(topic => (
                <button key={topic.id}
                  onClick={() => setSelectedTopics(prev =>
                    prev.includes(topic.id) ? prev.filter(t => t !== topic.id) : [...prev, topic.id]
                  )}
                  className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    selectedTopics.includes(topic.id)
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-slate-800 text-gray-400 border border-transparent hover:border-slate-600'
                  )}>
                  {topic.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data Sources */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Data Sources</label>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_DATA_SOURCES.map(source => {
                const sel = dataSources.includes(source.id);
                return (
                  <label key={source.id} className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all',
                    sel ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-black/30 border border-slate-700 hover:border-slate-600'
                  )}>
                    <input type="checkbox" checked={sel} onChange={() => setDataSources(prev => sel ? prev.filter(s => s !== source.id) : [...prev, source.id])} className="sr-only" />
                    {sel ? <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" /> : <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />}
                    <span className={clsx('text-xs', sel ? 'text-cyan-400' : 'text-gray-400')}>{source.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Methodology */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Methodology</label>
            <div className="space-y-1.5">
              {ANALYTICAL_METHODOLOGIES.map(m => (
                <label key={m.id} className={clsx('flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all',
                  methodology === m.id ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-black/30 border border-slate-700 hover:border-slate-600'
                )}>
                  <input type="radio" name="edit-methodology" value={m.id} checked={methodology === m.id} onChange={() => setMethodology(m.id)} className="sr-only" />
                  <div className={clsx('w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center', methodology === m.id ? 'border-purple-400' : 'border-slate-600')}>
                    {methodology === m.id && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  </div>
                  <span className={clsx('text-xs', methodology === m.id ? 'text-purple-400' : 'text-gray-400')}>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Risk Parameters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs text-gray-500">Max Position</label>
                <span className="text-xs font-mono text-white">{maxPositionPct}%</span>
              </div>
              <input type="range" min={5} max={50} value={maxPositionPct} onChange={e => setMaxPositionPct(+e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500" />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs text-gray-500">Max Exposure</label>
                <span className="text-xs font-mono text-white">{maxExposurePct}%</span>
              </div>
              <input type="range" min={10} max={100} step={5} value={maxExposurePct} onChange={e => setMaxExposurePct(+e.target.value)}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500" />
            </div>
          </div>

          {/* Risk Tolerance */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Risk Tolerance</label>
            <div className="grid grid-cols-4 gap-2">
              {RISK_TOLERANCE_LEVELS.map(level => (
                <button key={level.id} onClick={() => setRiskTolerance(level.id)}
                  className={clsx('px-2 py-2 rounded-lg text-center transition-all border',
                    riskTolerance === level.id
                      ? level.color === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : level.color === 'cyan' ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                      : level.color === 'amber' ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-red-500/15 border-red-500/40 text-red-400'
                      : 'bg-black/30 border-slate-700 text-gray-500 hover:border-slate-600'
                  )}>
                  <span className="text-xs font-medium">{level.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 space-y-3">
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{error}</div>
          )}
          {saved && (
            <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">Config saved successfully.</div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={isSaving || saved}
              className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Agents() {
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [editAgent, setEditAgent] = useState<AgentData | null>(null);

  // Primary data source: live leaderboard ratings
  const { data: ratingData, isLoading: ratingsLoading } = useQuery({
    queryKey: ['agents-ratings'],
    queryFn: () => ratingsAPI.leaderboard(50, true),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  // Secondary: governance-registered agents (includes user-created ones + full details)
  const { data: registeredAgents } = useQuery({
    queryKey: ['agents-list'],
    queryFn: () => apiClient.get<{ agents: Array<{ id: string; name: string; description?: string; status?: string; strategy_persona?: string; staked_budget?: number; mcp_endpoint?: string; trading_config?: any; metrics?: any }> }>('/agents')
      .then(res => res.agents ?? [])
      .catch(() => [] as any[]),
    staleTime: 30_000,
  });

  // Build unified agent list from live backend data
  const agents: AgentData[] = useMemo(() => {
    const agentMap = new Map<string, AgentData>();

    // Index registered agents by ID for quick lookup
    const regIndex = new Map<string, any>();
    for (const reg of registeredAgents ?? []) {
      regIndex.set(reg.id, reg);
    }

    for (const entry of ratingData?.leaderboard ?? []) {
      const meta = getAgentMeta(entry.agent_id);
      const agent = ratingEntryToAgentData(entry, meta);

      // Enrich with governance data if available
      const reg = regIndex.get(entry.agent_id);
      if (reg) {
        agent.strategyPersona = reg.strategy_persona || agent.strategyPersona;
        agent.mcpEndpoint = reg.mcp_endpoint || '';
        agent.stakedBudget = reg.staked_budget || agent.stakedBudget;
        if (reg.trading_config) {
          agent.maxPositionPct = reg.trading_config.max_position_pct ?? agent.maxPositionPct;
          agent.maxExposurePct = reg.trading_config.max_exposure_pct ?? agent.maxExposurePct;
        }
        regIndex.delete(entry.agent_id);
      }

      agentMap.set(entry.agent_id, agent);
    }

    // Add remaining registered agents not in the leaderboard
    for (const [id, reg] of regIndex) {
      const meta = getAgentMeta(id);
      const ts = reg.metrics?.truth_score ?? 0;
      agentMap.set(id, {
        id,
        name: reg.name || meta.name,
        description: reg.description || meta.description,
        avatar: meta.avatar,
        strategyPersona: reg.strategy_persona || meta.persona,
        mcpEndpoint: reg.mcp_endpoint || '',
        truthScore: ts > 1 ? ts / 100 : ts,
        brierScore: reg.metrics?.brier_score ?? 0.5,
        reputationHash: `0x${id.replace(/[^a-f0-9]/gi, '').slice(0, 4)}...${id.replace(/[^a-f0-9]/gi, '').slice(-4)}`,
        totalTrades: reg.metrics?.total_trades ?? 0,
        winningTrades: reg.metrics?.winning_trades ?? 0,
        totalPnl: reg.metrics?.total_pnl ?? 0,
        stakedBudget: reg.staked_budget ?? 100_000,
        permissions: {
          googleNews: true, marineTraffic: false, privateLiquidity: false,
          noaaWeather: false, githubActivity: false, socialSentiment: true,
        },
        topics: (reg.trading_config?.allowed_topics || [])
          .map((t: string) => t.toLowerCase())
          .filter((t: string) => TOPIC_CLUSTERS.some(c => c.id === t)),
        maxPositionPct: reg.trading_config?.max_position_pct ?? 15,
        maxExposurePct: reg.trading_config?.max_exposure_pct ?? 40,
        status: (reg.status === 'paused' ? 'paused' : 'active') as 'active' | 'paused',
        type: id.startsWith('ext-') ? 'external' : id.startsWith('sys-') ? 'system' : 'custom',
      });
    }

    return Array.from(agentMap.values())
      .filter(a => !hiddenIds.has(a.id))
      .sort((a, b) => b.truthScore - a.truthScore);
  }, [ratingData, registeredAgents, hiddenIds]);

  const queryClient = useQueryClient();

  const handleToggleStatus = async (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    const action = agent.status === 'active' ? 'pause' : 'resume';
    try {
      await apiClient.post(`/agents/${id}/${action}`, {});
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agents-ratings'] });
    } catch {
      // Endpoint may not exist yet — toggle is best-effort
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this agent? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/agents/${id}`);
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      queryClient.invalidateQueries({ queryKey: ['agents-ratings'] });
    } catch {
      // Fall back to local hide if endpoint fails
    }
    setHiddenIds(prev => new Set(prev).add(id));
  };

  const filteredAgents = agents.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesTopic = !selectedTopic || a.topics.includes(selectedTopic);
    return matchesSearch && matchesTopic;
  });

  if (ratingsLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-[#0a0a0a] via-black to-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Agent Registry</h1>
              <p className="text-gray-500 text-sm mt-1">Register, configure, and certify AI agents</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Deploy Agent
            </button>
          </div>

          {/* Search & Filters */}
          <div className="mt-6 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents..."
                className="w-full bg-black border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <button
                onClick={() => setSelectedTopic(null)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  !selectedTopic ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                )}
              >
                All
              </button>
              {TOPIC_CLUSTERS.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    selectedTopic === topic.id ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="max-w-7xl mx-auto px-6 py-4 border-b border-slate-800/50">
        <div className="flex items-center gap-8 text-sm">
          <span className="text-gray-500">
            Total: <strong className="text-white">{agents.length}</strong>
          </span>
          <span className="text-gray-500">
            Active: <strong className="text-emerald-400">{agents.filter(a => a.status === 'active').length}</strong>
          </span>
          <span className="text-gray-500">
            Paused: <strong className="text-amber-400">{agents.filter(a => a.status === 'paused').length}</strong>
          </span>
          <span className="text-gray-500">
            External: <strong className="text-purple-400">{agents.filter(a => a.type === 'external').length}</strong>
          </span>
          <span className="text-gray-500 ml-auto">
            Total Staked: <strong className="text-white">${(agents.reduce((a, b) => a + b.stakedBudget, 0) / 1000000).toFixed(2)}M</strong>
          </span>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredAgents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
                onEdit={setEditAgent}
              />
            ))}
          </AnimatePresence>
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No counterparties found</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateAgentModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* Edit Modal */}
      <EditAgentModal
        agent={editAgent}
        isOpen={!!editAgent}
        onClose={() => setEditAgent(null)}
      />
    </div>
  );
}
