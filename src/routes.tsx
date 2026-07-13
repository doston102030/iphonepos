import type { ReactNode } from 'react';
import type { Role } from '@/lib/api';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SellPage from './pages/SellPage';
import ProductsPage from './pages/ProductsPage';
import StockPage from './pages/StockPage';
import OrdersPage from './pages/OrdersPage';
import DebtsPage from './pages/DebtsPage';
import StockMovementsPage from './pages/StockMovementsPage';
import ReportsPage from './pages/ReportsPage';
import ProfitPage from './pages/ProfitPage';
import SmsPage from './pages/SmsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
  roles?: Role[];
}

/**
 * A cashier's whole job is the till: sell, keep the shelves stocked, and write
 * down who owes what. Everything else — the day's takings, the profit margin,
 * the staff list, the SMS balance — is the owner's business, and a screen a
 * cashier cannot act on is a screen that only gets in their way.
 *
 * A route with no `roles` is open to both. The guard is real (ProtectedRoute
 * blocks the URL, not just the menu link), but the server is the last word: it
 * answers 403 regardless of what this file says.
 */
export const routes: RouteConfig[] = [
  { name: 'Login', path: '/login', element: <LoginPage />, public: true },
  { name: 'Dashboard', path: '/', element: <DashboardPage />, roles: ['SUPER_ADMIN'] },

  // The cashier's four:
  { name: 'Sell', path: '/sell', element: <SellPage /> },
  { name: 'Products', path: '/products', element: <ProductsPage /> },
  { name: 'Stock', path: '/stock', element: <StockPage /> },
  { name: 'Debts', path: '/debts', element: <DebtsPage /> },

  { name: 'Orders', path: '/orders', element: <OrdersPage />, roles: ['SUPER_ADMIN'] },
  { name: 'Stock Movements', path: '/stock-movements', element: <StockMovementsPage />, roles: ['SUPER_ADMIN'] },
  { name: 'Reports', path: '/reports', element: <ReportsPage />, roles: ['SUPER_ADMIN'] },
  { name: 'Profit', path: '/profit', element: <ProfitPage />, roles: ['SUPER_ADMIN'] },
  { name: 'SMS', path: '/sms', element: <SmsPage />, roles: ['SUPER_ADMIN'] },
  { name: 'Users', path: '/users', element: <UsersPage />, roles: ['SUPER_ADMIN'] },
  { name: 'Settings', path: '/settings', element: <SettingsPage />, roles: ['SUPER_ADMIN'] },
];

/** Where a role lands after login — a cashier has no dashboard to go to. */
export function homePathFor(role: Role | undefined): string {
  return role === 'CASHIER' ? '/sell' : '/';
}
