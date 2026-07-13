import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, type Role } from '@/lib/api';

/** Exactly the shape of LoginResponse — the server sends nothing else. */
export interface AuthUser {
  id: number;
  token: string;
  fullName: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the stored token has been checked against the server. */
  booting: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  isSuperAdmin: boolean;
  isCashier: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((authUser: AuthUser) => {
    localStorage.setItem('token', authUser.token);
    localStorage.setItem('user', JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem('token');
      if (!token) setUser(null);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // The stored blob says who you are and — decisively — what role you have, and
  // it is a text file the user can edit. Ask the server on boot: an expired
  // token is rejected here (request() clears it and bounces to /login) instead
  // of painting a dashboard that dies on its first API call, and a hand-edited
  // role is corrected before any SUPER_ADMIN screen renders.
  const [booting, setBooting] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    let cancelled = false;

    authApi.me()
      .then(me => {
        if (cancelled) return;
        setUser(prev => {
          const token = prev?.token ?? localStorage.getItem('token') ?? '';
          const fresh: AuthUser = { id: me.id, fullName: me.fullName, role: me.role, token };
          localStorage.setItem('user', JSON.stringify(fresh));
          return fresh;
        });
      })
      // A 401 has already logged the user out inside request(); anything else is
      // a network blip, and kicking a cashier out mid-shift over one dropped
      // request would be worse than trusting the stored session for now.
      .catch(() => null)
      .finally(() => { if (!cancelled) setBooting(false); });

    return () => { cancelled = true; };
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    booting,
    login,
    logout,
    // The API knows only SUPER_ADMIN and CASHIER — there is no ADMIN tier.
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    isCashier: user?.role === 'CASHIER',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
