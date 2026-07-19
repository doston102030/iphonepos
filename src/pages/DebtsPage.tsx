import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, DollarSign, Search, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { notify } from '@/lib/notify';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { PaginationControls } from '@/components/common/PaginationControls';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import { NumericKeypad } from '@/components/common/NumericKeypad';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  debtsApi, remainingAmount, fetchAllPages,
  type DebtRequest, type DebtResponse, type DebtPaymentResponse, type DebtStatus,
} from '@/lib/api';
import { cn, formatCurrency, formatDateTime, getDebtStatusLabel } from '@/lib/utils';

// Per the API contract only customerName + amount are required; phone is optional.
const debtSchema = z.object({
  customerName: z.string().min(1, 'Mijoz ismi kiritilishi shart'),
  phone: z.string().optional(),
  amount: z.coerce.number().min(1, 'Summa 0 dan katta bo\'lishi kerak'),
});

type DebtForm = z.infer<typeof debtSchema>;

function DebtDialog({
  open, onOpenChange, debt, onSaved
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  debt: DebtResponse | null; onSaved: () => void;
}) {
  const form = useForm<DebtForm>({
    resolver: zodResolver(debtSchema),
    defaultValues: { customerName: '', phone: '', amount: 0 },
  });

  useEffect(() => {
    if (debt) {
      form.reset({
        customerName: debt.customerName,
        phone: debt.phone ?? '',
        amount: debt.amount,
      });
    } else {
      form.reset({ customerName: '', phone: '', amount: 0 });
    }
  }, [debt, open, form]);

  async function onSubmit(values: DebtForm) {
    const phone = values.phone?.trim();
    const payload: DebtRequest = {
      customerName: values.customerName.trim(),
      amount: values.amount,
      ...(phone ? { phone } : {}),
      ...(debt?.orderId !== undefined ? { orderId: debt.orderId } : {}),
    };
    try {
      if (debt) {
        await debtsApi.update(debt.id, payload);
        notify.success('Qarz yangilandi');
      } else {
        await debtsApi.create(payload);
        notify.success('Qarz yaratildi');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title={debt ? 'Qarzni tahrirlash' : 'Yangi qarz'}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-5 h-full flex flex-col">
          <FormField control={form.control} name="customerName" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-muted-foreground">Mijoz ismi</FormLabel>
              <FormControl><Input className="h-14 bg-muted/30 border-border/50 shadow-sm rounded-2xl text-lg px-4" placeholder="Masalan: Alisher" {...field} autoComplete="off" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-muted-foreground">Telefon raqami (ixtiyoriy)</FormLabel>
              <FormControl>
                <Input
                  className="h-14 bg-muted/30 border-border/50 shadow-sm rounded-2xl text-lg px-4"
                  type="tel" inputMode="tel" placeholder="+998901234567"
                  {...field} value={field.value ?? ''} autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-muted-foreground">Qarz summasi</FormLabel>
              <FormControl>
                <Input
                  className="h-14 bg-muted/30 border-border/50 shadow-sm rounded-2xl text-lg px-4 font-bold"
                  type="number" inputMode="numeric" min={0} placeholder="0"
                  {...field}
                  value={field.value === 0 || field.value === undefined ? '' : field.value}
                  onChange={e => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="mt-auto pt-6 pb-8">
            <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/25" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </form>
      </Form>
    </MobileOverlay>
  );
}

function PayDialog({
  open, onOpenChange, debt, onSaved
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  debt: DebtResponse | null; onSaved: () => void;
}) {
  const [amountStr, setAmountStr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAmountStr('');
  }, [open, debt]);

  async function handlePay() {
    if (!debt) return;
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      notify.error('Summani to\'g\'ri kiriting');
      return;
    }
    if (amount > remainingAmount(debt)) {
      notify.error(`Qolgan summa: ${formatCurrency(remainingAmount(debt))}`);
      return;
    }
    setLoading(true);
    try {
      await debtsApi.pay(debt.id, { amount });
      notify.success("To'lov amalga oshirildi");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  if (!debt) return null;

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title="To'lov">
      <div className="flex flex-col h-full bg-background">
        <div className="px-6 py-4 pb-2 text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-1">To'lovni qayd etish</h2>
          <p className="text-destructive font-semibold">Qolgan qarz: {formatCurrency(remainingAmount(debt))}</p>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 py-4 shrink-0 min-h-[150px]">
          <p className="text-sm text-muted-foreground mb-3 text-center">To'lov miqdori (so'm)</p>
          <div className="flex items-center justify-center gap-1.5 border-b-2 border-border/50 pb-2 bg-muted/30 p-4 rounded-3xl mx-4">
            <span className="text-4xl font-bold tracking-tighter text-foreground truncate">
              {amountStr === '' ? '0' : parseInt(amountStr, 10).toLocaleString('ru-RU')}
            </span>
            <span className="text-lg text-muted-foreground font-medium">so'm</span>
          </div>
        </div>

        <div className="px-3 pb-6 mt-auto">
          <Button 
            className="w-full h-14 rounded-2xl text-xl font-bold bg-success hover:bg-success/90 shadow-lg shadow-success/25 mb-4 mx-1" 
            onClick={handlePay} 
            disabled={loading || amountStr === '' || parseInt(amountStr, 10) <= 0}
          >
            {loading ? "Jarayonda..." : "To'lash"}
          </Button>
          
          <NumericKeypad 
            value={amountStr} 
            onChange={setAmountStr} 
            onEnter={handlePay} 
            allowDecimal={false} 
            className="rounded-[28px] bg-muted/20 p-2 border border-border"
          />
        </div>
      </div>
    </MobileOverlay>
  );
}

function PaymentHistoryDialog({
  open, onOpenChange, debt
}: {
  open: boolean; onOpenChange: (v: boolean) => void; debt: DebtResponse | null;
}) {
  const [payments, setPayments] = useState<DebtPaymentResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && debt) {
      setLoading(true);
      debtsApi.getPayments(debt.id)
        .then(setPayments)
        .catch(() => toast.error("To'lovlar tarixi yuklanmadi"))
        .finally(() => setLoading(false));
    } else {
      setPayments([]);
    }
  }, [open, debt]);

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title="To'lovlar tarixi">
      <div className="p-4">
        {debt && (
          <div className="bg-muted/50 rounded-2xl p-4 mb-4 grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground mb-0.5">Umumiy</p>
              <p className="font-bold text-foreground">{formatCurrency(debt.amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">To'langan</p>
              <p className="font-bold text-success">{formatCurrency(debt.paidAmount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Qoldi</p>
              <p className="font-bold text-destructive">{formatCurrency(remainingAmount(debt))}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}
          </div>
        ) : payments.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">Hali to'lov qilinmagan</p>
        ) : (
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border">
                <div className="h-9 w-9 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</p>
                  {p.performedBy && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{p.performedBy}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileOverlay>
  );
}

function statusVariant(status: DebtStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'PAID') return 'default';
  if (status === 'PARTIAL') return 'secondary';
  return 'destructive';
}

function statusPillClasses(status: DebtStatus): string {
  if (status === 'PAID') return 'bg-success/10 text-success';
  if (status === 'PARTIAL') return 'bg-warning/10 text-warning';
  return 'bg-destructive/10 text-destructive';
}

const STATUS_TABS: { value: DebtStatus; label: string }[] = [
  { value: 'UNPAID', label: "To'lanmagan" },
  { value: 'PARTIAL', label: 'Qisman' },
  { value: 'PAID', label: "To'langan" },
];

const PAGE_SIZE = 20;

export default function DebtsPage() {
  // null means "we do not know" — a failed load must not render an empty debt
  // book and a confident "Umumiy qarz: 0 so'm".
  const [debts, setDebts] = useState<DebtResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [editDebt, setEditDebt] = useState<DebtResponse | null>(null);
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [payDebt, setPayDebt] = useState<DebtResponse | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [historyDebt, setHistoryDebt] = useState<DebtResponse | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<DebtStatus>('UNPAID');
  const [search, setSearch] = useState('');
  const [truncated, setTruncated] = useState(false);
  const isMobile = useIsMobile();

  // GET /api/debts takes only page & size — it can neither filter by status nor
  // search by name. So the tabs and the search box are only honest if every debt
  // is in memory: filtering the 20 rows of one server page made the
  // "To'lanmagan" tab report "Qarz topilmadi" while unpaid debts sat on page 2.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAllPages(debtsApi.getAll);
      setDebts(res.items);
      setTruncated(res.truncated);
    } catch {
      setDebts(null);
      toast.error('Qarzlar yuklanmadi');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Every debt is loaded, so this really is the shop's outstanding total — it
  // used to be the subtotal of whichever page you were looking at.
  const totalDebt = useMemo(
    () => (debts ?? []).reduce((s, d) => s + remainingAmount(d), 0),
    [debts],
  );

  const filteredDebts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (debts ?? []).filter(d => {
      if (d.status !== statusFilter) return false;
      if (!q) return true;
      return d.customerName.toLowerCase().includes(q) || (d.phone ?? '').includes(q);
    });
  }, [debts, statusFilter, search]);

  // A new filter, a new search or a delete can leave `page` past the end of the
  // list; clamping here keeps the list and the page counter from disagreeing.
  const totalPages = Math.max(1, Math.ceil(filteredDebts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedDebts = useMemo(
    () => filteredDebts.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filteredDebts, safePage],
  );

  useEffect(() => { setPage(0); }, [statusFilter, search]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await debtsApi.delete(deleteId);
      notify.success("Qarz o'chirildi");
      load();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Xato');
    } finally { setDeleteId(null); }
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader
          title="Qarzlar"
          description="Mijoz qarzlarini boshqarish"
          action={
            <Button aria-label="Yangi qarz" onClick={() => { setEditDebt(null); setDebtDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Yangi qarz</span>
            </Button>
          }
        />

        <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/10 mb-4">
          <div className="h-10 w-10 rounded-full bg-destructive text-white flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Umumiy qarz</p>
            {/* Never a zero we did not measure: "0 so'm" here would tell the owner
                that nobody owes them anything. */}
            <p className="text-lg font-bold text-destructive truncate">
              {loading ? '…' : debts ? formatCurrency(totalDebt) : '—'}
            </p>
          </div>
          {!loading && !debts && (
            <Button variant="outline" size="sm" className="shrink-0 press" onClick={load}>
              Qayta urinish
            </Button>
          )}
        </div>

        {truncated && !loading && (
          <p className="mb-3 text-xs text-muted-foreground">
            Qarzlar juda ko'p — barchasi yuklanmadi. Qidiruvdan foydalaning.
          </p>
        )}

        <div className="flex gap-1 p-1 rounded-2xl bg-muted border border-border mb-4">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'flex-1 min-w-0 h-10 px-2 rounded-xl text-[13px] font-semibold transition-colors truncate press border',
                statusFilter === tab.value
                  ? 'bg-card text-foreground border-border shadow-sm'
                  : 'text-muted-foreground border-transparent'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-12 rounded-xl md:h-9"
            placeholder="Ism yoki telefon..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isMobile ? (
          <>
            <div className="space-y-3 pb-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="shadow-sm"><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
              ))
            ) : !debts ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Qarzlar yuklanmadi</p>
            ) : pagedDebts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Qarz topilmadi</p>
            ) : pagedDebts.map(d => {
              const paidPct = d.amount > 0 ? Math.round((d.paidAmount / d.amount) * 100) : 0;
              const remaining = remainingAmount(d);
              return (
              <Card key={d.id} className="shadow-sm border-border overflow-hidden rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold truncate tracking-tight">{d.customerName}</p>
                      {d.phone && <p className="text-xs text-muted-foreground mt-0.5 truncate">{d.phone}</p>}
                    </div>
                    <span className={cn('shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full', statusPillClasses(d.status))}>
                      {getDebtStatusLabel(d.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3 bg-muted/50 p-2.5 rounded-xl">
                    <div>
                      <p className="text-muted-foreground mb-0.5">Umumiy</p>
                      <p className="font-bold text-foreground">{formatCurrency(d.amount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">To'langan</p>
                      <p className="font-bold text-success">{formatCurrency(d.paidAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">Qoldi</p>
                      <p className="font-bold text-destructive">{formatCurrency(remaining)}</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium mb-2">{formatDateTime(d.createdAt)}</p>
                  <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground"
                      title="To'lovlar tarixi" aria-label="To'lovlar tarixi" onClick={() => { setHistoryDebt(d); setHistoryOpen(true); }}>
                      <Calendar className="h-[18px] w-[18px]" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground"
                      title="Tahrirlash" aria-label="Tahrirlash" onClick={() => { setEditDebt(d); setDebtDialogOpen(true); }}>
                      <Pencil className="h-[18px] w-[18px]" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                      title="O'chirish" aria-label="O'chirish" onClick={() => setDeleteId(d.id)}>
                      <Trash2 className="h-[18px] w-[18px]" />
                    </Button>
                    {remaining > 0 && (
                      <Button className="flex-1 h-11 rounded-xl bg-success hover:bg-success/90 text-white font-bold shadow-sm"
                        onClick={() => { setPayDebt(d); setPayOpen(true); }}>
                        To'lash
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
          <div className="py-2">
            <PaginationControls
              page={safePage} totalPages={totalPages}
              totalElements={filteredDebts.length} size={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </>
        ) : (
          <Card className="shadow-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Mijoz</TableHead>
                      <TableHead className="whitespace-nowrap">Telefon</TableHead>
                      <TableHead className="whitespace-nowrap">Umumiy</TableHead>
                      <TableHead className="whitespace-nowrap">To'langan</TableHead>
                      <TableHead className="whitespace-nowrap">Qolgan</TableHead>
                      <TableHead className="whitespace-nowrap">Holat</TableHead>
                      <TableHead className="whitespace-nowrap">Sana</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Amallar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((__, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : !debts ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                          Qarzlar yuklanmadi
                        </TableCell>
                      </TableRow>
                    ) : pagedDebts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                          Qarz topilmadi
                        </TableCell>
                      </TableRow>
                    ) : pagedDebts.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="whitespace-nowrap font-medium">{d.customerName}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{d.phone ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(d.amount)}</TableCell>
                        <TableCell className="whitespace-nowrap text-primary">{formatCurrency(d.paidAmount)}</TableCell>
                        <TableCell className="whitespace-nowrap font-bold text-destructive">{formatCurrency(remainingAmount(d))}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={statusVariant(d.status)}>{getDebtStatusLabel(d.status)}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {remainingAmount(d) > 0 && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary"
                                title="To'lash" onClick={() => { setPayDebt(d); setPayOpen(true); }}>
                                <DollarSign className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              title="To'lovlar tarixi" onClick={() => { setHistoryDebt(d); setHistoryOpen(true); }}>
                              <Calendar className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              title="Tahrirlash" onClick={() => { setEditDebt(d); setDebtDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              title="O'chirish" onClick={() => setDeleteId(d.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="px-4 pb-3">
                <PaginationControls
                  page={safePage} totalPages={totalPages}
                  totalElements={filteredDebts.length} size={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <DebtDialog open={debtDialogOpen} onOpenChange={setDebtDialogOpen} debt={editDebt} onSaved={load} />
      <PayDialog open={payOpen} onOpenChange={setPayOpen} debt={payDebt} onSaved={load} />
      <PaymentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} debt={historyDebt} />

      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Qarzni o'chirish</AlertDialogTitle>
            <AlertDialogDescription>Bu amalni qaytarib bo'lmaydi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
