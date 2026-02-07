/**
 * TRUTH-NET Status Bar
 * Bottom bar showing system health metrics
 */

import { Wifi, WifiOff, Clock, Activity, Cpu } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import clsx from 'clsx';

export default function StatusBar() {
  const { isConnected, stats } = useWebSocket();

  return (
    <div className="h-6 bg-[#050505] border-t border-[#111] flex items-center justify-between px-4 text-[10px] font-mono">
      <div className="flex items-center gap-4">
        {/* Connection */}
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">CONNECTED</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-red-400">DISCONNECTED</span>
            </>
          )}
        </div>

        <span className="text-gray-800">|</span>

        {/* Clients */}
        <div className="flex items-center gap-1.5 text-gray-500">
          <Activity className="w-3 h-3" />
          <span>{stats.clients} clients</span>
        </div>

        <span className="text-gray-800">|</span>

        {/* Throughput */}
        <div className="flex items-center gap-1.5 text-gray-500">
          <Cpu className="w-3 h-3" />
          <span>{stats.messagesPerSec || 0} msg/s</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-gray-700">TRUTH-NET v2.0</span>
        <span className="text-gray-800">|</span>
        <div className="flex items-center gap-1.5 text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
