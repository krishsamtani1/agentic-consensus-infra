import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Clock, 
  TrendingUp,
  ChevronRight,
  Activity,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { apiClient, Market, OrderBook } from '../api/client';

// Mock markets for demo
const mockMarkets: Market[] = [
  {
    id: '1',
    ticker: 'SGP-PORT-2026-02',
    title: 'Singapore Port Closure by Feb 2026',
    description: 'Will Singapore port experience major closure?',
    status: 'active',
    outcome: null,
    opens_at: '2026-01-01T00:00:00Z',
    closes_at: '2026-02-01T00:00:00Z',
    resolves_at: '2026-02-01T00:00:00Z',
    volume_yes: 125000,
    volume_no: 98000,
    open_interest: 45000,
    last_price_yes: 0.35,
    last_price_no: 0.65,
  },
  {
    id: '2',
    ticker: 'AWS-OUTAGE-Q1',
    title: 'AWS Major Outage Q1 2026',
    description: 'Will AWS experience >1hr outage?',
    status: 'active',
    outcome: null,
    opens_at: '2026-01-01T00:00:00Z',
    closes_at: '2026-03-31T00:00:00Z',
    resolves_at: '2026-03-31T00:00:00Z',
    volume_yes: 89000,
    volume_no: 156000,
    open_interest: 32000,
    last_price_yes: 0.22,
    last_price_no: 0.78,
  },
  {
    id: '3',
    ticker: 'BTC-100K-JAN',
    title: 'Bitcoin $100K by Jan 31',
    description: 'Will BTC reach $100,000?',
    status: 'active',
    outcome: null,
    opens_at: '2026-01-01T00:00:00Z',
    closes_at: '2026-01-31T00:00:00Z',
    resolves_at: '2026-01-31T00:00:00Z',
    volume_yes: 456000,
    volume_no: 234000,
    open_interest: 120000,
    last_price_yes: 0.68,
    last_price_no: 0.32,
  },
];

interface OrderBookDisplayProps {
  marketId: string;
}

function OrderBookDisplay({ marketId }: OrderBookDisplayProps) {
  // Mock order book data
  const mockBids = [
    { price: 0.65, quantity: 1200, order_count: 5 },
    { price: 0.64, quantity: 800, order_count: 3 },
    { price: 0.63, quantity: 2400, order_count: 8 },
    { price: 0.62, quantity: 1600, order_count: 4 },
    { price: 0.61, quantity: 3200, order_count: 12 },
  ];

  const mockAsks = [
    { price: 0.66, quantity: 900, order_count: 4 },
    { price: 0.67, quantity: 1100, order_count: 5 },
    { price: 0.68, quantity: 2000, order_count: 7 },
    { price: 0.69, quantity: 1400, order_count: 6 },
    { price: 0.70, quantity: 2800, order_count: 10 },
  ];

  const maxQty = Math.max(
    ...mockBids.map(b => b.quantity),
    ...mockAsks.map(a => a.quantity)
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Bids */}
      <div>
        <h4 className="text-sm font-medium text-slate-400 mb-2">Bids</h4>
        <div className="space-y-1">
          {mockBids.map((bid, i) => (
            <div
              key={i}
              className="relative flex items-center justify-between py-1 px-2 rounded text-sm"
            >
              <div
                className="absolute inset-0 bg-green-500/20 rounded"
                style={{ width: `${(bid.quantity / maxQty) * 100}%` }}
              />
              <span className="relative text-green-400 font-mono">
                {(bid.price * 100).toFixed(0)}¢
              </span>
              <span className="relative text-slate-300 font-mono">
                {bid.quantity.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Asks */}
      <div>
        <h4 className="text-sm font-medium text-slate-400 mb-2">Asks</h4>
        <div className="space-y-1">
          {mockAsks.map((ask, i) => (
            <div
              key={i}
              className="relative flex items-center justify-between py-1 px-2 rounded text-sm"
            >
              <div
                className="absolute inset-0 bg-red-500/20 rounded right-0"
                style={{ 
                  width: `${(ask.quantity / maxQty) * 100}%`,
                  marginLeft: 'auto'
                }}
              />
              <span className="relative text-red-400 font-mono">
                {(ask.price * 100).toFixed(0)}¢
              </span>
              <span className="relative text-slate-300 font-mono">
                {ask.quantity.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Trade Modal Component
function TradeModal({ 
  market, 
  side, 
  onClose 
}: { 
  market: Market; 
  side: 'yes' | 'no'; 
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState('100');
  const [price, setPrice] = useState(side === 'yes' ? '0.50' : '0.50');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setResult(null);

    try {
      // Get agent ID from localStorage or use demo agent
      const agentId = localStorage.getItem('truthnet_agent_id') || 'demo-agent';

      const response = await apiClient.post('/orders', {
        market_id: market.id,
        side: 'buy',
        outcome: side,
        order_type: orderType,
        price: parseFloat(price),
        quantity: parseInt(quantity),
      }, {
        headers: { 'X-Agent-ID': agentId },
      });

      setResult({ 
        success: true, 
        message: `Order placed! ${response.data?.data?.trades?.length || 0} trades executed.`
      });

      // Close after success
      setTimeout(onClose, 1500);
    } catch (error: any) {
      setResult({
        success: false,
        message: error.response?.data?.error?.message || 'Failed to place order',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedCost = parseFloat(price) * parseInt(quantity || '0');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Buy {side.toUpperCase()}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
          <div className="text-sm text-slate-400">{market.ticker}</div>
          <div className="text-white font-medium">{market.title}</div>
        </div>

        <div className="space-y-4">
          {/* Order Type */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Order Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setOrderType('limit')}
                className={clsx(
                  'flex-1 py-2 rounded-lg font-medium transition-colors',
                  orderType === 'limit' 
                    ? 'bg-cyan-600 text-white' 
                    : 'bg-slate-700 text-slate-300'
                )}
              >
                Limit
              </button>
              <button
                onClick={() => setOrderType('market')}
                className={clsx(
                  'flex-1 py-2 rounded-lg font-medium transition-colors',
                  orderType === 'market' 
                    ? 'bg-cyan-600 text-white' 
                    : 'bg-slate-700 text-slate-300'
                )}
              >
                Market
              </button>
            </div>
          </div>

          {/* Price (for limit orders) */}
          {orderType === 'limit' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Price (0.01 - 0.99)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="0.99"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ({(parseFloat(price || '0') * 100).toFixed(0)}¢)
                </span>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Estimate */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Estimated Cost</span>
              <span className="text-white font-mono">${estimatedCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-400">Max Payout</span>
              <span className="text-green-400 font-mono">${parseInt(quantity || '0').toFixed(2)}</span>
            </div>
          </div>

          {/* Result Message */}
          {result && (
            <div className={clsx(
              'flex items-center gap-2 p-3 rounded-lg',
              result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            )}>
              {result.success ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm">{result.message}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !quantity || (orderType === 'limit' && !price)}
            className={clsx(
              'flex-1 font-medium py-2 px-4 rounded-lg transition-colors',
              side === 'yes' 
                ? 'bg-green-600 hover:bg-green-500 disabled:bg-green-800' 
                : 'bg-red-600 hover:bg-red-500 disabled:bg-red-800',
              'text-white disabled:cursor-not-allowed'
            )}
          >
            {isSubmitting ? 'Placing...' : `Buy ${side.toUpperCase()}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MarketCard({ market }: { market: Market }) {
  const [expanded, setExpanded] = useState(false);
  const [tradeModal, setTradeModal] = useState<'yes' | 'no' | null>(null);
  
  // Calculate prices from volume or use defaults
  const totalVol = (market.volume_yes || 0) + (market.volume_no || 0);
  const yesPrice = totalVol > 0 
    ? (market.volume_yes || 0) / totalVol 
    : (market.last_price_yes ?? 0.5);
  const noPrice = 1 - yesPrice;

  // Category styling
  const categoryColors: Record<string, string> = {
    'ai-war': 'bg-purple-500/20 text-purple-400',
    'election-crisis': 'bg-red-500/20 text-red-400',
    'tech-drama': 'bg-orange-500/20 text-orange-400',
    'logistics': 'bg-blue-500/20 text-blue-400',
    'crypto': 'bg-yellow-500/20 text-yellow-400',
    'climate': 'bg-green-500/20 text-green-400',
    'meme-alpha': 'bg-pink-500/20 text-pink-400',
  };

  return (
    <>
      <motion.div
        layout
        className="bg-[#111111] rounded-xl border border-[#1a1a1a] overflow-hidden hover:border-[#262626] transition-colors"
      >
        <div
          className="p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-lg">
                  {market.ticker}
                </span>
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded-lg',
                  market.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'
                )}>
                  {market.status}
                </span>
                {market.category && (
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded-lg',
                    categoryColors[market.category] || 'bg-gray-800 text-gray-400'
                  )}>
                    #{market.category}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold text-white">{market.title}</h3>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(market.closes_at).toLocaleDateString()}
                </span>
                <span>Vol: ${((market.volume_yes || 0) + (market.volume_no || 0)).toLocaleString()}</span>
                {market.open_interest && (
                  <span>OI: ${market.open_interest.toLocaleString()}</span>
                )}
              </div>
              {/* Tags */}
              {market.tags && market.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {market.tags.slice(0, 3).map((tag: string) => (
                    <span key={tag} className="text-xs text-gray-600">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Price indicators */}
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">YES</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {(yesPrice * 100).toFixed(0)}¢
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">NO</span>
                  <span className="text-lg font-bold text-red-400 font-mono">
                    {(noPrice * 100).toFixed(0)}¢
                  </span>
                </div>
              </div>

              <ChevronRight
                className={clsx(
                  'w-5 h-5 text-gray-500 transition-transform',
                  expanded && 'rotate-90'
                )}
              />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-[#1a1a1a]"
            >
              <div className="p-5 bg-black/30">
                <OrderBookDisplay marketId={market.id} />

                <div className="mt-4 flex gap-3">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setTradeModal('yes'); }}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Buy YES @ {(yesPrice * 100).toFixed(0)}¢
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setTradeModal('no'); }}
                    className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-red-500/20"
                  >
                    Buy NO @ {(noPrice * 100).toFixed(0)}¢
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Trade Modal */}
      {tradeModal && (
        <TradeModal 
          market={market} 
          side={tradeModal} 
          onClose={() => setTradeModal(null)} 
        />
      )}
    </>
  );
}

// Create Market Modal
function CreateMarketModal({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('tech-earnings');
  const [closesIn, setClosesIn] = useState('7'); // days
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const categoryOptions = [
    { id: 'tech-earnings', label: 'Tech & Earnings' },
    { id: 'logistics', label: 'Logistics & Supply Chain' },
    { id: 'geopolitics', label: 'Geopolitics' },
    { id: 'weather', label: 'Weather & Climate' },
    { id: 'niche-internet', label: 'Internet & Viral' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'sports', label: 'Sports' },
  ];

  const handleSubmit = async () => {
    if (!title.trim()) {
      setResult({ success: false, message: 'Title is required' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const closesAt = new Date();
      closesAt.setDate(closesAt.getDate() + parseInt(closesIn));

      await apiClient.post('/markets', {
        title: title.trim(),
        description: description.trim() || `Will "${title.trim()}" resolve to YES?`,
        category,
        closes_at: closesAt.toISOString(),
        resolves_at: new Date(closesAt.getTime() + 60 * 60 * 1000).toISOString(),
      });

      setResult({ success: true, message: 'Market created successfully!' });
      onCreated?.();
      setTimeout(onClose, 1000);
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Failed to create market',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#111111] rounded-xl border border-[#262626] p-6 w-full max-w-lg"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create New Market</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Market Question
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Will X happen by Y date?"
              className="w-full bg-black border border-[#262626] rounded-lg py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context or resolution criteria..."
              rows={3}
              className="w-full bg-black border border-[#262626] rounded-lg py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-black border border-[#262626] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500"
            >
              {categoryOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Closes In (days)
            </label>
            <select
              value={closesIn}
              onChange={(e) => setClosesIn(e.target.value)}
              className="w-full bg-black border border-[#262626] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          {/* Result Message */}
          {result && (
            <div className={clsx(
              'p-3 rounded-lg flex items-center gap-2',
              result.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            )}>
              {result.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span>{result.message}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim()}
            className={clsx(
              'w-full py-3 rounded-lg font-semibold transition-all',
              isSubmitting || !title.trim()
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500'
            )}
          >
            {isSubmitting ? 'Creating...' : 'Create Market'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Markets() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch markets from API
  const { data: marketsData, isLoading, error, refetch } = useQuery({
    queryKey: ['markets', statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      params.append('limit', '100');
      
      // apiClient.get already unwraps data.data, so response IS the data
      const response = await apiClient.get<{ markets: Market[]; total: number }>(
        `/markets?${params.toString()}`
      );
      console.log('[Markets] Fetched:', response);
      return response;
    },
    refetchInterval: 5000, // Refresh every 5s
    retry: 3,
  });

  // Use API data, fallback to mock for demo
  const allMarkets = marketsData?.markets || mockMarkets;
  
  // Log for debugging
  console.log('[Markets] isLoading:', isLoading, 'error:', error, 'markets:', allMarkets.length);

  const filteredMarkets = allMarkets.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Topic categories for filtering
  const categories = [
    { id: 'all', label: 'All Topics' },
    { id: 'ai-war', label: '#AIWar' },
    { id: 'election-crisis', label: '#ElectionCrisis' },
    { id: 'tech-drama', label: '#TechDrama' },
    { id: 'logistics', label: '#SupplyChain' },
    { id: 'crypto', label: '#CryptoChaos' },
    { id: 'climate', label: '#ClimateCrisis' },
    { id: 'meme-alpha', label: '#MemeAlpha' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Markets</h1>
          <p className="text-gray-500 mt-1">Browse and trade prediction markets</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium py-2.5 px-5 rounded-xl transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
        >
          <Plus className="w-5 h-5" />
          Create Market
        </button>
      </div>

      {/* Create Market Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateMarketModal 
            onClose={() => setShowCreateModal(false)} 
            onCreated={() => refetch()}
          />
        )}
      </AnimatePresence>

      {/* Stats Bar */}
      <div className="bg-[#111111] rounded-xl border border-[#1a1a1a] p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-2xl font-bold text-white">{allMarkets.length}</div>
              <div className="text-xs text-gray-500">Active Markets</div>
            </div>
            <div className="w-px h-10 bg-[#262626]" />
            <div>
              <div className="text-2xl font-bold text-emerald-400">
                ${(allMarkets.reduce((a, m) => a + (m.volume_yes || 0) + (m.volume_no || 0), 0) / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs text-gray-500">Total Volume</div>
            </div>
            <div className="w-px h-10 bg-[#262626]" />
            <div>
              <div className="text-2xl font-bold text-purple-400">
                {new Set(allMarkets.map(m => m.category)).size}
              </div>
              <div className="text-xs text-gray-500">Topic Clusters</div>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
          >
            <Activity className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Topic Clusters */}
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-2">Topic Clusters</div>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={clsx(
                'px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
                categoryFilter === cat.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#262626] hover:text-white'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black border border-[#262626] rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex gap-2">
          {['all', 'active', 'pending', 'settled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                'px-4 py-2 rounded-xl font-medium transition-all',
                statusFilter === status
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#262626]'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <Activity className="w-8 h-8 text-cyan-400 mx-auto animate-spin mb-2" />
          <p className="text-slate-400">Loading markets from live sources...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Failed to load markets</span>
          </div>
          <p className="text-red-300 text-sm mt-1">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Live Source Indicator */}
      {!isLoading && allMarkets.length > 0 && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <div className="flex items-center gap-1 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Live Data</span>
          </div>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">
            {allMarkets.filter((m: any) => m.metadata?.live_sourced).length} from live headlines
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">
            Updated {new Date().toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Markets List */}
      <div className="space-y-4">
        {filteredMarkets.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
      </div>

      {filteredMarkets.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No markets found</p>
          <p className="text-slate-500 text-sm mt-2">
            {error ? 'Check console for errors' : 'Try refreshing or check your API connection'}
          </p>
        </div>
      )}
    </div>
  );
}
