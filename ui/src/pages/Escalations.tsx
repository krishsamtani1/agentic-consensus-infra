/**
 * TRUTH-NET Escalations Page
 * 
 * High-stakes trades requiring Commander approval.
 * Implements the Governance Gate pattern.
 */

import GovernanceGate from '../components/GovernanceGate';

export default function Escalations() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-[#0a0a0a] via-black to-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Escalation Queue</h1>
            <p className="text-gray-500 text-sm mt-1">High-stakes trades requiring Commander approval</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <GovernanceGate />
      </div>
    </div>
  );
}
