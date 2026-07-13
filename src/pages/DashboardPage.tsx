import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Package, CreditCard, TrendingUp,
  Warehouse, Wallet, TrendingDown, Percent, Trophy, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import {
  reportsApi, ordersApi, inventorySummary, marginPct,
  type SalesReportResponse, type OrderResponse, type PaymentMethod,
  extractContent,
} from '@/lib/api';
import {
  cn, formatCurrency, formatDateTime, getPaymentMethodLabel,
  todayStr, daysAgoStr, monthStartStr,
} from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

/** What inventorySummary() can actually derive — no inventory value exists. */
interface InventoryStats { totalProducts: number; lowStockCount: number }


function KpiCard({
  title, value, sub, icon, tone = 'default',
}: { title: string; value: string; sub?: string; icon: React.ReactNode; tone?: 'default' | 'brand' | 'success' | 'destructive' }) {
  return (
    <Card className="shadow-card rounded-2xl">
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
  const [today, setToday] = useState<SalesReportResponse | null>(null);
  const [week, setWeek] = useState<SalesReportResponse | null>(null);
  const [month, setMonth] = useState<SalesReportResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { user, isSuperAdmin } = useAuth();

  // allSettled, not all: one dead endpoint used to reject the whole batch, and
  // the `.catch(() => null)` under it left every card rendering a confident 0 —
  // a cashier could not tell "sotuv bo'lmadi" from "server javob bermadi".
  // Whatever does load is shown; whatever fails shows "—" and says so.
  const load = useCallback(async () => {
    setLoading(true);
    const [d, w, m, inv, ord] = await Promise.allSettled([
      reportsApi.daily(),
      reportsApi.range(daysAgoStr(6), todayStr()),
      reportsApi.range(monthStartStr(), todayStr()),
      inventorySummary(),
      ordersApi.getAll(0, 5),
    ]);

    setToday(d.status === 'fulfilled' ? d.value : null);
    setWeek(w.status === 'fulfilled' ? w.value : null);
    setMonth(m.status === 'fulfilled' ? m.value : null);
    setInventory(inv.status === 'fulfilled' ? inv.value : null);
    setRecentOrders(ord.status === 'fulfilled' ? extractContent(ord.value) : null);
    setFailed([d, w, m, inv, ord].some(r => r.status === 'rejected'));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Revenue is not split by cash vs card, but the credit portion IS reported —
  // so the only honest split is "paid up front" vs "sold on credit".
  const todayRevenue = today?.totalRevenue ?? 0;
  const todayCredit = today?.creditSalesAmount ?? 0;
  const todayPaid = Math.max(0, todayRevenue - todayCredit);
  const splitBase = todayRevenue || 1;

  const topProducts = today?.topProducts ?? [];

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader
          title={`Xush kelibsiz, ${user?.fullName ?? ''}!`}
          description="Bugungi savdo ko'rsatkichlari"
        />

        {failed && !loading && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive font-medium leading-snug">
              Ba'zi ma'lumotlar yuklanmadi — "—" belgisi noldan emas, xatodan.
            </p>
            <Button size="sm" variant="outline" className="shrink-0 press" onClick={load}>
              Qayta urinish
            </Button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-card rounded-2xl">
                <CardContent className="p-4 md:p-5">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-7 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <KpiCard
              title="Bugungi savdo"
              value={today ? formatCurrency(todayRevenue) : '—'}
              icon={<Wallet className="h-4 w-4" />}
              tone="brand"
            />
            <KpiCard
              title="Bugungi foyda"
              value={today ? formatCurrency(today.totalProfit) : '—'}
              icon={<TrendingUp className="h-4 w-4" />}
              tone={(today?.totalProfit ?? 0) >= 0 ? 'success' : 'destructive'}
            />
            <KpiCard
              title="Buyurtmalar"
              value={today ? String(today.totalOrders) : '—'}
              icon={<ShoppingCart className="h-4 w-4" />}
            />
            <KpiCard
              title="Marja"
              value={today ? `${marginPct(today)}%` : '—'}
              icon={<Percent className="h-4 w-4" />}
              tone={today && marginPct(today) >= 0 ? 'success' : 'destructive'}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Bugungi savdo taqsimoti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : !today ? (
                <p className="text-sm text-muted-foreground py-2">Ma'lumot yuklanmadi</p>
              ) : (
                [
                  { label: "To'langan", value: todayPaid, color: 'bg-success' },
                  { label: 'Qarzga sotuv', value: todayCredit, color: 'bg-destructive' },
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
              {loading ? <Skeleton className="h-16 w-full" /> : (
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Bu hafta</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-12 w-full" /> : (
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
              {loading ? <Skeleton className="h-12 w-full" /> : (
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
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : !today ? (
                // "Bugun sotuv bo'lmagan" is a claim about the shop's day. When
                // the request failed we know nothing about the shop's day.
                <p className="text-sm text-muted-foreground py-2">Ma'lumot yuklanmadi</p>
              ) : topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Bugun sotuv bo'lmagan</p>
              ) : (
                topProducts.map((p, i) => (
                  <div key={p.productId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-5 w-5 rounded-md bg-muted text-[11px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate">{p.productName}</span>
                    </div>
                    <span className="font-semibold shrink-0">{p.quantitySold} dona</span>
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
            {loading ? (
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
