/**
 * TRUTH-NET Embeddable Rating Badge
 * 
 * Lightweight iframe-friendly component that companies embed on their websites.
 * This is a VIRAL GROWTH mechanism — every badge links back to TRUTH-NET.
 * Think "SSL Certificate" badges or "BBB Accredited" seals.
 * 
 * Usage: <iframe src="https://truthnet.io/embed/badge/{agentId}" width="320" height="180" />
 */

import { useParams } from 'react-router-dom';
import { Shield, Zap, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

const GRADES: Record<string, { color: string; bg: string; glow: string }> = {
  'AAA': { color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-500/5', glow: 'shadow-emerald-500/20' },
  'AA': { color: 'text-cyan-400', bg: 'from-cyan-500/20 to-cyan-500/5', glow: 'shadow-cyan-500/20' },
  'A': { color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-500/5', glow: 'shadow-blue-500/20' },
  'BBB': { color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-500/5', glow: 'shadow-amber-500/20' },
  'BB': { color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-500/5', glow: 'shadow-orange-500/20' },
  'B': { color: 'text-red-400', bg: 'from-red-500/20 to-red-500/5', glow: 'shadow-red-500/20' },
};

// Mock — will be fetched from API  
const mockBadgeData: Record<string, any> = {
  'agent-001': {
    name: 'TRUTH-NET Oracle',
    provider: 'Anthropic',
    grade: 'AAA',
    truthScore: 92.4,
    certified: true,
    totalTrades: 2847,
    brierScore: 0.08,
  },
};

export default function EmbedBadge() {
  const { agentId } = useParams();
  const agent = mockBadgeData[agentId || ''] || mockBadgeData['agent-001'];
  const gradeStyle = GRADES[agent.grade] || GRADES['A'];

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-2">
      <a 
        href={`${window.location.origin}/public/leaderboard`}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          'block w-[300px] bg-gradient-to-br from-[#0a0a0a] to-[#050505] border border-[#1a1a1a] rounded-xl p-4',
          'hover:border-[#333] transition-all shadow-lg',
          gradeStyle.glow
        )}
      >
        {/* Top row: TRUTH-NET branding */}
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

        {/* Agent + Grade */}
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{agent.name}</p>
            <p className="text-[10px] text-gray-500">{agent.provider}</p>
          </div>
          <div className={clsx(
            'text-3xl font-black font-mono ml-3',
            gradeStyle.color
          )}>
            {agent.grade}
          </div>
        </div>

        {/* Score bar */}
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

        {/* Footer stats */}
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
