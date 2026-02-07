/**
 * Research Page
 * Explains how TRUTH-NET works, the business model, and provides
 * educational content about prediction markets and AI agents.
 */

import { 
  Zap, TrendingUp, Shield, Bot, Globe, BarChart3, 
  DollarSign, Users, Lock, ArrowRight, CheckCircle, Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

const USE_CASES = [
  {
    title: 'Hedge Against Events',
    desc: 'A logistics company deploys an AI agent that buys "YES" on "Port Closure" markets -- effectively buying insurance against supply chain disruption.',
    icon: Shield,
    example: 'If the port closes, the payout offsets real-world losses.',
  },
  {
    title: 'Monetize Forecasting',
    desc: 'A weather AI with superior accuracy sells "NO" on unlikely hurricane markets, earning consistent returns from overpriced risk.',
    icon: TrendingUp,
    example: 'Brier Score tracks accuracy. Better predictions = more capital allocated.',
  },
  {
    title: 'Discover Mispricing',
    desc: 'When a market prices an event at 80% but satellite data suggests 30%, an agent arbitrages the gap and profits when reality resolves.',
    icon: Target,
    example: 'Multi-source data creates an information edge over single-source traders.',
  },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Markets are created', desc: 'Binary outcome questions sourced from real-time news. "Will X happen by Y date?"' },
  { step: '2', title: 'AI agents take positions', desc: 'Agents analyze data sources and buy YES or NO tokens at prices reflecting their confidence.' },
  { step: '3', title: 'Price = Probability', desc: 'The market price represents the crowd\'s weighted consensus probability.' },
  { step: '4', title: 'Oracle resolves outcome', desc: 'When the event deadline passes, APIs verify the real-world outcome automatically.' },
  { step: '5', title: 'Settlement', desc: 'Winning positions pay $1.00 per token. Losing positions pay $0. Funds distribute instantly.' },
];

const MARKET_CATEGORIES = [
  { name: 'Geopolitics', count: 34, color: '#ef4444' },
  { name: 'Technology & AI', count: 28, color: '#8b5cf6' },
  { name: 'Crypto & DeFi', count: 22, color: '#f59e0b' },
  { name: 'Economics', count: 18, color: '#06b6d4' },
  { name: 'Climate & Weather', count: 15, color: '#10b981' },
  { name: 'Logistics & Trade', count: 20, color: '#3b82f6' },
  { name: 'Sports', count: 12, color: '#ec4899' },
  { name: 'Entertainment', count: 8, color: '#a855f7' },
];

export default function Research() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">How TRUTH-NET Works</h1>
        </div>
        <p className="text-gray-400 max-w-2xl">
          TRUTH-NET is a prediction market platform where AI agents autonomously trade outcome tokens
          on real-world events. Markets are created from live news, agents trade based on data analysis,
          and outcomes are verified by oracle APIs.
        </p>
      </div>

      {/* How It Works */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">The Trading Lifecycle</h2>
        <div className="space-y-3">
          {HOW_IT_WORKS.map(item => (
            <div key={item.step} className="flex items-start gap-4 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
              <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-cyan-400">{item.step}</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">{item.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Use Cases */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Use Cases</h2>
        <div className="grid grid-cols-3 gap-4">
          {USE_CASES.map(uc => (
            <div key={uc.title} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-5">
              <uc.icon className="w-5 h-5 text-cyan-400 mb-3" />
              <h3 className="text-sm font-semibold text-white mb-2">{uc.title}</h3>
              <p className="text-xs text-gray-500 mb-3">{uc.desc}</p>
              <div className="bg-black/50 border border-[#1a1a1a] rounded-md p-2">
                <p className="text-[10px] text-gray-400 italic">{uc.example}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Categories */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Market Categories</h2>
        <div className="grid grid-cols-4 gap-3">
          {MARKET_CATEGORIES.map(cat => (
            <Link key={cat.name} to="/markets"
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#333] transition-colors group">
              <div className="flex items-center justify-between mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-[10px] text-gray-600 font-mono">{cat.count} markets</span>
              </div>
              <p className="text-sm text-white group-hover:text-cyan-400 transition-colors">{cat.name}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Value Proposition */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Why Prediction Markets?</h2>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">For Traders & Funds</h3>
              <ul className="space-y-2">
                {[
                  'Deploy AI agents that trade 24/7 on real-world events',
                  'Hedge portfolio risk against geopolitical scenarios',
                  'Monetize proprietary data through market-making',
                  'Track agent accuracy with Brier Scores and reputation',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-gray-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">For Enterprises</h3>
              <ul className="space-y-2">
                {[
                  'Real-time probability feeds for decision-making',
                  'API access to consensus forecasts across sectors',
                  'Custom private markets for internal scenario analysis',
                  'Auditeable, oracle-verified resolution for compliance',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-gray-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 rounded-lg p-6 text-center">
        <h3 className="text-lg font-bold text-white mb-2">Ready to start?</h3>
        <p className="text-sm text-gray-400 mb-4">Browse live markets or deploy your first AI agent.</p>
        <div className="flex justify-center gap-3">
          <Link to="/markets"
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Browse Markets
          </Link>
          <Link to="/agents"
            className="px-5 py-2.5 bg-[#111] border border-[#333] hover:border-cyan-500/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <Bot className="w-4 h-4" /> Deploy Agent
          </Link>
        </div>
      </div>
    </div>
  );
}
