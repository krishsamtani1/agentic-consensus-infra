import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Activity,
  DollarSign,
  BarChart3,
  Clock,
  Zap,
  Radar,
  ExternalLink,
  Flame,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useWebSocket } from '../hooks/useWebSocket';
import CommanderRadar from '../components/CommanderRadar';
import { AgentReasoningTooltip, generateMockReasoning, TradeReasoning } from '../components/AgentReasoningTooltip';
import { apiClient, Market } from '../api/client';

// Mock data for the dashboard
const mockStats = {
  totalVolume: 1_234_567,
  activeMarkets: 12,
  totalAgents: 48,
  avgTruthScore: 0.67,
  tradesPerSecond: 42,
  ordersInBook: 1_832,
};

const mockVolumeData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  volume: Math.random() * 50000 + 10000,
  trades: Math.floor(Math.random() * 100 + 20),
}));

const mockPriceData = Array.from({ length: 50 }, (_, i) => ({
  tick: i,
  yes: 0.5 + (Math.sin(i / 5) * 0.2) + (Math.random() - 0.5) * 0.1,
  no: 0.5 - (Math.sin(i / 5) * 0.2) + (Math.random() - 0.5) * 0.1,
}));

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  color: string;
}

function StatCard({ title, value, icon: Icon, trend, color }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111111] rounded-xl p-6 border border-[#1a1a1a] hover:border-cyan-500/30 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">{value}</p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-1">
          {trend >= 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
          <span className={trend >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-gray-600 text-sm ml-1">vs last hour</span>
        </div>
      )}
    </motion.div>
  );
}

// Top Markets Teaser Component
function TopMarketsTeaser() {
  const { data: marketsData, isLoading } = useQuery({
    queryKey: ['top-markets'],
    queryFn: async () => {
      const response = await apiClient.get<{ markets: Market[]; total: number }>(
        '/markets?limit=100'
      );
      return response;
    },
    refetchInterval: 10000,
  });

  // Sort by volume and take top 5
  const topMarkets = (marketsData?.markets || [])
    .sort((a, b) => ((b.volume_yes || 0) + (b.volume_no || 0)) - ((a.volume_yes || 0) + (a.volume_no || 0)))
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/3" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden">
      <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          <h3 className="font-semibold text-white">Hottest Markets</h3>
          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">LIVE</span>
        </div>
        <Link 
          to="/markets" 
          className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          View All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="divide-y divide-[#1a1a1a]">
        {topMarkets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No markets available. Check your API connection.
          </div>
        ) : (
          topMarkets.map((market, i) => {
            const volume = (market.volume_yes || 0) + (market.volume_no || 0);
            const yesPrice = market.last_price_yes ?? (market.volume_yes && market.volume_no 
              ? market.volume_yes / (market.volume_yes + market.volume_no) 
              : 0.5);
            
            return (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500">{market.ticker}</span>
                      {market.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                          #{market.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white truncate mt-0.5">{market.title}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">YES</span>
                      <span className={`text-lg font-bold font-mono ${yesPrice > 0.5 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(yesPrice * 100).toFixed(0)}¢
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      ${(volume / 1000).toFixed(1)}K vol
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Mock recent trades with reasoning
const mockTrades: TradeReasoning[] = [
  generateMockReasoning('WeatherBot-Pro', 'agent1', 'buy', 'yes', 0.65, 500),
  generateMockReasoning('LogisticsHedger', 'agent2', 'sell', 'yes', 0.62, 300),
  generateMockReasoning('CloudOracle-v2', 'agent3', 'buy', 'no', 0.38, 750),
  generateMockReasoning('MarketMaker-001', 'agent4', 'sell', 'no', 0.35, 1200),
  generateMockReasoning('TechSentinel', 'agent5', 'buy', 'yes', 0.72, 200),
];

function LiveFeed() {
  const { messages } = useWebSocket();
  const recentMessages = messages.slice(-10).reverse();

  return (
    <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden h-full">
      <div className="p-4 border-b border-[#1a1a1a] flex items-center gap-2">
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        <h3 className="font-semibold text-white">Live Activity Feed</h3>
      </div>
      <div className="divide-y divide-[#1a1a1a] max-h-80 overflow-auto">
        {recentMessages.length === 0 ? (
          <div className="p-8 text-gray-600 text-sm text-center">
            Waiting for events...
          </div>
        ) : (
          recentMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400">[{msg.channel}]</span>
                <span className="text-sm text-white">{msg.event}</span>
                <span className="text-xs text-gray-600 ml-auto">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// Intelligence Cascade - LLM-translated trade summaries
function IntelligenceCascade() {
  const cascadeEvents = [
    {
      id: 1,
      agent: 'Geopolitical Analyst',
      action: 'LONG YES',
      market: 'US-China Tariff Escalation',
      size: 40000,
      summary: 'Agent-Gamma is hedging $40k against US-China tariff escalation following leaked trade memo.',
      confidence: 0.78,
      timestamp: new Date(Date.now() - 120000),
    },
    {
      id: 2,
      agent: 'Logistics Sentinel',
      action: 'SHORT NO',
      market: 'Panama Canal Bottleneck',
      size: 25000,
      summary: 'Logistics-Prime exits Panama exposure after satellite data shows queue normalization.',
      confidence: 0.82,
      timestamp: new Date(Date.now() - 300000),
    },
    {
      id: 3,
      agent: 'Tech Oracle',
      action: 'LONG YES',
      market: 'OpenAI GPT-5 Release Q1',
      size: 15000,
      summary: 'Tech-Oracle accumulates GPT-5 release bets citing insider GitHub activity spike.',
      confidence: 0.65,
      timestamp: new Date(Date.now() - 450000),
    },
    {
      id: 4,
      agent: 'Weather Quant',
      action: 'LONG YES',
      market: 'Hurricane Cat-4+ Gulf Feb',
      size: 8000,
      summary: 'Weather-Quant opens hurricane hedge as NOAA models shift toward active season.',
      confidence: 0.71,
      timestamp: new Date(Date.now() - 600000),
    },
    {
      id: 5,
      agent: 'Contrarian Alpha',
      action: 'SHORT YES',
      market: 'BTC 100K January',
      size: 50000,
      summary: 'Contrarian-Alpha fades Bitcoin hype, citing excessive retail sentiment indicators.',
      confidence: 0.68,
      timestamp: new Date(Date.now() - 900000),
    },
  ];

  return (
    <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden">
      <div className="p-4 border-b border-[#1a1a1a] flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h3 className="font-semibold text-white">Intelligence Cascade</h3>
        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ml-2">AI TRANSLATED</span>
        <span className="text-xs text-gray-600 ml-auto">Real-time strategic summaries</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-4 p-4" style={{ minWidth: 'max-content' }}>
          {cascadeEvents.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-black/50 border border-[#262626] rounded-xl p-4 min-w-[320px] hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-cyan-400">{event.agent}</span>
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded-lg font-mono',
                  event.action.includes('LONG') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                )}>
                  {event.action}
                </span>
              </div>
              <p className="text-sm text-white mb-2">{event.summary}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>${(event.size / 1000).toFixed(0)}K</span>
                <span>{Math.floor((Date.now() - event.timestamp.getTime()) / 60000)}m ago</span>
                <span className="text-cyan-400">{(event.confidence * 100).toFixed(0)}% conf</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TradeFeedWithReasoning() {
  return (
    <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden h-full">
      <div className="p-4 border-b border-[#1a1a1a] flex items-center gap-2">
        <Activity className="w-5 h-5 text-purple-400" />
        <h3 className="font-semibold text-white">Recent Trades</h3>
        <span className="text-xs text-gray-600 ml-auto">Hover for AI reasoning</span>
      </div>
      <div className="divide-y divide-[#1a1a1a] overflow-auto" style={{ maxHeight: '400px' }}>
        {mockTrades.map((trade, i) => (
          <AgentReasoningTooltip key={i} trade={trade}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-3 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  trade.action === 'buy' ? 'bg-emerald-500/20' : 'bg-red-500/20'
                }`}>
                  {trade.action === 'buy' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{trade.agent_name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      trade.action === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.action.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {trade.quantity} {trade.outcome.toUpperCase()} @ {(trade.price * 100).toFixed(0)}¢
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-white">
                    ${(trade.price * trade.quantity).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-600">
                    {trade.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </motion.div>
          </AgentReasoningTooltip>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  // Fetch live stats from API
  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get<{ markets: Market[]; total: number }>('/markets?limit=100');
      const markets = response?.markets || [];
      const totalVolume = markets.reduce((a, m) => a + (m.volume_yes || 0) + (m.volume_no || 0), 0);
      return {
        totalVolume,
        activeMarkets: markets.length,
        totalAgents: 48, // Mock for now
        avgTruthScore: 0.67, // Mock for now
      };
    },
    refetchInterval: 10000,
  });

  const liveStats = statsData || mockStats;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-white">Command Center</h1>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full animate-pulse">
            LIVE
          </span>
        </div>
        <p className="text-gray-500 mt-1">Real-time overview of TRUTH-NET Sovereign Edition</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Volume"
          value={`$${(liveStats.totalVolume / 1000).toFixed(1)}K`}
          icon={DollarSign}
          trend={12.5}
          color="bg-gradient-to-br from-cyan-600 to-blue-600"
        />
        <StatCard
          title="Active Markets"
          value={liveStats.activeMarkets}
          icon={BarChart3}
          trend={8.3}
          color="bg-gradient-to-br from-purple-600 to-pink-600"
        />
        <StatCard
          title="Total Agents"
          value={liveStats.totalAgents}
          icon={Users}
          trend={-2.1}
          color="bg-gradient-to-br from-orange-600 to-red-600"
        />
        <StatCard
          title="Avg Truth Score"
          value={(liveStats.avgTruthScore * 100).toFixed(0) + '%'}
          icon={Activity}
          trend={3.2}
          color="bg-gradient-to-br from-emerald-600 to-teal-600"
        />
      </div>

      {/* Top Markets Teaser */}
      <div className="mb-8">
        <TopMarketsTeaser />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Volume Chart */}
        <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] p-6">
          <h3 className="font-semibold text-white mb-4">24h Volume</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockVolumeData}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="hour" 
                  stroke="#404040" 
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#404040" 
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #262626',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#737373' }}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#volumeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Price Chart */}
        <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] p-6">
          <h3 className="font-semibold text-white mb-4">Sample Market Prices</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockPriceData}>
                <XAxis 
                  dataKey="tick" 
                  stroke="#404040" 
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#404040" 
                  fontSize={11}
                  tickLine={false}
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #262626',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#737373' }}
                  formatter={(value: number) => [`${(value * 100).toFixed(1)}%`]}
                />
                <Line
                  type="monotone"
                  dataKey="yes"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="YES"
                />
                <Line
                  type="monotone"
                  dataKey="no"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  name="NO"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Engine Stats */}
        <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Engine Performance
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Trades/sec</span>
              <span className="text-white font-mono">{mockStats.tradesPerSecond}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Orders in Book</span>
              <span className="text-white font-mono">{mockStats.ordersInBook.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Latency (p99)</span>
              <span className="text-emerald-400 font-mono">2.3ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Circuit Breakers</span>
              <span className="text-emerald-400">All Closed</span>
            </div>
          </div>
        </div>

        {/* Live Feed */}
        <div className="lg:col-span-2">
          <LiveFeed />
        </div>
      </div>

      {/* Radar & Trade Reasoning Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
        {/* Market Density Analysis */}
        <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Radar className="w-5 h-5 text-cyan-400" />
            Market Density Analysis
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Market density by category. Larger blips = higher volume.
          </p>
          <CommanderRadar />
        </div>

        {/* Trade Feed with Reasoning - Full Width */}
        <TradeFeedWithReasoning />
      </div>

      {/* Intelligence Cascade - Full Width */}
      <div className="mt-8">
        <IntelligenceCascade />
      </div>
    </div>
  );
}
