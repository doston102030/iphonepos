import React, { useState } from 'react';
import { BarChart3, Download, Calendar } from 'lucide-react';
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
  reportsApi,
  type SalesReportResponse, type DailySalesResponse, type UserSalesResponse
} from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
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
    { label: 'Sotilgan mahsulotlar', value: String(data.totalItems) },
    { label: 'Naqd pul', value: formatCurrency(data.cashAmount) },
    { label: 'Karta', value: formatCurrency(data.cardAmount) },
    { label: 'Qarz', value: formatCurrency(data.debtAmount) },
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
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs mb-1 block">Sana</Label>
          <Input type="date" className="w-44" value={date} onChange={e => setDate(e.target.value)} max={today()} />
        </div>
        <Button onClick={load} size="sm">
          <Calendar className="h-4 w-4 mr-1.5" />
          Ko'rish
        </Button>
      </div>
      <SummaryCard data={data} loading={loading} />
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

  function downloadCsv() {
    const url = reportsApi.exportCsv(from, to);
    const token = localStorage.getItem('token');
    // Open with token in URL won't work for auth — construct a fetch-download
    fetch(url, { headers: { Authorization: `Bearer ${token ?? ''}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `hisobot-${from}-${to}.csv`;
        a.click();
      })
      .catch(() => toast.error('CSV yuklab olishda xato'));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs mb-1 block">Dan</Label>
          <Input type="date" className="w-44" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Gacha</Label>
          <Input type="date" className="w-44" value={to} onChange={e => setTo(e.target.value)} max={today()} />
        </div>
        <Button onClick={load} size="sm">
          <BarChart3 className="h-4 w-4 mr-1.5" />
          Ko'rish
        </Button>
        {data && (
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
        )}
      </div>
      <SummaryCard data={data} loading={loading} />
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

  const chartData = data.map(d => ({
    date: formatDate(d.date),
    Daromad: d.totalRevenue,
    Buyurtmalar: d.totalOrders,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs mb-1 block">Dan</Label>
          <Input type="date" className="w-44" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Gacha</Label>
          <Input type="date" className="w-44" value={to} onChange={e => setTo(e.target.value)} max={today()} />
        </div>
        <Button onClick={load} size="sm">Ko'rish</Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : data.length > 0 ? (
        <>
          <Card className="shadow-card">
            <CardContent className="pt-4 pb-2">
              <div className="w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend layout="horizontal" wrapperStyle={{ paddingTop: 8 }} />
                    <Bar dataKey="Daromad" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Buyurtmalar" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map(d => (
                      <TableRow key={d.date}>
                        <TableCell className="whitespace-nowrap">{formatDate(d.date)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{d.totalOrders}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(d.totalRevenue)}</TableCell>
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
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs mb-1 block">Dan</Label>
          <Input type="date" className="w-44" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Gacha</Label>
          <Input type="date" className="w-44" value={to} onChange={e => setTo(e.target.value)} max={today()} />
        </div>
        <Button onClick={load} size="sm">Ko'rish</Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : data.length > 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Kassir</TableHead>
                    <TableHead className="whitespace-nowrap">Buyurtmalar</TableHead>
                    <TableHead className="whitespace-nowrap">Daromad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(u => (
                    <TableRow key={u.username}>
                      <TableCell className="whitespace-nowrap font-medium">{u.username}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">{u.totalOrders}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(u.totalRevenue)}</TableCell>
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
      <div className="p-6">
        <PageHeader title="Hisobotlar" description="Savdo statistikasi va tahlil" />
        <Tabs defaultValue="daily">
          <TabsList className="mb-4">
            <TabsTrigger value="daily">Kunlik</TabsTrigger>
            <TabsTrigger value="range">Oraliq</TabsTrigger>
            <TabsTrigger value="breakdown">Kunlar bo'yicha</TabsTrigger>
            <TabsTrigger value="byuser">Kassirlar</TabsTrigger>
          </TabsList>
          <TabsContent value="daily"><DailyTab /></TabsContent>
          <TabsContent value="range"><RangeTab /></TabsContent>
          <TabsContent value="breakdown"><DailyBreakdownTab /></TabsContent>
          <TabsContent value="byuser"><ByUserTab /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
