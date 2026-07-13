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
  reportsApi, totalCost, marginPct,
  type SalesReportResponse, type DailySalesResponse,
} from '@/lib/api';
import {
  formatCurrency, formatDate, cn, todayStr, daysAgoStr,
} from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

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
    <Card className="shadow-card rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs text-muted-foreground font-medium leading-tight">{title}</p>
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
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    const { from, to } = rangeFor(period, customFrom, customTo);
    if (!from || !to) return;
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        reportsApi.range(from, to),
        reportsApi.rangeDaily(from, to),
      ]);
      setSummary(s); setDaily(d);
    } catch {
      toast.error('Foyda hisoboti yuklanmadi');
    } finally { setLoading(false); }
  }, [period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  // Tannarx va marja server tomonidan yuborilmaydi — daromad/foydadan hisoblanadi.
  const cost = summary ? totalCost(summary) : 0;
  const margin = summary ? marginPct(summary) : 0;
  const topProducts = summary?.topProducts ?? [];

  const chartData = daily.map(d => ({
    date: formatDate(d.date),
    Daromad: d.totalRevenue,
    Foyda: d.totalProfit,
  }));

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader title="Foyda / Zarar" description="Tannarx va sotish narxi asosida foyda tahlili" />

        <Tabs value={period} onValueChange={v => setPeriod(v as Period)} className="mb-4">
          <TabsList className="grid grid-cols-4 w-full h-11 md:inline-flex md:w-auto md:h-9">
            <TabsTrigger value="today">Bugun</TabsTrigger>
            <TabsTrigger value="week">Hafta</TabsTrigger>
            <TabsTrigger value="month">Oy</TabsTrigger>
            <TabsTrigger value="range">Oraliq</TabsTrigger>
          </TabsList>
          <TabsContent value="range">
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
                <div className="min-w-0">
                  <Label className="text-xs mb-1 block">Dan</Label>
                  <Input type="date" className="w-full h-12 rounded-xl sm:w-44 md:h-9" value={customFrom} onChange={e => setCustomFrom(e.target.value)} max={customTo || todayStr()} />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs mb-1 block">Gacha</Label>
                  <Input type="date" className="w-full h-12 rounded-xl sm:w-44 md:h-9" value={customTo} onChange={e => setCustomTo(e.target.value)} max={todayStr()} />
                </div>
              </div>
              <Button onClick={load} className="w-full sm:w-auto">Ko'rish</Button>
            </div>
          </TabsContent>
        </Tabs>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-card rounded-2xl"><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            <KpiCard title="Jami savdo" value={formatCurrency(summary?.totalRevenue ?? 0)} icon={<Wallet className="h-3.5 w-3.5" />} />
            <KpiCard title="Tannarx" value={formatCurrency(cost)} icon={<TrendingDown className="h-3.5 w-3.5" />} />
            <KpiCard
              title="Sof foyda" value={formatCurrency(summary?.totalProfit ?? 0)}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              tone={(summary?.totalProfit ?? 0) >= 0 ? 'success' : 'destructive'}
            />
            <KpiCard
              title="Marja" value={`${margin}%`} sub={`${summary?.totalOrders ?? 0} ta buyurtma`}
              icon={<Percent className="h-3.5 w-3.5" />}
              tone={margin >= 0 ? 'success' : 'destructive'}
            />
          </div>
        )}

        {loading ? (
          <Skeleton className="h-64 w-full mb-6 rounded-2xl" />
        ) : chartData.length > 0 && (
          <Card className="shadow-card mb-6 rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Kunlar bo'yicha daromad va foyda</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-2 px-2 md:px-6">
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

        <Card className="shadow-card rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Eng ko'p sotilgan mahsulotlar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : topProducts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Ma'lumot yo'q</p>
            ) : isMobile ? (
              <div className="divide-y divide-border">
                {topProducts.map((p, i) => (
                  <div key={p.productId} className="p-3.5 flex items-center gap-3">
                    <span className="h-7 w-7 shrink-0 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold truncate flex-1 min-w-0">{p.productName}</p>
                    <span className="text-sm font-bold shrink-0">{p.quantitySold} dona</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap w-12">#</TableHead>
                      <TableHead className="whitespace-nowrap">Mahsulot</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Sotilgan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map((p, i) => (
                      <TableRow key={p.productId}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">{p.productName}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-semibold">{p.quantitySold} dona</TableCell>
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
