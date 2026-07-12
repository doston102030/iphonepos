import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, DollarSign, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
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
  debtsApi, type DebtResponse, extractContent, extractPage
} from '@/lib/api';
import { cn, formatCurrency, formatDateTime, getDebtStatusLabel } from '@/lib/utils';

const debtSchema = z.object({
  customerName: z.string().min(1, 'Mijoz ismi kiritilishi shart'),
  customerPhone: z.string().min(1, 'Telefon raqami kiritilishi shart'),
  amount: z.coerce.number().min(1, 'Summa 0 dan katta bo\'lishi kerak'),
});

const paySchema = z.object({
  amount: z.coerce.number().min(1, 'To\'lov summasi 0 dan katta bo\'lishi kerak'),
});

type DebtForm = z.infer<typeof debtSchema>;
type PayForm = z.infer<typeof paySchema>;

function DebtDialog({
  open, onOpenChange, debt, onSaved
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  debt: DebtResponse | null; onSaved: () => void;
}) {
  const form = useForm<DebtForm>({
    resolver: zodResolver(debtSchema),
    defaultValues: { customerName: '', customerPhone: '', amount: 0 },
  });

  useEffect(() => {
    if (debt) {
      form.reset({
        customerName: debt.customerName,
        customerPhone: debt.customerPhone,
        amount: debt.amount,
      });
    } else {
      form.reset({ customerName: '', customerPhone: '', amount: 0 });
    }
  }, [debt, open, form]);

  async function onSubmit(values: DebtForm) {
    try {
      if (debt) {
        await debtsApi.update(debt.id, values);
        toast.success('Qarz yangilandi');
      } else {
        await debtsApi.create(values);
        toast.success('Qarz yaratildi');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
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
          <FormField control={form.control} name="customerPhone" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-muted-foreground">Telefon raqami</FormLabel>
              <FormControl><Input className="h-14 bg-muted/30 border-border/50 shadow-sm rounded-2xl text-lg px-4" type="tel" inputMode="tel" placeholder="+998901234567" {...field} autoComplete="off" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-muted-foreground">Qarz summasi</FormLabel>
              <FormControl><Input className="h-14 bg-muted/30 border-border/50 shadow-sm rounded-2xl text-lg px-4 font-bold" type="number" inputMode="numeric" min={0} {...field} /></FormControl>
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
    if (open && debt) {
      setAmountStr(debt.remainingAmount.toString());
    } else {
      setAmountStr('');
    }
  }, [open, debt]);

  async function handlePay() {
    if (!debt) return;
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Summani to\'g\'ri kiriting');
      return;
    }
    if (amount > debt.remainingAmount) {
      toast.error(`Qolgan summa: ${formatCurrency(debt.remainingAmount)}`);
      return;
    }
    setLoading(true);
    try {
      await debtsApi.pay(debt.id, { amount });
      toast.success("To'lov amalga oshirildi");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
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
          <p className="text-destructive font-semibold">Qolgan qarz: {formatCurrency(debt.remainingAmount)}</p>
        </div>

        <div className="flex-1 flex flex-col justify-center px-6 py-4 shrink-0 min-h-[150px]">
          <p className="text-sm text-muted-foreground mb-3 text-center">To'lov miqdori (so'm)</p>
          <div className="flex items-center justify-center gap-1.5 border-b-2 border-border/50 pb-2 bg-muted/30 p-4 rounded-3xl mx-4">
            <span className="text-3xl text-muted-foreground font-light">$</span>
            <span className="text-4xl font-bold tracking-tighter text-foreground truncate">
              {amountStr === '' ? '0' : parseInt(amountStr, 10).toLocaleString('ru-RU')}
            </span>
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
            className="rounded-[28px] bg-muted/20 p-2 border border-border/40"
          />
        </div>
      </div>
    </MobileOverlay>
  );
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'PAID') return 'default';
  if (status === 'PARTIAL') return 'secondary';
  return 'destructive';
}

function statusPillClasses(status: string): string {
  if (status === 'PAID') return 'bg-success/10 text-success';
  if (status === 'PARTIAL') return 'bg-warning/10 text-warning';
  return 'bg-destructive/10 text-destructive';
}

const STATUS_TABS: { value: 'UNPAID' | 'PARTIAL' | 'PAID'; label: string }[] = [
  { value: 'UNPAID', label: "To'lanmagan" },
  { value: 'PARTIAL', label: 'Qisman' },
  { value: 'PAID', label: "To'langan" },
];

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [editDebt, setEditDebt] = useState<DebtResponse | null>(null);
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [payDebt, setPayDebt] = useState<DebtResponse | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'UNPAID' | 'PARTIAL' | 'PAID'>('UNPAID');
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await debtsApi.getAll(page, 20);
      setDebts(extractContent(res));
      const pg = extractPage(res);
      setTotalPages(pg.totalPages);
      setTotalElements(pg.totalElements);
    } catch { toast.error('Qarzlar yuklanmadi'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalDebt = useMemo(() => debts.reduce((s, d) => s + d.remainingAmount, 0), [debts]);

  const filteredDebts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return debts.filter(d => {
      if (d.status !== statusFilter) return false;
      if (!q) return true;
      return d.customerName.toLowerCase().includes(q) || d.customerPhone.includes(q);
    });
  }, [debts, statusFilter, search]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await debtsApi.delete(deleteId);
      toast.success("Qarz o'chirildi");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato');
    } finally { setDeleteId(null); }
  }

  return (
    <MainLayout>
      <div className="p-6">
        <PageHeader
          title="Qarzlar"
          description="Mijoz qarzlarini boshqarish"
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setEditDebt(null); setDebtDialogOpen(true); }}>
                <Plus className="h-4 w-4" />
                <span className="hidden">Yangi qarz</span>
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 mb-4">
          <div className="h-10 w-10 rounded-full bg-destructive text-white flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Umumiy qarz</p>
            <p className="text-lg font-bold text-destructive truncate">{formatCurrency(totalDebt)}</p>
          </div>
        </div>

        <div className="flex gap-1.5 p-1 rounded-xl bg-muted mb-4 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'flex-1 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === tab.value ? 'bg-primary text-primary-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
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
            ) : filteredDebts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Qarz topilmadi</p>
            ) : filteredDebts.map(d => {
              const paidPct = d.amount > 0 ? Math.round((d.paidAmount / d.amount) * 100) : 0;
              return (
              <Card key={d.id} className="shadow-sm border-border overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold truncate tracking-tight">{d.customerName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.customerPhone}</p>
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
                      <p className="font-bold text-destructive">{formatCurrency(d.remainingAmount)}</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${paidPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground font-medium">{formatDateTime(d.createdAt)}</span>
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Tahrirlash" onClick={() => { setEditDebt(d); setDebtDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="O'chirish" onClick={() => setDeleteId(d.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {d.remainingAmount > 0 && (
                        <Button size="sm" className="h-8 rounded-xl bg-success hover:bg-success/90 text-white font-bold ml-1 shadow-sm"
                          onClick={() => { setPayDebt(d); setPayOpen(true); }}>
                          To'lash
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
          <div className="py-2">
            <PaginationControls
              page={page} totalPages={totalPages}
              totalElements={totalElements} size={20}
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
                    ) : filteredDebts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                          Qarz topilmadi
                        </TableCell>
                      </TableRow>
                    ) : filteredDebts.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="whitespace-nowrap font-medium">{d.customerName}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{d.customerPhone}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(d.amount)}</TableCell>
                        <TableCell className="whitespace-nowrap text-primary">{formatCurrency(d.paidAmount)}</TableCell>
                        <TableCell className="whitespace-nowrap font-bold text-destructive">{formatCurrency(d.remainingAmount)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={statusVariant(d.status)}>{getDebtStatusLabel(d.status)}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {d.remainingAmount > 0 && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary"
                                title="To'lash" onClick={() => { setPayDebt(d); setPayOpen(true); }}>
                                <DollarSign className="h-3.5 w-3.5" />
                              </Button>
                            )}
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
                  page={page} totalPages={totalPages}
                  totalElements={totalElements} size={20}
                  onPageChange={setPage}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <DebtDialog open={debtDialogOpen} onOpenChange={setDebtDialogOpen} debt={editDebt} onSaved={load} />
      <PayDialog open={payOpen} onOpenChange={setPayOpen} debt={payDebt} onSaved={load} />

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
