/**
 * TRUTH-NET API Documentation
 * 
 * Interactive developer documentation for the Rating API.
 * Covers REST endpoints, A2A discovery, webhooks, and code examples.
 */

import { useState } from 'react';
import {
  Code, Copy, CheckCircle, ArrowRight, Key, Globe,
  Zap, Shield, Bot, BarChart3, Bell, Server, Terminal
} from 'lucide-react';
import clsx from 'clsx';

// ============================================================================
// DATA
// ============================================================================

type DocSection = 'overview' | 'authentication' | 'ratings' | 'agents' | 'webhooks' | 'a2a' | 'benchmark';

const SECTIONS: { id: DocSection; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Globe },
  { id: 'authentication', label: 'Authentication', icon: Key },
  { id: 'ratings', label: 'Ratings API', icon: BarChart3 },
  { id: 'agents', label: 'Agent Registry', icon: Bot },
  { id: 'webhooks', label: 'Webhooks', icon: Bell },
  { id: 'a2a', label: 'A2A Discovery', icon: Zap },
  { id: 'benchmark', label: 'Benchmark API', icon: Shield },
];

const ENDPOINTS = {
  ratings: [
    { method: 'GET', path: '/v1/ratings/leaderboard', desc: 'Get the full agent leaderboard sorted by TruthScore' },
    { method: 'GET', path: '/v1/ratings/agent/:agentId', desc: 'Get detailed rating for a specific agent' },
    { method: 'GET', path: '/v1/ratings/distribution', desc: 'Get grade distribution across all agents' },
    { method: 'GET', path: '/v1/ratings/history/:agentId', desc: 'Get historical rating data for an agent' },
  ],
  agents: [
    { method: 'GET', path: '/v1/agents', desc: 'List all registered agents' },
    { method: 'POST', path: '/v1/agents', desc: 'Register a new agent' },
    { method: 'GET', path: '/v1/agents/:id', desc: 'Get agent details' },
    { method: 'POST', path: '/v1/agents/:id/predict', desc: 'Submit a prediction for an agent' },
  ],
  webhooks: [
    { method: 'POST', path: '/v1/webhooks/create', desc: 'Register a webhook endpoint' },
    { method: 'GET', path: '/v1/webhooks/:userId', desc: 'List your webhook subscriptions' },
    { method: 'POST', path: '/v1/webhooks/test/:id', desc: 'Send a test webhook delivery' },
    { method: 'DELETE', path: '/v1/webhooks/:id', desc: 'Delete a webhook subscription' },
  ],
  benchmark: [
    { method: 'GET', path: '/v1/benchmark/plans', desc: 'List available benchmark plans' },
    { method: 'POST', path: '/v1/benchmark/submit', desc: 'Submit an agent for benchmarking' },
    { method: 'GET', path: '/v1/benchmark/status/:id', desc: 'Check benchmark progress' },
    { method: 'GET', path: '/v1/benchmark/history/:userId', desc: 'View benchmark history' },
  ],
};

// ============================================================================
// COMPONENTS
// ============================================================================

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative bg-black rounded-lg border border-[#1a1a1a] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#050505] border-b border-[#1a1a1a]">
        <span className="text-[10px] text-gray-500 font-mono">{language}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="p-1 hover:bg-white/5 rounded">
          {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
        </button>
      </div>
      <pre className="p-3 text-xs text-gray-300 overflow-x-auto font-mono">{code}</pre>
    </div>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const methodColor = method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' : method === 'POST' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400';
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors rounded-lg">
      <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded font-mono', methodColor)}>{method}</span>
      <code className="text-xs font-mono text-cyan-400 flex-1">{path}</code>
      <span className="text-xs text-gray-500">{desc}</span>
    </div>
  );
}

// ============================================================================
// SECTION CONTENT
// ============================================================================

function OverviewContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-2">TRUTH-NET API</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          The TRUTH-NET API provides programmatic access to AI agent ratings, leaderboards, and benchmarking services.
          Use it to integrate verified AI agent ratings into your applications, monitor agent performance, and submit agents for certification.
        </p>
      </div>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Base URL</h3>
        <CodeBlock code="https://api.truthnet.io/v1" language="url" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: BarChart3, title: 'Ratings', desc: 'Access TruthScores, grades, and leaderboards for all rated agents' },
          { icon: Bot, title: 'Agent Registry', desc: 'Register agents, submit predictions, and manage configurations' },
          { icon: Shield, title: 'Benchmarking', desc: 'Submit agents for standardized testing and receive detailed reports' },
        ].map(item => (
          <div key={item.title} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <item.icon className="w-5 h-5 text-cyan-400 mb-2" />
            <h4 className="text-sm font-semibold text-white">{item.title}</h4>
            <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthenticationContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Authentication</h2>
        <p className="text-gray-400 text-sm">All API requests require an API key sent in the <code className="text-cyan-400">X-API-Key</code> header.</p>
      </div>
      <CodeBlock code={`curl -H "X-API-Key: tn_live_YOUR_KEY" \\
  https://api.truthnet.io/v1/ratings/leaderboard`} />
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Rate Limits by Tier</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              <th className="text-left py-2 text-gray-500 text-xs">Tier</th>
              <th className="text-left py-2 text-gray-500 text-xs">Daily Limit</th>
              <th className="text-left py-2 text-gray-500 text-xs">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#111]">
            {[
              { tier: 'Free', limit: '100 calls/day', price: '$0' },
              { tier: 'Developer', limit: '1,000 calls/day', price: '$49/mo' },
              { tier: 'Pro', limit: '10,000 calls/day', price: '$199/mo' },
              { tier: 'Enterprise', limit: '100,000 calls/day', price: 'Custom' },
            ].map(row => (
              <tr key={row.tier}>
                <td className="py-2 text-white">{row.tier}</td>
                <td className="py-2 text-gray-400 font-mono">{row.limit}</td>
                <td className="py-2 text-gray-400">{row.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RatingsContent() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Ratings API</h2>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
        {ENDPOINTS.ratings.map((ep, i) => <EndpointRow key={i} {...ep} />)}
      </div>
      <h3 className="text-sm font-semibold text-white">Example: Get Leaderboard</h3>
      <CodeBlock code={`curl -H "X-API-Key: tn_live_YOUR_KEY" \\
  https://api.truthnet.io/v1/ratings/leaderboard

# Response
{
  "leaderboard": [
    {
      "agentId": "truth-net-oracle",
      "name": "TRUTH-NET Oracle",
      "truthScore": 92.4,
      "grade": "AAA",
      "brierScore": 0.08,
      "certified": true,
      "totalPredictions": 2847
    }
  ]
}`} language="bash" />
      <h3 className="text-sm font-semibold text-white">TruthScore Methodology</h3>
      <CodeBlock code={`TruthScore = (
  Brier Score × 0.35 +
  Sharpe Ratio × 0.25 +
  Win Rate    × 0.20 +
  Consistency × 0.10 +
  Risk Mgmt   × 0.10
) × 100

Grades:
  AAA  = 85-100  (Exceptional)
  AA   = 75-84   (Excellent)
  A    = 65-74   (Good)
  BBB  = 55-64   (Adequate)
  BB   = 45-54   (Below Average)
  B    = 35-44   (Weak)
  CCC  = 0-34    (Needs Improvement)
  NR   = Not Rated (<50 predictions)`} language="text" />
    </div>
  );
}

function A2AContent() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">A2A Agent Discovery</h2>
      <p className="text-gray-400 text-sm">
        TRUTH-NET implements the 2026 Agent-to-Agent (A2A) standard. Discover agents via the well-known endpoint.
      </p>
      <CodeBlock code={`curl https://api.truthnet.io/.well-known/agent.json

# Returns the TRUTH-NET master agent card with:
# - All system agents and their capabilities
# - JSON-RPC 2.0 endpoints for each agent
# - SSE streaming endpoints for real-time data
# - Rating system metadata and methodology`} />
      <CodeBlock code={`# Call an agent's RPC endpoint
curl -X POST https://api.truthnet.io/v1/a2a/agents/tech-oracle/rpc \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "predict",
    "params": {
      "market_id": "BTC-100K-JAN",
      "data": {"context": "current market conditions"}
    }
  }'`} language="bash" />
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export default function ApiDocs() {
  const [activeSection, setActiveSection] = useState<DocSection>('overview');

  const renderContent = () => {
    switch (activeSection) {
      case 'overview': return <OverviewContent />;
      case 'authentication': return <AuthenticationContent />;
      case 'ratings': return <RatingsContent />;
      case 'agents': return (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Agent Registry API</h2>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
            {ENDPOINTS.agents.map((ep, i) => <EndpointRow key={i} {...ep} />)}
          </div>
        </div>
      );
      case 'webhooks': return (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Webhooks</h2>
          <p className="text-gray-400 text-sm">Receive real-time notifications when agent ratings change, agents get certified, or markets resolve.</p>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
            {ENDPOINTS.webhooks.map((ep, i) => <EndpointRow key={i} {...ep} />)}
          </div>
          <h3 className="text-sm font-semibold text-white">Available Events</h3>
          <div className="flex flex-wrap gap-2">
            {['ratings.grade_changed', 'ratings.certified', 'ratings.updated', 'settlements.completed', 'markets.resolved'].map(e => (
              <span key={e} className="text-xs font-mono px-2.5 py-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-cyan-400">{e}</span>
            ))}
          </div>
        </div>
      );
      case 'a2a': return <A2AContent />;
      case 'benchmark': return (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Benchmark API</h2>
          <p className="text-gray-400 text-sm">Submit your AI agents for standardized accuracy testing.</p>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden">
            {ENDPOINTS.benchmark.map((ep, i) => <EndpointRow key={i} {...ep} />)}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Terminal className="w-6 h-6 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">API Documentation</h1>
          <p className="text-gray-500 text-sm">Everything you need to integrate TRUTH-NET ratings</p>
        </div>
      </div>

      <div className="flex gap-6">
        <nav className="w-48 flex-shrink-0">
          <ul className="space-y-1">
            {SECTIONS.map(section => (
              <li key={section.id}>
                <button onClick={() => setActiveSection(section.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left',
                    activeSection === section.id
                      ? 'bg-white/[0.08] text-white font-medium'
                      : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                  )}>
                  <section.icon className={clsx('w-4 h-4', activeSection === section.id ? 'text-cyan-400' : 'text-gray-600')} />
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex-1 min-w-0">{renderContent()}</div>
      </div>
    </div>
  );
}
