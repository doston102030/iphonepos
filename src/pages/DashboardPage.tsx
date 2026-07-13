import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Package, CreditCard, TrendingUp,
  Warehouse, Wallet, TrendingDown, Trophy, AlertTriangle, Users, CalendarDays,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import {
  reportsApi, ordersApi, inventorySummary,
  type SalesReportResponse, type OrderResponse, type PaymentMethod,
  type UserSalesResponse,
  extractContent,
} from '@/lib/api';
import {
  cn, formatCurrency, formatDateTime, getPaymentMethodLabel, getRoleLabel,
  todayStr, daysAgoStr, monthStartStr, uzDayLabel,
} from '@/lib/utils';
import { getProductUnit } from '@/lib/units';
import { useAuth } from '@/contexts/AuthContext';

/** What inventorySummary() can actually derive — no inventory value exists. */
interface InventoryStats { totalProducts: number; lowStockCount: number }


function KpiCard({
  title, value, sub, icon, tone = 'default', className,
}: { title: string; value: string; sub?: string; icon: React.ReactNode; tone?: 'default' | 'brand' | 'success' | 'destructive'; className?: string }) {
  return (
    <Card className={cn('shadow-card rounded-2xl', className)}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <p className="text-[13px] text-muted-foreground font-medium leading-tight">{title}</p>
          <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
            tone === 'brand' ? 'bg-brand/10 text-brand' :
            tone === 'success' ? 'bg-success/10 text-success' :
            tone === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
          )}>
            {icon}
          </div>
        </div>
        <p className="kpi-number text-foreground break-words">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-bold text-foreground break-words">{value}</p>
    </div>
  );
}

// The server sends four payment methods — this map is total, no fallback needed.
function paymentBadgeVariant(method: PaymentMethod): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<PaymentMethod, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    CASH: 'default',
    CARD: 'secondary',
    MIXED: 'outline',
    CREDIT: 'destructive',
  };
  return variants[method];
}

export default function DashboardPage() {
  // The day under inspection. Defaults to today; the chip in the header points
  // the whole daily half of the page (KPIs, split, staff, top products) at any
  // past day, while week/month/inventory/orders stay anchored to now.
  const [date, setDate] = useState(todayStr);
  const [day, setDay] = useState<SalesReportResponse | null>(null);
  const [staffSales, setStaffSales] = useState<UserSalesResponse[] | null>(null);
  const [week, setWeek] = useState<SalesReportResponse | null>(null);
  const [month, setMonth] = useState<SalesReportResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderResponse[] | null>(null);
  const [dayLoading, setDayLoading] = useState(true);
  const [restLoading, setRestLoading] = useState(true);
  const [dayFailed, setDayFailed] = useState(false);
  const [restFailed, setRestFailed] = useState(false);
  const { user, isSuperAdmin } = useAuth();

  // allSettled, not all: one dead endpoint used to reject the whole batch, and
  // the `.catch(() => null)` under it left every card rendering a confident 0 —
  // a cashier could not tell "sotuv bo'lmadi" from "server javob bermadi".
  // Whatever does load is shown; whatever fails shows "—" and says so.
  const loadDay = useCallback(async () => {
    setDayLoading(true);
    // daily() without a date lets the SERVER pick "today", and its clock may
    // sit on the other side of midnight from the shop's — so the KPI cards and
    // the per-cashier list below could describe two different days. One
    // explicit local date keeps everything on this screen on the same day.
    const [d, staff] = await Promise.allSettled([
      reportsApi.daily(date),
      reportsApi.byUser(date, date),
    ]);

    setDay(d.status === 'fulfilled' ? d.value : null);
    setStaffSales(staff.status === 'fulfilled'
      ? [...staff.value].sort((a, b) => b.totalRevenue - a.totalRevenue)
      : null);
    setDayFailed([d, staff].some(r => r.status === 'rejected'));
    setDayLoading(false);
  }, [date]);

  const loadRest = useCallback(async () => {
    setRestLoading(true);
    const [w, m, inv, ord] = await Promise.allSettled([
      reportsApi.range(daysAgoStr(6), todayStr()),
      reportsApi.range(monthStartStr(), todayStr()),
      inventorySummary(),
      ordersApi.getAll(0, 5),
    ]);

    setWeek(w.status === 'fulfilled' ? w.value : null);
    setMonth(m.status === 'fulfilled' ? m.value : null);
    setInventory(inv.status === 'fulfilled' ? inv.value : null);
    setRecentOrders(ord.status === 'fulfilled' ? extractContent(ord.value) : null);
    setRestFailed([w, m, inv, ord].some(r => r.status === 'rejected'));
    setRestLoading(false);
  }, []);

  useEffect(() => { loadDay(); }, [loadDay]);
  useEffect(() => { loadRest(); }, [loadRest]);

  const isToday = date === todayStr();
  const failed = dayFailed || restFailed;
  const anyLoading = dayLoading || restLoading;

  // Revenue is not split by cash vs card, but the credit portion IS reported —
  // so the only honest split is "paid up front" vs "sold on credit".
  const dayRevenue = day?.totalRevenue ?? 0;
  const dayCredit = day?.creditSalesAmount ?? 0;
  const dayPaid = Math.max(0, dayRevenue - dayCredit);
  const splitBase = dayRevenue || 1;

  const topProducts = day?.topProducts ?? [];

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader
          title={`Xush kelibsiz, ${user?.fullName ?? ''}!`}
          description={
            <>
              {isToday ? "Bugungi savdo ko'rsatkichlari" : "Savdo ko'rsatkichlari"}{' '}
              {/* The invisible native date input stretched over the chip is what
                  opens the system calendar — works without showPicker() support. */}
              <span className="relative inline-flex items-center gap-1 align-middle rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <CalendarDays className="h-3.5 w-3.5" />
                {uzDayLabel(date)}
                <input
                  type="date"
                  aria-label="Kunni tanlash"
                  value={date}
                  max={todayStr()}
                  onChange={e => e.target.value && setDate(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </span>
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setDate(todayStr())}
                  className="ml-2 align-middle text-xs font-semibold text-primary underline underline-offset-2 press"
                >
                  Bugunga qaytish
                </button>
              )}
            </>
          }
        />

        {failed && !anyLoading && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive font-medium leading-snug">
              Ba'zi ma'lumotlar yuklanmadi — "—" belgisi noldan emas, xatodan.
            </p>
            <Button
              size="sm" variant="outline" className="shrink-0 press"
              onClick={() => { loadDay(); loadRest(); }}
            >
              Qayta urinish
            </Button>
          </div>
        )}

        {dayLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className={cn('shadow-card rounded-2xl', i === 2 && 'col-span-2 md:col-span-1')}>
                <CardContent className="p-4 md:p-5">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-7 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
            <KpiCard
              title={isToday ? 'Bugungi savdo' : 'Savdo'}
              value={day ? formatCurrency(dayRevenue) : '—'}
              icon={<Wallet className="h-4 w-4" />}
              tone="brand"
            />
            <KpiCard
              title={isToday ? 'Bugungi foyda' : 'Foyda'}
              value={day ? formatCurrency(day.totalProfit) : '—'}
              icon={<TrendingUp className="h-4 w-4" />}
              tone={(day?.totalProfit ?? 0) >= 0 ? 'success' : 'destructive'}
            />
            <KpiCard
              title="Buyurtmalar"
              value={day ? String(day.totalOrders) : '—'}
              icon={<ShoppingCart className="h-4 w-4" />}
              className="col-span-2 md:col-span-1"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {isToday ? 'Bugungi savdo taqsimoti' : 'Savdo taqsimoti'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dayLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : !day ? (
                <p className="text-sm text-muted-foreground py-2">Ma'lumot yuklanmadi</p>
              ) : (
                [
                  { label: "To'langan", value: dayPaid, color: 'bg-success' },
                  { label: 'Qarzga sotuv', value: dayCredit, color: 'bg-destructive' },
                ].map(item => {
                  const pct = Math.round((item.value / splitBase) * 100);
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between gap-2 text-xs mb-1">
                        <span className="text-muted-foreground shrink-0">{item.label}</span>
                        <span className="font-medium truncate">
                          {formatCurrency(item.value)} · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Warehouse className="h-4 w-4 text-primary" /> Ombor holati
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {restLoading ? <Skeleton className="h-16 w-full" /> : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mahsulotlar</span>
                    <span className="font-semibold">{inventory ? `${inventory.totalProducts} ta` : '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    {/* The server's low-stock cutoff counts sold-out products too,
                        so this is "kam qolgan yoki tugagan" — the Ombor page,
                        which separates the two, is one tap away. */}
                    <span className="text-muted-foreground">Kam qolgan / tugagan</span>
                    <span className={cn('font-semibold', (inventory?.lowStockCount ?? 0) > 0 && 'text-destructive')}>
                      {inventory ? inventory.lowStockCount : '—'}
                    </span>
                  </div>
                  <Link to="/stock" className="inline-flex items-center min-h-11 text-xs text-primary font-medium press">
                    Omborni ko'rish →
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card mb-6">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" /> Xodimlar savdosi
            </CardTitle>
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              {isToday ? 'Bugun' : uzDayLabel(date)}
            </span>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {dayLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !staffSales ? (
              <p className="text-sm text-muted-foreground py-2">Ma'lumot yuklanmadi</p>
            ) : staffSales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {isToday ? "Bugun sotuv bo'lmagan" : "Bu kunda sotuv bo'lmagan"}
              </p>
            ) : (
              staffSales.map((s, i) => {
                // Bars are relative to today's best seller, so the leader is
                // always full and everyone else reads as "share of the leader".
                const maxRevenue = staffSales[0].totalRevenue || 1;
                const pct = Math.max(2, Math.round((s.totalRevenue / maxRevenue) * 100));
                return (
                  <div key={s.userId} className="flex items-center gap-3">
                    <div className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
                      i === 0 ? 'bg-gradient-primary text-white shadow-md' : 'bg-muted text-muted-foreground',
                    )}>
                      {s.fullName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{s.fullName}</p>
                        <p className="text-sm font-bold shrink-0">{formatCurrency(s.totalRevenue)}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-[11px] text-muted-foreground truncate">
                          {getRoleLabel(s.role)} · {s.totalOrders} ta buyurtma
                        </p>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                        <div
                          className={cn('h-full rounded-full', i === 0 ? 'bg-gradient-primary' : 'bg-primary/50')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Bu hafta</CardTitle></CardHeader>
            <CardContent>
              {restLoading ? <Skeleton className="h-12 w-full" /> : (
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Savdo" value={week ? formatCurrency(week.totalRevenue) : '—'} />
                  <MiniStat label="Foyda" value={week ? formatCurrency(week.totalProfit) : '—'} />
                  <MiniStat label="Buyurtma" value={week ? String(week.totalOrders) : '—'} />
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Bu oy</CardTitle></CardHeader>
            <CardContent>
              {restLoading ? <Skeleton className="h-12 w-full" /> : (
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Savdo" value={month ? formatCurrency(month.totalRevenue) : '—'} />
                  <MiniStat label="Foyda" value={month ? formatCurrency(month.totalProfit) : '—'} />
                  <MiniStat label="Buyurtma" value={month ? String(month.totalOrders) : '—'} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-primary" /> Eng ko'p sotilgan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : !day ? (
                // "Sotuv bo'lmagan" is a claim about the shop's day. When the
                // request failed we know nothing about the shop's day.
                <p className="text-sm text-muted-foreground py-2">Ma'lumot yuklanmadi</p>
              ) : topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {isToday ? "Bugun sotuv bo'lmagan" : "Bu kunda sotuv bo'lmagan"}
                </p>
              ) : (
                topProducts.map((p, i) => (
                  <div key={p.productId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-5 w-5 rounded-md bg-muted text-[11px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate">{p.productName}</span>
                    </div>
                    <span className="font-semibold shrink-0">{p.quantitySold} {getProductUnit(p.productId)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Tezkor navigatsiya</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Yangi savdo', path: '/sell', icon: <ShoppingCart className="h-4 w-4" /> },
                  { label: 'Mahsulotlar', path: '/products', icon: <Package className="h-4 w-4" /> },
                  { label: 'Qarzlar', path: '/debts', icon: <CreditCard className="h-4 w-4" /> },
                  ...(isSuperAdmin ? [{ label: 'Foyda / Zarar', path: '/profit', icon: <TrendingDown className="h-4 w-4" /> }] : []),
                ].map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-2 p-3 min-h-11 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium press"
                  >
                    <span className="text-primary shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">So'nggi buyurtmalar</CardTitle>
            <Link to="/orders" className="text-xs text-primary font-medium shrink-0">Barchasi →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {restLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !recentOrders ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Yuklanmadi</p>
            ) : recentOrders.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Buyurtma yo'q</p>
            ) : (
              <div className="divide-y divide-border">
                {recentOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">#{o.id}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(o.totalAmount)}</p>
                      <Badge variant={paymentBadgeVariant(o.paymentMethod)} className="mt-0.5">
                        {getPaymentMethodLabel(o.paymentMethod)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
