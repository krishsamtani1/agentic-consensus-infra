/**
 * TRUTH-NET Deposit Modal
 * Stripe Checkout integration with preset amounts
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, DollarSign, CreditCard, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const PRESETS = [10, 50, 100, 500];

export default function DepositModal({ onClose }: { onClose: () => void }) {
  const { user, refreshBalance } = useAuth();
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const effectiveAmount = customAmount ? parseFloat(customAmount) : amount;

  const handleStripeCheckout = async () => {
    if (!user || effectiveAmount <= 0) return;
    setIsLoading(true);
    setResult(null);

    try {
      const resp = await fetch(`${API_BASE}/payments/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: effectiveAmount, userId: user.id }),
      });

      const data = await resp.json();
      if (data.success && data.data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.data.url;
      } else {
        setResult({ success: false, message: data.error?.message || 'Failed to create checkout session' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Network error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoCredit = async () => {
    if (!user) return;
    setIsLoading(true);
    setResult(null);

    try {
      const resp = await fetch(`${API_BASE}/payments/demo-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount: effectiveAmount }),
      });

      const data = await resp.json();
      if (data.success) {
        setResult({ success: true, message: `$${effectiveAmount.toLocaleString()} credits added!` });
        await refreshBalance();
        setTimeout(onClose, 1500);
      } else {
        setResult({ success: false, message: data.error?.message || 'Failed to add credits' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || 'Network error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Deposit Funds</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Preset Amounts */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {PRESETS.map(preset => (
            <button
              key={preset}
              onClick={() => { setAmount(preset); setCustomAmount(''); }}
              className={clsx(
                'py-3 rounded-xl text-sm font-bold font-mono transition-all',
                amount === preset && !customAmount
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-[#111] border border-[#262626] text-gray-300 hover:border-cyan-500/30'
              )}
            >
              ${preset}
            </button>
          ))}
        </div>

        {/* Custom Amount */}
        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">$</span>
          <input
            type="number"
            placeholder="Custom amount"
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
            min="1"
            max="10000"
            className="w-full bg-black border border-[#262626] rounded-xl py-3 pl-8 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        {/* Amount Display */}
        <div className="bg-black border border-[#1a1a1a] rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-sm">Deposit Amount</span>
            <span className="text-2xl font-bold font-mono text-white">
              ${effectiveAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-gray-500 text-sm">Credits Received</span>
            <span className="text-lg font-mono text-emerald-400">
              ${effectiveAmount.toLocaleString()} USDC
            </span>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={clsx(
            'flex items-center gap-2 p-3 rounded-lg mb-4',
            result.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          )}>
            {result.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm">{result.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleStripeCheckout}
            disabled={isLoading || effectiveAmount <= 0}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Pay with Stripe
          </button>
          <button
            onClick={handleDemoCredit}
            disabled={isLoading}
            className="w-full py-3 bg-[#111] border border-[#262626] hover:border-purple-500/50 text-gray-300 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            Add Demo Credits
          </button>
        </div>
      </motion.div>
    </div>
  );
}
