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

export const routes: RouteConfig[] = [
  { name: 'Login', path: '/login', element: <LoginPage />, public: true },
  { name: 'Dashboard', path: '/', element: <DashboardPage /> },
  { name: 'Sell', path: '/sell', element: <SellPage /> },
  { name: 'Products', path: '/products', element: <ProductsPage /> },
  { name: 'Stock', path: '/stock', element: <StockPage /> },
  { name: 'Orders', path: '/orders', element: <OrdersPage /> },
  { name: 'Debts', path: '/debts', element: <DebtsPage /> },
  { name: 'Stock Movements', path: '/stock-movements', element: <StockMovementsPage /> },
  { name: 'Reports', path: '/reports', element: <ReportsPage /> },
  { name: 'Profit', path: '/profit', element: <ProfitPage />, roles: ['SUPER_ADMIN'] },
  { name: 'SMS', path: '/sms', element: <SmsPage /> },
  { name: 'Users', path: '/users', element: <UsersPage />, roles: ['SUPER_ADMIN'] },
  { name: 'Settings', path: '/settings', element: <SettingsPage /> },
];
