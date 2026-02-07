import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus, Search, Clock, TrendingUp, TrendingDown, ChevronRight,
  Activity, X, AlertCircle, CheckCircle, LayoutGrid, List, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { apiClient, Market, OrderBook } from '../api/client';

// ============================================================================
// MINI SPARKLINE
// ============================================================================

function MiniSparkline({ data, color = '#06b6d4' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <span className="text-gray-700 text-xs">--</span>;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

// ============================================================================
// TABLE VIEW (Bloomberg-style)
// ============================================================================

function MarketTableView({ markets, onTrade }: { markets: Market[]; onTrade: (m: Market, side: 'yes' | 'no') => void }) {
  const [sortBy, setSortBy] = useState<'volume' | 'price' | 'ticker' | 'change'>('volume');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [prevPrices, setPrevPrices] = useState<Map<string, number>>(new Map());
  const [flashRows, setFlashRows] = useState<Map<string, 'green' | 'red'>>(new Map());

  // Track price changes for flash effects
  useEffect(() => {
    const newFlash = new Map<string, 'green' | 'red'>();
    markets.forEach(m => {
      const totalVol = (m.volume_yes || 0) + (m.volume_no || 0);
      const price = totalVol > 0 ? (m.volume_yes || 0) / totalVol : (m.last_price_yes ?? 0.5);
      const prev = prevPrices.get(m.id);
      if (prev !== undefined && Math.abs(prev - price) > 0.001) {
        newFlash.set(m.id, price > prev ? 'green' : 'red');
      }
    });

    if (newFlash.size > 0) {
      setFlashRows(newFlash);
      setTimeout(() => setFlashRows(new Map()), 800);
    }

    const np = new Map<string, number>();
    markets.forEach(m => {
      const totalVol = (m.volume_yes || 0) + (m.volume_no || 0);
      np.set(m.id, totalVol > 0 ? (m.volume_yes || 0) / totalVol : (m.last_price_yes ?? 0.5));
    });
    setPrevPrices(np);
  }, [markets]);

  const sorted = [...markets].sort((a, b) => {
    const getVol = (m: Market) => (m.volume_yes || 0) + (m.volume_no || 0);
    const getPrice = (m: Market) => {
      const v = getVol(m);
      return v > 0 ? (m.volume_yes || 0) / v : (m.last_price_yes ?? 0.5);
    };

    let cmp = 0;
    switch (sortBy) {
      case 'volume': cmp = getVol(a) - getVol(b); break;
      case 'price': cmp = getPrice(a) - getPrice(b); break;
      case 'ticker': cmp = a.ticker.localeCompare(b.ticker); break;
      default: cmp = getVol(a) - getVol(b);
    }
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortHeader = ({ col, label, className = '' }: { col: typeof sortBy; label: string; className?: string }) => (
    <th
      onClick={() => toggleSort(col)}
      className={clsx('px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 select-none', className)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === col && (
          <ArrowUpDown className="w-3 h-3 text-cyan-400" />
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1a1a1a] bg-[#050505]">
              <SortHeader col="ticker" label="Ticker" />
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Market</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <SortHeader col="price" label="YES" className="text-right" />
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">NO</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Spread</th>
              <SortHeader col="volume" label="Volume" className="text-right" />
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">24h</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Trade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#111]">
            {sorted.map((m) => {
              const totalVol = (m.volume_yes || 0) + (m.volume_no || 0);
              const yesPrice = totalVol > 0 ? (m.volume_yes || 0) / totalVol : (m.last_price_yes ?? 0.5);
              const noPrice = 1 - yesPrice;
              const spread = Math.abs(yesPrice - noPrice);
              const flash = flashRows.get(m.id);

              // Fake sparkline data
              const sparkData = Array.from({ length: 12 }, (_, i) => yesPrice + (Math.random() - 0.5) * 0.1);

              return (
                <tr
                  key={m.id}
                  className={clsx(
                    'hover:bg-white/[0.02] transition-colors cursor-pointer',
                    flash === 'green' && 'row-flash-green',
                    flash === 'red' && 'row-flash-red'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-mono font-bold text-cyan-400">{m.ticker}</span>
                  </td>
                  <td className="px-3 py-2.5 max-w-[280px]">
                    <p className="text-sm text-white truncate">{m.title}</p>
                    <p className="text-[10px] text-gray-600">
                      Closes {new Date(m.closes_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={clsx(
                      'text-[10px] px-2 py-0.5 rounded-full font-medium',
                      m.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                      m.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-gray-800 text-gray-500'
                    )}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={clsx(
                      'price-cell text-sm font-bold',
                      yesPrice > 0.5 ? 'text-emerald-400' : 'text-gray-300'
                    )}>
                      {(yesPrice * 100).toFixed(1)}¢
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={clsx(
                      'price-cell text-sm font-bold',
                      noPrice > 0.5 ? 'text-red-400' : 'text-gray-300'
                    )}>
                      {(noPrice * 100).toFixed(1)}¢
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="price-cell text-xs text-gray-500">
                      {(spread * 100).toFixed(1)}¢
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="price-cell text-sm text-white">
                      ${(totalVol / 1000).toFixed(1)}K
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <MiniSparkline
                      data={sparkData}
                      color={yesPrice > 0.5 ? '#10b981' : '#ef4444'}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); onTrade(m, 'yes'); }}
                        className="px-2 py-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded transition-colors"
                      >
                        YES
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onTrade(m, 'no'); }}
                        className="px-2 py-1 text-[10px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                      >
                        NO
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// ORDER BOOK
// ============================================================================

function OrderBookDisplay({ marketId }: { marketId: string }) {
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
      <div>
        <h4 className="text-sm font-medium text-slate-400 mb-2">Bids</h4>
        <div className="space-y-1">
          {mockBids.map((bid, i) => (
            <div key={i} className="relative flex items-center justify-between py-1 px-2 rounded text-sm">
              <div className="absolute inset-0 bg-green-500/20 rounded" style={{ width: `${(bid.quantity / maxQty) * 100}%` }} />
              <span className="relative text-green-400 font-mono">{(bid.price * 100).toFixed(0)}¢</span>
              <span className="relative text-slate-300 font-mono">{bid.quantity.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-slate-400 mb-2">Asks</h4>
        <div className="space-y-1">
          {mockAsks.map((ask, i) => (
            <div key={i} className="relative flex items-center justify-between py-1 px-2 rounded text-sm">
              <div className="absolute inset-0 bg-red-500/20 rounded right-0" style={{ width: `${(ask.quantity / maxQty) * 100}%`, marginLeft: 'auto' }} />
              <span className="relative text-red-400 font-mono">{(ask.price * 100).toFixed(0)}¢</span>
              <span className="relative text-slate-300 font-mono">{ask.quantity.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TRADE MODAL
// ============================================================================

function TradeModal({ market, side, onClose }: { market: Market; side: 'yes' | 'no'; onClose: () => void }) {
  const [quantity, setQuantity] = useState('100');
  const [price, setPrice] = useState('0.50');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setResult(null);
    try {
      const agentId = localStorage.getItem('truthnet_agent_id') || 'demo-agent';
      await apiClient.post('/orders', {
        market_id: market.id,
        side: 'buy',
        outcome: side,
        order_type: orderType,
        price: parseFloat(price),
        quantity: parseInt(quantity),
      });
      setResult({ success: true, message: 'Order placed successfully!' });
      setTimeout(onClose, 1500);
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Failed to place order' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedCost = parseFloat(price) * parseInt(quantity || '0');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Buy {side.toUpperCase()}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="bg-black/50 rounded-lg p-3 mb-4 border border-[#1a1a1a]">
          <div className="text-sm text-cyan-400 font-mono">{market.ticker}</div>
          <div className="text-white font-medium">{market.title}</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Order Type</label>
            <div className="flex gap-2">
              {(['limit', 'market'] as const).map(t => (
                <button key={t} onClick={() => setOrderType(t)}
                  className={clsx('flex-1 py-2 rounded-lg font-medium transition-colors capitalize',
                    orderType === t ? 'bg-cyan-600 text-white' : 'bg-[#111] text-gray-300 border border-[#262626]'
                  )}>{t}</button>
              ))}
            </div>
          </div>

          {orderType === 'limit' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Price (0.01 - 0.99)</label>
              <input type="number" step="0.01" min="0.01" max="0.99" value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full bg-black border border-[#262626] rounded-lg py-2 px-3 text-white font-mono focus:outline-none focus:border-cyan-500" />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Quantity</label>
            <input type="number" min="1" value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full bg-black border border-[#262626] rounded-lg py-2 px-3 text-white font-mono focus:outline-none focus:border-cyan-500" />
          </div>

          <div className="bg-[#111] rounded-lg p-4 border border-[#1a1a1a]">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Estimated Cost</span>
              <span className="text-white font-mono">${estimatedCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-400">Max Payout</span>
              <span className="text-emerald-400 font-mono">${parseInt(quantity || '0').toFixed(2)}</span>
            </div>
          </div>

          {result && (
            <div className={clsx('flex items-center gap-2 p-3 rounded-lg',
              result.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
            )}>
              {result.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-sm">{result.message}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 bg-[#111] border border-[#262626] hover:border-[#333] text-white font-medium py-2 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting}
            className={clsx('flex-1 font-medium py-2 rounded-lg text-white',
              side === 'yes' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500',
              'disabled:opacity-50'
            )}>
            {isSubmitting ? 'Placing...' : `Buy ${side.toUpperCase()}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// CARD VIEW
// ============================================================================

function MarketCard({ market, onTrade }: { market: Market; onTrade: (side: 'yes' | 'no') => void }) {
  const [expanded, setExpanded] = useState(false);
  const totalVol = (market.volume_yes || 0) + (market.volume_no || 0);
  const yesPrice = totalVol > 0 ? (market.volume_yes || 0) / totalVol : (market.last_price_yes ?? 0.5);
  const noPrice = 1 - yesPrice;

  return (
    <motion.div layout className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] overflow-hidden hover:border-[#262626] transition-colors">
      <div className="p-5 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-lg">{market.ticker}</span>
              <span className={clsx('text-xs px-2 py-0.5 rounded-lg',
                market.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'
              )}>{market.status}</span>
            </div>
            <h3 className="text-lg font-semibold text-white">{market.title}</h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{new Date(market.closes_at).toLocaleDateString()}</span>
              <span>Vol: ${totalVol.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">YES</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">{(yesPrice * 100).toFixed(0)}¢</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">NO</span>
                <span className="text-lg font-bold text-red-400 font-mono">{(noPrice * 100).toFixed(0)}¢</span>
              </div>
            </div>
            <ChevronRight className={clsx('w-5 h-5 text-gray-500 transition-transform', expanded && 'rotate-90')} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#1a1a1a]">
            <div className="p-5 bg-black/30">
              <OrderBookDisplay marketId={market.id} />
              <div className="mt-4 flex gap-3">
                <button onClick={() => onTrade('yes')}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-emerald-500/20">
                  Buy YES @ {(yesPrice * 100).toFixed(0)}¢
                </button>
                <button onClick={() => onTrade('no')}
                  className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-red-500/20">
                  Buy NO @ {(noPrice * 100).toFixed(0)}¢
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// CREATE MARKET MODAL
// ============================================================================

function CreateMarketModal({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('tech-earnings');
  const [closesIn, setClosesIn] = useState('7');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const categories = [
    { id: 'tech-earnings', label: 'Tech & AI' },
    { id: 'geopolitics', label: 'Geopolitics' },
    { id: 'economics', label: 'Economics' },
    { id: 'crypto', label: 'Crypto & DeFi' },
    { id: 'logistics', label: 'Logistics' },
    { id: 'sports', label: 'Sports' },
    { id: 'weather', label: 'Climate & Weather' },
    { id: 'health', label: 'Health & Science' },
    { id: 'entertainment', label: 'Entertainment' },
  ];

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const closesAt = new Date();
      closesAt.setDate(closesAt.getDate() + parseInt(closesIn));
      await apiClient.post('/markets', {
        title: title.trim(),
        description: description.trim() || `Will "${title.trim()}" resolve to YES?`,
        category,
        closes_at: closesAt.toISOString(),
        resolves_at: new Date(closesAt.getTime() + 3600000).toISOString(),
      });
      setResult({ success: true, message: 'Market created!' });
      onCreated?.();
      setTimeout(onClose, 1000);
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create New Market</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Market Question</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Will X happen by Y date?"
              className="w-full bg-black border border-[#262626] rounded-lg py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full bg-black border border-[#262626] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500">
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Closes In</label>
            <select value={closesIn} onChange={e => setClosesIn(e.target.value)}
              className="w-full bg-black border border-[#262626] rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500">
              {[1,3,7,14,30,90].map(d => <option key={d} value={d}>{d} day{d>1?'s':''}</option>)}
            </select>
          </div>
          {result && (
            <div className={clsx('p-3 rounded-lg flex items-center gap-2',
              result.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
              {result.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span>{result.message}</span>
            </div>
          )}
          <button onClick={handleSubmit} disabled={isSubmitting || !title.trim()}
            className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50">
            {isSubmitting ? 'Creating...' : 'Create Market'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN MARKETS PAGE
// ============================================================================

const mockMarkets: Market[] = [
  { id: '1', ticker: 'SGP-PORT-2026', title: 'Singapore Port Closure by Feb 2026', description: '', status: 'active', outcome: null, opens_at: '2026-01-01T00:00:00Z', closes_at: '2026-02-01T00:00:00Z', resolves_at: '2026-02-01T00:00:00Z', volume_yes: 125000, volume_no: 98000, open_interest: 45000, last_price_yes: 0.35, last_price_no: 0.65 },
  { id: '2', ticker: 'AWS-OUTAGE-Q1', title: 'AWS Major Outage Q1 2026', description: '', status: 'active', outcome: null, opens_at: '2026-01-01T00:00:00Z', closes_at: '2026-03-31T00:00:00Z', resolves_at: '2026-03-31T00:00:00Z', volume_yes: 89000, volume_no: 156000, open_interest: 32000, last_price_yes: 0.22, last_price_no: 0.78 },
  { id: '3', ticker: 'BTC-100K-JAN', title: 'Bitcoin $100K by Jan 31', description: '', status: 'active', outcome: null, opens_at: '2026-01-01T00:00:00Z', closes_at: '2026-01-31T00:00:00Z', resolves_at: '2026-01-31T00:00:00Z', volume_yes: 456000, volume_no: 234000, open_interest: 120000, last_price_yes: 0.68, last_price_no: 0.32 },
];

export default function Markets() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tradeModal, setTradeModal] = useState<{ market: Market; side: 'yes' | 'no' } | null>(null);

  const { data: marketsData, isLoading, error, refetch } = useQuery({
    queryKey: ['markets', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('limit', '100');
      return apiClient.get<{ markets: Market[]; total: number }>(`/markets?${params.toString()}`);
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  const allMarkets = marketsData?.markets || mockMarkets;

  const filteredMarkets = allMarkets.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase()) && !m.ticker.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalVolume = allMarkets.reduce((a, m) => a + (m.volume_yes || 0) + (m.volume_no || 0), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Markets</h1>
          <p className="text-gray-500 text-sm mt-1">Trade outcome tokens on real-world events</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-[#111] border border-[#1a1a1a] rounded-lg p-0.5">
            <button onClick={() => setViewMode('table')}
              className={clsx('p-2 rounded-md transition-colors', viewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:text-white')}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('cards')}
              className={clsx('p-2 rounded-md transition-colors', viewMode === 'cards' ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:text-white')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium py-2 px-4 rounded-xl transition-all shadow-lg shadow-cyan-500/20">
            <Plus className="w-4 h-4" /> Create Market
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Markets', value: allMarkets.filter(m => m.status === 'active').length, color: 'text-cyan-400' },
          { label: 'Total Volume', value: `$${(totalVolume / 1e6).toFixed(2)}M`, color: 'text-emerald-400' },
          { label: 'Open Interest', value: `$${(allMarkets.reduce((a, m) => a + (m.open_interest || 0), 0) / 1e6).toFixed(2)}M`, color: 'text-purple-400' },
          { label: 'Avg Spread', value: `${(allMarkets.length > 0 ? allMarkets.reduce((a, m) => { const v = (m.volume_yes||0) + (m.volume_no||0); const p = v>0?(m.volume_yes||0)/v:0.5; return a + Math.abs(p - (1-p)); }, 0) / allMarkets.length * 100 : 0).toFixed(1)}¢`, color: 'text-amber-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className={clsx('text-xl font-bold font-mono', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search by ticker or title..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-black border border-[#1a1a1a] rounded-xl py-2 pl-10 pr-4 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
        </div>
        <div className="flex gap-1.5">
          {['all', 'active', 'pending', 'settled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                statusFilter === s ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent')}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8">
          <Activity className="w-8 h-8 text-cyan-400 mx-auto animate-spin mb-2" />
          <p className="text-gray-400 text-sm">Loading markets...</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && viewMode === 'table' && (
        <MarketTableView
          markets={filteredMarkets}
          onTrade={(m, side) => setTradeModal({ market: m, side })}
        />
      )}

      {!isLoading && viewMode === 'cards' && (
        <div className="space-y-3">
          {filteredMarkets.map(m => (
            <MarketCard key={m.id} market={m} onTrade={side => setTradeModal({ market: m, side })} />
          ))}
        </div>
      )}

      {filteredMarkets.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400">No markets found</p>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreateModal && <CreateMarketModal onClose={() => setShowCreateModal(false)} onCreated={() => refetch()} />}
      </AnimatePresence>
      {tradeModal && <TradeModal market={tradeModal.market} side={tradeModal.side} onClose={() => setTradeModal(null)} />}
    </div>
  );
}
