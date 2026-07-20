import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Package, CreditCard, TrendingUp, BarChart3,
  Warehouse, Wallet, TrendingDown, Trophy, AlertTriangle, Users, CalendarDays,
} from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import {
  reportsApi, ordersApi, inventorySummary,
  type SalesReportResponse, type DailySalesResponse, type OrderResponse,
  type PaymentMethod, type UserSalesResponse,
  extractContent,
} from '@/lib/api';
import {
  cn, formatCurrency, formatDateTime, getPaymentMethodLabel, getRoleLabel,
  todayStr, daysAgoStr, uzDayLabel, uzRangeLabel,
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

/** Y-axis money in a couple of glyphs: 1 500 000 → "1.5M", 40 000 → "40k". */
function compactSum(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

interface TrendPoint { date: string; day: number; revenue: number; orders: number }

function TrendTooltip({ active, payload }: {
  active?: boolean; payload?: ReadonlyArray<{ payload: TrendPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-card">
      <p className="text-[11px] font-medium text-muted-foreground">{uzDayLabel(p.date)}</p>
      <p className="text-sm font-bold text-foreground">{formatCurrency(p.revenue)}</p>
      <p className="text-[11px] text-muted-foreground">{p.orders} ta buyurtma</p>
    </div>
  );
}

/**
 * The week in one card: the takings LEAD as the hero number, profit/orders sit
 * in the two labeled tiles the old period cards taught, and a 7-day revenue
 * bar chart shows the shape of the week. One series, so the card title is the
 * legend; today's bar is solid, past days sit back at 45%.
 */
function WeekAnalyticsCard({ report, allTime, days, loading }: {
  report: SalesReportResponse | null; allTime: SalesReportResponse | null;
  days: DailySalesResponse[] | null; loading: boolean;
}) {
  const today = todayStr();
  const profit = report?.totalProfit ?? 0;
  const profitUp = profit >= 0;
  // The server omits days with no sales — chart over a full local 7-day
  // scaffold so the week always shows seven bars in calendar order.
  const points: TrendPoint[] = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgoStr(6 - i);
    const d = days?.find(x => x.date === date);
    return {
      date,
      day: new Date(`${date}T00:00:00`).getDate(),
      revenue: d?.totalRevenue ?? 0,
      orders: d?.totalOrders ?? 0,
    };
  });

  return (
    <Card className="shadow-card">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BarChart3 className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold truncate">Savdo analitikasi</p>
          </div>
          <span className="text-[11px] text-muted-foreground font-semibold shrink-0">
            {uzRangeLabel(daysAgoStr(6), today)}
          </span>
        </div>
        {loading ? (
          <>
            <Skeleton className="h-8 w-36 mt-4 mb-3" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground font-medium mt-3.5">7 kunlik savdo</p>
            <p className="kpi-number text-foreground break-words mt-0.5">
              {report ? formatCurrency(report.totalRevenue) : '—'}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="col-span-2 rounded-xl bg-primary/10 px-3 py-2.5">
                <p className="text-[11px] font-medium text-primary/80">Jami savdo (umumiy)</p>
                <p className="text-sm font-bold text-primary break-words">
                  {allTime ? formatCurrency(allTime.totalRevenue) : '—'}
                </p>
              </div>
              <div className={cn('rounded-xl px-3 py-2.5', profitUp ? 'bg-success/10' : 'bg-destructive/10')}>
                <p className={cn('text-[11px] font-medium', profitUp ? 'text-success/80' : 'text-destructive/80')}>
                  Sof foyda
                </p>
                <p className={cn('text-sm font-bold break-words', profitUp ? 'text-success' : 'text-destructive')}>
                  {report ? formatCurrency(profit) : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                <p className="text-[11px] font-medium text-muted-foreground">Buyurtmalar</p>
                <p className="text-sm font-bold text-foreground">
                  {report ? `${report.totalOrders} ta` : '—'}
                </p>
              </div>
            </div>
            {!days ? (
              <p className="text-sm text-muted-foreground pt-4">Grafik yuklanmadi</p>
            ) : (
              <div className="mt-4 -ml-2 w-[calc(100%+0.5rem)] min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="day" tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      width={36} tickLine={false} axisLine={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={compactSum}
                      allowDecimals={false}
                      // An empty week auto-scales to 0–4 and the axis reads as
                      // broken; pin a money-shaped scale until real sales exist.
                      domain={[0, (dataMax: number) => (dataMax > 0 ? dataMax : 1_000_000)]}
                    />
                    <Tooltip content={<TrendTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={26}>
                      {points.map(p => (
                        <Cell
                          key={p.date}
                          fill={p.date === today ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.45)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <Link to="/reports" className="inline-flex items-center min-h-11 text-xs text-primary font-medium press">
              Batafsil hisobot →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
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
  const [allTime, setAllTime] = useState<SalesReportResponse | null>(null);
  const [weekDays, setWeekDays] = useState<DailySalesResponse[] | null>(null);
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
  // Flipping between two dates fires two requests; if the older one lands
  // last, its KPIs would sit under the newer date chip. Latest request only.
  const daySeq = useRef(0);
  const loadDay = useCallback(async () => {
    const seq = ++daySeq.current;
    setDayLoading(true);
    // daily() without a date lets the SERVER pick "today", and its clock may
    // sit on the other side of midnight from the shop's — so the KPI cards and
    // the per-cashier list below could describe two different days. One
    // explicit local date keeps everything on this screen on the same day.
    const [d, staff] = await Promise.allSettled([
      reportsApi.daily(date),
      reportsApi.byUser(date, date),
    ]);
    if (seq !== daySeq.current) return;

    setDay(d.status === 'fulfilled' ? d.value : null);
    setStaffSales(staff.status === 'fulfilled'
      ? [...staff.value].sort((a, b) => b.totalRevenue - a.totalRevenue)
      : null);
    setDayFailed([d, staff].some(r => r.status === 'rejected'));
    setDayLoading(false);
  }, [date]);

  const loadRest = useCallback(async () => {
    setRestLoading(true);
    const [w, all, wd, inv, ord] = await Promise.allSettled([
      reportsApi.range(daysAgoStr(6), todayStr()),
      // "Jami savdo" — the whole book. No dedicated endpoint, so the range one
      // is asked from far before the shop existed up to today.
      reportsApi.range('2020-01-01', todayStr()),
      reportsApi.rangeDaily(daysAgoStr(6), todayStr()),
      inventorySummary(),
      ordersApi.getAll(0, 5),
    ]);

    setWeek(w.status === 'fulfilled' ? w.value : null);
    setAllTime(all.status === 'fulfilled' ? all.value : null);
    setWeekDays(wd.status === 'fulfilled' ? wd.value : null);
    setInventory(inv.status === 'fulfilled' ? inv.value : null);
    setRecentOrders(ord.status === 'fulfilled' ? extractContent(ord.value) : null);
    setRestFailed([w, all, wd, inv, ord].some(r => r.status === 'rejected'));
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
            <CardContent>
              {restLoading ? <Skeleton className="h-16 w-full" /> : (
                <>
                  {/* Same labeled tiles as the week/month cards, so the whole
                      dashboard speaks one visual language. */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-muted-foreground">Mahsulotlar</p>
                      <p className="text-sm font-bold text-foreground">{inventory ? `${inventory.totalProducts} ta` : '—'}</p>
                    </div>
                    {/* The server's low-stock cutoff counts sold-out products too,
                        so this is "kam qolgan yoki tugagan" — the Ombor page,
                        which separates the two, is one tap away. */}
                    <div className={cn(
                      'rounded-xl px-3 py-2.5',
                      (inventory?.lowStockCount ?? 0) > 0 ? 'bg-destructive/10' : 'bg-muted/60',
                    )}>
                      <p className={cn(
                        'text-[11px] font-medium',
                        (inventory?.lowStockCount ?? 0) > 0 ? 'text-destructive/80' : 'text-muted-foreground',
                      )}>
                        Kam / tugagan
                      </p>
                      <p className={cn(
                        'text-sm font-bold text-foreground',
                        (inventory?.lowStockCount ?? 0) > 0 && 'text-destructive',
                      )}>
                        {inventory ? `${inventory.lowStockCount} ta` : '—'}
                      </p>
                    </div>
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
                      i === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
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
                          className={cn('h-full rounded-full', i === 0 ? 'bg-primary' : 'bg-primary/50')}
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

        <div className="mb-6">
          <WeekAnalyticsCard report={week} allTime={allTime} days={weekDays} loading={restLoading} />
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
