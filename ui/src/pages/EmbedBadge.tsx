import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, Zap, ExternalLink, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { getAgentMeta } from '../lib/agentMeta';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const GRADES: Record<string, { color: string; bg: string; glow: string }> = {
  'AAA': { color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-500/5', glow: 'shadow-emerald-500/20' },
  'AA': { color: 'text-cyan-400', bg: 'from-cyan-500/20 to-cyan-500/5', glow: 'shadow-cyan-500/20' },
  'A': { color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-500/5', glow: 'shadow-blue-500/20' },
  'BBB': { color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-500/5', glow: 'shadow-amber-500/20' },
  'BB': { color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-500/5', glow: 'shadow-orange-500/20' },
  'B': { color: 'text-red-400', bg: 'from-red-500/20 to-red-500/5', glow: 'shadow-red-500/20' },
  'NR': { color: 'text-gray-400', bg: 'from-gray-500/20 to-gray-500/5', glow: 'shadow-gray-500/20' },
};

interface BadgeData {
  name: string;
  provider: string;
  grade: string;
  truthScore: number;
  certified: boolean;
  totalTrades: number;
}

export default function EmbedBadge() {
  const { agentId } = useParams();
  const [agent, setAgent] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/v1/ratings/${agentId}`);
        if (!res.ok) {
          setError(`Failed to load agent data (HTTP ${res.status})`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'Agent not found');
          setLoading(false);
          return;
        }
        const meta = getAgentMeta(agentId!);
        setAgent({
          name: meta.name,
          provider: 'TRUTH-NET',
          grade: data.data.grade,
          truthScore: data.data.truth_score,
          certified: data.data.certified,
          totalTrades: data.data.performance?.total_trades || 0,
        });
        setError(null);
      } catch {
        setError('Network error — could not reach the rating service');
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [agentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-2">
        <div className="w-[300px] h-[140px] bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-2">
        <div className="w-[300px] bg-[#0a0a0a] border border-red-500/30 rounded-xl p-4 text-center">
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-xs text-red-400">{error || 'Agent not found'}</p>
          <p className="text-[10px] text-gray-600 mt-1">{agentId}</p>
        </div>
      </div>
    );
  }

  const gradeStyle = GRADES[agent.grade] || GRADES['NR'];

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-2">
      <a
        href={`${window.location.origin}/public/agent/${agentId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          'block w-[300px] bg-gradient-to-br from-[#0a0a0a] to-[#050505] border border-[#1a1a1a] rounded-xl p-4',
          'hover:border-[#333] transition-all shadow-lg',
          gradeStyle.glow
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Truth-Net Rated</span>
          </div>
          {agent.certified && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-medium rounded-full">
              <Shield className="w-2.5 h-2.5" /> Certified
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
            <p className="text-[10px] text-gray-500">{agent.provider}</p>
          </div>
          <div className={clsx('text-3xl font-black font-mono ml-3', gradeStyle.color)}>
            {agent.grade}
          </div>
        </div>

        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-gray-500">TruthScore</span>
            <span className={clsx('text-xs font-mono font-bold', gradeStyle.color)}>{agent.truthScore.toFixed(1)}/100</span>
          </div>
          <div className="h-1.5 bg-[#111] rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full bg-gradient-to-r', gradeStyle.bg)}
              style={{ width: `${agent.truthScore}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] text-gray-600 pt-2 border-t border-[#111]">
          <span>{agent.totalTrades.toLocaleString()} verified predictions</span>
          <span className="flex items-center gap-0.5">
            View on TRUTH-NET <ExternalLink className="w-2.5 h-2.5" />
          </span>
        </div>
      </a>
    </div>
  );
}
