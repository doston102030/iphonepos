import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Package, CreditCard, TrendingUp,
  Warehouse, Wallet, TrendingDown, Percent, Trophy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import {
  reportsApi, ordersApi, inventorySummary, marginPct,
  type SalesReportResponse, type OrderResponse, type PaymentMethod,
  extractContent,
} from '@/lib/api';
import { cn, formatCurrency, formatDateTime, getPaymentMethodLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

/** What inventorySummary() can actually derive — no inventory value exists. */
interface InventoryStats { totalProducts: number; lowStockCount: number }

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthStartStr(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

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
  const [recentOrders, setRecentOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isSuperAdmin } = useAuth();

  useEffect(() => {
    Promise.all([
      reportsApi.daily(),
      reportsApi.range(daysAgoStr(6), todayStr()),
      reportsApi.range(monthStartStr(), todayStr()),
      inventorySummary(),
      ordersApi.getAll(0, 5),
    ]).then(([d, w, m, inv, ordersRes]) => {
      setToday(d); setWeek(w); setMonth(m); setInventory(inv);
      setRecentOrders(extractContent(ordersRes));
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

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

        {loading ? (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-card">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-6 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <KpiCard
              title="Bugungi savdo"
              value={formatCurrency(todayRevenue)}
              icon={<Wallet className="h-4 w-4" />}
              tone="brand"
            />
            <KpiCard
              title="Bugungi foyda"
              value={formatCurrency(today?.totalProfit ?? 0)}
              icon={<TrendingUp className="h-4 w-4" />}
              tone={(today?.totalProfit ?? 0) >= 0 ? 'success' : 'destructive'}
            />
            <KpiCard
              title="Buyurtmalar"
              value={String(today?.totalOrders ?? 0)}
              icon={<ShoppingCart className="h-4 w-4" />}
            />
            <KpiCard
              title="Marja"
              value={`${today ? marginPct(today) : 0}%`}
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
                    <span className="font-semibold">{inventory?.totalProducts ?? 0} dona</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kam qolgan</span>
                    <span className={cn('font-semibold', (inventory?.lowStockCount ?? 0) > 0 && 'text-destructive')}>
                      {inventory?.lowStockCount ?? 0}
                    </span>
                  </div>
                  <Link to="/products" className="inline-flex items-center min-h-11 text-xs text-primary font-medium press">
                    Mahsulotlarni ko'rish →
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
                  <MiniStat label="Savdo" value={formatCurrency(week?.totalRevenue ?? 0)} />
                  <MiniStat label="Foyda" value={formatCurrency(week?.totalProfit ?? 0)} />
                  <MiniStat label="Buyurtma" value={String(week?.totalOrders ?? 0)} />
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Bu oy</CardTitle></CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-12 w-full" /> : (
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Savdo" value={formatCurrency(month?.totalRevenue ?? 0)} />
                  <MiniStat label="Foyda" value={formatCurrency(month?.totalProfit ?? 0)} />
                  <MiniStat label="Buyurtma" value={String(month?.totalOrders ?? 0)} />
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
