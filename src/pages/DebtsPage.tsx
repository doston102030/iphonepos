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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{debt ? 'Qarzni tahrirlash' : 'Yangi qarz'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mijoz ismi</FormLabel>
                  <FormControl><Input className="h-11" placeholder="Ism familiya" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="customerPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon</FormLabel>
                  <FormControl><Input className="h-11" type="tel" inputMode="tel" placeholder="+998901234567" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Summa (so'm)</FormLabel>
                  <FormControl><Input className="h-11" type="number" inputMode="numeric" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-11" onClick={() => onOpenChange(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" className="flex-1 rounded-xl h-11" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({
  open, onOpenChange, debt, onSaved
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  debt: DebtResponse | null; onSaved: () => void;
}) {
  const form = useForm<PayForm>({
    resolver: zodResolver(paySchema),
    defaultValues: { amount: 0 },
  });

  useEffect(() => {
    if (open && debt) {
      form.reset({ amount: debt.remainingAmount });
    }
  }, [open, debt, form]);

  async function onSubmit(values: PayForm) {
    if (!debt) return;
    if (values.amount > debt.remainingAmount) {
      form.setError('amount', { message: `Qolgan summa: ${formatCurrency(debt.remainingAmount)}` });
      return;
    }
    try {
      await debtsApi.pay(debt.id, { amount: values.amount });
      toast.success("To'lov amalga oshirildi");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm">
        <DialogHeader>
          <DialogTitle>Qarzni to'lash</DialogTitle>
        </DialogHeader>
        {debt && (
          <div className="text-sm space-y-1 mb-2 p-3 bg-muted rounded-md">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mijoz:</span>
              <span className="font-medium">{debt.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Umumiy qarz:</span>
              <span className="font-semibold">{formatCurrency(debt.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To'langan:</span>
              <span className="text-primary">{formatCurrency(debt.paidAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Qolgan:</span>
              <span className="font-bold text-destructive">{formatCurrency(debt.remainingAmount)}</span>
            </div>
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>To'lov summasi</FormLabel>
                <FormControl><Input className="h-11" type="number" inputMode="numeric" min={1} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-11" onClick={() => onOpenChange(false)}>Bekor</Button>
              <Button type="submit" className="flex-1 rounded-xl h-11" disabled={form.formState.isSubmitting}>To'lash</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
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
