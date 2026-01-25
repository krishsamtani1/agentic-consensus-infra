import { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings,
  Activity,
  Users,
  TrendingUp,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

interface SimulationConfig {
  agentCount: number;
  marketCount: number;
  tickInterval: number;
  durationTicks: number;
  initialBalance: number;
}

interface SimulationState {
  running: boolean;
  tick: number;
  totalTrades: number;
  totalVolume: number;
  agents: Array<{
    id: string;
    name: string;
    balance: number;
    pnl: number;
    trades: number;
  }>;
  priceHistory: Array<{
    tick: number;
    price: number;
  }>;
}

const defaultConfig: SimulationConfig = {
  agentCount: 10,
  marketCount: 3,
  tickInterval: 100,
  durationTicks: 500,
  initialBalance: 10000,
};

export default function Simulation() {
  const [config, setConfig] = useState<SimulationConfig>(defaultConfig);
  const [state, setState] = useState<SimulationState>({
    running: false,
    tick: 0,
    totalTrades: 0,
    totalVolume: 0,
    agents: [],
    priceHistory: [],
  });
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize agents
  useEffect(() => {
    const agents = Array.from({ length: config.agentCount }, (_, i) => ({
      id: `agent_${i}`,
      name: `Agent-${String(i + 1).padStart(3, '0')}`,
      balance: config.initialBalance,
      pnl: 0,
      trades: 0,
    }));
    setState(s => ({ ...s, agents }));
  }, [config.agentCount, config.initialBalance]);

  // Simulation loop
  useEffect(() => {
    if (state.running && state.tick < config.durationTicks) {
      intervalRef.current = setInterval(() => {
        setState(s => {
          if (s.tick >= config.durationTicks) {
            return { ...s, running: false };
          }

          // Simulate trades
          const newTrades = Math.floor(Math.random() * 5);
          const newVolume = newTrades * (Math.random() * 100 + 50);

          // Update agents randomly
          const updatedAgents = s.agents.map(agent => {
            if (Math.random() > 0.7) {
              const pnlChange = (Math.random() - 0.5) * 200;
              return {
                ...agent,
                balance: agent.balance + pnlChange,
                pnl: agent.pnl + pnlChange,
                trades: agent.trades + (Math.random() > 0.5 ? 1 : 0),
              };
            }
            return agent;
          });

          // Update price history
          const lastPrice = s.priceHistory.length > 0 
            ? s.priceHistory[s.priceHistory.length - 1].price 
            : 0.5;
          const newPrice = Math.max(0.1, Math.min(0.9, lastPrice + (Math.random() - 0.5) * 0.05));

          return {
            ...s,
            tick: s.tick + 1,
            totalTrades: s.totalTrades + newTrades,
            totalVolume: s.totalVolume + newVolume,
            agents: updatedAgents,
            priceHistory: [...s.priceHistory.slice(-100), { tick: s.tick + 1, price: newPrice }],
          };
        });
      }, config.tickInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [state.running, state.tick, config.durationTicks, config.tickInterval]);

  const handleStart = () => {
    setState(s => ({ ...s, running: true }));
  };

  const handlePause = () => {
    setState(s => ({ ...s, running: false }));
  };

  const handleReset = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    const agents = Array.from({ length: config.agentCount }, (_, i) => ({
      id: `agent_${i}`,
      name: `Agent-${String(i + 1).padStart(3, '0')}`,
      balance: config.initialBalance,
      pnl: 0,
      trades: 0,
    }));
    setState({
      running: false,
      tick: 0,
      totalTrades: 0,
      totalVolume: 0,
      agents,
      priceHistory: [],
    });
  };

  const progress = (state.tick / config.durationTicks) * 100;

  // Sort agents by P&L
  const sortedAgents = [...state.agents].sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Simulation Mode</h1>
          <p className="text-slate-400 mt-1">Test engine stability with mock agents</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
          {!state.running ? (
            <button
              onClick={handleStart}
              disabled={state.tick >= config.durationTicks}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <Play className="w-5 h-5" />
              {state.tick > 0 ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <Pause className="w-5 h-5" />
              Pause
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400">Simulation Progress</span>
          <span className="text-white font-mono">
            Tick {state.tick} / {config.durationTicks}
          </span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <span className="text-slate-400">Trades:</span>
              <span className="text-white font-mono">{state.totalTrades.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-slate-400">Volume:</span>
              <span className="text-white font-mono">${state.totalVolume.toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="text-slate-400">Agents:</span>
              <span className="text-white font-mono">{config.agentCount}</span>
            </div>
          </div>
          {state.running && (
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
              <span className="text-yellow-400">Running...</span>
            </div>
          )}
        </div>
      </div>

      {/* Charts and Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4">Market Price (YES Token)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={state.priceHistory}>
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
                  formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Price']}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent Leaderboard */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4">Agent Performance</h3>
          <div className="space-y-2 max-h-64 overflow-auto">
            {sortedAgents.map((agent, index) => (
              <motion.div
                key={agent.id}
                layout
                className="flex items-center gap-3 p-2 bg-slate-700/30 rounded-lg"
              >
                <span className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-slate-400 text-black' :
                  index === 2 ? 'bg-orange-600 text-white' :
                  'bg-slate-600 text-slate-300'
                )}>
                  {index + 1}
                </span>
                <span className="text-white font-medium flex-1">{agent.name}</span>
                <span className="text-slate-400 text-sm">{agent.trades} trades</span>
                <span className={clsx(
                  'font-mono text-sm',
                  agent.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {agent.pnl >= 0 ? '+' : ''}{agent.pnl.toFixed(0)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md"
            >
              <h2 className="text-xl font-bold text-white mb-4">Simulation Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Number of Agents
                  </label>
                  <input
                    type="number"
                    value={config.agentCount}
                    onChange={(e) => setConfig(c => ({ ...c, agentCount: parseInt(e.target.value) || 1 }))}
                    min={1}
                    max={100}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Number of Markets
                  </label>
                  <input
                    type="number"
                    value={config.marketCount}
                    onChange={(e) => setConfig(c => ({ ...c, marketCount: parseInt(e.target.value) || 1 }))}
                    min={1}
                    max={10}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Tick Interval (ms)
                  </label>
                  <input
                    type="number"
                    value={config.tickInterval}
                    onChange={(e) => setConfig(c => ({ ...c, tickInterval: parseInt(e.target.value) || 50 }))}
                    min={10}
                    max={1000}
                    step={10}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Duration (ticks)
                  </label>
                  <input
                    type="number"
                    value={config.durationTicks}
                    onChange={(e) => setConfig(c => ({ ...c, durationTicks: parseInt(e.target.value) || 100 }))}
                    min={100}
                    max={10000}
                    step={100}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Initial Balance per Agent
                  </label>
                  <input
                    type="number"
                    value={config.initialBalance}
                    onChange={(e) => setConfig(c => ({ ...c, initialBalance: parseInt(e.target.value) || 1000 }))}
                    min={1000}
                    max={1000000}
                    step={1000}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleReset();
                    setShowSettings(false);
                  }}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Apply & Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
