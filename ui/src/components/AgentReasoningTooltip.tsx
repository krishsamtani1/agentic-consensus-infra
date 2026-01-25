import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from 'lucide-react';
import clsx from 'clsx';

export interface TradeReasoning {
  agent_name: string;
  agent_id: string;
  action: 'buy' | 'sell';
  outcome: 'yes' | 'no';
  price: number;
  quantity: number;
  confidence: number;
  reasoning: string;
  factors: Array<{
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }>;
  timestamp: Date;
}

interface AgentReasoningTooltipProps {
  trade: TradeReasoning;
  children: React.ReactNode;
}

export function AgentReasoningTooltip({ trade, children }: AgentReasoningTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {children}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-80"
          >
            {/* Thought bubble arrow */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 border-l border-t border-slate-600 rotate-45" />

            {/* Content */}
            <div className="relative bg-slate-800 border border-slate-600 rounded-xl p-4 shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-white">{trade.agent_name}</div>
                  <div className="text-xs text-slate-400">
                    {trade.action.toUpperCase()} {trade.quantity} {trade.outcome.toUpperCase()} @ {(trade.price * 100).toFixed(0)}¢
                  </div>
                </div>
                <div className={clsx(
                  'ml-auto px-2 py-1 rounded text-xs font-medium',
                  trade.action === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                )}>
                  {trade.action === 'buy' ? (
                    <TrendingUp className="w-4 h-4 inline mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 inline mr-1" />
                  )}
                  {(trade.confidence * 100).toFixed(0)}%
                </div>
              </div>

              {/* Reasoning */}
              <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-300 leading-relaxed">
                    "{trade.reasoning}"
                  </p>
                </div>
              </div>

              {/* Factors */}
              <div className="space-y-2">
                <div className="text-xs text-slate-400 font-medium">Decision Factors</div>
                {trade.factors.map((factor, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {factor.impact === 'positive' && (
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                      )}
                      {factor.impact === 'negative' && (
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                      )}
                      {factor.impact === 'neutral' && (
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                      )}
                      <span className="text-slate-300">{factor.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full',
                            factor.impact === 'positive' && 'bg-green-400',
                            factor.impact === 'negative' && 'bg-red-400',
                            factor.impact === 'neutral' && 'bg-slate-400',
                          )}
                          style={{ width: `${factor.weight * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8 text-right">
                        {(factor.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Timestamp */}
              <div className="mt-3 pt-2 border-t border-slate-700">
                <div className="text-xs text-slate-500 text-center">
                  {trade.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MOCK DATA GENERATOR
// ============================================================================

const REASONING_TEMPLATES = [
  "Hedging based on a {pct}% increase in volatility in the source news.",
  "Internal models predict {pct}% probability. Market is mispriced by {spread}¢.",
  "Correlated event in {sector} sector suggests higher risk.",
  "Historical pattern matching indicates {direction} movement likely.",
  "Real-time data from {source} contradicts current market consensus.",
  "Arbitrage opportunity detected between {market1} and {market2}.",
  "Risk-adjusted return exceeds threshold at current price.",
  "Sentiment analysis of {count} news sources shows {sentiment} bias.",
];

const FACTORS = [
  { name: 'News Sentiment', impacts: ['positive', 'negative', 'neutral'] },
  { name: 'Historical Accuracy', impacts: ['positive', 'neutral'] },
  { name: 'Market Volatility', impacts: ['negative', 'positive'] },
  { name: 'Data Freshness', impacts: ['positive', 'neutral'] },
  { name: 'Correlation Signal', impacts: ['positive', 'negative'] },
  { name: 'Volume Analysis', impacts: ['neutral', 'positive'] },
];

export function generateMockReasoning(
  agentName: string,
  agentId: string,
  action: 'buy' | 'sell',
  outcome: 'yes' | 'no',
  price: number,
  quantity: number
): TradeReasoning {
  const template = REASONING_TEMPLATES[Math.floor(Math.random() * REASONING_TEMPLATES.length)];
  const reasoning = template
    .replace('{pct}', String(Math.floor(Math.random() * 30 + 5)))
    .replace('{spread}', String(Math.floor(Math.random() * 10 + 2)))
    .replace('{sector}', ['tech', 'logistics', 'weather', 'cloud'][Math.floor(Math.random() * 4)])
    .replace('{direction}', action === 'buy' ? 'upward' : 'downward')
    .replace('{source}', ['Reuters', 'Bloomberg', 'NOAA', 'AWS Status'][Math.floor(Math.random() * 4)])
    .replace('{market1}', 'SGP-PORT')
    .replace('{market2}', 'AWS-OUTAGE')
    .replace('{count}', String(Math.floor(Math.random() * 50 + 10)))
    .replace('{sentiment}', ['bullish', 'bearish', 'mixed'][Math.floor(Math.random() * 3)]);

  const numFactors = Math.floor(Math.random() * 3) + 2;
  const selectedFactors = FACTORS
    .sort(() => Math.random() - 0.5)
    .slice(0, numFactors)
    .map(f => ({
      name: f.name,
      impact: f.impacts[Math.floor(Math.random() * f.impacts.length)] as 'positive' | 'negative' | 'neutral',
      weight: Math.random() * 0.4 + 0.2,
    }));

  return {
    agent_name: agentName,
    agent_id: agentId,
    action,
    outcome,
    price,
    quantity,
    confidence: Math.random() * 0.3 + 0.6,
    reasoning,
    factors: selectedFactors,
    timestamp: new Date(),
  };
}
