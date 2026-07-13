import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Role } from '@/lib/api';

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

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
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
