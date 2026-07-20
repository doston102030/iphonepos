import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, CreditCard, Warehouse,
  BarChart3, MessageSquare, Settings, Users, LogOut,
  ChevronRight, ChevronLeft, Sun, Moon, TrendingUp, Receipt, Boxes, RotateCw,
} from 'lucide-react';
import useGoBack from '@/hooks/use-go-back';
import useKeyboardOpen from '@/hooks/use-keyboard-open';
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

// One list, role-tagged, and everything else is derived from it. There used to be
// three hand-maintained copies (sidebar, bottom tabs, two "Ko'proq" lists) that
// had already drifted: SMS and Sozlamalar existed in the sidebar but in neither
// mobile menu, so on a phone they could not be opened at all.
//
// `roles` here must mirror routes.tsx — the route guard is what actually blocks;
// this only decides what is worth showing.
const navItems: NavItem[] = [
  { label: 'Bosh sahifa', path: '/', icon: <LayoutDashboard className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'Sotish', path: '/sell', icon: <ShoppingCart className="h-4 w-4" /> },
  { label: 'Mahsulotlar', path: '/products', icon: <Package className="h-4 w-4" /> },
  { label: 'Ombor', path: '/stock', icon: <Boxes className="h-4 w-4" /> },
  { label: 'Qarzlar', path: '/debts', icon: <CreditCard className="h-4 w-4" /> },
  { label: 'Buyurtmalar', path: '/orders', icon: <Receipt className="h-4 w-4" /> },
  { label: 'Ombor harakatlari', path: '/stock-movements', icon: <Warehouse className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'Hisobotlar', path: '/reports', icon: <BarChart3 className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'Foyda / Zarar', path: '/profit', icon: <TrendingUp className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'SMS', path: '/sms', icon: <MessageSquare className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'Foydalanuvchilar', path: '/users', icon: <Users className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
  { label: 'Sozlamalar', path: '/settings', icon: <Settings className="h-4 w-4" />, roles: ['SUPER_ADMIN'] },
];

/** The bottom bar. A cashier has no dashboard, so they get four tabs, not five. */
const bottomTabs: { label: string; path: string; icon: typeof LayoutDashboard; roles?: Role[] }[] = [
  { label: 'Bosh sahifa', path: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN'] },
  { label: 'Sotish', path: '/sell', icon: ShoppingCart },
  { label: 'Mahsulotlar', path: '/products', icon: Package },
  { label: 'Ombor', path: '/stock', icon: Boxes },
  { label: 'Qarzlar', path: '/debts', icon: CreditCard },
];

const TAB_PATHS = new Set(bottomTabs.map(t => t.path));

/** Everything that is not a tab — reached from the avatar in the header. */
const moreItems: NavItem[] = navItems.filter(item => !TAB_PATHS.has(item.path));

function visibleTo<T extends { roles?: Role[] }>(items: T[], role: Role | undefined): T[] {
  return items.filter(item => !item.roles || (!!role && item.roles.includes(role)));
}

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
  const visibleItems = visibleTo(navItems, user?.role);

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

/**
 * Hard-reloads the page. Inside the Telegram Mini App there is no browser
 * chrome, so without this the only way to refetch after a network hiccup is
 * killing and reopening the whole mini-app.
 */
function ReloadButton() {
  const [spinning, setSpinning] = useState(false);
  return (
    <button
      type="button"
      aria-label="Yangilash"
      title="Yangilash"
      onClick={() => { setSpinning(true); window.location.reload(); }}
      className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center transition-colors hover:bg-primary/20 press"
    >
      <RotateCw className={cn('h-4 w-4', spinning && 'animate-spin')} strokeWidth={2.4} />
    </button>
  );
}

function MobileBottomNav({ cartCount, unpaidDebtsCount }: {
  cartCount: number; unpaidDebtsCount: number;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const tabs = visibleTo(bottomTabs, user?.role);

  const badgeFor = (path: string): number => {
    if (path === '/sell') return cartCount;
    if (path === '/debts') return unpaidDebtsCount;
    return 0;
  };

  return (
    // Telegram-iOS's floating tab bar, per the user's reference shot: a
    // compact rounded glass dock lifted off the screen edge, the page
    // scrolling beneath it. `nav-dock-inset` owns the gap so the sum still
    // equals --bottom-nav-h, which every page pads by.
    // backdrop-saturate is what makes it read as APPLE glass, not frosted
    // plastic: colors scrolling beneath come through vivid, not washed out.
    <nav className="absolute bottom-0 left-0 right-0 z-40 px-3 pointer-events-none nav-dock-inset">
      <div className="pointer-events-auto flex items-stretch h-[var(--dock-h)] rounded-[1.75rem] bg-background/80 backdrop-blur-2xl backdrop-saturate-150 border border-border/60 shadow-[0_2px_6px_rgba(0,0,0,0.06),0_12px_32px_-8px_rgba(0,0,0,0.25)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_12px_32px_-8px_rgba(0,0,0,0.7)] px-1.5">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = isPathActive(location.pathname, tab.path);
          const badge = badgeFor(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 tracking-tight press',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span className="relative flex items-center justify-center">
                {/* Telegram's trick for "filled when active" with outline
                    glyphs: tint the glyph's own body, don't add a pill. */}
                <Icon
                  className="h-[26px] w-[26px]"
                  strokeWidth={isActive ? 2.1 : 1.8}
                  fill="currentColor"
                  fillOpacity={isActive ? 0.25 : 0}
                />
                {badge > 0 && (
                  <span className="absolute -top-1.5 left-3.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[9px] font-bold flex items-center justify-center border border-background">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className={cn('truncate max-w-full px-0.5 leading-none text-[10px] font-medium', isActive && 'font-semibold')}>
                {tab.label}
              </span>
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
  // Almost all of a cashier's pages are bottom tabs — this sheet holds only
  // Buyurtmalar, their profile, the theme and the way out for them.
  const visibleMoreItems = visibleTo(moreItems, user?.role);

  function handleLogout() { logout(); onClose(); navigate('/login'); }
  function handleNav(path: string) { navigate(path); onClose(); }

  return (
    <MobileOverlay open={open} onOpenChange={onClose} title="Ko'proq">
      {/* min-h-full + gap (not h-full + space-y): the profile card's mt-auto
          must win to pin it to the bottom, and space-y's margins would not
          let it; min-h-full lets the sheet still scroll when the grid is tall. */}
      <div className="flex flex-col min-h-full bg-muted/10 p-4 gap-4">

        {/* Menu Grid */}
        <div className="grid grid-cols-2 gap-3">
          {visibleMoreItems.map(item => {
            const isActive = isPathActive(location.pathname, item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNav(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-3xl transition-colors h-28 border border-border press',
                  isActive ? 'bg-primary/10 text-primary border-primary/20 shadow-card' : 'bg-background text-foreground hover:bg-muted/50 shadow-card'
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
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl transition-colors h-28 border border-border bg-background text-foreground hover:bg-muted/50 shadow-card press"
          >
            <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
              {theme === 'dark' ? <Sun className="h-6 w-6 text-amber-400" /> : <Moon className="h-6 w-6" />}
            </div>
            <span className="text-xs font-bold text-center">Mavzu</span>
          </button>
        </div>

        {/* User Profile Card — pinned to the bottom of the sheet */}
        <div className="mt-auto bg-background rounded-3xl p-4 flex items-center justify-between shadow-card border border-border">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shrink-0">
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
  // On Android (and Telegram's Android webview) the keyboard resizes the
  // webview, parking the dock right on top of it — dead chrome over whatever
  // the user is typing about. Step aside until the keyboard goes.
  const keyboardOpen = useKeyboardOpen();

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
    <div className="flex h-app w-full bg-muted/30 justify-center overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar shrink-0 z-20 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 w-full flex flex-col bg-background relative md:max-w-none max-w-[430px] mx-auto md:mx-0 sm:border-x md:border-none sm:border-border sm:shadow-2xl md:shadow-none overflow-hidden">
        {/* safe-area-top lives on the <header>, the fixed h-14 on an inner row
            (the MobileOverlay pattern). Both on one element is a trap: with
            border-box sizing the inset padding eats the 56px box instead of
            growing it, so inside Telegram the page title slid up under the
            floating Закрыть/menu pills. */}
        <header className="md:hidden border-b border-border/60 bg-background/80 backdrop-blur-2xl backdrop-saturate-150 shrink-0 sticky top-0 z-30 safe-area-top">
          <div className="flex items-center justify-between gap-3 px-4 h-14">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Logo className="h-8" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ReloadButton />
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
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overscroll-contain pb-nav md:pb-0">
          <div className="mx-auto max-w-7xl w-full">
            {children}
          </div>
        </main>
        {!keyboardOpen && (
          <div className="md:hidden">
            <MobileBottomNav
              cartCount={totalCount}
              unpaidDebtsCount={unpaidDebtsCount}
            />
          </div>
        )}
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>
    </div>
  );
}

export function PageHeader({
  title, description, action,
}: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
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
