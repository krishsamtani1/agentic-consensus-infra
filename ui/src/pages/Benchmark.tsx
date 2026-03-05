/**
 * TRUTH-NET Benchmark-as-a-Service Page
 * 
 * Submit AI agents for standardized testing and rating.
 * Pricing tiers: Quick (free), Standard ($499), Comprehensive ($4,999)
 */

import { useState } from 'react';
import {
  Zap, Play, Clock, CheckCircle, AlertCircle, ArrowRight,
  Bot, Target, BarChart3, Shield, Activity, FileText,
  Server, Globe, Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// ============================================================================
// TYPES
// ============================================================================

interface BenchmarkRun {
  id: string;
  agentName: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  depth: string;
  startedAt?: string;
  results?: {
    brierScore: number;
    accuracy: number;
    suggestedGrade: string;
    truthScore: number;
    avgResponseTime: number;
    totalMarkets: number;
  };
}

// ============================================================================
// DATA
// ============================================================================

const PLANS = [
  {
    id: 'quick',
    name: 'Quick Scan',
    price: 'Free',
    priceDetail: '10 markets',
    time: '~5 min',
    features: ['10 market predictions', 'Basic accuracy score', 'Overall grade', 'Instant results'],
    recommended: false,
    icon: Zap,
    gradient: 'from-gray-600 to-gray-700',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$499',
    priceDetail: '50 markets',
    time: '~30 min',
    features: ['50 market predictions', 'Full accuracy analysis', 'Domain breakdown', 'Calibration report', 'PDF report'],
    recommended: true,
    icon: Target,
    gradient: 'from-cyan-600 to-blue-600',
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive',
    price: '$4,999',
    priceDetail: '200 markets',
    time: '~2 hours',
    features: ['200 market predictions', 'All Standard features', 'Stress testing', 'Response time analysis', 'Certification eligibility', 'White-label report'],
    recommended: false,
    icon: Shield,
    gradient: 'from-purple-600 to-pink-600',
  },
];

const MOCK_HISTORY: BenchmarkRun[] = [
  { id: 'br-1', agentName: 'My GPT-4 Agent', status: 'completed', progress: 100, depth: 'standard', startedAt: '2026-02-10', results: { brierScore: 0.18, accuracy: 72.1, suggestedGrade: 'A', truthScore: 76.2, avgResponseTime: 1200, totalMarkets: 50 } },
  { id: 'br-2', agentName: 'Claude Trading Bot', status: 'completed', progress: 100, depth: 'quick', startedAt: '2026-02-08', results: { brierScore: 0.12, accuracy: 81.3, suggestedGrade: 'AA', truthScore: 84.7, avgResponseTime: 890, totalMarkets: 10 } },
];

const CATEGORIES = [
  { id: 'tech', label: 'Tech & AI', icon: Code },
  { id: 'geopolitics', label: 'Geopolitics', icon: Globe },
  { id: 'finance', label: 'Finance', icon: BarChart3 },
  { id: 'crypto', label: 'Crypto', icon: Zap },
  { id: 'logistics', label: 'Logistics', icon: Server },
  { id: 'climate', label: 'Climate', icon: Activity },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function PlanCard({ plan, onSelect }: { plan: typeof PLANS[0]; onSelect: () => void }) {
  const Icon = plan.icon;
  return (
    <div className={clsx(
      'bg-[#0a0a0a] border rounded-xl p-6 relative flex flex-col',
      plan.recommended ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-[#1a1a1a]'
    )}>
      {plan.recommended && (
        <span className="absolute -top-2.5 left-4 px-3 py-0.5 bg-cyan-600 text-white text-[10px] font-bold rounded-full tracking-wide">
          MOST POPULAR
        </span>
      )}
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br mb-4', plan.gradient)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
      <div className="mt-2 mb-1">
        <span className="text-3xl font-bold text-white">{plan.price}</span>
        <span className="text-xs text-gray-500 ml-2">{plan.priceDetail}</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Est. time: {plan.time}</p>
      <ul className="space-y-2 flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <button onClick={onSelect} className={clsx(
        'w-full py-2.5 rounded-xl font-semibold text-sm mt-6 transition-all',
        plan.recommended
          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20'
          : 'bg-[#111] border border-[#262626] hover:border-[#444] text-white'
      )}>
        Select Plan
      </button>
    </div>
  );
}

function SubmitForm({ plan, onBack, onSubmit }: { plan: string; onBack: () => void; onSubmit: () => void }) {
  const API_BASE = import.meta.env.VITE_API_URL || '/api';
  const [agentName, setAgentName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [protocol, setProtocol] = useState<'rest' | 'mcp' | 'a2a'>('rest');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['tech', 'finance']);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/v1/benchmark/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('truthnet_token')}` },
        body: JSON.stringify({ agentName, endpoint, protocol, categories: selectedCategories, depth: plan }),
      });
    } catch {}
    setSubmitting(false);
    onSubmit();
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-gray-500 hover:text-white transition-colors text-sm">
          &larr; Back to plans
        </button>
        <span className="text-gray-700">/</span>
        <span className="text-sm text-cyan-400 font-medium">{PLANS.find(p => p.id === plan)?.name}</span>
      </div>

      <h3 className="text-xl font-bold text-white mb-6">Submit Your Agent for Benchmarking</h3>

      <div className="space-y-5">
        <div>
          <label className="text-sm text-gray-400 block mb-1">Agent Name</label>
          <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)}
            placeholder="e.g., My GPT-4 Trading Agent"
            className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none" />
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">Agent Endpoint URL</label>
          <input type="url" value={endpoint} onChange={e => setEndpoint(e.target.value)}
            placeholder="https://api.your-agent.com/predict"
            className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none" />
          <p className="text-[10px] text-gray-600 mt-1">We'll POST market data and expect probability responses (0-1)</p>
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-2">Protocol</label>
          <div className="flex gap-2">
            {[
              { id: 'rest' as const, label: 'REST API' },
              { id: 'mcp' as const, label: 'MCP (Model Context Protocol)' },
              { id: 'a2a' as const, label: 'A2A Standard' },
            ].map(p => (
              <button key={p.id} onClick={() => setProtocol(p.id)}
                className={clsx('px-4 py-2 rounded-lg text-sm transition-colors',
                  protocol === p.id ? 'bg-cyan-600 text-white' : 'bg-[#111] border border-[#262626] text-gray-400 hover:text-white'
                )}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-2">Test Categories</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
                  selectedCategories.includes(cat.id)
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-[#111] border border-[#262626] text-gray-500 hover:text-gray-300'
                )}>
                <cat.icon className="w-3 h-3" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#111] rounded-xl p-4 border border-[#1a1a1a]">
          <h4 className="text-sm font-semibold text-white mb-2">What We'll Test</h4>
          <ul className="space-y-1.5 text-xs text-gray-400">
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" />Send real market data to your endpoint</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" />Validate probability responses</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" />Compare against resolved outcomes</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" />Calculate Brier Score and accuracy</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" />Generate grade and TruthScore</li>
          </ul>
        </div>

        <button onClick={handleSubmit} disabled={!agentName || !endpoint || submitting}
          className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? 'Submitting...' : 'Start Benchmark'}
        </button>
      </div>
    </motion.div>
  );
}

function BenchmarkHistory() {
  const gradeColor = (g: string) => {
    if (g === 'AAA') return 'text-emerald-400';
    if (g === 'AA') return 'text-cyan-400';
    if (g === 'A') return 'text-blue-400';
    if (g === 'BBB') return 'text-amber-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#1a1a1a] flex items-center gap-2">
        <FileText className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-white">Previous Benchmarks</span>
      </div>
      <div className="divide-y divide-[#111]">
        {MOCK_HISTORY.map(run => (
          <div key={run.id} className="p-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-white font-medium">{run.agentName}</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                  {run.status}
                </span>
              </div>
              <span className="text-xs text-gray-500">{run.startedAt}</span>
            </div>
            {run.results && (
              <div className="grid grid-cols-5 gap-4 mt-3">
                <div>
                  <p className="text-[10px] text-gray-500">Grade</p>
                  <p className={clsx('text-lg font-bold font-mono', gradeColor(run.results.suggestedGrade))}>
                    {run.results.suggestedGrade}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">TruthScore</p>
                  <p className="text-lg font-bold text-white font-mono">{run.results.truthScore}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Brier Score</p>
                  <p className="text-lg font-bold text-white font-mono">{run.results.brierScore}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Accuracy</p>
                  <p className="text-lg font-bold text-white font-mono">{run.results.accuracy}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Markets</p>
                  <p className="text-lg font-bold text-white font-mono">{run.results.totalMarkets}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export default function Benchmark() {
  const [step, setStep] = useState<'plans' | 'submit'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<string>('standard');
  const [showSuccess, setShowSuccess] = useState(false);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
          <Target className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Benchmark Your Agent</h1>
          <p className="text-gray-500 text-sm">Submit your AI agent for standardized accuracy testing and get a TRUTH-NET rating</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'plans' && !showSuccess && (
          <motion.div key="plans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-3 gap-5 mb-8">
              {PLANS.map(plan => (
                <PlanCard key={plan.id} plan={plan} onSelect={() => { setSelectedPlan(plan.id); setStep('submit'); }} />
              ))}
            </div>
            <BenchmarkHistory />
          </motion.div>
        )}

        {step === 'submit' && !showSuccess && (
          <SubmitForm
            plan={selectedPlan}
            onBack={() => setStep('plans')}
            onSubmit={() => setShowSuccess(true)}
          />
        )}

        {showSuccess && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Benchmark Submitted!</h3>
            <p className="text-gray-400 mb-6">Your agent is queued for testing. You'll be notified when results are ready.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => { setShowSuccess(false); setStep('plans'); }}
                className="px-6 py-2.5 bg-[#111] border border-[#262626] hover:border-[#444] text-white rounded-lg text-sm font-medium transition-colors">
                View History
              </button>
              <button onClick={() => { setShowSuccess(false); setStep('submit'); }}
                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors">
                Submit Another
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
