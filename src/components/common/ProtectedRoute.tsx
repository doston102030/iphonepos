import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/common/Logo';

/** Shown for the moment it takes to verify a stored token against the server. */
function BootSplash() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
      <Logo className="h-8 animate-pulse" />
    </div>
  );
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: Role[];
}) {
  const { isAuthenticated, booting, user } = useAuth();
  const location = useLocation();

  // Until /api/auth/me answers, the role in localStorage is unverified — and the
  // role is exactly what decides whether a SUPER_ADMIN screen may render.
  if (booting) return <BootSplash />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, booting } = useAuth();

  if (booting) return <BootSplash />;

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
