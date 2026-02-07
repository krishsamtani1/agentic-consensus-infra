/**
 * TRUTH-NET Governance Gate
 * 
 * High-stakes escalation system for trades exceeding risk thresholds.
 * Implements the "Commander's Verdict" pattern for 50/50 market splits.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Brain, 
  Scale, 
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  Gavel
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../api/client';

// ============================================================================
// TYPES
// ============================================================================

export interface EscalationCard {
  id: string;
  timestamp: Date;
  agent: {
    id: string;
    name: string;
    avatar: string;
    truthScore: number;
    brierScore: number;
  };
  trade: {
    marketId: string;
    marketTitle: string;
    marketTicker: string;
    side: 'buy' | 'sell';
    outcome: 'yes' | 'no';
    size: number;
    price: number;
    budgetPercentage: number;
  };
  reasoning: {
    chainOfThought: string[];
    confidenceScore: number;
    dataSources: string[];
    riskAssessment: string;
  };
  marketConsensus: {
    yesPrice: number;
    noPrice: number;
    isSplit: boolean; // True if 45-55% range
  };
  status: 'pending' | 'approved' | 'vetoed' | 'expired';
  expiresAt: Date;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockEscalations: EscalationCard[] = [
  {
    id: 'esc-1',
    timestamp: new Date(Date.now() - 30000),
    agent: {
      id: 'agent-geo-1',
      name: 'Geopolitical Analyst',
      avatar: '🌍',
      truthScore: 0.78,
      brierScore: 0.23,
    },
    trade: {
      marketId: 'GEO-USCH-0129',
      marketTitle: 'US-China Trade Negotiations Fail by Feb 15',
      marketTicker: 'GEO-USCH-0129',
      side: 'buy',
      outcome: 'yes',
      size: 45000,
      price: 0.62,
      budgetPercentage: 18,
    },
    reasoning: {
      chainOfThought: [
        'Detected diplomatic cable leak indicating stalled talks',
        'Cross-referenced with Shenzhen port AIS data showing 12% throughput decline',
        'Historical pattern matching suggests 73% probability of escalation',
        'Risk-reward ratio favorable at current price point',
      ],
      confidenceScore: 0.82,
      dataSources: ['Reuters API', 'MarineTraffic', 'State Dept. RSS'],
      riskAssessment: 'HIGH CONVICTION - Multiple independent signals converging',
    },
    marketConsensus: {
      yesPrice: 0.62,
      noPrice: 0.38,
      isSplit: false,
    },
    status: 'pending',
    expiresAt: new Date(Date.now() + 300000), // 5 minutes
  },
  {
    id: 'esc-2',
    timestamp: new Date(Date.now() - 120000),
    agent: {
      id: 'agent-tech-1',
      name: 'Tech Oracle',
      avatar: '💻',
      truthScore: 0.85,
      brierScore: 0.18,
    },
    trade: {
      marketId: 'TECH-GPT5-0129',
      marketTitle: 'OpenAI GPT-5 Released in Q1 2026',
      marketTicker: 'TECH-GPT5-0129',
      side: 'buy',
      outcome: 'yes',
      size: 32000,
      price: 0.51,
      budgetPercentage: 16,
    },
    reasoning: {
      chainOfThought: [
        'GitHub commit velocity in semantic-kernel repo spiked 340%',
        'Azure spot pricing in Virginia indicates datacenter preparation',
        'Insider Slack leak suggests internal demo scheduled',
        'Market currently underpricing based on available signals',
      ],
      confidenceScore: 0.73,
      dataSources: ['GitHub API', 'Azure Pricing', 'Blind Forums'],
      riskAssessment: 'MODERATE - Strong signals but timing uncertain',
    },
    marketConsensus: {
      yesPrice: 0.51,
      noPrice: 0.49,
      isSplit: true, // This triggers Commander's Verdict
    },
    status: 'pending',
    expiresAt: new Date(Date.now() + 240000),
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

interface EscalationCardProps {
  escalation: EscalationCard;
  onApprove: (id: string) => void;
  onVeto: (id: string) => void;
}

function EscalationCardComponent({ escalation, onApprove, onVeto }: EscalationCardProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [showFullReasoning, setShowFullReasoning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, escalation.expiresAt.getTime() - Date.now());
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [escalation.expiresAt]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const isUrgent = timeLeft < 60000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={clsx(
        'bg-[#0a0a0a] border-2 rounded-xl overflow-hidden',
        escalation.marketConsensus.isSplit 
          ? 'border-purple-500 shadow-lg shadow-purple-500/20' 
          : 'border-amber-500 shadow-lg shadow-amber-500/20'
      )}
    >
      {/* Header */}
      <div className={clsx(
        'px-4 py-3 flex items-center justify-between',
        escalation.marketConsensus.isSplit 
          ? 'bg-purple-500/10 border-b border-purple-500/30' 
          : 'bg-amber-500/10 border-b border-amber-500/30'
      )}>
        <div className="flex items-center gap-3">
          {escalation.marketConsensus.isSplit ? (
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Gavel className="w-5 h-5 text-purple-400" />
            </div>
          ) : (
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className={clsx(
                'text-xs font-bold uppercase px-2 py-0.5 rounded',
                escalation.marketConsensus.isSplit 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-amber-500 text-black'
              )}>
                {escalation.marketConsensus.isSplit ? "Commander's Verdict Required" : 'High-Stakes Escalation'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Trade exceeds {escalation.trade.budgetPercentage}% of agent budget
            </p>
          </div>
        </div>
        <div className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg',
          isUrgent ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-gray-800 text-gray-400'
        )}>
          <Clock className="w-4 h-4" />
          <span className="font-mono text-sm">{minutes}:{seconds.toString().padStart(2, '0')}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Agent & Trade Info */}
        <div className="flex items-start gap-4">
          <div className="text-4xl">{escalation.agent.avatar}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-white">{escalation.agent.name}</span>
              <span className="text-xs text-gray-500">requests approval</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>Truth: <strong className="text-emerald-400">{(escalation.agent.truthScore * 100).toFixed(0)}%</strong></span>
              <span>Brier: <strong className="text-cyan-400">{escalation.agent.brierScore.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>

        {/* Trade Details */}
        <div className="bg-black/50 rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 font-mono">{escalation.trade.marketTicker}</p>
              <p className="text-sm text-white font-medium">{escalation.trade.marketTitle}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold font-mono text-white">
                ${(escalation.trade.size / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-gray-500">{escalation.trade.budgetPercentage}% of budget</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg flex-1',
              escalation.trade.side === 'buy' ? 'bg-emerald-500/20' : 'bg-red-500/20'
            )}>
              {escalation.trade.side === 'buy' ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className={clsx(
                'font-semibold text-sm',
                escalation.trade.side === 'buy' ? 'text-emerald-400' : 'text-red-400'
              )}>
                {escalation.trade.side.toUpperCase()} {escalation.trade.outcome.toUpperCase()}
              </span>
              <span className="text-gray-400 text-sm ml-auto">
                @ {(escalation.trade.price * 100).toFixed(0)}¢
              </span>
            </div>
          </div>

          {/* Market Consensus */}
          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-500">Market Consensus</span>
              {escalation.marketConsensus.isSplit && (
                <span className="text-purple-400 flex items-center gap-1">
                  <Scale className="w-3 h-3" /> 50/50 Split - Your verdict is the tiebreaker
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-emerald-500/20 rounded-lg p-2 text-center">
                <p className="text-emerald-400 font-mono text-lg font-bold">
                  {(escalation.marketConsensus.yesPrice * 100).toFixed(0)}%
                </p>
                <p className="text-[10px] text-gray-500 uppercase">YES</p>
              </div>
              <div className="flex-1 bg-red-500/20 rounded-lg p-2 text-center">
                <p className="text-red-400 font-mono text-lg font-bold">
                  {(escalation.marketConsensus.noPrice * 100).toFixed(0)}%
                </p>
                <p className="text-[10px] text-gray-500 uppercase">NO</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chain of Thought */}
        <div>
          <button
            onClick={() => setShowFullReasoning(!showFullReasoning)}
            className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors mb-2"
          >
            <Brain className="w-4 h-4" />
            Agent's Internal Reasoning
          </button>
          
          <AnimatePresence>
            {showFullReasoning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3 space-y-2"
              >
                {escalation.reasoning.chainOfThought.map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-mono text-xs mt-0.5">{i + 1}.</span>
                    <p className="text-sm text-gray-300">{step}</p>
                  </div>
                ))}
                <div className="pt-2 border-t border-cyan-500/20 flex items-center gap-4 text-xs">
                  <span className="text-gray-500">Sources:</span>
                  {escalation.reasoning.dataSources.map((src) => (
                    <span key={src} className="text-cyan-400">{src}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Risk Assessment:</span>
                  <span className="text-xs text-amber-400 font-semibold">{escalation.reasoning.riskAssessment}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => onVeto(escalation.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-xl font-semibold transition-all"
          >
            <XCircle className="w-5 h-5" />
            VETO & RE-PLAN
          </button>
          <button
            onClick={() => onApprove(escalation.id)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 rounded-xl font-semibold transition-all"
          >
            <CheckCircle2 className="w-5 h-5" />
            APPROVE & DISPATCH
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GovernanceGate() {
  const [escalations, setEscalations] = useState<EscalationCard[]>(mockEscalations);
  const [resolvedCount, setResolvedCount] = useState({ approved: 0, vetoed: 0 });

  const handleApprove = async (id: string) => {
    // Send approval to backend
    try {
      await apiClient.post(`/doctrine/escalation/${id}/approve`, {});
    } catch (e) {
      console.log('Escalation API not available');
    }
    
    setEscalations(prev => prev.filter(e => e.id !== id));
    setResolvedCount(prev => ({ ...prev, approved: prev.approved + 1 }));
  };

  const handleVeto = async (id: string) => {
    // Send veto to backend
    try {
      await apiClient.post(`/doctrine/escalation/${id}/veto`, {});
    } catch (e) {
      console.log('Escalation API not available');
    }
    
    setEscalations(prev => prev.filter(e => e.id !== id));
    setResolvedCount(prev => ({ ...prev, vetoed: prev.vetoed + 1 }));
  };

  const pendingCount = escalations.filter(e => e.status === 'pending').length;
  const splitCount = escalations.filter(e => e.marketConsensus.isSplit).length;

  return (
    <div className="bg-[#0a0a0a] border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-[#0a0a0a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Governance Gate</h2>
              <p className="text-xs text-gray-500">High-stakes trades requiring Commander approval</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {splitCount > 0 && (
              <span className="flex items-center gap-1 text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-lg">
                <Gavel className="w-3 h-3" />
                {splitCount} Verdict{splitCount > 1 ? 's' : ''} Required
              </span>
            )}
            <span className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-lg">
              <Zap className="w-3 h-3" />
              {pendingCount} Pending
            </span>
          </div>
        </div>
      </div>

      {/* Escalation Cards */}
      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {escalations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Shield className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No pending escalations</p>
              <p className="text-xs text-gray-600 mt-1">
                High-stakes trades will appear here for approval
              </p>
            </motion.div>
          ) : (
            escalations.map((escalation) => (
              <EscalationCardComponent
                key={escalation.id}
                escalation={escalation}
                onApprove={handleApprove}
                onVeto={handleVeto}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer Stats */}
      {(resolvedCount.approved > 0 || resolvedCount.vetoed > 0) && (
        <div className="p-3 border-t border-slate-800 bg-black/50 flex items-center justify-center gap-6 text-xs">
          <span className="text-gray-500">Session:</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {resolvedCount.approved} Approved
          </span>
          <span className="text-red-400 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {resolvedCount.vetoed} Vetoed
          </span>
        </div>
      )}
    </div>
  );
}
