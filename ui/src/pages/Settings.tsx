import { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon, User, CreditCard, Key, Bell,
  Globe, Copy, CheckCircle, Plus, Trash2, Zap, AlertCircle, Loader2
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../hooks/useAuth';
import { apiKeysAPI, webhooksAPI } from '../api/client';

type SettingsTab = 'profile' | 'subscription' | 'api-keys' | 'webhooks' | 'notifications';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const PLANS = [
  { id: 'free', name: 'Free', price: '$0', features: ['Public leaderboard', '100 API calls/day', 'Top-10 agents'], stripePriceId: null },
  { id: 'developer', name: 'Developer', price: '$49/mo', features: ['Full API access', '1,000 calls/day', '1 agent slot', 'Rating history'], stripePriceId: 'developer' },
  { id: 'pro', name: 'Pro', price: '$199/mo', features: ['10,000 calls/day', 'Unlimited agents', 'Webhooks', 'Advanced analytics', 'Certification'], stripePriceId: 'pro' },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', features: ['100K calls/day', 'White-label', 'Custom benchmarks', 'SLA', 'Dedicated support'], stripePriceId: null },
];

function ProfileTab() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [org, setOrg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const raw = localStorage.getItem('truthnet_user');
      const stored = raw ? JSON.parse(raw) : {};
      const updated = { ...stored, displayName: name, email, organization: org };
      localStorage.setItem('truthnet_user', JSON.stringify(updated));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Profile</h3>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white focus:border-cyan-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white focus:border-cyan-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Organization (optional)</label>
            <input type="text" value={org} onChange={e => setOrg(e.target.value)} placeholder="Your company name"
              className="w-full bg-black border border-[#262626] rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none" />
          </div>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : null}
            {saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionTab() {
  const { user } = useAuth();
  const currentPlan = user?.plan || 'free';
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [demoCredited, setDemoCredited] = useState(false);

  const handleUpgrade = async (planId: string) => {
    setUpgradeError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/payments/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('truthnet_token')}` },
        body: JSON.stringify({ userId: user?.id, plan: planId }),
      });
      const data = await res.json();
      if (data.data?.url) {
        window.location.href = data.data.url;
      } else if (!data.success) {
        setUpgradeError(data.error?.message || 'Stripe is not configured. Use demo credits below.');
      }
    } catch {
      setUpgradeError('Payment processing unavailable. Use demo credits for testing.');
    }
  };

  const handleDemoCredit = async () => {
    try {
      await fetch(`${API_BASE}/v1/payments/demo-credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id || 'demo-user', amount: 10000 }),
      });
      setDemoCredited(true);
      setTimeout(() => setDemoCredited(false), 3000);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Subscription Plans</h3>

      {upgradeError && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-amber-200">{upgradeError}</p>
            <button onClick={handleDemoCredit}
              className="mt-2 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors">
              {demoCredited ? 'Credits Added!' : 'Add $10,000 Demo Credits'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentPlan;
          return (
            <div key={plan.id} className={clsx(
              'bg-[#0a0a0a] border rounded-xl p-5 relative',
              isCurrent ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-[#1a1a1a]'
            )}>
              {isCurrent && (
                <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-cyan-600 text-white text-[10px] font-medium rounded-full">
                  CURRENT PLAN
                </span>
              )}
              <h4 className="text-sm font-semibold text-white mb-1">{plan.name}</h4>
              <p className="text-2xl font-bold text-white mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-4">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button className="w-full py-2 bg-[#111] border border-[#262626] text-gray-400 text-sm rounded-lg cursor-default">Current Plan</button>
              ) : plan.id === 'enterprise' ? (
                <a href="mailto:enterprise@truthnet.io" className="block w-full py-2 bg-[#111] border border-[#262626] hover:border-purple-500/50 text-white text-sm font-medium rounded-lg transition-colors text-center">
                  Contact Sales
                </a>
              ) : (
                <button onClick={() => handleUpgrade(plan.id)}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
                  Upgrade
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadKeys = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await apiKeysAPI.list(user.id);
      setKeys(data.keys || []);
    } catch {}
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const createKey = async () => {
    if (!newKeyName.trim() || !user?.id) return;
    try {
      const data = await apiKeysAPI.create(user.id, newKeyName);
      setCreatedKey(data.key);
      setNewKeyName('');
      setShowCreate(false);
      loadKeys();
    } catch {}
  };

  const revokeKey = async (keyId: string) => {
    try {
      await apiKeysAPI.revoke(keyId);
      loadKeys();
    } catch {}
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">API Keys</h3>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Create Key
        </button>
      </div>

      {createdKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-sm text-emerald-400 font-medium mb-2">Key created! Copy it now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black rounded-lg p-2 text-xs text-white font-mono">{createdKey}</code>
            <button onClick={() => { copyToClipboard(createdKey, 'new'); setCreatedKey(null); }}
              className="px-3 py-2 bg-emerald-600 text-white text-xs rounded-lg">Copy & Dismiss</button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="bg-[#0a0a0a] border border-cyan-500/30 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-white mb-3">New API Key</h4>
          <div className="flex gap-3">
            <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g., Production)"
              className="flex-1 bg-black border border-[#262626] rounded-lg py-2 px-3 text-white text-sm placeholder-gray-600 focus:border-cyan-500 focus:outline-none" />
            <button onClick={createKey}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
              Generate
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 text-gray-600 animate-spin mx-auto" /></div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-sm">No API keys yet. Create one to get started.</div>
      ) : (
        <div className="space-y-3">
          {keys.map((key: any) => (
            <div key={key.id} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">{key.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{key.prefix}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-cyan-500/20 text-cyan-400">{key.tier}</span>
                  <button onClick={() => copyToClipboard(key.prefix, key.id)}
                    className="p-1.5 hover:bg-white/5 rounded transition-colors">
                    {copiedId === key.id ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                  </button>
                  <button onClick={() => revokeKey(key.id)} className="p-1.5 hover:bg-red-500/10 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWebhooks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [whData, evData] = await Promise.all([
        webhooksAPI.list(user.id),
        webhooksAPI.getEvents(),
      ]);
      setWebhooks(whData.webhooks || []);
      setAvailableEvents(evData.events || []);
    } catch {}
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadWebhooks(); }, [loadWebhooks]);

  const createWebhook = async () => {
    if (!newUrl.trim() || !user?.id || selectedEvents.length === 0) return;
    try {
      await webhooksAPI.create(user.id, newUrl, selectedEvents);
      setNewUrl('');
      setSelectedEvents([]);
      setShowCreate(false);
      loadWebhooks();
    } catch {}
  };

  const deleteWebhook = async (id: string) => {
    try {
      await webhooksAPI.delete(id);
      loadWebhooks();
    } catch {}
  };

  const toggleEvent = (ev: string) => {
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Webhooks</h3>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Webhook
        </button>
      </div>

      {showCreate && (
        <div className="bg-[#0a0a0a] border border-cyan-500/30 rounded-xl p-5 space-y-3">
          <h4 className="text-sm font-semibold text-white">New Webhook</h4>
          <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)}
            placeholder="https://your-server.com/webhooks/truthnet"
            className="w-full bg-black border border-[#262626] rounded-lg py-2 px-3 text-white text-sm placeholder-gray-600 focus:border-cyan-500 focus:outline-none" />
          <div>
            <p className="text-xs text-gray-400 mb-2">Events to subscribe:</p>
            <div className="flex flex-wrap gap-2">
              {availableEvents.map(event => (
                <button key={event} onClick={() => toggleEvent(event)}
                  className={clsx('px-2.5 py-1.5 border rounded-lg text-xs transition-colors',
                    selectedEvents.includes(event)
                      ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                      : 'bg-black border-[#262626] text-gray-400 hover:border-cyan-500/30')}>
                  {event}
                </button>
              ))}
            </div>
          </div>
          <button onClick={createWebhook}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            disabled={!newUrl || selectedEvents.length === 0}>
            Create Webhook
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 text-gray-600 animate-spin mx-auto" /></div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-sm">No webhooks configured. Add one to receive event notifications.</div>
      ) : webhooks.map((wh: any) => (
        <div key={wh.id} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-white font-mono">{wh.url}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx('text-[10px] px-2 py-0.5 rounded-full',
                wh.active !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              )}>{wh.active !== false ? 'Active' : 'Disabled'}</span>
              <button onClick={() => deleteWebhook(wh.id)} className="p-1.5 hover:bg-red-500/10 rounded">
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(wh.events || []).map((e: string) => (
              <span key={e} className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded">{e}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState([
    { key: 'grade_changes', label: 'Grade Changes', desc: 'When any watched agent changes grade', enabled: true },
    { key: 'certifications', label: 'New Certifications', desc: 'When an agent gets certified', enabled: true },
    { key: 'market_resolutions', label: 'Market Resolutions', desc: 'When markets you follow resolve', enabled: false },
    { key: 'weekly_digest', label: 'Weekly Digest', desc: 'Summary of rating changes every Monday', enabled: true },
    { key: 'api_usage', label: 'API Usage Alerts', desc: 'When usage exceeds 80% of daily limit', enabled: true },
    { key: 'benchmark_complete', label: 'Benchmark Complete', desc: 'When a submitted benchmark finishes', enabled: true },
  ]);

  const toggle = (key: string) => {
    setPrefs(prev => prev.map(p => p.key === key ? { ...p, enabled: !p.enabled } : p));
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Notification Preferences</h3>
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl divide-y divide-[#1a1a1a]">
        {prefs.map(pref => (
          <div key={pref.key} className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-white">{pref.label}</p>
              <p className="text-xs text-gray-500">{pref.desc}</p>
            </div>
            <button onClick={() => toggle(pref.key)} className={clsx(
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
        <nav className="w-48 flex-shrink-0">
          <ul className="space-y-1">
            {TABS.map(tab => (
              <li key={tab.id}>
                <button onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left',
                    activeTab === tab.id ? 'bg-white/[0.08] text-white font-medium' : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'
                  )}>
                  <tab.icon className={clsx('w-4 h-4', activeTab === tab.id ? 'text-cyan-400' : 'text-gray-600')} />
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

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
