/**
 * TRUTH-NET KYA (Know Your Agent) Cards
 * 
 * 2026 A2A Standard compliant agent management with:
 * - Brier Score (accuracy) and ERC-8004 Reputation Hash
 * - Data source permissions (Google News, MarineTraffic, etc.)
 * - MCP (Model Context Protocol) integration
 * - War Room professional layout
 */

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Bot, 
  TrendingUp, 
  TrendingDown,
  Award,
  DollarSign,
  Search,
  MoreVertical,
  Plug,
  Tag,
  Filter,
  Trash2,
  Copy,
  Zap,
  Brain,
  Eye,
  Shuffle,
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
  Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { apiClient } from '../api/client';

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

// Mock agents with enhanced KYA data
const mockAgents: AgentData[] = [
  {
    id: 'agent-oracle-001',
    name: 'TRUTH-NET Oracle',
    description: 'Primary oracle resolver for market outcomes',
    avatar: '⚡',
    strategyPersona: 'You are the primary truth oracle. Verify market outcomes using multi-source consensus. Never compromise on data integrity.',
    mcpEndpoint: '',
    truthScore: 0.94,
    brierScore: 0.12,
    reputationHash: '0x8f4a...3c21',
    totalTrades: 2847,
    winningTrades: 2456,
    totalPnl: 245000,
    stakedBudget: 500000,
    permissions: { googleNews: true, marineTraffic: true, privateLiquidity: true, noaaWeather: true, githubActivity: true, socialSentiment: true },
    topics: ['logistics', 'ai', 'weather', 'geopolitics'],
    maxPositionPct: 25,
    maxExposurePct: 50,
    status: 'active',
    type: 'system',
  },
  {
    id: 'agent-mm-001',
    name: 'Market Maker Prime',
    description: 'Automated liquidity provisioning across all markets',
    avatar: '⚖️',
    strategyPersona: 'Provide tight spreads and deep liquidity. Balance inventory risk across correlated markets. Target 0.5% spread capture.',
    mcpEndpoint: '',
    truthScore: 0.71,
    brierScore: 0.28,
    reputationHash: '0x2b7e...9f44',
    totalTrades: 12456,
    winningTrades: 7234,
    totalPnl: 89000,
    stakedBudget: 1000000,
    permissions: { googleNews: true, marineTraffic: false, privateLiquidity: true, noaaWeather: false, githubActivity: false, socialSentiment: true },
    topics: [],
    maxPositionPct: 10,
    maxExposurePct: 30,
    status: 'active',
    type: 'system',
  },
  {
    id: 'agent-geo-001',
    name: 'Geopolitical Analyst',
    description: 'Trade tensions, sanctions, and diplomatic events',
    avatar: '🌍',
    strategyPersona: 'Monitor diplomatic cables, trade data, and geopolitical signals. Specialize in US-China, EU, and emerging market events.',
    mcpEndpoint: 'https://api.claude.ai/mcp/geo-analyst',
    truthScore: 0.82,
    brierScore: 0.19,
    reputationHash: '0x5c3d...8a12',
    totalTrades: 892,
    winningTrades: 654,
    totalPnl: 67000,
    stakedBudget: 250000,
    permissions: { googleNews: true, marineTraffic: true, privateLiquidity: false, noaaWeather: false, githubActivity: false, socialSentiment: true },
    topics: ['geopolitics', 'logistics'],
    maxPositionPct: 15,
    maxExposurePct: 40,
    status: 'active',
    type: 'external',
  },
  {
    id: 'agent-logistics-001',
    name: 'Logistics Sentinel',
    description: 'Supply chain disruptions and shipping routes',
    avatar: '🚢',
    strategyPersona: 'Track vessel movements, port congestion, and supply chain bottlenecks. Hedge against logistics disruptions before they hit markets.',
    mcpEndpoint: '',
    truthScore: 0.78,
    brierScore: 0.22,
    reputationHash: '0x9a1f...2e67',
    totalTrades: 1234,
    winningTrades: 876,
    totalPnl: 112000,
    stakedBudget: 300000,
    permissions: { googleNews: true, marineTraffic: true, privateLiquidity: false, noaaWeather: true, githubActivity: false, socialSentiment: false },
    topics: ['logistics', 'weather'],
    maxPositionPct: 20,
    maxExposurePct: 45,
    status: 'active',
    type: 'system',
  },
  {
    id: 'agent-tech-001',
    name: 'Tech Oracle',
    description: 'AI releases, earnings, and tech industry events',
    avatar: '💻',
    strategyPersona: 'Monitor GitHub activity, cloud pricing, and tech earnings. Predict AI releases and major tech announcements.',
    mcpEndpoint: '',
    truthScore: 0.85,
    brierScore: 0.16,
    reputationHash: '0x7d4c...1b89',
    totalTrades: 567,
    winningTrades: 445,
    totalPnl: 78000,
    stakedBudget: 200000,
    permissions: { googleNews: true, marineTraffic: false, privateLiquidity: false, noaaWeather: false, githubActivity: true, socialSentiment: true },
    topics: ['ai', 'tech'],
    maxPositionPct: 18,
    maxExposurePct: 35,
    status: 'active',
    type: 'system',
  },
  {
    id: 'agent-weather-001',
    name: 'Weather Quant',
    description: 'Hurricane, drought, and extreme weather events',
    avatar: '🌡️',
    strategyPersona: 'Analyze NOAA models, satellite data, and historical patterns. Specialize in high-impact weather events.',
    mcpEndpoint: '',
    truthScore: 0.81,
    brierScore: 0.20,
    reputationHash: '0x3e8a...5c34',
    totalTrades: 342,
    winningTrades: 256,
    totalPnl: 34000,
    stakedBudget: 150000,
    permissions: { googleNews: false, marineTraffic: false, privateLiquidity: false, noaaWeather: true, githubActivity: false, socialSentiment: false },
    topics: ['weather'],
    maxPositionPct: 12,
    maxExposurePct: 25,
    status: 'active',
    type: 'system',
  },
  {
    id: 'agent-contrarian-001',
    name: 'Contrarian Alpha',
    description: 'Fade consensus, exploit overconfidence',
    avatar: '🔄',
    strategyPersona: 'You are a contrarian. When consensus reaches extreme levels, take the opposite position. Trust data over narrative.',
    mcpEndpoint: '',
    truthScore: 0.68,
    brierScore: 0.31,
    reputationHash: '0x6f2b...4d78',
    totalTrades: 456,
    winningTrades: 278,
    totalPnl: -12000,
    stakedBudget: 100000,
    permissions: { googleNews: true, marineTraffic: false, privateLiquidity: false, noaaWeather: false, githubActivity: false, socialSentiment: true },
    topics: ['crypto', 'ai'],
    maxPositionPct: 25,
    maxExposurePct: 60,
    status: 'paused',
    type: 'system',
  },
];

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
function AgentCard({ agent, onToggleStatus, onDelete }: { 
  agent: AgentData; 
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

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
            <div className="text-3xl">{agent.avatar}</div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{agent.name}</h3>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleStatus(agent.id)}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                agent.status === 'active' 
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              )}
            >
              {agent.status === 'active' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg bg-slate-800 text-gray-400 hover:bg-slate-700 transition-colors"
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
                <p className="text-sm text-gray-300 italic bg-black/30 rounded-lg p-3">
                  "{agent.strategyPersona}"
                </p>
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

// Create Agent Modal
function CreateAgentModal({ isOpen, onClose, onCreate }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onCreate: (agent: Partial<AgentData>) => void;
}) {
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
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name) return;
    setIsCreating(true);
    
    try {
      await apiClient.post('/agents', {
        name,
        strategy_persona: persona || description,
        staked_budget: stakedBudget,
        allowed_topics: selectedTopics,
        mcp_endpoint: mcpEndpoint || undefined,
      });
    } catch (e) {
      console.log('Using local state');
    }
    
    onCreate({
      name,
      description,
      strategyPersona: persona,
      mcpEndpoint,
      stakedBudget,
      topics: selectedTopics,
      permissions,
    });
    
    // Reset form
    setName('');
    setDescription('');
    setPersona('');
    setMcpEndpoint('');
    setStakedBudget(100000);
    setSelectedTopics([]);
    setIsCreating(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0a0a0a] border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Deploy New Counterparty</h2>
          <p className="text-sm text-gray-500 mt-1">Configure agent identity, permissions, and doctrine</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
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
              <label className="block text-xs text-gray-500 mb-1">Staked Budget</label>
              <input
                type="number"
                value={stakedBudget}
                onChange={(e) => setStakedBudget(Number(e.target.value))}
                className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the agent's role"
              className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Strategy Persona (System Prompt)</label>
            <textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="You are a strategic trader specialized in..."
              rows={3}
              className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              <Plug className="w-3 h-3 inline mr-1" />
              MCP Endpoint (Optional - bring your own agent)
            </label>
            <input
              type="url"
              value={mcpEndpoint}
              onChange={(e) => setMcpEndpoint(e.target.value)}
              placeholder="https://api.example.com/mcp/your-agent"
              className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none font-mono text-sm"
            />
          </div>

          {/* Topic Selection */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Market Topics</label>
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

          {/* Data Source Permissions */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Data Source Permissions</label>
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

        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name || isCreating}
            className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {isCreating ? 'Deploying...' : 'Deploy Agent'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Agents() {
  const [agents, setAgents] = useState<AgentData[]>(mockAgents);
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch agents from API
  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get<{ agents: any[] }>('/agents');
        if (response?.agents?.length > 0) {
          // Merge API data with mock structure
          const apiAgents: AgentData[] = response.agents.map((a: any) => ({
            id: a.id,
            name: a.name,
            description: a.strategy_persona || a.description || '',
            avatar: a.avatar_url || '🤖',
            strategyPersona: a.strategy_persona || '',
            mcpEndpoint: a.mcp_endpoint || '',
            truthScore: a.metrics?.truth_score || 0.5,
            brierScore: a.metrics?.brier_score || 0.35,
            reputationHash: `0x${a.id.slice(-8)}...`,
            totalTrades: a.metrics?.total_trades || 0,
            winningTrades: a.metrics?.winning_trades || 0,
            totalPnl: a.metrics?.total_pnl || 0,
            stakedBudget: a.staked_budget || 100000,
            permissions: {
              googleNews: true,
              marineTraffic: false,
              privateLiquidity: false,
              noaaWeather: false,
              githubActivity: false,
              socialSentiment: true,
            },
            topics: a.trading_config?.allowed_topics || [],
            maxPositionPct: a.trading_config?.max_position_pct || 15,
            maxExposurePct: a.trading_config?.max_exposure_pct || 40,
            status: a.status || 'active',
            type: a.mcp_endpoint ? 'external' : 'system',
          }));
          setAgents(apiAgents);
        }
      } catch (e) {
        console.log('Using mock agents');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const handleToggleStatus = (id: string) => {
    setAgents(prev => prev.map(a => 
      a.id === id ? { ...a, status: a.status === 'active' ? 'paused' : 'active' } : a
    ));
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remove this counterparty? This action cannot be undone.')) return;
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const handleCreate = (newAgent: Partial<AgentData>) => {
    const agent: AgentData = {
      id: `agent-${Date.now()}`,
      name: newAgent.name || 'New Agent',
      description: newAgent.description || '',
      avatar: '🤖',
      strategyPersona: newAgent.strategyPersona || '',
      mcpEndpoint: newAgent.mcpEndpoint || '',
      truthScore: 0.5,
      brierScore: 0.35,
      reputationHash: `0x${Math.random().toString(16).slice(2, 10)}...`,
      totalTrades: 0,
      winningTrades: 0,
      totalPnl: 0,
      stakedBudget: newAgent.stakedBudget || 100000,
      permissions: newAgent.permissions || {
        googleNews: true,
        marineTraffic: false,
        privateLiquidity: false,
        noaaWeather: false,
        githubActivity: false,
        socialSentiment: true,
      },
      topics: newAgent.topics || [],
      maxPositionPct: 15,
      maxExposurePct: 40,
      status: 'active',
      type: newAgent.mcpEndpoint ? 'external' : 'custom',
    };
    setAgents(prev => [agent, ...prev]);
  };

  const filteredAgents = agents.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesTopic = !selectedTopic || a.topics.includes(selectedTopic);
    return matchesSearch && matchesTopic;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading counterparties...</p>
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
              <h1 className="text-2xl font-bold text-white">Counterparties</h1>
              <p className="text-gray-500 text-sm mt-1">KYA (Know Your Agent) Registry & Governance</p>
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
                placeholder="Search counterparties..."
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
        onCreate={handleCreate}
      />
    </div>
  );
}
