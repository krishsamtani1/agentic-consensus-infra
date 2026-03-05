import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Shield, TrendingUp, ArrowRight, Bot, Award,
  BarChart3, Globe, Target, Activity, DollarSign, Lock,
  Users, AlertTriangle, Sparkles, ChevronRight, ChevronLeft,
  CheckCircle, ArrowUp, Building2, Layers, Code2, Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

const SLIDES = [
  {
    id: 'cover',
    title: 'TRUTH-NET',
    subtitle: 'The Credit Rating Agency for AI',
  },
  {
    id: 'problem',
    title: 'The Problem',
    subtitle: '$4.2 Trillion in AI-driven decisions. Zero accountability.',
  },
  {
    id: 'solution',
    title: 'The Solution',
    subtitle: 'Oracle-verified ratings through real-stakes prediction markets',
  },
  {
    id: 'how',
    title: 'How It Works',
    subtitle: 'Three steps from unverified to enterprise-trusted',
  },
  {
    id: 'market',
    title: 'Market Opportunity',
    subtitle: 'Every AI agent needs a credit score',
  },
  {
    id: 'moat',
    title: 'Competitive Moat',
    subtitle: 'Why this compounds and becomes unbeatable',
  },
  {
    id: 'traction',
    title: 'Traction & Metrics',
    subtitle: 'Where we are today',
  },
  {
    id: 'business',
    title: 'Business Model',
    subtitle: 'How we make money',
  },
  {
    id: 'roadmap',
    title: 'Roadmap',
    subtitle: '12-month plan to market dominance',
  },
  {
    id: 'team',
    title: 'The Ask',
    subtitle: 'What we need to become the standard',
  },
];

function CoverSlide() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-cyan-500/30">
        <Zap className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-6xl font-black text-white mb-4 tracking-tight">TRUTH-NET</h1>
      <p className="text-2xl text-cyan-400 font-medium mb-8">The Credit Rating Agency for AI</p>
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <span>S&P for Autonomous Agents</span>
        <span className="w-1 h-1 bg-gray-700 rounded-full" />
        <span>Oracle-Verified Ratings</span>
        <span className="w-1 h-1 bg-gray-700 rounded-full" />
        <span>Prediction Market Infrastructure</span>
      </div>
      <div className="mt-12 px-6 py-3 bg-[#111] border border-[#222] rounded-xl">
        <p className="text-xs text-gray-500">Seed Round | 2026</p>
      </div>
    </div>
  );
}

function ProblemSlide() {
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="grid grid-cols-2 gap-12">
        <div>
          <AlertTriangle className="w-10 h-10 text-red-400 mb-6" />
          <h2 className="text-3xl font-black text-white mb-6">AI agents are making critical decisions with zero verified track record</h2>
          <div className="space-y-4 text-gray-400">
            <p>Enterprises are deploying AI agents for trading, supply chain, customer service, and code generation. These agents manage real money and real outcomes.</p>
            <p className="text-white font-medium">But there's no way to verify: Is this agent actually good?</p>
          </div>
        </div>
        <div className="space-y-4">
          {[
            { stat: '$4.2T', label: 'AI-influenced financial decisions by 2027', icon: DollarSign },
            { stat: '10M+', label: 'Autonomous AI agents deployed by 2028', icon: Bot },
            { stat: '0', label: 'Independent rating agencies for AI agents', icon: Shield },
            { stat: '73%', label: 'Enterprises can\'t evaluate AI agent quality', icon: AlertTriangle },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-4 bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <item.icon className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-white">{item.stat}</p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SolutionSlide() {
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="text-center mb-10">
        <Shield className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
        <h2 className="text-3xl font-black text-white mb-3">TRUTH-NET rates AI agents like S&P rates bonds</h2>
        <p className="text-gray-400 max-w-2xl mx-auto">Through oracle-verified prediction markets with real economic stakes. Not benchmarks. Not vibes. Ground-truth performance data.</p>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {[
          { title: 'TruthScore (0-100)', desc: 'Composite rating: Brier Score (35%) + Sharpe Ratio (25%) + Win Rate (20%) + Consistency (10%) + Risk Management (10%)', icon: Award, color: 'from-cyan-500 to-blue-600' },
          { title: 'Letter Grades', desc: 'AAA to CCC rating scale. Certified status for agents with 50+ verified predictions and grade B or above.', icon: Shield, color: 'from-emerald-500 to-teal-600' },
          { title: 'Oracle-Verified', desc: 'Outcomes verified against real-world data sources. No self-reporting. No gaming. Immutable track records.', icon: Globe, color: 'from-purple-500 to-pink-600' },
        ].map(item => (
          <div key={item.title} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
            <div className={clsx('w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center mb-4', item.color)}>
              <item.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowSlide() {
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="space-y-8">
        {[
          { step: '01', title: 'Register Your Agent', desc: 'Connect via REST API or A2A protocol. Get an API key. Takes 30 seconds.', icon: Code2 },
          { step: '02', title: 'Submit Predictions', desc: 'Your agent submits probability estimates on live markets. "GPT-5 ships before April 2026?" → 72% probability. Stakes are real.', icon: Target },
          { step: '03', title: 'Earn Your Rating', desc: 'Markets resolve against oracle-verified outcomes. Your TruthScore updates continuously. Embed your badge. Get certified.', icon: Award },
        ].map(item => (
          <div key={item.step} className="flex items-start gap-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-black text-cyan-400">{item.step}</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
              <p className="text-gray-400">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketSlide() {
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="grid grid-cols-2 gap-12">
        <div>
          <Globe className="w-10 h-10 text-cyan-400 mb-6" />
          <h2 className="text-3xl font-black text-white mb-6">TAM: Every AI agent that makes a consequential decision</h2>
          <div className="space-y-4">
            {[
              { size: '$50B+', label: 'Total Addressable Market', desc: '10M+ agents x $500-5000/yr monitoring' },
              { size: '$8B', label: 'Serviceable Addressable Market', desc: 'Enterprise agents in finance, logistics, health' },
              { size: '$500M', label: 'Year 3 Revenue Target', desc: '100K agents x $5K avg revenue' },
            ].map(item => (
              <div key={item.label} className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="text-xl font-black text-cyan-400">{item.size}</span>
                </div>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Why Now?</h3>
          <div className="space-y-3">
            {[
              { text: 'EU AI Act mandates auditability for high-risk AI systems (2026 enforcement)', icon: Building2 },
              { text: 'Autonomous AI agents going from demos to production (Devin, AutoGPT, custom enterprise agents)', icon: Bot },
              { text: 'AI spending hitting $300B+ annually with zero quality verification infrastructure', icon: DollarSign },
              { text: 'Insurance industry needs risk assessment for AI-driven decisions', icon: Shield },
              { text: 'No incumbent (Moody\'s/S&P have no AI agent product)', icon: AlertTriangle },
            ].map(item => (
              <div key={item.text} className="flex items-start gap-3">
                <item.icon className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-400">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MoatSlide() {
  return (
    <div className="flex flex-col justify-center h-full">
      <Lock className="w-10 h-10 text-emerald-400 mb-6" />
      <h2 className="text-3xl font-black text-white mb-8">Four compounding moats</h2>
      <div className="grid grid-cols-2 gap-6">
        {[
          { title: 'Data Gravity', desc: 'Historical TruthScore time-series for thousands of agents becomes a proprietary dataset. The longer we run, the more valuable the data. Nobody can replicate 2 years of verified prediction history.', icon: Layers, color: 'border-cyan-500/30' },
          { title: 'Network Effects', desc: 'Every agent rated makes every other rating more credible. Enterprises trust ratings with more participants. Agents want to be rated where others are rated.', icon: Users, color: 'border-emerald-500/30' },
          { title: 'Standard Adoption', desc: 'Once "TRUTH-NET Certified" appears in procurement RFPs and compliance frameworks, switching costs become enormous. The rating becomes required infrastructure.', icon: Shield, color: 'border-purple-500/30' },
          { title: 'Embeddable Distribution', desc: 'Every TruthScore badge in a GitHub README is a free billboard. Every agent profile shared on LinkedIn is organic distribution. Growth is built into the product.', icon: Code2, color: 'border-amber-500/30' },
        ].map(item => (
          <div key={item.title} className={clsx('bg-[#0a0a0a] border rounded-xl p-6', item.color)}>
            <item.icon className="w-8 h-8 text-white mb-3" />
            <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TractionSlide() {
  return (
    <div className="flex flex-col justify-center h-full">
      <Activity className="w-10 h-10 text-cyan-400 mb-6" />
      <h2 className="text-3xl font-black text-white mb-8">Platform Status</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { metric: '10+', label: 'AI Models Rated', sub: 'GPT-4o, Claude, Gemini + heuristics' },
          { metric: '100+', label: 'Markets Created', sub: 'Live from real RSS/API feeds' },
          { metric: '5', label: 'Rating Components', sub: 'Brier, Sharpe, WinRate, Consistency, Risk' },
          { metric: 'A2A + MCP', label: 'Protocol Support', sub: 'Industry-standard agent interop' },
        ].map(item => (
          <div key={item.label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5 text-center">
            <p className="text-3xl font-black text-cyan-400 mb-1">{item.metric}</p>
            <p className="text-sm font-medium text-white mb-1">{item.label}</p>
            <p className="text-[10px] text-gray-600">{item.sub}</p>
          </div>
        ))}
      </div>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
        <h3 className="text-sm font-bold text-white mb-4">What's Built</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            'Central Limit Order Book (CLOB)',
            'Multi-LLM Trading Engine',
            'Oracle Resolution System',
            'TruthScore Rating Algorithm',
            'External Agent REST API',
            'Embeddable SVG Badge',
            'Public Agent Profiles',
            'Head-to-Head Battles',
            'A2A Discovery Protocol',
            'Real-time WebSocket Feed',
            'Stripe Payment Integration',
            'Settlement & Escrow System',
          ].map(feature => (
            <div key={feature} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-xs text-gray-400">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BusinessSlide() {
  return (
    <div className="flex flex-col justify-center h-full">
      <DollarSign className="w-10 h-10 text-emerald-400 mb-6" />
      <h2 className="text-3xl font-black text-white mb-8">Revenue Model</h2>
      <div className="grid grid-cols-2 gap-6 mb-8">
        {[
          { tier: 'Free', price: '$0', agents: '1 agent', features: ['Public leaderboard', 'Basic badge', 'Community markets'], color: 'border-gray-500/30' },
          { tier: 'Team', price: '$99/mo', agents: '5 agents', features: ['Webhooks & alerts', 'Rating history API', 'Private dashboard'], color: 'border-cyan-500/30' },
          { tier: 'Business', price: '$499/mo', agents: '25 agents', features: ['White-label badges', 'Benchmark-as-a-service', 'Priority support'], color: 'border-blue-500/30' },
          { tier: 'Enterprise', price: 'Custom', agents: 'Unlimited', features: ['Custom benchmarks', 'Compliance reports', 'SLA & on-prem oracle'], color: 'border-purple-500/30' },
        ].map(item => (
          <div key={item.tier} className={clsx('bg-[#0a0a0a] border rounded-xl p-5', item.color)}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-bold text-white">{item.tier}</span>
              <span className="text-lg font-black text-cyan-400">{item.price}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{item.agents}</p>
            <div className="space-y-1.5">
              {item.features.map(f => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-gray-400">{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4">
        <p className="text-sm text-gray-400 text-center">
          <span className="text-white font-medium">Additional revenue:</span> 10-15% marketplace take rate on agent-to-agent transactions + API overage charges + premium data feeds (model divergence signals, calibration data)
        </p>
      </div>
    </div>
  );
}

function RoadmapSlide() {
  return (
    <div className="flex flex-col justify-center h-full">
      <TrendingUp className="w-10 h-10 text-cyan-400 mb-6" />
      <h2 className="text-3xl font-black text-white mb-8">12-Month Roadmap</h2>
      <div className="space-y-4">
        {[
          { quarter: 'Q1 2026', title: 'Foundation', items: ['PostgreSQL persistence', 'Python SDK (pip install truthnet)', 'Batch prediction API', 'Weekly Model Report Card blog'], status: 'active' },
          { quarter: 'Q2 2026', title: 'Distribution', items: ['LangChain/LlamaIndex integration', 'GitHub Action for CI/CD benchmarking', 'Slack/Teams notification bot', '1,000 registered agents target'], status: 'upcoming' },
          { quarter: 'Q3 2026', title: 'Enterprise', items: ['Compliance-ready audit logs', 'PDF rating report generation', 'SOC 2 Type II certification', '10 enterprise pilots ($5K+/mo)'], status: 'upcoming' },
          { quarter: 'Q4 2026', title: 'Dominance', items: ['Standards body engagement (NIST, ISO)', 'Insurance partnership (AI risk assessment)', 'International expansion', '$2M+ ARR target'], status: 'upcoming' },
        ].map(item => (
          <div key={item.quarter} className={clsx('flex gap-6 bg-[#0a0a0a] border rounded-xl p-5',
            item.status === 'active' ? 'border-cyan-500/30' : 'border-[#1a1a1a]'
          )}>
            <div className="w-24 flex-shrink-0">
              <p className={clsx('text-sm font-bold', item.status === 'active' ? 'text-cyan-400' : 'text-gray-500')}>{item.quarter}</p>
              <p className="text-xs text-gray-600">{item.title}</p>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2">
              {item.items.map(i => (
                <div key={i} className="flex items-center gap-2">
                  {item.status === 'active' ? <CheckCircle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" /> : <div className="w-3.5 h-3.5 border border-gray-700 rounded-full flex-shrink-0" />}
                  <span className="text-xs text-gray-400">{i}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AskSlide() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Briefcase className="w-12 h-12 text-cyan-400 mb-6" />
      <h2 className="text-4xl font-black text-white mb-4">Seed Round</h2>
      <p className="text-xl text-gray-400 mb-10 max-w-xl">Building the infrastructure layer that every AI agent deployment will depend on</p>
      <div className="grid grid-cols-3 gap-8 mb-10 w-full max-w-2xl">
        {[
          { label: 'Raising', value: '$2.5M' },
          { label: 'Use of Funds', value: 'Engineering + GTM' },
          { label: 'Target', value: '$2M ARR in 18mo' },
        ].map(item => (
          <div key={item.label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className="text-xl font-black text-white">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-[#111] border border-cyan-500/20 rounded-xl p-6 max-w-xl w-full">
        <p className="text-sm text-gray-400 mb-3">Fund allocation</p>
        <div className="space-y-2">
          {[
            { label: 'Engineering (persistence, SDK, integrations)', pct: 50 },
            { label: 'Go-to-Market (content, partnerships, dev rel)', pct: 30 },
            { label: 'Operations (compliance, legal, infrastructure)', pct: 20 },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">{item.label}</span>
                <span className="text-white font-bold">{item.pct}%</span>
              </div>
              <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-10">
        <Link to="/onboarding" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/25">
          Try TRUTH-NET Now <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}

const SLIDE_COMPONENTS: Record<string, () => JSX.Element> = {
  cover: CoverSlide,
  problem: ProblemSlide,
  solution: SolutionSlide,
  how: HowSlide,
  market: MarketSlide,
  moat: MoatSlide,
  traction: TractionSlide,
  business: BusinessSlide,
  roadmap: RoadmapSlide,
  team: AskSlide,
};

export default function PitchDeck() {
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];
  const SlideComponent = SLIDE_COMPONENTS[slide.id];

  const next = () => setCurrent(c => Math.min(c + 1, SLIDES.length - 1));
  const prev = () => setCurrent(c => Math.max(c - 1, 0));

  return (
    <div className="min-h-screen bg-black text-white flex flex-col" onKeyDown={e => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); }} tabIndex={0}>
      {/* Top bar */}
      <div className="border-b border-[#1a1a1a] bg-[#050505] px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-bold">TRUTH-NET</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">Investor Deck</span>
          <span className="text-xs text-gray-600">{current + 1} / {SLIDES.length}</span>
        </div>
      </div>

      {/* Slide area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 max-w-5xl mx-auto w-full px-12 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <SlideComponent />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="border-t border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
          <button onClick={prev} disabled={current === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#222] rounded-lg text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <div className="flex gap-1.5">
            {SLIDES.map((s, i) => (
              <button key={s.id} onClick={() => setCurrent(i)}
                className={clsx('w-2 h-2 rounded-full transition-all',
                  i === current ? 'bg-cyan-400 w-6' : 'bg-gray-700 hover:bg-gray-600'
                )} />
            ))}
          </div>

          <button onClick={next} disabled={current === SLIDES.length - 1}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
