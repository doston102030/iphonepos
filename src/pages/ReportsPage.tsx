import { useState } from 'react';
import { BarChart3, Download, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import {
  reportsApi, totalCost, marginPct,
  type SalesReportResponse, type DailySalesResponse, type UserSalesResponse
} from '@/lib/api';
import { formatCurrency, formatDate, getRoleLabel } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function weekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// ── KPI summary card ──────────────────────────────────────────────────────────
// Only what the server actually reports (plus the two values derivable from it):
// there is no item count and revenue is never split into cash vs card, so those
// cards are gone rather than showing a made-up zero.
function SummaryCard({ data, loading }: { data: SalesReportResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="shadow-card">
            <CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }
  if (!data) return null;

  const items = [
    { label: 'Jami buyurtmalar', value: String(data.totalOrders) },
    { label: 'Jami daromad', value: formatCurrency(data.totalRevenue) },
    { label: 'Sof foyda', value: formatCurrency(data.totalProfit) },
    { label: 'Qarzga sotuv', value: formatCurrency(data.creditSalesAmount) },
    { label: 'Tannarx', value: formatCurrency(totalCost(data)) },
    { label: 'Marja', value: `${marginPct(data)}%` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map(item => (
        <Card key={item.label} className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
            <p className="text-lg font-bold text-foreground">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Top products ──────────────────────────────────────────────────────────────
// topProducts only carries a name and a sold quantity — no revenue, no profit.
function TopProductsCard({ data }: { data: SalesReportResponse | null }) {
  if (!data?.topProducts?.length) return null;

  return (
    <Card className="shadow-card rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Eng ko'p sotilgan mahsulotlar
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <ul className="divide-y divide-border">
          {data.topProducts.map((p, i) => (
            <li key={p.productId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {p.productName}
              </span>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {p.quantitySold} dona
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── Daily tab ─────────────────────────────────────────────────────────────────
function DailyTab() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState<SalesReportResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await reportsApi.daily(date);
      setData(res);
    } catch { toast.error('Hisobot yuklanmadi'); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 sm:flex-none">
          <Label className="text-xs mb-1 block">Sana</Label>
          <Input type="date" className="w-full h-12 rounded-xl sm:w-44 md:h-9" value={date} onChange={e => setDate(e.target.value)} max={today()} />
        </div>
        <Button onClick={load} className="w-full sm:w-auto">
          <Calendar className="h-4 w-4 mr-1.5" />
          Ko'rish
        </Button>
      </div>
      <SummaryCard data={data} loading={loading} />
      {!loading && <TopProductsCard data={data} />}
    </div>
  );
}

// ── Range tab ─────────────────────────────────────────────────────────────────
function RangeTab() {
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<SalesReportResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await reportsApi.range(from, to);
      setData(res);
    } catch { toast.error('Hisobot yuklanmadi'); }
    finally { setLoading(false); }
  }

  async function downloadCsv() {
    const url = reportsApi.exportCsv(from, to);
    const token = localStorage.getItem('token');
    // The export endpoint is authenticated, so it can't be a plain link — fetch
    // it with the bearer token and hand the browser a blob URL instead.
    let objectUrl: string | undefined;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `hisobot-${from}-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error('CSV yuklab olishda xato');
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <div className="min-w-0">
            <Label className="text-xs mb-1 block">Dan</Label>
            <Input type="date" className="w-full h-12 rounded-xl sm:w-44 md:h-9" value={from} onChange={e => setFrom(e.target.value)} max={to || today()} />
          </div>
          <div className="min-w-0">
            <Label className="text-xs mb-1 block">Gacha</Label>
            <Input type="date" className="w-full h-12 rounded-xl sm:w-44 md:h-9" value={to} onChange={e => setTo(e.target.value)} max={today()} />
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={load} className="flex-1 sm:flex-none">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Ko'rish
          </Button>
          {data && (
            <Button variant="outline" onClick={downloadCsv} className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 mr-1.5" />
              CSV
            </Button>
          )}
        </div>
      </div>
      <SummaryCard data={data} loading={loading} />
      {!loading && <TopProductsCard data={data} />}
    </div>
  );
}

// ── Daily breakdown tab ───────────────────────────────────────────────────────
function DailyBreakdownTab() {
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<DailySalesResponse[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await reportsApi.rangeDaily(from, to);
      setData(res);
    } catch { toast.error('Hisobot yuklanmadi'); }
    finally { setLoading(false); }
  }

  // Order count shares no scale with so'm amounts, so it stays out of the bars
  // and lives in the table below instead.
  const chartData = data.map(d => ({
    date: formatDate(d.date),
    Daromad: d.totalRevenue,
    Foyda: d.totalProfit,
  }));

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <div className="min-w-0">
            <Label className="text-xs mb-1 block">Dan</Label>
            <Input type="date" className="w-full h-12 rounded-xl sm:w-44 md:h-9" value={from} onChange={e => setFrom(e.target.value)} max={to || today()} />
          </div>
          <div className="min-w-0">
            <Label className="text-xs mb-1 block">Gacha</Label>
            <Input type="date" className="w-full h-12 rounded-xl sm:w-44 md:h-9" value={to} onChange={e => setTo(e.target.value)} max={today()} />
          </div>
        </div>
        <Button onClick={load} className="w-full sm:w-auto">Ko'rish</Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : data.length > 0 ? (
        <>
          <Card className="shadow-card rounded-2xl">
            <CardContent className="pt-4 pb-2 px-2 md:px-6">
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                    <Bar dataKey="Daromad" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Foyda" fill="hsl(var(--brand))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Sana</TableHead>
                      <TableHead className="whitespace-nowrap">Buyurtmalar</TableHead>
                      <TableHead className="whitespace-nowrap">Daromad</TableHead>
                      <TableHead className="whitespace-nowrap">Foyda</TableHead>
                      <TableHead className="whitespace-nowrap">Qarzga</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map(d => (
                      <TableRow key={d.date}>
                        <TableCell className="whitespace-nowrap">{formatDate(d.date)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{d.totalOrders}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(d.totalRevenue)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(d.totalProfit)}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatCurrency(d.creditSalesAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

// ── By user tab ───────────────────────────────────────────────────────────────
function ByUserTab() {
  const [from, setFrom] = useState(weekAgo());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<UserSalesResponse[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await reportsApi.byUser(from, to);
      setData(res);
    } catch { toast.error('Hisobot yuklanmadi'); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <div className="min-w-0">
            <Label className="text-xs mb-1 block">Dan</Label>
            <Input type="date" className="w-full h-12 rounded-xl sm:w-44 md:h-9" value={from} onChange={e => setFrom(e.target.value)} max={to || today()} />
          </div>
          <div className="min-w-0">
            <Label className="text-xs mb-1 block">Gacha</Label>
            <Input type="date" className="w-full h-12 rounded-xl sm:w-44 md:h-9" value={to} onChange={e => setTo(e.target.value)} max={today()} />
          </div>
        </div>
        <Button onClick={load} className="w-full sm:w-auto">Ko'rish</Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : data.length > 0 ? (
        <Card className="shadow-card rounded-2xl">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Xodim</TableHead>
                    <TableHead className="whitespace-nowrap">Buyurtmalar</TableHead>
                    <TableHead className="whitespace-nowrap">Daromad</TableHead>
                    <TableHead className="whitespace-nowrap">Foyda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(u => (
                    <TableRow key={u.userId}>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-medium">{u.fullName}</span>
                        <span className="block text-xs text-muted-foreground">{getRoleLabel(u.role)}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">{u.totalOrders}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(u.totalRevenue)}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(u.totalProfit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader title="Hisobotlar" description="Savdo statistikasi va tahlil" />
        <Tabs defaultValue="daily">
          {/* Four labels overflow a 375px screen — let the strip scroll. */}
          <div className="-mx-4 px-4 mb-4 overflow-x-auto scrollbar-none md:mx-0 md:px-0">
            <TabsList className="h-11 w-max md:h-9">
              <TabsTrigger value="daily">Kunlik</TabsTrigger>
              <TabsTrigger value="range">Oraliq</TabsTrigger>
              <TabsTrigger value="breakdown">Kunlar bo'yicha</TabsTrigger>
              <TabsTrigger value="byuser">Kassirlar</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="daily"><DailyTab /></TabsContent>
          <TabsContent value="range"><RangeTab /></TabsContent>
          <TabsContent value="breakdown"><DailyBreakdownTab /></TabsContent>
          <TabsContent value="byuser"><ByUserTab /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
