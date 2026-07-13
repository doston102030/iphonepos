import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, CreditCard, Warehouse,
  BarChart3, MessageSquare, Settings, Users, LogOut,
  ChevronRight, ChevronLeft, Sun, Moon, TrendingUp, Receipt, Boxes,
} from 'lucide-react';
import useGoBack from '@/hooks/use-go-back';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/common/Logo';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import { cn, getRoleLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart } from '@/contexts/CartContext';
import { debtsApi, fetchAllPages, type Role } from '@/lib/api';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { label: 'Bosh sahifa', path: '/', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Sotish', path: '/sell', icon: <ShoppingCart className="h-4 w-4" /> },
  { label: 'Mahsulotlar', path: '/products', icon: <Package className="h-4 w-4" /> },
  { label: 'Ombor', path: '/stock', icon: <Boxes className="h-4 w-4" /> },
  { label: 'Buyurtmalar', path: '/orders', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Qarzlar', path: '/debts', icon: <CreditCard className="h-4 w-4" /> },
  { label: 'Ombor harakatlari', path: '/stock-movements', icon: <Warehouse className="h-4 w-4" /> },
  { label: 'Hisobotlar', path: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Foyda / Zarar', path: '/profit', icon: <TrendingUp className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'SMS', path: '/sms', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'Foydalanuvchilar', path: '/users', icon: <Users className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'Sozlamalar', path: '/settings', icon: <Settings className="h-4 w-4" /> },
];

// The "Ko'proq" tab is gone — Ombor took its slot. The same sheet still opens
// from the avatar in the header, and it now carries SMS and Sozlamalar too,
// which had no way in on a phone at all.
const bottomTabs = [
  { label: 'Bosh sahifa', path: '/', icon: LayoutDashboard },
  { label: 'Sotish', path: '/sell', icon: ShoppingCart },
  { label: 'Mahsulotlar', path: '/products', icon: Package },
  { label: 'Ombor', path: '/stock', icon: Boxes },
  { label: 'Qarzlar', path: '/debts', icon: CreditCard },
];

const cashierMoreItems: NavItem[] = [
  { label: 'Buyurtmalar', path: '/orders', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Ombor harakatlari', path: '/stock-movements', icon: <Warehouse className="h-4 w-4" /> },
  { label: 'Hisobotlar', path: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'SMS', path: '/sms', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'Sozlamalar', path: '/settings', icon: <Settings className="h-4 w-4" /> },
];

const superAdminMoreItems: NavItem[] = [
  { label: 'Buyurtmalar', path: '/orders', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Ombor harakatlari', path: '/stock-movements', icon: <Warehouse className="h-4 w-4" /> },
  { label: 'Hisobotlar', path: '/reports', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'Foyda / Zarar', path: '/profit', icon: <TrendingUp className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'Foydalanuvchilar', path: '/users', icon: <Users className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'SMS', path: '/sms', icon: <MessageSquare className="h-4 w-4" /> },
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

/**
 * A plain `startsWith` lit up "Ombor" (/stock) while you were on "Ombor
 * harakatlari" (/stock-movements) — one path is a prefix of the other. Only an
 * exact match, or a real child segment, counts as active.
 */
function isPathActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { user } = useAuth();
  const visibleItems = navItems.filter(
    item => !item.roles || (!!user && item.roles.includes(user.role))
  );

  return (
    <nav className="flex-1 px-3 py-2 space-y-0.5">
      {visibleItems.map(item => {
        const isActive = isPathActive(location.pathname, item.path);
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
          <div className="flex-1 min-w-0">
            <Logo className="h-6" />
            <p className="text-xs text-muted-foreground truncate mt-1">Boshqaruv paneli</p>
          </div>
          <ThemeToggle />
        </div>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="px-4 py-3 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{user?.fullName?.[0]?.toUpperCase() ?? 'U'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.fullName}</p>
            {user && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{getRoleLabel(user.role)}</Badge>
            )}
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

function MobileBottomNav({ cartCount, unpaidDebtsCount }: {
  cartCount: number; unpaidDebtsCount: number;
}) {
  const location = useLocation();

  const badgeFor = (path: string): number => {
    if (path === '/sell') return cartCount;
    if (path === '/debts') return unpaidDebtsCount;
    return 0;
  };

  const tabClass = 'flex-1 flex flex-col items-center justify-center gap-1 h-full rounded-full text-[11px] font-semibold tracking-tight press';

  return (
    // A floating iOS-style dock rather than a bar welded to the screen edge: the
    // page scrolls under the glass, and the rounded shell keeps clear of the
    // home indicator. `nav-dock-inset` owns the gap so the sum still equals
    // --bottom-nav-h, which every page pads by.
    <nav className="absolute bottom-0 left-0 right-0 z-40 px-3 pointer-events-none nav-dock-inset">
      <div className="pointer-events-auto flex items-stretch h-[var(--dock-h)] rounded-full bg-background/70 backdrop-blur-2xl border border-border/60 shadow-[0_8px_28px_-6px_rgba(0,0,0,0.22)] dark:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.6)] px-1.5">
        {bottomTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = isPathActive(location.pathname, tab.path);
          const badge = badgeFor(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(tabClass, isActive ? 'text-primary' : 'text-muted-foreground')}
            >
              <span className={cn(
                'relative flex items-center justify-center h-8 w-12 rounded-full transition-all duration-200',
                isActive && 'bg-primary/10'
              )}>
                <Icon
                  className={cn('h-[23px] w-[23px] transition-transform duration-200', isActive && 'scale-105')}
                  strokeWidth={isActive ? 2.3 : 1.9}
                />
                {badge > 0 && (
                  <span className="absolute -top-1.5 right-0.5 h-[17px] min-w-[17px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className="truncate max-w-full px-0.5 leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isCashier = user?.role === 'CASHIER';
  const moreItems = isCashier
    ? cashierMoreItems
    : superAdminMoreItems.filter(
        item => !item.roles || (!!user && item.roles.includes(user.role))
      );

  function handleLogout() { logout(); onClose(); navigate('/login'); }
  function handleNav(path: string) { navigate(path); onClose(); }

  return (
    <MobileOverlay open={open} onOpenChange={onClose} title="Ko'proq">
      <div className="flex flex-col h-full bg-muted/10 p-4 space-y-4">
        
        {/* User Profile Card */}
        <div className="bg-background rounded-3xl p-4 flex items-center justify-between shadow-sm border border-border/50">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center shadow-md shrink-0">
              <span className="text-2xl font-bold text-white">{user?.fullName?.[0]?.toUpperCase() ?? 'U'}</span>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-tight">{user?.fullName}</p>
              {user && (
                <p className="text-sm font-medium text-muted-foreground">{getRoleLabel(user.role)}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Chiqish"
            onClick={handleLogout}
            className="h-12 w-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors press"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3">
          {moreItems.map(item => {
            const isActive = isPathActive(location.pathname, item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-3xl transition-colors h-28 border border-border/50 press',
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
            type="button"
            onClick={toggleTheme}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl transition-colors h-28 border border-border/50 bg-background text-foreground hover:bg-muted/50 shadow-sm press"
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

// Every page renders its own <MainLayout>, so this effect re-fires on every
// navigation. Counting the debt book each time would be a burst of requests per
// tap, so the answer is cached for a minute.
let debtCountCache: { at: number; count: number } | null = null;
const DEBT_COUNT_TTL_MS = 60_000;

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [unpaidDebtsCount, setUnpaidDebtsCount] = useState(debtCountCache?.count ?? 0);
  const { user } = useAuth();
  const { totalCount } = useCart();

  useEffect(() => {
    if (debtCountCache && Date.now() - debtCountCache.at < DEBT_COUNT_TTL_MS) {
      setUnpaidDebtsCount(debtCountCache.count);
      return;
    }
    let cancelled = false;

    // Every page, not the first 100 rows: the badge sits on the tab that opens
    // the debt list, and it used to disagree with the list it points at.
    fetchAllPages(debtsApi.getAll)
      .then(({ items }) => {
        const count = items.filter(d => d.status !== 'PAID').length;
        debtCountCache = { at: Date.now(), count };
        if (!cancelled) setUnpaidDebtsCount(count);
      })
      .catch(() => null);

    return () => { cancelled = true; };
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
            <Logo className="h-6" />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {user && (
              <button
                type="button"
                aria-label="Menyu"
                onClick={() => setMoreOpen(true)}
                className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center transition-colors hover:bg-primary/20 press"
              >
                <span className="text-xs font-bold text-primary">
                  {user.fullName?.[0]?.toUpperCase()}
                </span>
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overscroll-contain pb-nav md:pb-0">
          <div className="mx-auto max-w-7xl w-full">
            {children}
          </div>
        </main>
        <div className="md:hidden">
          <MobileBottomNav
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
  const location = useLocation();
  const goBack = useGoBack();
  // The four bottom-nav tabs are reachable in one tap, so they need no back
  // button. Every other page is opened from the "Ko'proq" sheet — without this
  // the only way out is the bottom nav, which loses where you came from.
  const isTabRoot = bottomTabs.some(tab => tab.path === location.pathname);

  return (
    <div className="flex items-start gap-3 mb-4 md:mb-6">
      {!isTabRoot && (
        <button
          type="button"
          aria-label="Orqaga"
          onClick={goBack}
          className="md:hidden h-10 w-10 -ml-1 mt-0.5 shrink-0 rounded-xl bg-muted text-foreground flex items-center justify-center press"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-[22px] leading-tight font-bold text-foreground tracking-tight md:text-2xl">{title}</h1>
        {description && (
          <p className="text-[13px] text-muted-foreground mt-1 md:text-sm">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
