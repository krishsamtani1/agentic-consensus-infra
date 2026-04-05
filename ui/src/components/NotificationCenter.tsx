/**
 * TRUTH-NET Notification Center + Toast System
 * 
 * Real-time notifications from WebSocket events.
 * Bell icon in the header with dropdown + toast popups.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, X, Shield, TrendingUp, Award, AlertTriangle,
  CheckCircle, Info, ArrowRight
} from 'lucide-react';
import clsx from 'clsx';

// ============================================================================
// TYPES
// ============================================================================

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'rating';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
}

// ============================================================================
// NOTIFICATION STORE (simple context-based)
// ============================================================================

interface NotificationContextType {
  notifications: Notification[];
  toasts: Toast[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  addToast: (t: Omit<Toast, 'id'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const notification: Notification = {
      ...n,
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [notification, ...prev].slice(0, 50));
  }, []);

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const toast: Toast = {
      ...t,
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    setToasts(prev => [...prev, toast]);

    // Auto-remove
    setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== toast.id));
    }, t.duration || 5000);
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, toasts, unreadCount,
      addNotification, addToast, markRead, markAllRead, removeToast, clearAll,
    }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={clsx(
                'flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm',
                toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' :
                toast.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
                toast.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-[#0a0a0a] border-[#1a1a1a]'
              )}
            >
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />}
              {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{toast.title}</p>
                {toast.message && <p className="text-xs text-gray-400 mt-0.5">{toast.message}</p>}
              </div>
              <button onClick={() => removeToast(toast.id)} className="p-0.5 hover:bg-white/10 rounded flex-shrink-0">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

// ============================================================================
// BELL DROPDOWN COMPONENT (for header)
// ============================================================================

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const iconForType = (type: string) => {
    switch (type) {
      case 'rating': return <Award className="w-4 h-4 text-cyan-400" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
        <Bell className="w-4 h-4 text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-[#1a1a1a]">
              <span className="text-sm font-medium text-white">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-cyan-400 hover:text-cyan-300">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-600 text-sm">No notifications</div>
              ) : (
                notifications.slice(0, 10).map(n => (
                  <button key={n.id} onClick={() => { markRead(n.id); }}
                    className={clsx(
                      'w-full flex items-start gap-3 p-3 hover:bg-white/[0.02] transition-colors text-left border-b border-[#111]',
                      !n.read && 'bg-white/[0.02]'
                    )}>
                    <div className="mt-0.5 flex-shrink-0">{iconForType(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={clsx('text-xs font-medium', n.read ? 'text-gray-400' : 'text-white')}>{n.title}</p>
                        {!n.read && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{n.message}</p>
                      <p className="text-[9px] text-gray-600 mt-1">{timeAgo(n.timestamp)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
