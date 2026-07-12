import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, CreditCard, Warehouse,
  BarChart3, MessageSquare, Settings, Users, LogOut, Menu,
  ChevronRight, Sun, Moon, MoreHorizontal, TrendingUp, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn, getRoleLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart } from '@/contexts/CartContext';
import { debtsApi, extractContent } from '@/lib/api';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Bosh sahifa', path: '/', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Sotish', path: '/sell', icon: <ShoppingCart className="h-4 w-4" /> },
  { label: 'Mahsulotlar', path: '/products', icon: <Package className="h-4 w-4" /> },
  { label: 'Buyurtmalar', path: '/orders', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Qarzlar', path: '/debts', icon: <CreditCard className="h-4 w-4" /> },
  { label: 'Ombor harakatlari', path: '/stock-movements', icon: <Warehouse className="h-4 w-4" /> },
  { label: 'Hisobotlar', path: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Foyda / Zarar', path: '/profit', icon: <TrendingUp className="h-4 w-4" />, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { label: 'SMS', path: '/sms', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'Foydalanuvchilar', path: '/users', icon: <Users className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'Sozlamalar', path: '/settings', icon: <Settings className="h-4 w-4" /> },
];

const bottomTabs = [
  { label: 'Bosh sahifa', path: '/', icon: LayoutDashboard },
  { label: 'Sotish', path: '/sell', icon: ShoppingCart },
  { label: 'Mahsulotlar', path: '/products', icon: Package },
  { label: 'Qarzlar', path: '/debts', icon: CreditCard },
];

const kassirMoreItems: NavItem[] = [
  { label: 'Buyurtmalar', path: '/orders', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Ombor harakatlari', path: '/stock-movements', icon: <Warehouse className="h-4 w-4" /> },
  { label: 'Hisobotlar', path: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
];

const adminMoreItems: NavItem[] = [
  { label: 'Buyurtmalar', path: '/orders', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Ombor harakatlari', path: '/stock-movements', icon: <Warehouse className="h-4 w-4" /> },
  { label: 'Hisobotlar', path: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Foyda / Zarar', path: '/profit', icon: <TrendingUp className="h-4 w-4" />, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { label: 'Foydalanuvchilar', path: '/users', icon: <Users className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
];

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8 shrink-0', className)}
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Yorqin rejim' : "Qorong'u rejim"}
    >
      {theme === 'dark'
        ? <Sun className="h-4 w-4 text-amber-400" />
        : <Moon className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { user } = useAuth();
  const visibleItems = navItems.filter(item => !item.roles || item.roles.includes(user?.role ?? ''));

  return (
    <nav className="flex-1 px-3 py-2 space-y-0.5">
      {visibleItems.map(item => {
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            {item.icon}
            <span className="flex-1 min-w-0 truncate">{item.label}</span>
            {isActive && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <ShoppingCart className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate leading-tight">NetDC Orders</p>
            <p className="text-xs text-muted-foreground truncate">Boshqaruv paneli</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="px-4 py-3 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{user?.username?.[0]?.toUpperCase() ?? 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.username}</p>
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{getRoleLabel(user?.role ?? '')}</Badge>
          </div>
        </div>
        <Button
          variant="ghost" size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2"
          onClick={handleLogout}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="text-xs">Chiqish</span>
        </Button>
      </div>
    </div>
  );
}

function MobileBottomNav({ onMoreOpen, cartCount, unpaidDebtsCount }: {
  onMoreOpen: () => void; cartCount: number; unpaidDebtsCount: number;
}) {
  const location = useLocation();

  const badgeFor = (path: string): number => {
    if (path === '/sell') return cartCount;
    if (path === '/debts') return unpaidDebtsCount;
    return 0;
  };

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] safe-area-bottom">
      <div className="flex items-stretch h-[4.5rem]">
        {bottomTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path);
          const badge = badgeFor(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'relative flex items-center justify-center h-10 w-10 rounded-2xl transition-all duration-300',
                isActive ? 'bg-primary/10 scale-110 shadow-sm' : ''
              )}>
                <Icon className={cn('h-6 w-6 transition-transform', isActive ? 'text-primary scale-110' : 'text-muted-foreground')} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center shadow-md border-2 border-background">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={cn('transition-all duration-300', isActive ? 'translate-y-0.5' : '')}>{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onMoreOpen}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-all"
        >
          <div className="flex items-center justify-center h-10 w-10 rounded-2xl transition-all duration-300">
            <MoreHorizontal className="h-6 w-6" />
          </div>
          <span>Ko'proq</span>
        </button>
      </div>
    </nav>
  );
}

import { MobileOverlay } from '@/components/common/MobileOverlay';

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isKassir = user?.role === 'KASSIR';
  const moreItems = isKassir
    ? kassirMoreItems
    : adminMoreItems.filter(item => !item.roles || item.roles.includes(user?.role ?? ''));

  function handleLogout() { logout(); onClose(); navigate('/login'); }
  function handleNav(path: string) { navigate(path); onClose(); }

  return (
    <MobileOverlay open={open} onOpenChange={onClose} title="Ko'proq">
      <div className="flex flex-col h-full bg-muted/10 p-4 space-y-4">
        
        {/* User Profile Card */}
        <div className="bg-background rounded-3xl p-4 flex items-center justify-between shadow-sm border border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center shadow-md shrink-0">
              <span className="text-2xl font-bold text-white">{user?.username?.[0]?.toUpperCase() ?? 'U'}</span>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{user?.username}</p>
              <p className="text-sm font-medium text-muted-foreground">{getRoleLabel(user?.role ?? '')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3">
          {moreItems.map(item => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-3xl transition-colors h-28 border border-border/50',
                  isActive ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' : 'bg-background text-foreground hover:bg-muted/50 shadow-sm'
                )}
              >
                <div className={cn(
                  'h-12 w-12 rounded-2xl flex items-center justify-center',
                  isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'
                )}>
                  {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { className: 'h-6 w-6' })}
                </div>
                <span className="text-xs font-bold text-center">{item.label}</span>
              </button>
            );
          })}
          
          <button
            onClick={toggleTheme}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl transition-colors h-28 border border-border/50 bg-background text-foreground hover:bg-muted/50 shadow-sm"
          >
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
              {theme === 'dark' ? <Sun className="h-6 w-6 text-amber-400" /> : <Moon className="h-6 w-6" />}
            </div>
            <span className="text-xs font-bold text-center">Mavzu</span>
          </button>
        </div>
      </div>
    </MobileOverlay>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [unpaidDebtsCount, setUnpaidDebtsCount] = useState(0);
  const { user } = useAuth();
  const { totalCount } = useCart();

  useEffect(() => {
    debtsApi.getAll(0, 100)
      .then(res => setUnpaidDebtsCount(extractContent(res).filter(d => d.status !== 'PAID').length))
      .catch(() => null);
  }, []);

  return (
    <div className="flex h-[100dvh] w-full bg-muted/30 justify-center overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar shrink-0 z-20 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 w-full flex flex-col bg-background relative md:max-w-none max-w-[430px] mx-auto md:mx-0 sm:border-x md:border-none sm:border-border sm:shadow-2xl md:shadow-none overflow-hidden transition-all duration-300">
        <header className="md:hidden flex items-center justify-between gap-3 px-4 h-14 border-b border-border bg-background/80 backdrop-blur-md shrink-0 sticky top-0 z-30 safe-area-top">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-7 w-7 rounded bg-gradient-primary flex items-center justify-center shrink-0 shadow-sm">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold truncate tracking-tight">NetDC Orders</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {user && (
              <button 
                onClick={() => setMoreOpen(true)} 
                className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center transition-colors hover:bg-primary/20"
              >
                <span className="text-[11px] font-bold text-primary">
                  {user.username?.[0]?.toUpperCase()}
                </span>
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <div className="mx-auto max-w-7xl w-full">
            {children}
          </div>
        </main>
        <div className="md:hidden">
          <MobileBottomNav
            onMoreOpen={() => setMoreOpen(true)}
            cartCount={totalCount}
            unpaidDebtsCount={unpaidDebtsCount}
          />
        </div>
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>
    </div>
  );
}

export function PageHeader({
  title, description, action,
}: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-foreground md:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
