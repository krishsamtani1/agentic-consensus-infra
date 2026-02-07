/**
 * TRUTH-NET Onboarding / ConciergeWizard
 * 3-step guided commissioning flow for new users
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Shield, TrendingUp, Target, Users, ArrowRight, 
  DollarSign, Bot, CheckCircle, Sparkles, Eye, Rocket
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Agent Templates
const AGENT_TEMPLATES = [
  {
    id: 'conservative',
    name: 'Conservative Analyst',
    icon: Shield,
    color: 'from-blue-600 to-cyan-600',
    shadow: 'shadow-blue-500/20',
    persona: 'Risk-averse news analyst. Focuses on high-confidence predictions backed by verified sources. Max position 10% of portfolio.',
    topics: ['#Geopolitics', '#Macro'],
    risk: 'Low',
    maxPosition: 10,
  },
  {
    id: 'momentum',
    name: 'Momentum Trader',
    icon: TrendingUp,
    color: 'from-orange-600 to-red-600',
    shadow: 'shadow-orange-500/20',
    persona: 'Aggressive trend-follower. Identifies breaking events and deploys capital rapidly. Max position 30% of portfolio.',
    topics: ['#Tech', '#Crypto', '#Viral'],
    risk: 'High',
    maxPosition: 30,
  },
  {
    id: 'balanced',
    name: 'Balanced Portfolio',
    icon: Target,
    color: 'from-emerald-600 to-teal-600',
    shadow: 'shadow-emerald-500/20',
    persona: 'Diversified across all sectors. Balanced risk-reward profile. Hedges large positions automatically. Max position 20%.',
    topics: ['#All-Sectors'],
    risk: 'Medium',
    maxPosition: 20,
  },
  {
    id: 'scanner',
    name: 'News Scanner',
    icon: Eye,
    color: 'from-purple-600 to-pink-600',
    shadow: 'shadow-purple-500/20',
    persona: 'Pure information agent. Monitors 50+ RSS feeds and APIs. Creates market intelligence but trades conservatively. Max position 5%.',
    topics: ['#Intelligence', '#Signals'],
    risk: 'Very Low',
    maxPosition: 5,
  },
];

const OBJECTIVES = [
  { id: 'growth', label: 'Capital Growth', icon: TrendingUp, desc: 'Maximize returns with managed risk' },
  { id: 'truth', label: 'Truth Discovery', icon: Target, desc: 'Identify mispriced narratives in the market' },
  { id: 'hedge', label: 'Risk Hedging', icon: Shield, desc: 'Protect against adverse real-world events' },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState('growth');
  const [selectedAgents, setSelectedAgents] = useState<string[]>(['balanced']);
  const [fundingChoice, setFundingChoice] = useState<'demo' | 'stripe'>('demo');

  const { register, login, skipAuth, user, markOnboarded } = useAuth();
  const navigate = useNavigate();

  // Step 0: Welcome / Auth
  const handleAuth = async () => {
    setError('');
    setIsLoading(true);
    try {
      if (authMode === 'register') {
        await register(email, password, displayName || undefined);
      } else {
        await login(email, password);
      }
      setStep(1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoMode = () => {
    skipAuth();
    setStep(1);
  };

  // Step 2: Fund account
  const handleFunding = async () => {
    if (fundingChoice === 'demo') {
      // Credit demo funds
      try {
        const userId = user?.id || 'demo-user';
        await fetch(`${API_BASE}/payments/demo-credit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount: 10000 }),
        });
      } catch {
        // Continue anyway
      }
    }
    setStep(2);
  };

  // Step 3: Deploy agents & finish
  const handleFinish = async () => {
    setIsLoading(true);
    try {
      // Deploy selected agents
      for (const agentId of selectedAgents) {
        const template = AGENT_TEMPLATES.find(t => t.id === agentId);
        if (template) {
          try {
            await fetch(`${API_BASE}/governance/agents`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: template.name,
                strategy_persona: template.persona,
                staked_budget: 2000,
                max_position_pct: template.maxPosition,
                allowed_topics: template.topics,
              }),
            });
          } catch {
            // Agent creation may fail on demo - continue
          }
        }
      }

      await markOnboarded();
      navigate('/');
    } catch {
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative w-full max-w-2xl">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-gray-800">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                initial={{ width: '0%' }}
                animate={{ width: step >= i ? '100%' : '0%' }}
                transition={{ duration: 0.5, delay: step >= i ? 0.2 : 0 }}
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ============================================================ */}
          {/* STEP 0: Welcome / Auth */}
          {/* ============================================================ */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8"
            >
              {/* Logo */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Welcome to TRUTH-NET</h1>
                  <p className="text-sm text-gray-500">AI-Powered Prediction Markets</p>
                </div>
              </div>

              <p className="text-gray-400 mb-6 leading-relaxed">
                TRUTH-NET is a prediction market platform where autonomous AI agents
                trade outcome tokens on real-world events. Set your strategy,
                deploy agents, and let them find alpha across global markets.
              </p>

              {/* Auth form */}
              <div className="space-y-4">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setAuthMode('register')}
                    className={clsx(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      authMode === 'register' ? 'bg-cyan-600 text-white' : 'bg-[#111] text-gray-400'
                    )}
                  >
                    Create Account
                  </button>
                  <button
                    onClick={() => setAuthMode('login')}
                    className={clsx(
                      'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      authMode === 'login' ? 'bg-cyan-600 text-white' : 'bg-[#111] text-gray-400'
                    )}
                  >
                    Sign In
                  </button>
                </div>

                {authMode === 'register' && (
                  <input
                    type="text"
                    placeholder="Display Name (optional)"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full bg-black border border-[#262626] rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                )}

                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-black border border-[#262626] rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAuth()}
                  className="w-full bg-black border border-[#262626] rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                />

                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}

                <button
                  onClick={handleAuth}
                  disabled={isLoading || !email || !password}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {authMode === 'register' ? 'Commission Account' : 'Sign In'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-800" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[#0a0a0a] text-gray-600">or</span>
                  </div>
                </div>

                <button
                  onClick={handleDemoMode}
                  className="w-full py-3 bg-[#111] border border-[#262626] hover:border-purple-500/50 text-gray-300 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Enter Demo Mode ($10,000 Credits)
                </button>
              </div>
            </motion.div>
          )}

          {/* ============================================================ */}
          {/* STEP 1: Fund & Objective */}
          {/* ============================================================ */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8"
            >
              <h2 className="text-xl font-bold text-white mb-1">Objective & Funding</h2>
              <p className="text-gray-500 text-sm mb-6">Choose your strategy and fund your account</p>

              {/* Objective Selection */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 font-medium mb-3 block">What is your primary objective?</label>
                <div className="grid grid-cols-3 gap-3">
                  {OBJECTIVES.map(obj => (
                    <button
                      key={obj.id}
                      onClick={() => setSelectedObjective(obj.id)}
                      className={clsx(
                        'p-4 rounded-xl border transition-all text-left',
                        selectedObjective === obj.id
                          ? 'border-cyan-500/50 bg-cyan-500/10'
                          : 'border-[#1a1a1a] hover:border-[#333]'
                      )}
                    >
                      <obj.icon className={clsx('w-5 h-5 mb-2', selectedObjective === obj.id ? 'text-cyan-400' : 'text-gray-500')} />
                      <p className="text-sm font-medium text-white">{obj.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{obj.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Funding */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 font-medium mb-3 block">Fund your trading account</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFundingChoice('demo')}
                    className={clsx(
                      'p-4 rounded-xl border transition-all text-left',
                      fundingChoice === 'demo'
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-[#1a1a1a] hover:border-[#333]'
                    )}
                  >
                    <Sparkles className={clsx('w-5 h-5 mb-2', fundingChoice === 'demo' ? 'text-emerald-400' : 'text-gray-500')} />
                    <p className="text-sm font-medium text-white">Demo Credits</p>
                    <p className="text-xs text-gray-500 mt-1">$10,000 free credits to explore</p>
                  </button>
                  <button
                    onClick={() => setFundingChoice('stripe')}
                    className={clsx(
                      'p-4 rounded-xl border transition-all text-left',
                      fundingChoice === 'stripe'
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-[#1a1a1a] hover:border-[#333]'
                    )}
                  >
                    <DollarSign className={clsx('w-5 h-5 mb-2', fundingChoice === 'stripe' ? 'text-blue-400' : 'text-gray-500')} />
                    <p className="text-sm font-medium text-white">Deposit via Stripe</p>
                    <p className="text-xs text-gray-500 mt-1">Real USD deposit (Test Mode)</p>
                  </button>
                </div>
              </div>

              <button
                onClick={handleFunding}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: Deploy Agents */}
          {/* ============================================================ */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8"
            >
              <h2 className="text-xl font-bold text-white mb-1">Step 3: Deploy Your Agents</h2>
              <p className="text-gray-500 text-sm mb-6">Select agent templates to deploy into the clearinghouse</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {AGENT_TEMPLATES.map(agent => {
                  const selected = selectedAgents.includes(agent.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={clsx(
                        'p-4 rounded-xl border transition-all text-left relative overflow-hidden',
                        selected
                          ? 'border-cyan-500/50 bg-[#111]'
                          : 'border-[#1a1a1a] hover:border-[#333] bg-[#0a0a0a]'
                      )}
                    >
                      {selected && (
                        <div className="absolute top-3 right-3">
                          <CheckCircle className="w-5 h-5 text-cyan-400" />
                        </div>
                      )}
                      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br mb-3', agent.color, agent.shadow, 'shadow-lg')}>
                        <agent.icon className="w-5 h-5 text-white" />
                      </div>
                      <p className="text-sm font-semibold text-white">{agent.name}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{agent.persona}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={clsx(
                          'text-[10px] px-2 py-0.5 rounded-full',
                          agent.risk === 'Low' ? 'bg-blue-500/20 text-blue-400' :
                          agent.risk === 'Very Low' ? 'bg-gray-500/20 text-gray-400' :
                          agent.risk === 'Medium' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-orange-500/20 text-orange-400'
                        )}>
                          {agent.risk} Risk
                        </span>
                        <span className="text-[10px] text-gray-600">Max {agent.maxPosition}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleFinish}
                disabled={isLoading || selectedAgents.length === 0}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover:from-cyan-500 hover:via-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg shadow-lg shadow-cyan-500/20"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    Start Trading
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
