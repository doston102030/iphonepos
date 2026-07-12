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
  { label: 'SMS', path: '/sms', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'Sozlamalar', path: '/settings', icon: <Settings className="h-4 w-4" /> },
];

const adminMoreItems: NavItem[] = [
  { label: 'Buyurtmalar', path: '/orders', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Ombor harakatlari', path: '/stock-movements', icon: <Warehouse className="h-4 w-4" /> },
  { label: 'Hisobotlar', path: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Foyda / Zarar', path: '/profit', icon: <TrendingUp className="h-4 w-4" />, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { label: 'SMS', path: '/sms', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'Foydalanuvchilar', path: '/users', icon: <Users className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'Sozlamalar', path: '/settings', icon: <Settings className="h-4 w-4" /> },
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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border safe-area-bottom">
      <div className="flex items-stretch h-16">
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
                'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'relative flex items-center justify-center h-8 w-8 rounded-xl transition-all',
                isActive ? 'bg-primary/10 scale-110' : ''
              )}>
                <Icon className={cn('h-5 w-5', isActive ? 'text-primary' : 'text-muted-foreground')} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onMoreOpen}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-xl">
            <MoreHorizontal className="h-5 w-5" />
          </div>
          <span>Ko'proq</span>
        </button>
      </div>
    </nav>
  );
}

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
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="p-0 rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-primary">{user?.username?.[0]?.toUpperCase() ?? 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user?.username}</p>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{getRoleLabel(user?.role ?? '')}</Badge>
          </div>
          <button
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted transition-colors shrink-0"
          >
            {theme === 'dark'
              ? <Sun className="h-5 w-5 text-amber-400" />
              : <Moon className="h-5 w-5 text-muted-foreground" />}
          </button>
        </div>
        <div className="px-3 py-2 space-y-1">
          {moreItems.map(item => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors text-left',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="px-3 pb-6 pt-1 border-t border-border mt-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors text-left"
          >
            <LogOut className="h-4 w-4" />
            <span>Chiqish</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
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
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-sidebar-border">
        <SidebarContent />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60 bg-sidebar">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background shrink-0 sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center shrink-0">
              <ShoppingCart className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold truncate">NetDC Orders</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            {user && (
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary-foreground">
                  {user.username?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>
      <MobileBottomNav
        onMoreOpen={() => setMoreOpen(true)}
        cartCount={totalCount}
        unpaidDebtsCount={unpaidDebtsCount}
      />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
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
