import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, TrendingDown, Users, Activity, DollarSign, BarChart3,
  Zap, Radar, ArrowRight, AlertTriangle, Shield, Send, Terminal,
  FileText, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight,
  Flame, Target, Brain, Rocket, CreditCard, Bot, PieChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart as RPieChart, Pie, Cell 
} from 'recharts';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';
import CommanderRadar from '../components/CommanderRadar';
import { apiClient, Market } from '../api/client';

// ============================================================================
// TYPES
// ============================================================================

interface StrategicBrief {
  id: string;
  timestamp: Date;
  type: 'position' | 'hedge' | 'alert' | 'settlement' | 'doctrine';
  priority: 'critical' | 'high' | 'medium' | 'low';
  agent: string;
  agentAvatar: string;
  action: string;
  market: string;
  marketTicker: string;
  size: number;
  summary: string;
  reasoning: string;
  confidence: number;
  tags: string[];
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockVolumeData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  volume: Math.random() * 50000 + 10000,
  trades: Math.floor(Math.random() * 100 + 20),
}));

const mockPnlData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  pnl: (Math.random() - 0.4) * 2000 + (i * 50),
  cumulative: 0,
}));
// Calculate cumulative P&L
let cumPnl = 0;
mockPnlData.forEach(d => { cumPnl += d.pnl; d.cumulative = cumPnl; });

const mockPortfolioData = [
  { name: 'Geopolitics', value: 35, color: '#06b6d4' },
  { name: 'Tech & AI', value: 25, color: '#8b5cf6' },
  { name: 'Crypto', value: 20, color: '#f59e0b' },
  { name: 'Logistics', value: 12, color: '#10b981' },
  { name: 'Weather', value: 8, color: '#ef4444' },
];

const mockBriefs: StrategicBrief[] = [
  { id: 'b1', timestamp: new Date(Date.now() - 45000), type: 'position', priority: 'critical', agent: 'Geopolitical Analyst', agentAvatar: '🌍', action: 'LONG', market: 'US-China Trade Tensions', marketTicker: 'GEO-USCH-0129', size: 45000, summary: 'Opened $45K long on trade tensions after diplomatic signals indicate stalled negotiations.', reasoning: 'Reuters cables + satellite port activity down 12%.', confidence: 0.82, tags: ['#Geopolitics'] },
  { id: 'b2', timestamp: new Date(Date.now() - 120000), type: 'hedge', priority: 'high', agent: 'Logistics Sentinel', agentAvatar: '🚢', action: 'HEDGE CLOSED', market: 'Panama Canal Delays', marketTicker: 'LOG-PANA-0129', size: 28000, summary: 'Closed Panama hedge at profit. AIS confirms queue normalization.', reasoning: 'Vessel queue 142→67. Water levels stabilized.', confidence: 0.91, tags: ['#Logistics'] },
  { id: 'b3', timestamp: new Date(Date.now() - 300000), type: 'position', priority: 'high', agent: 'Tech Oracle', agentAvatar: '💻', action: 'ACCUMULATING', market: 'GPT-5 Q1 Release', marketTicker: 'TECH-GPT5', size: 18000, summary: 'Accumulating GPT-5 positions on GitHub commit velocity.', reasoning: '340% spike in semantic-kernel commits.', confidence: 0.73, tags: ['#AI-War'] },
  { id: 'b4', timestamp: new Date(Date.now() - 600000), type: 'position', priority: 'medium', agent: 'Contrarian Alpha', agentAvatar: '🔄', action: 'SHORT', market: 'Bitcoin $100K Jan', marketTicker: 'CRYPTO-BTC', size: 55000, summary: 'Fading retail BTC hype on extreme Fear & Greed.', reasoning: 'Whale wallets reducing exposure 8%.', confidence: 0.67, tags: ['#Crypto'] },
];

// ============================================================================
// GETTING STARTED WIDGET
// ============================================================================

function GettingStartedWidget() {
  const { user, balance } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('truthnet_getting_started_dismissed') === 'true') {
      setDismissed(true);
    }
  }, []);

  if (dismissed) return null;

  const hasFunds = (balance?.available ?? 0) > 0;
  const steps = [
    { id: 'fund', label: 'Fund your account', done: hasFunds, action: () => {}, icon: CreditCard },
    { id: 'agent', label: 'Deploy an agent', done: false, action: () => navigate('/agents'), icon: Bot },
    { id: 'trade', label: 'Place your first trade', done: false, action: () => navigate('/markets'), icon: TrendingUp },
  ];

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('truthnet_getting_started_dismissed', 'true');
  };

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Getting Started</span>
        </div>
        <button onClick={handleDismiss} className="text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
      </div>
      <div className="flex gap-4">
        {steps.map((step, i) => (
          <button key={step.id} onClick={step.action}
            className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg transition-all flex-1',
              step.done ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-black/30 border border-[#1a1a1a] hover:border-cyan-500/30')}>
            {step.done ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <step.icon className="w-4 h-4 text-gray-500" />
            )}
            <span className={clsx('text-xs', step.done ? 'text-emerald-400 line-through' : 'text-gray-300')}>{step.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// MARKET HEATMAP
// ============================================================================

function MarketHeatmap() {
  const { data: marketsData } = useQuery({
    queryKey: ['heatmap-markets'],
    queryFn: () => apiClient.get<{ markets: Market[]; total: number }>('/markets?limit=20'),
    refetchInterval: 10000,
  });

  const markets = marketsData?.markets || [];

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <PieChart className="w-4 h-4 text-purple-400" />
        <span className="font-medium text-white text-sm">Consensus Heatmap</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {(markets.length > 0 ? markets : Array.from({ length: 15 }, (_, i) => ({
          id: String(i), ticker: `MKT-${i}`,
          volume_yes: Math.random() * 100000, volume_no: Math.random() * 100000,
        }))).slice(0, 15).map((m: any) => {
          const totalVol = (m.volume_yes || 0) + (m.volume_no || 0);
          const yesPct = totalVol > 0 ? (m.volume_yes || 0) / totalVol : 0.5;
          const intensity = Math.abs(yesPct - 0.5) * 2; // 0 = split, 1 = consensus

          return (
            <div key={m.id} title={`${m.ticker}: ${(yesPct * 100).toFixed(0)}% YES`}
              className="aspect-square rounded-md flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-white/20 transition-all"
              style={{
                backgroundColor: yesPct > 0.5
                  ? `rgba(16, 185, 129, ${0.15 + intensity * 0.5})`
                  : `rgba(239, 68, 68, ${0.15 + intensity * 0.5})`,
              }}>
              <span className="text-[8px] font-mono text-white/60 truncate px-0.5">{m.ticker?.slice(0, 6)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-red-400">Bearish</span>
        <span className="text-[9px] text-gray-600">50/50</span>
        <span className="text-[9px] text-emerald-400">Bullish</span>
      </div>
    </div>
  );
}

// ============================================================================
// DOCTRINE CONTROL PLANE
// ============================================================================

function DoctrineControlPlane() {
  const [mandate, setMandate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRealignment, setShowRealignment] = useState(false);
  const [affectedAgents, setAffectedAgents] = useState<string[]>([]);

  const submitMandate = async () => {
    if (!mandate.trim()) return;
    setIsProcessing(true);
    setShowRealignment(true);
    await new Promise(r => setTimeout(r, 1500));

    const agents = ['Geopolitical Analyst', 'Logistics Sentinel', 'Tech Oracle', 'Contrarian Alpha'];
    setAffectedAgents(agents.slice(0, Math.floor(Math.random() * 3) + 2));

    try {
      await apiClient.post('/doctrine/mandate', { mandate: mandate.trim(), weights: [] });
    } catch { /* demo fallback */ }

    setIsProcessing(false);
    setMandate('');
    setTimeout(() => setShowRealignment(false), 3000);
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="w-4 h-4 text-amber-400" />
        <span className="font-medium text-white text-sm">Strategic Doctrine</span>
      </div>
      <div className="flex gap-2">
        <input type="text" value={mandate} onChange={e => setMandate(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitMandate()}
          placeholder='Issue mandate (e.g. "Be aggressive on #AI-War")'
          className="flex-1 bg-black border border-[#262626] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 font-mono"
          disabled={isProcessing} />
        <button onClick={submitMandate} disabled={!mandate.trim() || isProcessing}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 text-white rounded-lg transition-all flex items-center gap-1.5 text-sm font-medium">
          <Send className="w-3 h-3" /> Dispatch
        </button>
      </div>
      <AnimatePresence>
        {showRealignment && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              {affectedAgents.map((a, i) => (
                <motion.div key={a} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.15 }}
                  className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-amber-300">{a}</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// STRATEGIC NARRATIVE LOG
// ============================================================================

function StrategicNarrativeLog() {
  const [expandedBrief, setExpandedBrief] = useState<string | null>(null);

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col" style={{ height: '500px' }}>
      <div className="p-3 border-b border-[#1a1a1a] flex items-center justify-between bg-[#050505]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-400" />
          <span className="font-medium text-white text-sm">Intelligence Cascade</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full animate-pulse">LIVE</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {mockBriefs.map(brief => (
          <div key={brief.id}
            className={clsx('border-l-4 border-b border-[#111] cursor-pointer transition-all hover:bg-white/[0.02]',
              brief.priority === 'critical' ? 'border-l-red-500' :
              brief.priority === 'high' ? 'border-l-amber-500' : 'border-l-cyan-500'
            )}
            onClick={() => setExpandedBrief(expandedBrief === brief.id ? null : brief.id)}>
            <div className="p-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{brief.agentAvatar}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-white">{brief.agent}</span>
                      <span className={clsx('text-[9px] px-1 py-0.5 rounded uppercase font-bold',
                        brief.priority === 'critical' ? 'bg-red-500 text-white' :
                        brief.priority === 'high' ? 'bg-amber-500 text-black' : 'bg-cyan-500 text-black'
                      )}>{brief.priority}</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400">{brief.marketTicker}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-white">{brief.size > 0 ? `$${(brief.size/1000).toFixed(0)}K` : '—'}</span>
                  <p className="text-[10px] text-gray-600">{Math.floor((Date.now() - brief.timestamp.getTime()) / 60000)}m ago</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{brief.summary}</p>
              {expandedBrief === brief.id && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 pt-2 border-t border-[#1a1a1a]">
                  <div className="flex items-start gap-1.5">
                    <Brain className="w-3 h-3 text-cyan-400 mt-0.5" />
                    <p className="text-[11px] text-gray-500">{brief.reasoning}</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({ title, value, icon: Icon, trend, color }: {
  title: string; value: string | number; icon: React.ElementType; trend?: number; color: string;
}) {
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">{title}</p>
          <p className="text-xl font-bold text-white mt-1 font-mono tabular-nums">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {trend >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
          <span className={clsx('text-xs font-mono', trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TOP MARKETS
// ============================================================================

function TopMarketsWidget() {
  const { data: marketsData, isLoading } = useQuery({
    queryKey: ['top-markets'],
    queryFn: () => apiClient.get<{ markets: Market[]; total: number }>('/markets?limit=100'),
    refetchInterval: 10000,
  });

  const topMarkets = (marketsData?.markets || [])
    .sort((a, b) => ((b.volume_yes||0)+(b.volume_no||0)) - ((a.volume_yes||0)+(a.volume_no||0)))
    .slice(0, 5);

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="p-3 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="font-medium text-white text-sm">Hottest Positions</span>
        </div>
        <Link to="/markets" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5">
          View All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="divide-y divide-[#111]">
        {topMarkets.length === 0 ? (
          <div className="p-3 text-center text-gray-600 text-xs">No active positions</div>
        ) : topMarkets.map((m, i) => {
          const vol = (m.volume_yes||0)+(m.volume_no||0);
          const yp = m.last_price_yes ?? 0.5;
          return (
            <div key={m.id} className="p-2.5 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-600 w-4">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{m.title}</p>
                  <span className="text-[9px] font-mono text-gray-600">{m.ticker}</span>
                </div>
                <div className="text-right">
                  <span className={clsx('text-xs font-mono font-bold', yp > 0.5 ? 'text-emerald-400' : 'text-red-400')}>
                    {(yp * 100).toFixed(0)}¢
                  </span>
                  <p className="text-[9px] text-gray-600 font-mono">${(vol/1000).toFixed(0)}K</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function Dashboard() {
  const { user } = useAuth();

  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get<{ markets: Market[]; total: number }>('/markets?limit=100');
      const markets = response?.markets || [];
      const totalVolume = markets.reduce((a, m) => a + (m.volume_yes||0) + (m.volume_no||0), 0);
      return { totalVolume, activeMarkets: markets.length, totalAgents: 10, avgTruthScore: 0.72 };
    },
    refetchInterval: 10000,
  });

  const stats = statsData || { totalVolume: 0, activeMarkets: 0, totalAgents: 10, avgTruthScore: 0.72 };

  return (
    <div className="min-h-screen bg-black p-6">
      {/* Getting Started */}
      <GettingStartedWidget />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-gray-500 text-sm mt-0.5">Clearinghouse Governance & Settlement Operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', 'bg-emerald-500/20 text-emerald-400')}>
            <Shield className="w-3 h-3" /> Doctrine: Active
          </div>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full animate-pulse">LIVE</span>
        </div>
      </div>

      {/* Doctrine */}
      <DoctrineControlPlane />

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard title="Cleared Volume" value={`$${(stats.totalVolume/1000).toFixed(1)}K`} icon={DollarSign} trend={12.5} color="bg-gradient-to-br from-cyan-600 to-blue-600" />
        <StatCard title="Active Positions" value={stats.activeMarkets} icon={BarChart3} trend={8.3} color="bg-gradient-to-br from-purple-600 to-pink-600" />
        <StatCard title="Counterparties" value={stats.totalAgents} icon={Users} trend={-2.1} color="bg-gradient-to-br from-orange-600 to-red-600" />
        <StatCard title="Avg Truth Score" value={(stats.avgTruthScore * 100).toFixed(0) + '%'} icon={Target} trend={3.2} color="bg-gradient-to-br from-emerald-600 to-teal-600" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column */}
        <div className="col-span-8 space-y-4">
          {/* P&L Curve */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="font-medium text-white text-sm">Portfolio P&L (30d)</span>
              </div>
              <span className={clsx('text-sm font-mono font-bold', cumPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {cumPnl >= 0 ? '+' : ''}${cumPnl.toFixed(0)}
              </span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockPnlData}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#333" fontSize={9} tickLine={false} axisLine={false} interval={4} />
                  <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}K`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2} fill="url(#pnlGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Intelligence Cascade */}
          <StrategicNarrativeLog />
        </div>

        {/* Right Column */}
        <div className="col-span-4 space-y-4">
          {/* Portfolio Allocation */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="w-4 h-4 text-cyan-400" />
              <span className="font-medium text-white text-sm">Portfolio Allocation</span>
            </div>
            <div className="h-36 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart>
                  <Pie data={mockPortfolioData} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                    paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {mockPortfolioData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }} />
                </RPieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {mockPortfolioData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-gray-400">{d.name} {d.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <TopMarketsWidget />
          <MarketHeatmap />

          {/* Engine Status */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="font-medium text-white text-sm">Engine</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Throughput', value: '42 tx/s' },
                { label: 'Latency (p99)', value: '2.3ms' },
                { label: 'OB Depth', value: '1,832' },
                { label: 'Circuits', value: 'Closed' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">{item.label}</span>
                  <span className="text-xs font-mono text-emerald-400">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Volume Chart */}
      <div className="mt-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
        <h3 className="font-medium text-white mb-3 text-sm">24h Settlement Volume</h3>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockVolumeData}>
              <defs>
                <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', fontSize: '11px' }} />
              <Area type="monotone" dataKey="volume" stroke="#06b6d4" strokeWidth={2} fill="url(#volumeGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
