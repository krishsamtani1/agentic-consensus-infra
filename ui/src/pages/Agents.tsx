import { useState } from 'react';
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
  MessageSquare,
  Tag,
  Filter,
  Link2,
  Trash2,
  Copy,
  Zap,
  Brain,
  Eye,
  Shuffle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { apiClient } from '../api/client';

// Personality presets for quick agent creation
const PERSONALITY_PRESETS = [
  { 
    id: 'cynic', 
    name: 'The Cynic', 
    icon: Eye,
    description: 'Skeptical and contrarian - bets against hype',
    prompt: 'You are a cynical contrarian trader. Question every bullish narrative. Look for overconfidence, inflated expectations, and irrational exuberance. Prefer short positions when sentiment is euphoric. Trust hard data over headlines.',
    color: 'red'
  },
  { 
    id: 'quant', 
    name: 'High-Frequency Quant', 
    icon: Zap,
    description: 'Fast execution, statistical arbitrage',
    prompt: 'You are a high-frequency quantitative trader. Focus on statistical patterns, mean reversion, and micro-inefficiencies. Execute rapidly with tight risk limits. Prefer high-volume, liquid markets. Target 0.5-2% per trade.',
    color: 'yellow'
  },
  { 
    id: 'news-junkie', 
    name: 'The News Junkie', 
    icon: MessageSquare,
    description: 'Trades on breaking headlines',
    prompt: 'You react to breaking news faster than anyone. Monitor headline sentiment and social velocity. Enter positions within seconds of high-impact events. Accept higher volatility for first-mover advantage.',
    color: 'blue'
  },
  { 
    id: 'oracle', 
    name: 'The Oracle', 
    icon: Brain,
    description: 'Deep research, long-term conviction',
    prompt: 'You are a patient, deep researcher. Analyze fundamentals, historical precedents, and structural trends. Hold positions for days or weeks. High conviction trades only. Quality over quantity.',
    color: 'purple'
  },
  { 
    id: 'chaos', 
    name: 'Chaos Agent', 
    icon: Shuffle,
    description: 'Random exploration and discovery',
    prompt: 'You explore unconventional angles and make unexpected bets. 20% of your trades should be pure exploration of neglected markets. Balance randomness with basic risk management.',
    color: 'orange'
  },
];

// Topic clusters for market grouping
const TOPIC_CLUSTERS = [
  { id: 'shipping', label: '#LogisticsWar', keywords: ['port', 'canal', 'vessel', 'freight', 'container'], color: 'blue' },
  { id: 'ai-news', label: '#AIWar', keywords: ['ai', 'llm', 'gpt', 'model', 'neural'], color: 'purple' },
  { id: 'weather', label: '#ClimateRisk', keywords: ['storm', 'hurricane', 'drought', 'temperature'], color: 'green' },
  { id: 'crypto', label: '#CryptoAlpha', keywords: ['bitcoin', 'eth', 'token', 'blockchain'], color: 'orange' },
  { id: 'tech', label: '#TechEarnings', keywords: ['github', 'npm', 'api', 'cloud', 'aws'], color: 'cyan' },
  { id: 'geopolitics', label: '#PoliticalTheater', keywords: ['election', 'policy', 'sanctions', 'conflict'], color: 'red' },
];

// MCP Tools available for agents
const MCP_TOOLS = [
  { name: 'get_consensus_odds', label: 'Get Consensus Odds', description: 'Fetch market probabilities' },
  { name: 'place_margin_hedge', label: 'Place Margin Hedge', description: 'Execute hedged positions' },
  { name: 'fetch_truth_audit', label: 'Fetch Truth Audit', description: 'Get resolution audit trail' },
  { name: 'list_markets', label: 'List Markets', description: 'Browse available markets' },
  { name: 'get_agent_positions', label: 'Get Positions', description: 'View current positions' },
  { name: 'calculate_hedge_strategy', label: 'Calculate Hedge', description: 'Recommend hedging' },
];

// Mock agents data with enhanced fields
const mockAgents = [
  {
    id: '1',
    name: 'WeatherBot-Pro',
    description: 'Specialized in weather-related predictions',
    avatar_url: '',
    system_prompt: 'You are a weather prediction specialist. Focus on NOAA data, satellite imagery, and historical patterns to assess event probabilities.',
    mcp_endpoint: '',
    truth_score: 0.89,
    total_trades: 1247,
    winning_trades: 892,
    total_pnl: 45230,
    status: 'active',
    strategy: 'informed',
    balance: 125000,
    topics: ['weather'],
  },
  {
    id: '2',
    name: 'LogisticsHedger',
    description: 'Supply chain risk management agent',
    avatar_url: '',
    system_prompt: 'You are a logistics risk hedger. Your goal is to buy insurance against supply chain disruptions. Be conservative and hedge early.',
    mcp_endpoint: 'http://localhost:8080/mcp/logistics',
    truth_score: 0.76,
    total_trades: 892,
    winning_trades: 543,
    total_pnl: 23100,
    status: 'active',
    strategy: 'momentum',
    balance: 89000,
    topics: ['shipping'],
  },
  {
    id: '3',
    name: 'CloudOracle-v2',
    description: 'Cloud infrastructure event predictions',
    avatar_url: '',
    system_prompt: 'You monitor cloud provider status pages and predict outages. Use historical incident data and current metrics.',
    mcp_endpoint: '',
    truth_score: 0.82,
    total_trades: 2103,
    winning_trades: 1456,
    total_pnl: 67800,
    status: 'active',
    strategy: 'informed',
    balance: 234000,
    topics: ['tech'],
  },
  {
    id: '4',
    name: 'MarketMaker-001',
    description: 'Automated liquidity provider',
    avatar_url: '',
    system_prompt: 'Provide liquidity across all markets. Quote tight spreads and manage inventory risk. Target 0.5% spread capture.',
    mcp_endpoint: '',
    truth_score: 0.71,
    total_trades: 5672,
    winning_trades: 3234,
    total_pnl: 12400,
    status: 'active',
    strategy: 'mean_reversion',
    balance: 456000,
    topics: ['shipping', 'weather', 'tech'],
  },
  {
    id: '5',
    name: 'ArbitrageSeeker',
    description: 'Cross-market arbitrage detection',
    avatar_url: '',
    system_prompt: 'Find and exploit arbitrage opportunities between correlated markets. Act fast and close positions quickly.',
    mcp_endpoint: 'http://localhost:8081/mcp/arb',
    truth_score: 0.68,
    total_trades: 3421,
    winning_trades: 1890,
    total_pnl: -5200,
    status: 'active',
    strategy: 'random',
    balance: 34000,
    topics: ['crypto', 'ai-news'],
  },
];

function TruthScoreBadge({ score }: { score: number }) {
  const percentage = score * 100;
  const color = score >= 0.8 ? 'text-green-400' : score >= 0.6 ? 'text-yellow-400' : 'text-red-400';
  const bgColor = score >= 0.8 ? 'bg-green-400' : score >= 0.6 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full', bgColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={clsx('font-mono text-sm font-medium', color)}>
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
}

function AgentCard({ 
  agent, 
  onDelete 
}: { 
  agent: typeof mockAgents[0]; 
  onDelete?: (id: string) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const winRate = agent.total_trades > 0 
    ? (agent.winning_trades / agent.total_trades * 100).toFixed(1) 
    : '0.0';

  const handleDelete = async () => {
    if (!window.confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      // Optimistic UI update
      onDelete?.(agent.id);
    } catch (error) {
      console.error('Failed to delete agent:', error);
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      layout
      className={clsx(
        "bg-slate-800 rounded-xl border border-slate-700 p-5 relative",
        isDeleting && "opacity-50 pointer-events-none"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {agent.avatar_url ? (
            <img 
              src={agent.avatar_url} 
              alt={agent.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white">{agent.name}</h3>
              {agent.mcp_endpoint && (
                <span className="flex items-center gap-1 text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                  <Plug className="w-3 h-3" />
                  MCP
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">{agent.description}</p>
          </div>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowActions(!showActions)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-slate-400" />
          </button>
          
          {/* Actions dropdown */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-10 z-10 bg-slate-700 rounded-lg border border-slate-600 shadow-xl py-1 min-w-[140px]"
              >
                <button
                  onClick={() => { setShowPrompt(!showPrompt); setShowActions(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  View Prompt
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(agent.id); setShowActions(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy ID
                </button>
                <hr className="border-slate-600 my-1" />
                <button
                  onClick={() => { handleDelete(); setShowActions(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* System Prompt Preview */}
      {showPrompt && agent.system_prompt && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">System Prompt</div>
          <p className="text-sm text-slate-300 italic">"{agent.system_prompt}"</p>
          {agent.mcp_endpoint && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="text-xs text-slate-400 mb-1">MCP Endpoint</div>
              <code className="text-xs text-purple-400 font-mono">{agent.mcp_endpoint}</code>
            </div>
          )}
        </div>
      )}

      {/* Topic Tags */}
      {agent.topics && agent.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {agent.topics.map(topic => {
            const cluster = TOPIC_CLUSTERS.find(c => c.id === topic);
            return (
              <span 
                key={topic}
                className={clsx(
                  'text-xs px-2 py-0.5 rounded-full',
                  cluster?.color === 'blue' && 'bg-blue-500/20 text-blue-400',
                  cluster?.color === 'purple' && 'bg-purple-500/20 text-purple-400',
                  cluster?.color === 'green' && 'bg-green-500/20 text-green-400',
                  cluster?.color === 'orange' && 'bg-orange-500/20 text-orange-400',
                  cluster?.color === 'cyan' && 'bg-cyan-500/20 text-cyan-400',
                  !cluster && 'bg-slate-600 text-slate-300'
                )}
              >
                {cluster?.label || topic}
              </span>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">Truth Score</p>
          <TruthScoreBadge score={agent.truth_score} />
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Win Rate</p>
          <p className="font-mono text-white">{winRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
        <div>
          <p className="text-xs text-slate-400">Trades</p>
          <p className="font-mono text-white">{agent.total_trades.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Balance</p>
          <p className="font-mono text-white">${(agent.balance / 1000).toFixed(0)}K</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">P&L</p>
          <p className={clsx(
            'font-mono flex items-center gap-1',
            agent.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
          )}>
            {agent.total_pnl >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            ${Math.abs(agent.total_pnl).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <span className={clsx(
          'text-xs px-2 py-1 rounded',
          agent.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'
        )}>
          {agent.status}
        </span>
        <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
          {agent.strategy}
        </span>
      </div>
    </motion.div>
  );
}

function CreateAgentModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (agent: any) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [mcpEndpoint, setMcpEndpoint] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'personality' | 'advanced'>('basic');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  
  // New A2A-compliant fields
  const [stakedBudget, setStagedBudget] = useState(100000);
  const [maxPositionPct, setMaxPositionPct] = useState(25);
  const [maxExposurePct, setMaxExposurePct] = useState(80);
  const [enabledTools, setEnabledTools] = useState<string[]>(MCP_TOOLS.map(t => t.name));

  const applyPreset = (presetId: string) => {
    const preset = PERSONALITY_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedPreset(presetId);
      setSystemPrompt(preset.prompt);
      if (!name) setName(preset.name);
      if (!description) setDescription(preset.description);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const response = await apiClient.post('/agents', {
        name,
        strategy_persona: systemPrompt || description || 'General purpose trading agent',
        avatar_url: avatarUrl || undefined,
        mcp_endpoint: mcpEndpoint || undefined,
        staked_budget: stakedBudget,
        allowed_topics: selectedTopics,
        max_position_pct: maxPositionPct,
        max_exposure_pct: maxExposurePct,
        auto_trade: true,
      });
      onCreated?.(response.data);
      onClose();
    } catch (error) {
      console.error('Failed to create agent:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev => 
      prev.includes(topicId) 
        ? prev.filter(t => t !== topicId)
        : [...prev, topicId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-lg max-h-[90vh] overflow-auto"
      >
        <h2 className="text-xl font-bold text-white mb-4">Create New Agent</h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('basic')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'basic' 
                ? 'bg-cyan-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            Basic Info
          </button>
          <button
            onClick={() => setActiveTab('personality')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'personality' 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            Personality
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'advanced' 
                ? 'bg-cyan-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            Advanced
          </button>
        </div>

        <div className="space-y-4">
          {activeTab === 'basic' && (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Agent Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., WeatherBot-Pro"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this agent specialize in?"
                  rows={2}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                  <Link2 className="w-4 h-4" />
                  Avatar URL (optional)
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <Tag className="w-4 h-4" />
                  Market Topics
                </label>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_CLUSTERS.map(topic => (
                    <button
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        selectedTopics.includes(topic.id)
                          ? topic.color === 'blue' ? 'bg-blue-600 text-white' :
                            topic.color === 'purple' ? 'bg-purple-600 text-white' :
                            topic.color === 'green' ? 'bg-green-600 text-white' :
                            topic.color === 'orange' ? 'bg-orange-600 text-white' :
                            'bg-cyan-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      {topic.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'personality' && (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Choose a Personality Preset</label>
                <div className="grid grid-cols-1 gap-3">
                  {PERSONALITY_PRESETS.map(preset => {
                    const Icon = preset.icon;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset.id)}
                        className={clsx(
                          'flex items-start gap-3 p-3 rounded-lg border transition-all text-left',
                          selectedPreset === preset.id 
                            ? 'border-purple-500 bg-purple-500/10' 
                            : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                        )}
                      >
                        <div className={clsx(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          preset.color === 'red' && 'bg-red-500/20 text-red-400',
                          preset.color === 'yellow' && 'bg-yellow-500/20 text-yellow-400',
                          preset.color === 'blue' && 'bg-blue-500/20 text-blue-400',
                          preset.color === 'purple' && 'bg-purple-500/20 text-purple-400',
                          preset.color === 'orange' && 'bg-orange-500/20 text-orange-400',
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{preset.name}</span>
                            {selectedPreset === preset.id && (
                              <span className="text-xs bg-purple-500 text-white px-1.5 py-0.5 rounded">Selected</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mt-0.5">{preset.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedPreset && (
                <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                  <div className="text-xs text-slate-400 mb-1">Generated System Prompt</div>
                  <p className="text-sm text-slate-300 italic">"{systemPrompt.slice(0, 150)}..."</p>
                  <button
                    onClick={() => setActiveTab('advanced')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 mt-2"
                  >
                    Edit in Advanced tab →
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'advanced' && (
            <>
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                  <MessageSquare className="w-4 h-4" />
                  System Prompt
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Define the agent's personality, strategy, and decision-making approach..."
                  rows={4}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 resize-none font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  This prompt guides the agent's trading decisions and risk management.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                  <Plug className="w-4 h-4 text-purple-400" />
                  MCP Endpoint (optional)
                </label>
                <input
                  type="url"
                  value={mcpEndpoint}
                  onChange={(e) => setMcpEndpoint(e.target.value)}
                  placeholder="http://localhost:8080/mcp/agent"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Connect an external agent via Model Context Protocol for autonomous trading.
                </p>
              </div>

              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Plug className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-300">MCP Integration</span>
                </div>
                <p className="text-xs text-slate-400">
                  Model Context Protocol allows external AI agents to receive market data and 
                  submit orders autonomously. The endpoint should implement the TRUTH-NET MCP schema.
                </p>
              </div>

              {/* Budget & Staking */}
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Staked Budget
                </label>
                <input
                  type="number"
                  value={stakedBudget}
                  onChange={(e) => setStagedBudget(parseInt(e.target.value) || 0)}
                  placeholder="100000"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:border-green-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Capital allocated from the Escrow Vault. Required for margin trading.
                </p>
              </div>

              {/* Doctrine Limits */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Max Position Size (%)</label>
                  <input
                    type="number"
                    value={maxPositionPct}
                    onChange={(e) => setMaxPositionPct(parseInt(e.target.value) || 25)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Max Exposure (%)</label>
                  <input
                    type="number"
                    value={maxExposurePct}
                    onChange={(e) => setMaxExposurePct(parseInt(e.target.value) || 80)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* MCP Tools Access */}
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  MCP Tools Access
                </label>
                <div className="space-y-2">
                  {MCP_TOOLS.map(tool => (
                    <label key={tool.name} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabledTools.includes(tool.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEnabledTools([...enabledTools, tool.name]);
                          } else {
                            setEnabledTools(enabledTools.filter(t => t !== tool.name));
                          }
                        }}
                        className="rounded bg-slate-600 border-slate-500 text-cyan-500 focus:ring-cyan-500"
                      />
                      <span className="text-sm text-slate-300">{tool.label}</span>
                      <span className="text-xs text-slate-500">({tool.description})</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">Initial Configuration</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Starting Balance</span>
              <span className="text-white font-mono">$10,000 USDC</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-slate-300">Initial Truth Score</span>
              <span className="text-white font-mono">50%</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name || isCreating}
            className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isCreating ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Agents() {
  const [agents, setAgents] = useState(mockAgents);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const handleDeleteAgent = (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const handleCreateAgent = (newAgent: any) => {
    const agent = {
      id: Date.now().toString(),
      name: newAgent.name || 'New Agent',
      description: newAgent.description || '',
      avatar_url: newAgent.avatar_url || '',
      system_prompt: newAgent.system_prompt || '',
      mcp_endpoint: newAgent.mcp_endpoint || '',
      truth_score: 0.5,
      total_trades: 0,
      winning_trades: 0,
      total_pnl: 0,
      status: 'active',
      strategy: 'custom',
      balance: 10000,
      topics: newAgent.topics || [],
    };
    setAgents(prev => [agent, ...prev]);
  };

  const filteredAgents = agents.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesTopic = !selectedTopic || a.topics?.includes(selectedTopic);
    return matchesSearch && matchesTopic;
  });

  // Sort by truth score descending
  const sortedAgents = [...filteredAgents].sort((a, b) => b.truth_score - a.truth_score);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Agents</h1>
          <p className="text-slate-400 mt-1">Manage AI trading agents and their reputations</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Agent
        </button>
      </div>

      {/* Leaderboard */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <Award className="w-5 h-5 text-yellow-400" />
          Truth Score Leaderboard
        </h2>
        <div className="space-y-3">
          {sortedAgents.slice(0, 5).map((agent, index) => (
            <div
              key={agent.id}
              className="flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg"
            >
              <span className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center font-bold',
                index === 0 ? 'bg-yellow-500 text-black' :
                index === 1 ? 'bg-slate-400 text-black' :
                index === 2 ? 'bg-orange-600 text-white' :
                'bg-slate-600 text-slate-300'
              )}>
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-white">{agent.name}</p>
                <p className="text-sm text-slate-400">{agent.total_trades} trades</p>
              </div>
              <TruthScoreBadge score={agent.truth_score} />
            </div>
          ))}
        </div>
      </div>

      {/* Topic Filter */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-400">Filter by Topic</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTopic(null)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              selectedTopic === null 
                ? 'bg-cyan-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            )}
          >
            All Topics
          </button>
          {TOPIC_CLUSTERS.map(topic => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                selectedTopic === topic.id
                  ? topic.color === 'blue' ? 'bg-blue-600 text-white' :
                    topic.color === 'purple' ? 'bg-purple-600 text-white' :
                    topic.color === 'green' ? 'bg-green-600 text-white' :
                    topic.color === 'orange' ? 'bg-orange-600 text-white' :
                    'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              )}
            >
              {topic.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {sortedAgents.map((agent) => (
            <AgentCard 
              key={agent.id} 
              agent={agent} 
              onDelete={handleDeleteAgent}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateAgentModal 
          onClose={() => setShowCreate(false)} 
          onCreated={handleCreateAgent}
        />
      )}
    </div>
  );
}
