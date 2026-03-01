/**
 * TRUTH-NET Settings Page
 * 
 * Manage: profile, subscription, API keys, webhooks, notifications.
 * This is the control center for developer experience.
 */

import { useState } from 'react';
import {
  Settings as SettingsIcon, User, CreditCard, Key, Bell,
  Shield, Copy, CheckCircle, Eye, EyeOff, Plus, Trash2,
  ExternalLink, Zap, ArrowRight, AlertCircle, Globe
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../hooks/useAuth';

// ============================================================================
// TYPES
// ============================================================================

type SettingsTab = 'profile' | 'subscription' | 'api-keys' | 'webhooks' | 'notifications';

interface MockApiKey {
  id: string;
  prefix: string;
  name: string;
  tier: string;
  callsToday: number;
  dailyLimit: number;
  createdAt: string;
  lastUsedAt?: string;
}

interface MockWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  failureCount: number;
  lastTriggeredAt?: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockApiKeys: MockApiKey[] = [
  { id: 'key-1', prefix: 'tn_live_8f4a3c21...', name: 'Production Key', tier: 'pro', callsToday: 342, dailyLimit: 10000, createdAt: '2026-01-15', lastUsedAt: '2 min ago' },
  { id: 'key-2', prefix: 'tn_live_2b7e9f44...', name: 'Staging Key', tier: 'developer', callsToday: 89, dailyLimit: 1000, createdAt: '2026-02-01', lastUsedAt: '1 hour ago' },
];

const mockWebhooks: MockWebhook[] = [
  { id: 'wh-1', url: 'https://api.myapp.com/webhooks/truthnet', events: ['ratings.grade_changed', 'ratings.certified'], active: true, failureCount: 0, lastTriggeredAt: '15 min ago' },
];

const PLANS = [
  { id: 'free', name: 'Free', price: '$0', features: ['Public leaderboard', '100 API calls/day', 'Top-10 agents'], current: false },
  { id: 'developer', name: 'Developer', price: '$49/mo', features: ['Full API access', '1,000 calls/day', '1 agent slot', 'Rating history'], current: false },
  { id: 'pro', name: 'Pro', price: '$199/mo', features: ['10,000 calls/day', 'Unlimited agents', 'Webhooks', 'Advanced analytics', 'Certification'], current: true },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', features: ['100K calls/day', 'White-label', 'Custom benchmarks', 'SLA', 'Dedicated support'], current: false },
];

const WEBHOOK_EVENTS = [
  'ratings.grade_changed',
  'ratings.certified',
  'ratings.updated',
  'settlements.completed',
  'markets.resolved',
];

// ============================================================================
// TAB COMPONENTS
// ============================================================================

function ProfileTab() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Profile</h3>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Display Name</label>
            <input type="text" defaultValue={user?.displayName || ''} className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white focus:border-cyan-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Email</label>
            <input type="email" defaultValue={user?.email || ''} className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white focus:border-cyan-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Organization (optional)</label>
            <input type="text" placeholder="Your company name" className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none" />
          </div>
          <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
            Save Changes
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Security</h3>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Current Password</label>
            <input type="password" className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white focus:border-cyan-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">New Password</label>
            <input type="password" className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white focus:border-cyan-500 focus:outline-none" />
          </div>
          <button className="px-4 py-2 bg-[#111] border border-[#262626] hover:border-[#333] text-white text-sm font-medium rounded-lg transition-colors">
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionTab() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Subscription Plans</h3>
      <div className="grid grid-cols-4 gap-4">
        {PLANS.map(plan => (
          <div key={plan.id} className={clsx(
            'bg-[#0a0a0a] border rounded-xl p-5 relative',
            plan.current ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-[#1a1a1a]'
          )}>
            {plan.current && (
              <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-cyan-600 text-white text-[10px] font-medium rounded-full">
                CURRENT PLAN
              </span>
            )}
            <h4 className="text-sm font-semibold text-white mb-1">{plan.name}</h4>
            <p className="text-2xl font-bold text-white mb-4">{plan.price}</p>
            <ul className="space-y-2 mb-4">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {plan.current ? (
              <button className="w-full py-2 bg-[#111] border border-[#262626] text-gray-400 text-sm rounded-lg cursor-default">
                Current Plan
              </button>
            ) : plan.id === 'enterprise' ? (
              <button className="w-full py-2 bg-[#111] border border-[#262626] hover:border-purple-500/50 text-white text-sm font-medium rounded-lg transition-colors">
                Contact Sales
              </button>
            ) : (
              <button className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
                Upgrade
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
        <h4 className="text-sm font-semibold text-white mb-3">Usage This Month</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">API Calls</p>
            <p className="text-xl font-bold text-white font-mono">3,421 <span className="text-xs text-gray-500">/ 10,000</span></p>
            <div className="h-1.5 bg-[#111] rounded-full mt-2">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: '34%' }} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">Agent Slots</p>
            <p className="text-xl font-bold text-white font-mono">3 <span className="text-xs text-gray-500">/ 10</span></p>
            <div className="h-1.5 bg-[#111] rounded-full mt-2">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '30%' }} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">Webhooks</p>
            <p className="text-xl font-bold text-white font-mono">1 <span className="text-xs text-gray-500">/ 5</span></p>
            <div className="h-1.5 bg-[#111] rounded-full mt-2">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: '20%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">API Keys</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Create Key
        </button>
      </div>

      {showCreate && (
        <div className="bg-[#0a0a0a] border border-cyan-500/30 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-white mb-3">New API Key</h4>
          <div className="flex gap-3">
            <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g., Production)" className="flex-1 bg-black border border-[#262626] rounded-lg py-2 px-3 text-white text-sm placeholder-gray-600 focus:border-cyan-500 focus:outline-none" />
            <button onClick={() => { setShowCreate(false); setNewKeyName(''); }}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
              Generate
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">Key will inherit your current subscription tier permissions.</p>
        </div>
      )}

      <div className="space-y-3">
        {mockApiKeys.map(key => (
          <div key={key.id} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-cyan-400" />
                <div>
                  <p className="text-sm font-semibold text-white">{key.name}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{key.prefix}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium',
                  key.tier === 'pro' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-blue-500/20 text-blue-400'
                )}>{key.tier}</span>
                <button onClick={() => { setCopiedId(key.id); setTimeout(() => setCopiedId(null), 2000); }}
                  className="p-1.5 hover:bg-white/5 rounded transition-colors">
                  {copiedId === key.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                </button>
                <button className="p-1.5 hover:bg-red-500/10 rounded transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-gray-500">
              <span>Usage: {key.callsToday.toLocaleString()} / {key.dailyLimit.toLocaleString()} today</span>
              <span>Created: {key.createdAt}</span>
              {key.lastUsedAt && <span>Last used: {key.lastUsedAt}</span>}
            </div>
            <div className="h-1 bg-[#111] rounded-full mt-2">
              <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${(key.callsToday / key.dailyLimit) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-white mb-2">Quick Start</h4>
        <pre className="bg-black rounded-lg p-3 text-xs text-gray-400 overflow-x-auto">
{`curl -H "X-API-Key: tn_live_YOUR_KEY" \\
  https://api.truthnet.io/v1/ratings/leaderboard`}
        </pre>
      </div>
    </div>
  );
}

function WebhooksTab() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Webhooks</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Webhook
        </button>
      </div>

      {showCreate && (
        <div className="bg-[#0a0a0a] border border-cyan-500/30 rounded-xl p-5 space-y-3">
          <h4 className="text-sm font-semibold text-white">New Webhook</h4>
          <input type="url" placeholder="https://your-server.com/webhooks/truthnet"
            className="w-full bg-black border border-[#262626] rounded-lg py-2 px-3 text-white text-sm placeholder-gray-600 focus:border-cyan-500 focus:outline-none" />
          <div>
            <p className="text-xs text-gray-400 mb-2">Events to subscribe:</p>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map(event => (
                <label key={event} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black border border-[#262626] rounded-lg cursor-pointer hover:border-cyan-500/30">
                  <input type="checkbox" className="rounded bg-black border-gray-600" />
                  <span className="text-xs text-gray-300">{event}</span>
                </label>
              ))}
            </div>
          </div>
          <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
            Create Webhook
          </button>
        </div>
      )}

      {mockWebhooks.map(wh => (
        <div key={wh.id} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-white font-mono">{wh.url}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx('text-[10px] px-2 py-0.5 rounded-full',
                wh.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              )}>{wh.active ? 'Active' : 'Disabled'}</span>
              <button className="p-1.5 hover:bg-white/5 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {wh.events.map(e => (
              <span key={e} className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded">{e}</span>
            ))}
          </div>
          <div className="text-[10px] text-gray-500">
            Failures: {wh.failureCount} · Last triggered: {wh.lastTriggeredAt || 'Never'}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Notification Preferences</h3>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl divide-y divide-[#1a1a1a]">
        {[
          { label: 'Grade Changes', desc: 'When any watched agent changes grade', enabled: true },
          { label: 'New Certifications', desc: 'When an agent gets certified', enabled: true },
          { label: 'Market Resolutions', desc: 'When markets you follow resolve', enabled: false },
          { label: 'Weekly Digest', desc: 'Summary of rating changes every Monday', enabled: true },
          { label: 'API Usage Alerts', desc: 'When usage exceeds 80% of daily limit', enabled: true },
          { label: 'Benchmark Complete', desc: 'When a submitted benchmark finishes', enabled: true },
        ].map(pref => (
          <div key={pref.label} className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-white">{pref.label}</p>
              <p className="text-xs text-gray-500">{pref.desc}</p>
            </div>
            <button className={clsx(
              'w-10 h-5 rounded-full transition-colors relative',
              pref.enabled ? 'bg-cyan-600' : 'bg-[#333]'
            )}>
              <div className={clsx(
                'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                pref.enabled ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

const TABS: { id: SettingsTab; label: string; icon: any }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: Globe },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-6 h-6 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-500 text-sm">Manage your account, API access, and notifications</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Tab Navigation */}
        <nav className="w-48 flex-shrink-0">
          <ul className="space-y-1">
            {TABS.map(tab => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left',
                    activeTab === tab.id
                      ? 'bg-white/[0.08] text-white font-medium'
                      : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                  )}
                >
                  <tab.icon className={clsx('w-4 h-4', activeTab === tab.id ? 'text-cyan-400' : 'text-gray-600')} />
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'subscription' && <SubscriptionTab />}
          {activeTab === 'api-keys' && <ApiKeysTab />}
          {activeTab === 'webhooks' && <WebhooksTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
        </div>
      </div>
    </div>
  );
}
