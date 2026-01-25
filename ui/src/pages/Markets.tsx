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
  const yesPrice = market.last_price_yes ?? 0.5;
  const noPrice = market.last_price_no ?? 0.5;

  return (
    <>
      <motion.div
        layout
        className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
      >
        <div
          className="p-5 cursor-pointer hover:bg-slate-700/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">
                  {market.ticker}
                </span>
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded',
                  market.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'
                )}>
                  {market.status}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white">{market.title}</h3>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(market.closes_at).toLocaleDateString()}
                </span>
                <span>Vol: ${((market.volume_yes + market.volume_no) / 1000).toFixed(0)}K</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Price indicators */}
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">YES</span>
                  <span className="text-lg font-bold text-green-400 font-mono">
                    {(yesPrice * 100).toFixed(0)}¢
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">NO</span>
                  <span className="text-lg font-bold text-red-400 font-mono">
                    {(noPrice * 100).toFixed(0)}¢
                  </span>
                </div>
              </div>

              <ChevronRight
                className={clsx(
                  'w-5 h-5 text-slate-400 transition-transform',
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
              className="border-t border-slate-700"
            >
              <div className="p-5">
                <OrderBookDisplay marketId={market.id} />

                <div className="mt-4 flex gap-3">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setTradeModal('yes'); }}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Buy YES @ {(yesPrice * 100).toFixed(0)}¢
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setTradeModal('no'); }}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
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

export default function Markets() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredMarkets = mockMarkets.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Markets</h1>
          <p className="text-slate-400 mt-1">Browse and trade prediction markets</p>
        </div>
        <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 px-4 rounded-lg transition-colors">
          <Plus className="w-5 h-5" />
          Create Market
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex gap-2">
          {['all', 'active', 'pending', 'settled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                statusFilter === status
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Markets List */}
      <div className="space-y-4">
        {filteredMarkets.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
      </div>

      {filteredMarkets.length === 0 && (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No markets found</p>
        </div>
      )}
    </div>
  );
}
