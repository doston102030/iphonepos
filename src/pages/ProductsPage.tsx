import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, History, PackageMinus } from 'lucide-react';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { PaginationControls } from '@/components/common/PaginationControls';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import { BarcodeScannerDialog, ScanButton } from '@/components/common/BarcodeScanner';
import { MoneyInput } from '@/components/common/MoneyInput';
import { useIsMobile } from '@/hooks/use-mobile';
import useBarcodeName from '@/hooks/use-barcode-name';
import {
  productsApi, LOW_STOCK_THRESHOLD,
  type OutflowReason, type ProductResponse, type StockMovementResponse,
  extractContent, extractPage
} from '@/lib/api';
import {
  cn, formatCurrency, formatDateTime,
  getOutflowReasonLabel, getStockMovementTypeLabel
} from '@/lib/utils';
import { getProductUnit } from '@/lib/units';

// min-w-0 lets the value shrink instead of shoving the label; pl-2 keeps a long
// value from touching the label; text stays right-aligned like a receipt.
// Order matters: p-0 must come FIRST — tailwind-merge lets the later class win,
// so `pl-2 p-0` killed the left padding, and with no right padding at all the
// caret and the last typed letter sat clipped against the input's edge.
const ROW_INPUT_CLASS = 'flex-1 min-w-0 border-0 shadow-none text-right p-0 pl-2 pr-1 h-auto text-sm font-semibold focus-visible:ring-0 bg-transparent';

// A single-line row input slid a long product name out of view past its left
// edge; this one-row textarea wraps and grows downward instead, so the whole
// name stays readable while it is typed. Names are one line of text — Enter is
// swallowed and pasted newlines become spaces.
const NAME_INPUT_CLASS = 'flex-1 min-w-0 border-0 outline-none text-right p-0 pl-2 pr-1 text-sm font-semibold bg-transparent resize-none overflow-hidden leading-snug placeholder:text-muted-foreground';

const NameInput = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function NameInput({ onChange, ...props }, ref) {
    const inner = useRef<HTMLTextAreaElement | null>(null);
    useLayoutEffect(() => {
      const el = inner.current;
      if (!el) return;
      el.style.height = '0px';
      el.style.height = `${el.scrollHeight}px`;
    });
    return (
      <textarea
        {...props}
        ref={el => {
          inner.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        rows={1}
        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
        onChange={e => {
          e.target.value = e.target.value.replace(/\n+/g, ' ');
          onChange?.(e);
        }}
        className={NAME_INPUT_CLASS}
      />
    );
  }
);

// A number field that shows nothing (not "0") when empty, so typing "50" gives
// 50 — not "500", which is what a stuck leading zero produced. An emptied field
// reads back as 0, and the schema's min() rules reject it where that's illegal.
function numberFieldProps(field: { value: number; onChange: (v: number) => void }) {
  return {
    ...field,
    value: field.value === 0 || field.value === undefined || Number.isNaN(field.value) ? '' : field.value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      field.onChange(e.target.value === '' ? 0 : Number(e.target.value)),
  };
}

/** The server accepts exactly these three outflow reasons — free text is rejected. */
const OUTFLOW_REASONS: OutflowReason[] = ['DAMAGED', 'LOST', 'RETURNED'];

// ── Schemas ────────────────────────────────────────────────────────────────────
// The product record is { name, barcode?, purchasePrice, price, stockQuantity } —
// the server has no unit and no per-product minimum; the measure word ("dona",
// "kg", …) is stored device-side (lib/units.ts) and low stock is decided by the
// shared LOW_STOCK_THRESHOLD.
const productSchema = z.object({
  name: z.string().min(1, 'Nom kiritilishi shart'),
  barcode: z.string().min(1, 'Shtrix-kod kiritilishi shart'),
  purchasePrice: z.coerce.number().min(0, 'Kelish narxi manfiy bo\'lmasligi kerak'),
  price: z.coerce.number().min(0, 'Sotish narxi manfiy bo\'lmasligi kerak'),
  stockQuantity: z.coerce.number().min(0, 'Miqdor manfiy bo\'lmasligi kerak'),
});

const restockSchema = z.object({
  quantity: z.coerce.number().min(1, 'Miqdor kamida 1 bo\'lishi kerak'),
});

// `note` is optional on the server too, and the three reasons already say what
// happened — so the form does not ask for it.
const outflowSchema = z.object({
  quantity: z.coerce.number().min(1, 'Miqdor kamida 1 bo\'lishi kerak'),
  reason: z.enum(['DAMAGED', 'LOST', 'RETURNED'], { required_error: 'Sabab tanlanishi shart' }),
});

type ProductForm = z.infer<typeof productSchema>;
type RestockForm = z.infer<typeof restockSchema>;
type OutflowForm = z.infer<typeof outflowSchema>;

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
  // A barcode that is already in the catalogue must not create a twin product:
  // the matching record is pulled into the form and Saqlash becomes an update.
  // The ref mirrors the state so the async lookup below can read the current
  // value without re-arming itself.
  const [existing, setExisting] = useState<ProductResponse | null>(null);
  const existingRef = useRef<ProductResponse | null>(null);
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', barcode: '', purchasePrice: 0, price: 0, stockQuantity: 0 },
  });

  useEffect(() => {
    setExisting(null);
    existingRef.current = null;
    if (product) {
      form.reset({
        name: product.name,
        barcode: product.barcode ?? '',
        purchasePrice: product.purchasePrice,
        price: product.price,
        stockQuantity: product.stockQuantity,
      });
    } else {
      form.reset({ name: '', barcode: '', purchasePrice: 0, price: 0, stockQuantity: 0 });
    }
  }, [product, open, form]);

  // Watches the barcode while a NEW product is being added. A known code loads
  // that product's name, prices, stock and unit right here — the shopkeeper
  // sees what is already in the ombor and corrects it in place. When the
  // barcode then moves on to an unknown code, the borrowed values are cleared
  // so they cannot be saved under the wrong barcode.
  const barcodeValue = form.watch('barcode');
  useEffect(() => {
    if (!open || product) return;
    const code = (barcodeValue ?? '').trim();

    const clearBorrowed = () => {
      if (!existingRef.current) return;
      existingRef.current = null;
      setExisting(null);
      form.reset({ name: '', barcode: code, purchasePrice: 0, price: 0, stockQuantity: 0 });
    };

    if (code.length < 4) {
      clearBorrowed();
      return;
    }
    let alive = true;
    // A scan lands the whole code at once; typing arrives digit by digit —
    // the debounce keeps a lookup from firing on every keystroke.
    const timer = setTimeout(() => {
      productsApi.getByBarcode(code)
        .then(found => {
          if (!alive) return;
          existingRef.current = found;
          setExisting(found);
          form.reset({
            name: found.name,
            barcode: found.barcode ?? code,
            purchasePrice: found.purchasePrice,
            price: found.price,
            stockQuantity: found.stockQuantity,
          });
        })
        .catch(() => {
          if (alive) clearBorrowed();
        });
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [barcodeValue, open, product, form]);

  const purchasePrice = form.watch('purchasePrice');
  const sellPrice = form.watch('price');
  const marginPct = sellPrice > 0 ? Math.round(((sellPrice - purchasePrice) / sellPrice) * 1000) / 10 : 0;

  // A scanned barcode fetches the product's name from the world databases and
  // fills the empty Nomi field — only for codes we do NOT already stock; a
  // known product's name is the shop's own wording and is left alone.
  useBarcodeName(
    form.watch('barcode'),
    open && !product && !existing,
    () => form.getValues('name') ?? '',
    name => form.setValue('name', name, { shouldValidate: true }),
  );

  async function onSubmit(values: ProductForm) {
    try {
      const target = product ?? existing;
      if (target) {
        await productsApi.update(target.id, values);
        notify.success('Mahsulot yangilandi');
      } else {
        await productsApi.create(values);
        notify.success('Mahsulot yaratildi');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title={product ? 'Mahsulotni tahrirlash' : existing ? 'Mavjud mahsulot' : 'Yangi mahsulot'}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 h-full flex flex-col">
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-muted-foreground tracking-wide mb-2 px-0.5">ASOSIY MA'LUMOTLAR</p>
            <div className="rounded-2xl border-0 bg-muted/30 shadow-sm overflow-hidden mb-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="space-y-0.5 px-4 py-3 border-b border-border/50">
                  <div className="flex items-start gap-3">
                    <FormLabel className="shrink-0 text-sm font-medium text-muted-foreground w-20">Nomi</FormLabel>
                    <FormControl>
                      <NameInput placeholder="Masalan: Coca-Cola 0.5L" autoComplete="off" {...field} />
                    </FormControl>
                  </div>
                  <FormMessage className="text-right" />
                </FormItem>
              )} />
              <FormField control={form.control} name="barcode" render={({ field }) => (
                <FormItem className="space-y-0.5 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FormLabel className="shrink-0 text-sm font-medium text-muted-foreground w-20">Shtrix-kod</FormLabel>
                    <FormControl>
                      <Input placeholder="1234567890123" autoComplete="off" className={ROW_INPUT_CLASS} {...field} />
                    </FormControl>
                    <ScanButton onClick={() => setScannerOpen(true)} className="shrink-0 h-9 w-9 bg-background shadow-sm" />
                  </div>
                  <FormMessage className="text-right" />
                </FormItem>
              )} />
            </div>

            {existing && (
              <div className="px-4 py-3 -mt-3 mb-6 rounded-2xl bg-primary/10 text-[13px] leading-snug font-medium text-primary">
                Bu mahsulot omborda allaqachon bor — narxlari va qoldig'i yuklandi. Saqlash shu mahsulotni yangilaydi.
              </div>
            )}

            <p className="text-[11px] font-semibold text-muted-foreground tracking-wide mb-2 px-0.5">NARX VA OMBOR</p>
            <div className="rounded-2xl border-0 bg-muted/30 shadow-sm overflow-hidden">
              <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                <FormItem className="space-y-0.5 px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <FormLabel className="shrink-0 text-sm font-medium text-muted-foreground w-28">Kelish narxi</FormLabel>
                    <FormControl>
                      <MoneyInput className={ROW_INPUT_CLASS} value={field.value} onChange={field.onChange} />
                    </FormControl>
                  </div>
                  <FormMessage className="text-right" />
                </FormItem>
              )} />
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem className="space-y-0.5 px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <FormLabel className="shrink-0 text-sm font-medium text-muted-foreground w-28">Sotish narxi</FormLabel>
                    <FormControl>
                      <MoneyInput className={ROW_INPUT_CLASS} value={field.value} onChange={field.onChange} />
                    </FormControl>
                  </div>
                  <FormMessage className="text-right" />
                </FormItem>
              )} />
              <FormField control={form.control} name="stockQuantity" render={({ field }) => (
                <FormItem className="space-y-0.5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FormLabel className="shrink-0 text-sm font-medium text-muted-foreground w-28">Ombordagi</FormLabel>
                    <FormControl>
                      <Input type="number" inputMode="numeric" placeholder="0" className={ROW_INPUT_CLASS} {...numberFieldProps(field)} />
                    </FormControl>
                  </div>
                  <FormMessage className="text-right" />
                </FormItem>
              )} />
            </div>
            {sellPrice > 0 && (
              <div className="flex items-center justify-between px-4 py-3 mt-4 rounded-2xl bg-success/10 text-sm">
                <span className="text-success font-medium">Har biridan foyda</span>
                <span className={cn('font-bold', marginPct >= 0 ? 'text-success' : 'text-destructive')}>
                  {formatCurrency(sellPrice - purchasePrice)} ({marginPct}%)
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 pb-6 mt-auto">
            <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-bold" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </form>
      </Form>
      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={code => form.setValue('barcode', code, { shouldValidate: true })}
      />
    </MobileOverlay>
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
    defaultValues: { quantity: 1 },
  });
  useEffect(() => { if (open) form.reset({ quantity: 1 }); }, [open, form]);

  async function onSubmit(values: RestockForm) {
    if (!product) return;
    try {
      await productsApi.restock(product.id, values);
      notify.success('Ombor to\'ldirildi');
      onSaved(); onOpenChange(false);
    } catch (err) { notify.error(err instanceof Error ? err.message : 'Xato'); }
  }

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title={`Omborni to'ldirish`}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-4 h-full flex flex-col">
          <div className="p-4 bg-muted/30 rounded-2xl mb-4 border border-border text-center">
            <p className="text-muted-foreground text-sm mb-1">Mahsulot</p>
            <h3 className="font-bold text-lg">{product?.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Hozirgi qoldiq: <span className="font-semibold text-foreground">{product ? `${product.stockQuantity} ${getProductUnit(product.id)}` : '—'}</span>
            </p>
          </div>
          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-muted-foreground">Miqdor</FormLabel>
              <FormControl><Input className="h-14 bg-muted/30 border-border/50 shadow-sm rounded-2xl text-lg px-4" type="number" inputMode="numeric" min={1} {...numberFieldProps(field)} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="mt-auto pt-6 pb-8">
            <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-bold" disabled={form.formState.isSubmitting}>Saqlash</Button>
          </div>
        </form>
      </Form>
    </MobileOverlay>
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
    defaultValues: { quantity: 1 },
  });
  useEffect(() => { if (open) form.reset({ quantity: 1 }); }, [open, form]);

  async function onSubmit(values: OutflowForm) {
    if (!product) return;
    if (values.quantity > product.stockQuantity) {
      notify.error(`Ombordagi qoldiq: ${product.stockQuantity} ${getProductUnit(product.id)}`);
      return;
    }
    try {
      await productsApi.createOutflow(product.id, values);
      notify.success('Chiqim yaratildi');
      onSaved(); onOpenChange(false);
    } catch (err) { notify.error(err instanceof Error ? err.message : 'Xato'); }
  }

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title={`Chiqim`}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-4 h-full flex flex-col">
          <div className="p-4 bg-muted/30 rounded-2xl mb-4 border border-border text-center">
            <p className="text-muted-foreground text-sm mb-1">Mahsulot</p>
            <h3 className="font-bold text-lg">{product?.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Qoldiq: <span className="font-semibold text-foreground">{product ? `${product.stockQuantity} ${getProductUnit(product.id)}` : '—'}</span>
            </p>
          </div>
          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-muted-foreground">Miqdor</FormLabel>
              <FormControl><Input className="h-14 bg-muted/30 border-border/50 shadow-sm rounded-2xl text-lg px-4" type="number" inputMode="numeric" min={1} max={product?.stockQuantity} {...numberFieldProps(field)} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          {/* The server only accepts DAMAGED | LOST | RETURNED, so this is a Select, not free text. */}
          <FormField control={form.control} name="reason" render={({ field }) => (
            <FormItem>
              <FormLabel className="font-semibold text-muted-foreground">Sabab</FormLabel>
              <Select onValueChange={value => field.onChange(value as OutflowReason)} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-14 bg-muted/30 border-border/50 shadow-sm rounded-2xl text-lg px-4">
                    <SelectValue placeholder="Sababni tanlang" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {OUTFLOW_REASONS.map(reason => (
                    <SelectItem key={reason} value={reason}>{getOutflowReasonLabel(reason)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <div className="mt-auto pt-6 pb-8">
            <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-bold" disabled={form.formState.isSubmitting}>Saqlash</Button>
          </div>
        </form>
      </Form>
    </MobileOverlay>
  );
}

function HistoryDialog({ open, onOpenChange, product }: {
  open: boolean; onOpenChange: (v: boolean) => void; product: ProductResponse | null;
}) {
  // null = load failed. Also reset on every open: without it, a failed fetch
  // for product B kept showing product A's movements under B's title.
  const [history, setHistory] = useState<StockMovementResponse[] | null>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(() => {
    if (!product) return;
    setHistory([]);
    setLoading(true);
    productsApi.restockHistory(product.id)
      .then(setHistory)
      .catch(() => setHistory(null))
      .finally(() => setLoading(false));
  }, [product]);

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, fetchHistory]);

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title={`Tarix — ${product?.name || ''}`}>
      <div className="p-4 flex flex-col h-full">
        {loading ? (
          <div className="space-y-3 mt-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
          </div>
        ) : history === null ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground text-sm mb-3">Tarix yuklanmadi</p>
            <Button variant="outline" size="sm" className="press" onClick={fetchHistory}>
              Qayta urinish
            </Button>
          </div>
        ) : history.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70">
            <History className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Tarix topilmadi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(h => (
              <div key={h.id} className="p-4 bg-muted/30 border border-border rounded-2xl flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge variant="outline" className="mb-2 bg-background">{getStockMovementTypeLabel(h.type)}</Badge>
                  <p className="text-xs text-muted-foreground font-medium">{formatDateTime(h.createdAt)}</p>
                  {h.reason && <p className="text-xs mt-1 text-muted-foreground line-clamp-1">{h.reason}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-lg">{h.quantity}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{h.performedBy}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileOverlay>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  // null = the load FAILED — "no products" may only be claimed by a successful
  // empty response, not by a network error that happened to leave [] behind.
  const [products, setProducts] = useState<ProductResponse[] | null>([]);
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
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const isMobile = useIsMobile();

  // Two quick page taps fire two requests; the slower (older) one must not
  // paint its rows under the newer page counter. Only the latest may render.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const res = await productsApi.getAll(search || undefined, page, 30);
      if (seq !== loadSeq.current) return;
      const pg = extractPage(res);
      // Deleting the last product on the last page leaves `page` past the end;
      // the refetch then comes back empty and the screen reads "Mahsulot
      // topilmadi" over a "3 / 2" counter, as if the catalogue had vanished.
      if (page > 0 && page > pg.totalPages - 1) {
        setPage(Math.max(0, pg.totalPages - 1));
        return;
      }
      setProducts(extractContent(res));
      setTotalPages(pg.totalPages);
      setTotalElements(pg.totalElements);
    } catch {
      if (seq !== loadSeq.current) return;
      setProducts(null);
      toast.error('Mahsulotlar yuklanmadi');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  // Search follows the keystrokes (debounced), the same way the sell screen
  // does — the "Qidirish" button made the cashier type and then go hunting
  // for a button that the till never needed.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await productsApi.delete(deleteId);
      notify.success("Mahsulot o'chirildi");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato');
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader
          title="Mahsulotlar"
          description="Mahsulotlar ro'yxati va boshqaruvi"
          action={
            <Button aria-label="Yangi mahsulot" onClick={() => { setEditProduct(null); setProductDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Yangi mahsulot</span>
            </Button>
          }
        />

        {/* Search — live, no button: results update as the name is typed. */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Mahsulot qidirish..."
            className="pl-9 h-12 rounded-xl md:h-9"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        {isMobile ? (
          <>
            <div className="space-y-3 pb-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="shadow-sm"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))
            ) : products === null ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm mb-3">Mahsulotlar yuklanmadi</p>
                <Button variant="outline" size="sm" className="press" onClick={load}>Qayta urinish</Button>
              </div>
            ) : products.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Mahsulot topilmadi</p>
            ) : products.map(p => (
              <Card key={p.id} className="shadow-sm border-border overflow-hidden rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold tracking-tight text-foreground leading-snug">
                        <span className="break-words">{p.name}</span>
                        {/* Sold out is not "low" — it used to wear the same "Kam"
                            badge as a product with 4 left on the shelf. */}
                        {p.stockQuantity <= 0 ? (
                          <Badge variant="destructive" className="ml-2 text-[10px] align-middle px-1.5 py-0 h-4">Tugagan</Badge>
                        ) : p.stockQuantity <= LOW_STOCK_THRESHOLD && (
                          <Badge variant="destructive" className="ml-2 text-[10px] align-middle px-1.5 py-0 h-4">Kam</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{p.barcode}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-brand">{formatCurrency(p.price)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">tan narx {formatCurrency(p.purchasePrice)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mb-2">
                    Qoldiq: <span className="font-bold text-foreground">{p.stockQuantity} {getProductUnit(p.id)}</span>
                  </p>
                  {/* Five actions can't share a row with text on a 375px screen,
                      so they get their own full-width row of 44px targets. */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    {[
                      { key: 'restock', label: "To'ldirish", icon: RefreshCw, onClick: () => { setRestockProduct(p); setRestockOpen(true); } },
                      { key: 'outflow', label: 'Chiqim', icon: PackageMinus, onClick: () => { setOutflowProduct(p); setOutflowOpen(true); } },
                      { key: 'history', label: 'Tarix', icon: History, onClick: () => { setHistoryProduct(p); setHistoryOpen(true); } },
                      { key: 'edit', label: 'Tahrirlash', icon: Pencil, onClick: () => { setEditProduct(p); setProductDialogOpen(true); } },
                      { key: 'delete', label: "O'chirish", icon: Trash2, onClick: () => setDeleteId(p.id), danger: true },
                    ].map(action => (
                      <button
                        key={action.key}
                        type="button"
                        title={action.label}
                        aria-label={action.label}
                        onClick={action.onClick}
                        className={cn(
                          'flex-1 h-11 flex items-center justify-center rounded-xl transition-colors press',
                          action.danger
                            ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <action.icon className="h-[18px] w-[18px]" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="py-2">
            <PaginationControls
              page={page} totalPages={totalPages}
              totalElements={totalElements} size={30}
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
                      <TableHead className="whitespace-nowrap">Nomi</TableHead>
                      <TableHead className="whitespace-nowrap">Shtrix-kod</TableHead>
                      <TableHead className="whitespace-nowrap">Kelish narxi</TableHead>
                      <TableHead className="whitespace-nowrap">Sotish narxi</TableHead>
                      <TableHead className="whitespace-nowrap">Miqdor</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Amallar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((__, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : products === null ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <p className="text-muted-foreground text-sm mb-3">Mahsulotlar yuklanmadi</p>
                          <Button variant="outline" size="sm" className="press" onClick={load}>Qayta urinish</Button>
                        </TableCell>
                      </TableRow>
                    ) : products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                          Mahsulot topilmadi
                        </TableCell>
                      </TableRow>
                    ) : products.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {p.name}
                          {p.stockQuantity <= 0 ? (
                            <Badge variant="destructive" className="ml-2 text-[10px]">Tugagan</Badge>
                          ) : p.stockQuantity <= LOW_STOCK_THRESHOLD && (
                            <Badge variant="destructive" className="ml-2 text-[10px]">Kam</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.barcode}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatCurrency(p.purchasePrice)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-brand">{formatCurrency(p.price)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold">{p.stockQuantity}</TableCell>
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
              <div className="px-4 pb-3">
                <PaginationControls
                  page={page} totalPages={totalPages}
                  totalElements={totalElements} size={30}
                  onPageChange={setPage}
                />
              </div>
            </CardContent>
          </Card>
        )}
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
