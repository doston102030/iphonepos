import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, PackageCheck, History, PackageMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card, CardContent, CardHeader, CardTitle
} from '@/components/ui/card';
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
import { BarcodeScannerDialog, ScanButton } from '@/components/common/BarcodeScanner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  productsApi, type ProductResponse, type StockMovementResponse,
  extractContent, extractPage
} from '@/lib/api';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';

const ROW_INPUT_CLASS = 'flex-1 border-0 shadow-none text-right p-0 h-auto text-sm font-semibold focus-visible:ring-0 bg-transparent';

// ── Schemas ────────────────────────────────────────────────────────────────────
const productSchema = z.object({
  name: z.string().min(1, 'Nom kiritilishi shart'),
  barcode: z.string().min(1, 'Shtrix-kod kiritilishi shart'),
  costPrice: z.coerce.number().min(0, 'Kelish narxi 0 dan katta bo\'lishi kerak'),
  price: z.coerce.number().min(0, 'Sotish narxi 0 dan katta bo\'lishi kerak'),
  quantity: z.coerce.number().min(0, 'Miqdor 0 dan katta bo\'lishi kerak'),
  unit: z.string().min(1, "O'lchov birligi kiritilishi shart"),
  minQuantity: z.coerce.number().min(0, 'Minimal miqdor 0 dan katta bo\'lishi kerak'),
});

const restockSchema = z.object({
  quantity: z.coerce.number().min(1, 'Miqdor 1 dan katta bo\'lishi kerak'),
  note: z.string().optional(),
});

const outflowSchema = z.object({
  quantity: z.coerce.number().min(1, 'Miqdor 1 dan katta bo\'lishi kerak'),
  reason: z.string().min(1, 'Sabab kiritilishi shart'),
});

const receiveSchema = z.object({
  barcode: z.string().min(1, 'Shtrix-kod kiritilishi shart'),
  name: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Miqdor 1 dan katta bo\'lishi kerak'),
  costPrice: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
  unit: z.string().optional(),
});

type ProductForm = z.infer<typeof productSchema>;
type RestockForm = z.infer<typeof restockSchema>;
type OutflowForm = z.infer<typeof outflowSchema>;
type ReceiveForm = z.infer<typeof receiveSchema>;

// ── Dialogs ────────────────────────────────────────────────────────────────────
function ProductDialog({
  open, onOpenChange, product, onSaved
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ProductResponse | null;
  onSaved: () => void;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', barcode: '', costPrice: 0, price: 0, quantity: 0, unit: 'dona', minQuantity: 0 },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name, barcode: product.barcode, costPrice: product.costPrice, price: product.price,
        quantity: product.quantity, unit: product.unit, minQuantity: product.minQuantity,
      });
    } else {
      form.reset({ name: '', barcode: '', costPrice: 0, price: 0, quantity: 0, unit: 'dona', minQuantity: 0 });
    }
  }, [product, open, form]);

  const costPrice = form.watch('costPrice');
  const sellPrice = form.watch('price');
  const marginPct = sellPrice > 0 ? Math.round(((sellPrice - costPrice) / sellPrice) * 1000) / 10 : 0;

  async function onSubmit(values: ProductForm) {
    try {
      if (product) {
        await productsApi.update(product.id, values);
        toast.success('Mahsulot yangilandi');
      } else {
        await productsApi.create(values);
        toast.success('Mahsulot yaratildi');
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
          <DialogTitle>{product ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground tracking-wide mb-2 px-0.5">ASOSIY MA'LUMOTLAR</p>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="space-y-0.5 px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <FormLabel className="shrink-0 text-sm font-normal text-muted-foreground">Nomi</FormLabel>
                      <FormControl>
                        <Input placeholder="Masalan: Coca-Cola 0.5L" autoComplete="off"
                          className={ROW_INPUT_CLASS} {...field} />
                      </FormControl>
                    </div>
                    <FormMessage className="text-right" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="barcode" render={({ field }) => (
                  <FormItem className="space-y-0.5 px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <FormLabel className="shrink-0 text-sm font-normal text-muted-foreground">Shtrix-kod</FormLabel>
                      <FormControl>
                        <Input placeholder="1234567890123" autoComplete="off" className={ROW_INPUT_CLASS} {...field} />
                      </FormControl>
                      <ScanButton onClick={() => setScannerOpen(true)} className="shrink-0 h-8 w-8" />
                    </div>
                    <FormMessage className="text-right" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem className="space-y-0.5 px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <FormLabel className="shrink-0 text-sm font-normal text-muted-foreground">O'lchov birligi</FormLabel>
                      <FormControl>
                        <Input placeholder="dona" autoComplete="off" className={ROW_INPUT_CLASS} {...field} />
                      </FormControl>
                    </div>
                    <FormMessage className="text-right" />
                  </FormItem>
                )} />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground tracking-wide mb-2 px-0.5">NARX VA OMBOR</p>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                <FormField control={form.control} name="costPrice" render={({ field }) => (
                  <FormItem className="space-y-0.5 px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <FormLabel className="shrink-0 text-sm font-normal text-muted-foreground">Kelish narxi</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" className={ROW_INPUT_CLASS} {...field} />
                      </FormControl>
                    </div>
                    <FormMessage className="text-right" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem className="space-y-0.5 px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <FormLabel className="shrink-0 text-sm font-normal text-muted-foreground">Sotish narxi</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" className={ROW_INPUT_CLASS} {...field} />
                      </FormControl>
                    </div>
                    <FormMessage className="text-right" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem className="space-y-0.5 px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <FormLabel className="shrink-0 text-sm font-normal text-muted-foreground">Ombordagi miqdori</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" className={ROW_INPUT_CLASS} {...field} />
                      </FormControl>
                    </div>
                    <FormMessage className="text-right" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="minQuantity" render={({ field }) => (
                  <FormItem className="space-y-0.5 px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      <FormLabel className="shrink-0 text-sm font-normal text-muted-foreground">Minimal miqdor</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" className={ROW_INPUT_CLASS} {...field} />
                      </FormControl>
                    </div>
                    <FormMessage className="text-right" />
                  </FormItem>
                )} />
              </div>
              {sellPrice > 0 && (
                <div className="flex items-center justify-between px-3.5 py-2.5 mt-2 rounded-xl bg-muted text-xs">
                  <span className="text-muted-foreground">Bir dona foyda</span>
                  <span className={cn('font-semibold', marginPct >= 0 ? 'text-success' : 'text-destructive')}>
                    {formatCurrency(sellPrice - costPrice)} ({marginPct}%)
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-1 gap-2 sm:gap-2">
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
      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={code => form.setValue('barcode', code, { shouldValidate: true })}
      />
    </Dialog>
  );
}

function RestockDialog({
  open, onOpenChange, product, onSaved
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  product: ProductResponse | null; onSaved: () => void;
}) {
  const form = useForm<RestockForm>({
    resolver: zodResolver(restockSchema),
    defaultValues: { quantity: 1, note: '' },
  });
  useEffect(() => { if (open) form.reset({ quantity: 1, note: '' }); }, [open, form]);

  async function onSubmit(values: RestockForm) {
    if (!product) return;
    try {
      await productsApi.restock(product.id, values);
      toast.success('Ombor to\'ldirildi');
      onSaved(); onOpenChange(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Xato'); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle>Omborni to'ldirish — {product?.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel>Miqdor</FormLabel>
                <FormControl><Input className="h-11" type="number" inputMode="numeric" min={1} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem>
                <FormLabel>Izoh (ixtiyoriy)</FormLabel>
                <FormControl><Input className="h-11" placeholder="Izoh..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-11" onClick={() => onOpenChange(false)}>Bekor</Button>
              <Button type="submit" className="flex-1 rounded-xl h-11" disabled={form.formState.isSubmitting}>Saqlash</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function OutflowDialog({
  open, onOpenChange, product, onSaved
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  product: ProductResponse | null; onSaved: () => void;
}) {
  const form = useForm<OutflowForm>({
    resolver: zodResolver(outflowSchema),
    defaultValues: { quantity: 1, reason: '' },
  });
  useEffect(() => { if (open) form.reset({ quantity: 1, reason: '' }); }, [open, form]);

  async function onSubmit(values: OutflowForm) {
    if (!product) return;
    try {
      await productsApi.createOutflow(product.id, values);
      toast.success('Chiqim yaratildi');
      onSaved(); onOpenChange(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Xato'); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader><DialogTitle>Chiqim — {product?.name}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel>Miqdor</FormLabel>
                <FormControl><Input className="h-11" type="number" inputMode="numeric" min={1} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Sabab</FormLabel>
                <FormControl><Input className="h-11" placeholder="Sabab..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-11" onClick={() => onOpenChange(false)}>Bekor</Button>
              <Button type="submit" className="flex-1 rounded-xl h-11" disabled={form.formState.isSubmitting}>Saqlash</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveDialog({ open, onOpenChange, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const form = useForm<ReceiveForm>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { barcode: '', name: '', quantity: 1, costPrice: 0, price: 0, unit: 'dona' },
  });
  useEffect(() => {
    if (open) form.reset({ barcode: '', name: '', quantity: 1, costPrice: 0, price: 0, unit: 'dona' });
  }, [open, form]);

  async function onSubmit(values: ReceiveForm) {
    try {
      await productsApi.receive(values);
      toast.success('Tovar qabul qilindi');
      onSaved(); onOpenChange(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Xato'); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader><DialogTitle>Tovar qabul qilish</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="barcode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shtrix-kod</FormLabel>
                  <FormControl>
                    <div className="flex gap-1.5">
                      <Input className="h-11" placeholder="123456789" {...field} />
                      <ScanButton onClick={() => setScannerOpen(true)} className="shrink-0 h-11 w-11" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomi (ixtiyoriy)</FormLabel>
                  <FormControl><Input className="h-11" placeholder="Mahsulot nomi" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Miqdor</FormLabel>
                  <FormControl><Input className="h-11" type="number" inputMode="numeric" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="costPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>Kelish narxi (ixtiyoriy)</FormLabel>
                  <FormControl><Input className="h-11" type="number" inputMode="numeric" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sotish narxi (ixtiyoriy)</FormLabel>
                  <FormControl><Input className="h-11" type="number" inputMode="numeric" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem>
                  <FormLabel>O'lchov (ixtiyoriy)</FormLabel>
                  <FormControl><Input className="h-11" placeholder="dona" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-11" onClick={() => onOpenChange(false)}>Bekor</Button>
              <Button type="submit" className="flex-1 rounded-xl h-11" disabled={form.formState.isSubmitting}>Qabul qilish</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={code => form.setValue('barcode', code, { shouldValidate: true })}
      />
    </Dialog>
  );
}

function HistoryDialog({ open, onOpenChange, product }: {
  open: boolean; onOpenChange: (v: boolean) => void; product: ProductResponse | null;
}) {
  const [history, setHistory] = useState<StockMovementResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      setLoading(true);
      productsApi.restockHistory(product.id)
        .then(setHistory)
        .catch(() => toast.error('Tarix yuklanmadi'))
        .finally(() => setLoading(false));
    }
  }, [open, product]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader><DialogTitle>Restock tarixi — {product?.name}</DialogTitle></DialogHeader>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Tarix yo'q</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Sana</TableHead>
                    <TableHead className="whitespace-nowrap">Tur</TableHead>
                    <TableHead className="whitespace-nowrap">Miqdor</TableHead>
                    <TableHead className="whitespace-nowrap">Izoh</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map(h => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(h.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap"><Badge variant="outline">{h.type}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{h.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{h.note ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const [editProduct, setEditProduct] = useState<ProductResponse | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [restockProduct, setRestockProduct] = useState<ProductResponse | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);
  const [outflowProduct, setOutflowProduct] = useState<ProductResponse | null>(null);
  const [outflowOpen, setOutflowOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<ProductResponse | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.getAll(search || undefined, page, 30);
      setProducts(extractContent(res));
      const pg = extractPage(res);
      setTotalPages(pg.totalPages);
      setTotalElements(pg.totalElements);
    } catch {
      toast.error('Mahsulotlar yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  function handleSearch() {
    setSearch(searchInput);
    setPage(0);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await productsApi.delete(deleteId);
      toast.success("Mahsulot o'chirildi");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato');
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <MainLayout>
      <div className="p-6">
        <PageHeader
          title="Mahsulotlar"
          description="Mahsulotlar ro'yxati va boshqaruvi"
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setReceiveOpen(true)}>
                <PackageCheck className="h-4 w-4 mr-1.5" />
                <span className="hidden">Qabul qilish</span>
              </Button>
              <Button size="sm" onClick={() => { setEditProduct(null); setProductDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1.5" />
                <span className="hidden">Yangi mahsulot</span>
              </Button>
            </div>
          }
        />

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Mahsulot nomini qidirish..."
              className="pl-9"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <Button variant="outline" onClick={handleSearch}>Qidirish</Button>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            {isMobile ? (
              <div className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4"><Skeleton className="h-16 w-full" /></div>
                  ))
                ) : products.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Mahsulot topilmadi</p>
                ) : products.map(p => (
                  <div key={p.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {p.name}
                          {p.quantity <= p.minQuantity && (
                            <Badge variant="destructive" className="ml-1.5 text-[10px] align-middle">Kam</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{p.barcode}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-accent">{formatCurrency(p.price)}</p>
                        <p className="text-[11px] text-muted-foreground">tan narx {formatCurrency(p.costPrice)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        Qoldiq: <span className="font-semibold text-foreground">{p.quantity} {p.unit}</span>
                      </span>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          title="Restock" onClick={() => { setRestockProduct(p); setRestockOpen(true); }}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          title="Chiqim" onClick={() => { setOutflowProduct(p); setOutflowOpen(true); }}>
                          <PackageMinus className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          title="Tarix" onClick={() => { setHistoryProduct(p); setHistoryOpen(true); }}>
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          title="Tahrirlash" onClick={() => { setEditProduct(p); setProductDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          title="O'chirish" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Nomi</TableHead>
                      <TableHead className="whitespace-nowrap">Shtrix-kod</TableHead>
                      <TableHead className="whitespace-nowrap">Kelish narxi</TableHead>
                      <TableHead className="whitespace-nowrap">Sotish narxi</TableHead>
                      <TableHead className="whitespace-nowrap">Miqdor</TableHead>
                      <TableHead className="whitespace-nowrap">Birligi</TableHead>
                      <TableHead className="whitespace-nowrap">Min.</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Amallar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((__, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                          Mahsulot topilmadi
                        </TableCell>
                      </TableRow>
                    ) : products.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {p.name}
                          {p.quantity <= p.minQuantity && (
                            <Badge variant="destructive" className="ml-2 text-[10px]">Kam</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.barcode}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatCurrency(p.costPrice)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-accent">{formatCurrency(p.price)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{p.quantity}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{p.unit}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.minQuantity}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              title="Restock" onClick={() => { setRestockProduct(p); setRestockOpen(true); }}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              title="Chiqim" onClick={() => { setOutflowProduct(p); setOutflowOpen(true); }}>
                              <PackageMinus className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              title="Tarix" onClick={() => { setHistoryProduct(p); setHistoryOpen(true); }}>
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              title="Tahrirlash" onClick={() => { setEditProduct(p); setProductDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              title="O'chirish" onClick={() => setDeleteId(p.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="px-4 pb-3">
              <PaginationControls
                page={page} totalPages={totalPages}
                totalElements={totalElements} size={30}
                onPageChange={setPage}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editProduct}
        onSaved={load}
      />
      <RestockDialog open={restockOpen} onOpenChange={setRestockOpen} product={restockProduct} onSaved={load} />
      <OutflowDialog open={outflowOpen} onOpenChange={setOutflowOpen} product={outflowProduct} onSaved={load} />
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} product={historyProduct} />
      <ReceiveDialog open={receiveOpen} onOpenChange={setReceiveOpen} onSaved={load} />

      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Mahsulotni o'chirish</AlertDialogTitle>
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
