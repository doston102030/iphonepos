import React, { useEffect, useState } from 'react';
import {
  ShoppingCart, Package, CreditCard, TrendingUp,
  Target, Warehouse, Wallet, TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import {
  reportsApi, settingsApi, ordersApi,
  type SalesReportResponse, type InventorySummaryResponse, type OrderResponse,
  extractContent,
} from '@/lib/api';
import { cn, formatCurrency, formatDateTime, getPaymentTypeLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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
}: { title: string; value: string; sub?: string; icon: React.ReactNode; tone?: 'default' | 'accent' | 'success' | 'destructive' }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <div className={cn(
            'h-8 w-8 rounded-md flex items-center justify-center shrink-0',
            tone === 'accent' ? 'bg-accent/10 text-accent' :
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

export default function DashboardPage() {
  const [today, setToday] = useState<SalesReportResponse | null>(null);
  const [week, setWeek] = useState<SalesReportResponse | null>(null);
  const [month, setMonth] = useState<SalesReportResponse | null>(null);
  const [inventory, setInventory] = useState<InventorySummaryResponse | null>(null);
  const [monthlyTarget, setMonthlyTarget] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    Promise.all([
      reportsApi.daily(),
      reportsApi.range(daysAgoStr(6), todayStr()),
      reportsApi.range(monthStartStr(), todayStr()),
      reportsApi.inventorySummary(),
      settingsApi.get(),
      ordersApi.getAll(0, 5),
    ]).then(([d, w, m, inv, settings, ordersRes]) => {
      setToday(d); setWeek(w); setMonth(m); setInventory(inv);
      setMonthlyTarget(settings.monthlyTarget ?? 0);
      setRecentOrders(extractContent(ordersRes));
    }).catch(() => null).finally(() => setLoading(false));
  }, []);

  const targetPct = monthlyTarget > 0
    ? Math.min(100, Math.round(((month?.totalRevenue ?? 0) / monthlyTarget) * 100))
    : 0;

  const paymentBadgeVariant = (type: string): 'default' | 'secondary' | 'destructive' => {
    if (type === 'CASH') return 'default';
    if (type === 'CARD') return 'secondary';
    return 'destructive';
  };

  return (
    <MainLayout>
      <div className="p-6">
        <PageHeader
          title={`Xush kelibsiz, ${user?.username ?? ''}!`}
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
              value={formatCurrency(today?.totalRevenue ?? 0)}
              icon={<Wallet className="h-4 w-4" />}
              tone="accent"
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
              title="Sotilgan mahsulot"
              value={String(today?.totalItems ?? 0)}
              icon={<Package className="h-4 w-4" />}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" /> Oylik maqsad
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : monthlyTarget > 0 ? (
                <>
                  <div className="flex items-end justify-between mb-2 gap-2">
                    <span className="text-2xl font-bold text-foreground truncate">{formatCurrency(month?.totalRevenue ?? 0)}</span>
                    <span className="text-sm text-muted-foreground shrink-0">/ {formatCurrency(monthlyTarget)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', targetPct >= 100 ? 'bg-success' : 'bg-primary')}
                      style={{ width: `${targetPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {targetPct}% bajarildi · Bu oy sof foyda: {formatCurrency(month?.totalProfit ?? 0)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Oylik maqsad belgilanmagan. <a href="/settings" className="text-primary font-medium">Sozlamalarga o'tish</a>
                </p>
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
                    <span className="font-semibold">{inventory?.totalProducts ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kam qolgan</span>
                    <span className={cn('font-semibold', (inventory?.lowStockCount ?? 0) > 0 && 'text-destructive')}>
                      {inventory?.lowStockCount ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ombor qiymati</span>
                    <span className="font-semibold">{formatCurrency(inventory?.inventoryValue ?? 0)}</span>
                  </div>
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
              <CardTitle className="text-sm font-semibold">Bugungi to'lov turlari</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  {[
                    { label: 'Naqd', value: today?.cashAmount ?? 0, color: 'bg-primary' },
                    { label: 'Karta', value: today?.cardAmount ?? 0, color: 'bg-accent' },
                    { label: 'Qarz', value: today?.debtAmount ?? 0, color: 'bg-destructive' },
                  ].map(item => {
                    const total = (today?.totalRevenue ?? 0) || 1;
                    const pct = Math.round((item.value / total) * 100);
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
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
                  ...(isAdmin ? [{ label: 'Foyda / Zarar', path: '/profit', icon: <TrendingDown className="h-4 w-4" /> }] : []),
                ].map(item => (
                  <a
                    key={item.path}
                    href={item.path}
                    className="flex items-center gap-2 p-3 rounded-md border border-border hover:bg-muted transition-colors text-sm font-medium"
                  >
                    <span className="text-primary">{item.icon}</span>
                    {item.label}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">So'nggi buyurtmalar</CardTitle>
            <a href="/orders" className="text-xs text-primary font-medium">Barchasi →</a>
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
                      <p className="text-sm font-medium truncate">#{o.id} · {o.cashierName}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(o.totalPrice)}</p>
                      <Badge variant={paymentBadgeVariant(o.paymentType)} className="mt-0.5">
                        {getPaymentTypeLabel(o.paymentType)}
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
