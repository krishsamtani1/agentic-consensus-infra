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
  Radar
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useWebSocket } from '../hooks/useWebSocket';
import CommanderRadar from '../components/CommanderRadar';
import { AgentReasoningTooltip, generateMockReasoning, TradeReasoning } from '../components/AgentReasoningTooltip';

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
      className="bg-slate-800 rounded-xl p-6 border border-slate-700"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1 tabular-nums">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-1">
          {trend >= 0 ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
          <span className={trend >= 0 ? 'text-green-400' : 'text-red-400'}>
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-slate-500 text-sm ml-1">vs last hour</span>
        </div>
      )}
    </motion.div>
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
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <h3 className="font-semibold text-white">Live Activity Feed</h3>
      </div>
      <div className="divide-y divide-slate-700/50 max-h-80 overflow-auto">
        {recentMessages.length === 0 ? (
          <div className="p-4 text-slate-500 text-sm text-center">
            Waiting for events...
          </div>
        ) : (
          recentMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400">[{msg.channel}]</span>
                <span className="text-sm text-white">{msg.event}</span>
                <span className="text-xs text-slate-500 ml-auto">
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

function TradeFeedWithReasoning() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center gap-2">
        <Activity className="w-5 h-5 text-purple-400" />
        <h3 className="font-semibold text-white">Recent Trades</h3>
        <span className="text-xs text-slate-400 ml-auto">Hover for AI reasoning</span>
      </div>
      <div className="divide-y divide-slate-700/50 max-h-80 overflow-auto">
        {mockTrades.map((trade, i) => (
          <AgentReasoningTooltip key={i} trade={trade}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-3 hover:bg-slate-700/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  trade.action === 'buy' ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  {trade.action === 'buy' ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{trade.agent_name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      trade.action === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.action.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {trade.quantity} {trade.outcome.toUpperCase()} @ {(trade.price * 100).toFixed(0)}¢
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-white">
                    ${(trade.price * trade.quantity).toFixed(0)}
                  </div>
                  <div className="text-xs text-slate-500">
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
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Real-time overview of TRUTH-NET consensus engine</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Volume"
          value={`$${(mockStats.totalVolume / 1000).toFixed(1)}K`}
          icon={DollarSign}
          trend={12.5}
          color="bg-cyan-600"
        />
        <StatCard
          title="Active Markets"
          value={mockStats.activeMarkets}
          icon={BarChart3}
          trend={8.3}
          color="bg-purple-600"
        />
        <StatCard
          title="Total Agents"
          value={mockStats.totalAgents}
          icon={Users}
          trend={-2.1}
          color="bg-orange-600"
        />
        <StatCard
          title="Avg Truth Score"
          value={(mockStats.avgTruthScore * 100).toFixed(0) + '%'}
          icon={Activity}
          trend={3.2}
          color="bg-green-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Volume Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4">24h Volume</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockVolumeData}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="hour" 
                  stroke="#64748b" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
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
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4">Sample Market Prices</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockPriceData}>
                <XAxis 
                  dataKey="tick" 
                  stroke="#64748b" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12}
                  tickLine={false}
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#94a3b8' }}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Engine Stats */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Engine Performance
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Trades/sec</span>
              <span className="text-white font-mono">{mockStats.tradesPerSecond}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Orders in Book</span>
              <span className="text-white font-mono">{mockStats.ordersInBook.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Latency (p99)</span>
              <span className="text-green-400 font-mono">2.3ms</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Circuit Breakers</span>
              <span className="text-green-400">All Closed</span>
            </div>
          </div>
        </div>

        {/* Live Feed */}
        <div className="lg:col-span-2">
          <LiveFeed />
        </div>
      </div>

      {/* Radar & Trade Reasoning Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Commander's Radar */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Radar className="w-5 h-5 text-cyan-400" />
            Commander's Radar
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Market density by category. Larger blips = higher volume.
          </p>
          <CommanderRadar />
        </div>

        {/* Trade Feed with Reasoning */}
        <TradeFeedWithReasoning />
      </div>
    </div>
  );
}
