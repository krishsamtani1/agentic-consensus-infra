/**
 * TRUTH-NET Wallet Bar
 * Shows user balance and deposit/withdraw controls
 */

import { useState } from 'react';
import { DollarSign, Plus, ArrowDownRight, LogOut, User } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../hooks/useAuth';
import DepositModal from './DepositModal';

export default function WalletBar() {
  const { user, balance, isAuthenticated, logout } = useAuth();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  if (!isAuthenticated || !user) return null;

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Balance Display */}
        <div className="flex items-center gap-2 bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <div className="text-right">
            <span className="text-sm font-bold font-mono text-white">
              ${(balance?.available ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {(balance?.locked ?? 0) > 0 && (
              <span className="text-[10px] text-gray-500 ml-2">
                (${balance!.locked.toFixed(2)} locked)
              </span>
            )}
          </div>
        </div>

        {/* Deposit Button */}
        <button
          onClick={() => setShowDeposit(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" />
          Deposit
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 bg-[#111] border border-[#1a1a1a] hover:border-[#333] rounded-xl px-3 py-2 transition-colors"
          >
            <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm text-gray-300 max-w-[100px] truncate">
              {user.displayName}
            </span>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#111] border border-[#262626] rounded-xl overflow-hidden shadow-xl z-50">
                <div className="p-3 border-b border-[#1a1a1a]">
                  <p className="text-sm text-white font-medium">{user.displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setShowMenu(false); setShowDeposit(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Deposit
                </button>
                <button
                  onClick={() => { setShowMenu(false); logout(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
    </>
  );
}
