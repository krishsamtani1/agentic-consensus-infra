/**
 * TRUTH-NET Auth Context & Hook
 * Manages user authentication state, token storage, and user profile
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  onboarded: boolean;
}

export interface UserBalance {
  available: number;
  locked: number;
  total: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  balance: UserBalance | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  refreshBalance: () => Promise<void>;
  markOnboarded: () => Promise<void>;
  skipAuth: () => void; // Demo mode
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    balance: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('truthnet_token');
    const userStr = localStorage.getItem('truthnet_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as AuthUser;
        setState({
          user,
          token,
          balance: null,
          isLoading: false,
          isAuthenticated: true,
        });
        // Fetch balance in background
        fetchBalance(token, user.id);
      } catch {
        localStorage.removeItem('truthnet_token');
        localStorage.removeItem('truthnet_user');
        setState(s => ({ ...s, isLoading: false }));
      }
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  const fetchBalance = async (token: string, userId: string) => {
    try {
      const resp = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.data?.balance) {
          setState(s => ({ ...s, balance: data.data.balance }));
        }
      }
    } catch {
      // Silently fail - balance will show as null
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Login failed');
    }

    const { user, token, balance } = data.data;
    localStorage.setItem('truthnet_token', token);
    localStorage.setItem('truthnet_user', JSON.stringify(user));

    setState({
      user,
      token,
      balance: balance || null,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    const resp = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });

    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Registration failed');
    }

    const { user, token } = data.data;
    localStorage.setItem('truthnet_token', token);
    localStorage.setItem('truthnet_user', JSON.stringify(user));

    setState({
      user,
      token,
      balance: { available: 0, locked: 0, total: 0 },
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('truthnet_token');
    localStorage.removeItem('truthnet_user');
    setState({
      user: null,
      token: null,
      balance: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const refreshBalance = useCallback(async () => {
    if (state.token && state.user) {
      await fetchBalance(state.token, state.user.id);
    }
  }, [state.token, state.user]);

  const markOnboarded = useCallback(async () => {
    if (!state.user || !state.token) return;

    try {
      await fetch(`${API_BASE}/auth/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ userId: state.user.id }),
      });

      const updatedUser = { ...state.user, onboarded: true };
      localStorage.setItem('truthnet_user', JSON.stringify(updatedUser));
      setState(s => ({ ...s, user: updatedUser }));
    } catch {
      // Silently fail
    }
  }, [state.user, state.token]);

  const skipAuth = useCallback(() => {
    const demoUser: AuthUser = {
      id: 'demo-user',
      email: 'demo@truthnet.io',
      displayName: 'Demo Commander',
      role: 'user',
      onboarded: true,
    };
    localStorage.setItem('truthnet_token', 'demo-token');
    localStorage.setItem('truthnet_user', JSON.stringify(demoUser));
    setState({
      user: demoUser,
      token: 'demo-token',
      balance: { available: 10000, locked: 0, total: 10000 },
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      logout,
      refreshBalance,
      markOnboarded,
      skipAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
