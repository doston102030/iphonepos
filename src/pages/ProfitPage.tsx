import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Wallet, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  reportsApi, type SalesReportResponse, type DailySalesResponse, type ProfitByProductResponse,
} from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type Period = 'today' | 'week' | 'month' | 'range';

function rangeFor(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  if (period === 'today') return { from: todayStr(), to: todayStr() };
  if (period === 'week') return { from: daysAgoStr(6), to: todayStr() };
  if (period === 'month') return { from: daysAgoStr(29), to: todayStr() };
  return { from: customFrom, to: customTo };
}

function KpiCard({
  title, value, sub, icon, tone = 'default',
}: { title: string; value: string; sub?: string; icon: React.ReactNode; tone?: 'default' | 'success' | 'destructive' }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <span className={cn(
            'h-7 w-7 rounded-md flex items-center justify-center shrink-0',
            tone === 'success' ? 'bg-success/10 text-success' :
            tone === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
          )}>
            {icon}
          </span>
        </div>
        <p className="text-lg font-bold text-foreground truncate">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function ProfitPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState(daysAgoStr(6));
  const [customTo, setCustomTo] = useState(todayStr());
  const [summary, setSummary] = useState<SalesReportResponse | null>(null);
  const [daily, setDaily] = useState<DailySalesResponse[]>([]);
  const [byProduct, setByProduct] = useState<ProfitByProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    const { from, to } = rangeFor(period, customFrom, customTo);
    if (!from || !to) return;
    setLoading(true);
    try {
      const [s, d, p] = await Promise.all([
        reportsApi.range(from, to),
        reportsApi.rangeDaily(from, to),
        reportsApi.profitByProduct(from, to),
      ]);
      setSummary(s); setDaily(d); setByProduct(p);
    } catch {
      toast.error('Foyda hisoboti yuklanmadi');
    } finally { setLoading(false); }
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  const marginPct = summary && summary.totalRevenue > 0
    ? Math.round((summary.totalProfit / summary.totalRevenue) * 1000) / 10 : 0;

  const chartData = daily.map(d => ({
    date: formatDate(d.date),
    Daromad: d.totalRevenue,
    Foyda: d.totalProfit,
  }));

  return (
    <MainLayout>
      <div className="p-6">
        <PageHeader title="Foyda / Zarar" description="Tannarx va sotish narxi asosida foyda tahlili" />

        <Tabs value={period} onValueChange={v => setPeriod(v as Period)} className="mb-4">
          <TabsList>
            <TabsTrigger value="today">Bugun</TabsTrigger>
            <TabsTrigger value="week">Hafta</TabsTrigger>
            <TabsTrigger value="month">Oy</TabsTrigger>
            <TabsTrigger value="range">Oraliq</TabsTrigger>
          </TabsList>
          <TabsContent value="range">
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <div>
                <Label className="text-xs mb-1 block">Dan</Label>
                <Input type="date" className="w-44" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Gacha</Label>
                <Input type="date" className="w-44" value={customTo} onChange={e => setCustomTo(e.target.value)} max={todayStr()} />
              </div>
              <Button size="sm" onClick={load}>Ko'rish</Button>
            </div>
          </TabsContent>
        </Tabs>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-card"><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard title="Jami savdo" value={formatCurrency(summary?.totalRevenue ?? 0)} icon={<Wallet className="h-3.5 w-3.5" />} />
            <KpiCard title="Tannarx" value={formatCurrency(summary?.totalCost ?? 0)} icon={<TrendingDown className="h-3.5 w-3.5" />} />
            <KpiCard
              title="Sof foyda" value={formatCurrency(summary?.totalProfit ?? 0)}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              tone={(summary?.totalProfit ?? 0) >= 0 ? 'success' : 'destructive'}
            />
            <KpiCard
              title="Marja" value={`${marginPct}%`} sub={`${summary?.totalOrders ?? 0} ta buyurtma`}
              icon={<Percent className="h-3.5 w-3.5" />}
              tone={marginPct >= 0 ? 'success' : 'destructive'}
            />
          </div>
        )}

        {loading ? (
          <Skeleton className="h-64 w-full mb-6" />
        ) : chartData.length > 0 && (
          <Card className="shadow-card mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Kunlar bo'yicha daromad va foyda</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-2">
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                    <Bar dataKey="Daromad" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Foyda" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Mahsulotlar bo'yicha foyda</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : byProduct.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Ma'lumot yo'q</p>
            ) : isMobile ? (
              <div className="divide-y divide-border">
                {byProduct.map(p => (
                  <div key={p.productId} className="p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold truncate">{p.productName}</p>
                      <span className={cn('text-sm font-bold shrink-0', p.profit >= 0 ? 'text-success' : 'text-destructive')}>
                        {formatCurrency(p.profit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{p.quantitySold} dona sotildi</span>
                      <span>Marja: {p.marginPct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Mahsulot</TableHead>
                      <TableHead className="whitespace-nowrap">Sotilgan</TableHead>
                      <TableHead className="whitespace-nowrap">Daromad</TableHead>
                      <TableHead className="whitespace-nowrap">Tannarx</TableHead>
                      <TableHead className="whitespace-nowrap">Foyda</TableHead>
                      <TableHead className="whitespace-nowrap">Marja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byProduct.map(p => (
                      <TableRow key={p.productId}>
                        <TableCell className="whitespace-nowrap font-medium">{p.productName}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.quantitySold}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatCurrency(p.revenue)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatCurrency(p.cost)}</TableCell>
                        <TableCell className={cn('whitespace-nowrap font-semibold', p.profit >= 0 ? 'text-success' : 'text-destructive')}>
                          {formatCurrency(p.profit)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{p.marginPct}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
