import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, ShoppingCart, Minus, Plus, Package, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form, FormControl, FormField, FormItem, FormMessage
} from '@/components/ui/form';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import useKeyboardOpen from '@/hooks/use-keyboard-open';
import { BarcodeScannerDialog, ScanButton } from '@/components/common/BarcodeScanner';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useCart, type CartItem } from '@/contexts/CartContext';
import {
  productsApi, ordersApi, fetchAllPages, newIdempotencyKey, type ProductResponse,
} from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { getProductUnit } from '@/lib/units';
import { notify } from '@/lib/notify';

// Units sold by measure, not by count: for these the cart also takes a target
// SUM — "2000 so'mlik bering" — and works the quantity out itself.
const MEASURED_UNITS = new Set(['kg', 'gramm', 'litr', 'ml']);

// The API's paymentMethod also allows MIXED, but that needs a paidAmount split
// this screen does not collect — so it is not offered here.
// One refine per field, so the message lands on the input that is actually empty
// — a single error pinned to customerName left an empty phone field unmarked.
const checkoutSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'CREDIT']),
  discountAmount: z.coerce.number().min(0).optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
})
  .refine(d => d.paymentMethod !== 'CREDIT' || !!d.customerName?.trim(), {
    message: "Qarzga sotuvda mijoz ismi shart", path: ['customerName'],
  })
  .refine(d => d.paymentMethod !== 'CREDIT' || !!d.customerPhone?.trim(), {
    message: 'Telefon raqami shart', path: ['customerPhone'],
  });

type CheckoutForm = z.infer<typeof checkoutSchema>;

function ProductGridCard({ product, onEdit }: { product: ProductResponse; onEdit: () => void }) {
  const { quantityOf, addItem, decrementItem } = useCart();
  const qty = quantityOf(product.id);
  // Sold-out products never reach this grid, so the only ceiling left to hold
  // is "don't put more in the cart than the shelf actually has".
  const atStockLimit = qty >= product.stockQuantity;

  return (
    <Card className="relative rounded-2xl h-full shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.45)]">
      <CardContent className="flex h-full flex-col p-3">
        {qty > 0 && (
          <span className="absolute -top-2 -right-2 h-6 min-w-6 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-hover z-10">
            {qty}
          </span>
        )}
        <p className="text-base font-bold leading-tight line-clamp-2 break-words">{product.name}</p>
        <p className="text-base font-bold text-brand mt-1.5">{formatCurrency(product.price)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{product.stockQuantity} {getProductUnit(product.id)}</p>
        <div className="flex items-center gap-2 mt-auto pt-3">
          <button
            type="button"
            aria-label="Kamaytirish"
            disabled={qty === 0}
            onClick={() => decrementItem(product.id)}
            className="flex-1 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center disabled:opacity-30 press"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Qo'lda kiritish"
            onClick={onEdit}
            className="flex-1 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center press"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Qo'shish"
            disabled={atStockLimit}
            onClick={() => addItem(product)}
            className="flex-1 h-9 rounded-xl bg-success/10 text-success flex items-center justify-center disabled:opacity-30 press"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The counter modal: type the QUANTITY by hand, or — for measured units — type
 * the target SUM ("2000 so'mlik bering") and the quantity is worked out. The
 * two fields drive each other. Quantities are whole numbers because the
 * server's OrderItemRequest.quantity is int32, so the sum rounds to the
 * nearest whole kg/litr and "Jami" always shows the real charge. Removal from
 * the basket lives here too — the row's trash icon became this pencil.
 */
function QuantityModal({ product, open, onOpenChange }: {
  product: ProductResponse | null; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { quantityOf, addItem, setItemQuantity, removeItem } = useCart();
  const [qtyDraft, setQtyDraft] = useState('1');
  const [sumDraft, setSumDraft] = useState('');
  const inCart = product ? quantityOf(product.id) > 0 : false;

  useEffect(() => {
    if (open && product) {
      const q = quantityOf(product.id) || 1;
      setQtyDraft(String(q));
      setSumDraft(String(q * product.price));
    }
  }, [open, product, quantityOf]);

  if (!product) return null;
  const unit = getProductUnit(product.id);
  const measured = MEASURED_UNITS.has(unit);

  const qtyNum = Math.floor(Number(qtyDraft));
  const validQty = qtyDraft !== '' && Number.isFinite(qtyNum) && qtyNum >= 1;
  // What will actually be charged after the stock ceiling and rounding.
  const finalQty = validQty ? Math.min(qtyNum, product.stockQuantity) : 0;
  const overStock = validQty && qtyNum > product.stockQuantity;

  function handleQtyChange(v: string) {
    setQtyDraft(v);
    const n = Math.floor(Number(v));
    if (v !== '' && Number.isFinite(n) && n >= 0) setSumDraft(String(n * product!.price));
  }
  function handleSumChange(v: string) {
    setSumDraft(v);
    const n = Number(v);
    if (v !== '' && Number.isFinite(n) && product!.price > 0) {
      setQtyDraft(String(Math.max(1, Math.round(n / product!.price))));
    }
  }
  function handleSave() {
    if (!validQty) return;
    // addItem first covers the grid case (row not in the basket yet);
    // setItemQuantity then lands the typed amount, clamped to stock.
    if (!inCart) addItem(product!);
    setItemQuantity(product!.id, qtyNum);
    onOpenChange(false);
  }
  function handleRemove() {
    removeItem(product!.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] rounded-3xl p-5">
        <div className="pr-8">
          <DialogTitle className="text-lg font-bold leading-tight break-words">{product.name}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {formatCurrency(product.price)} / {unit} · Omborda: {product.stockQuantity} {unit}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Miqdor ({unit})</p>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                aria-label="Miqdor"
                placeholder="1"
                className="w-full h-12 rounded-2xl bg-muted/50 border border-border/50 px-4 pr-16 text-lg font-bold outline-none focus:border-primary"
                value={qtyDraft}
                onFocus={e => e.target.select()}
                onChange={e => handleQtyChange(e.target.value)}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">{unit}</span>
            </div>
          </div>

          {measured && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Yoki summa bilan</p>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label="Summa bilan"
                  placeholder="0"
                  className="w-full h-12 rounded-2xl bg-muted/50 border border-border/50 px-4 pr-16 text-lg font-bold outline-none focus:border-primary"
                  value={sumDraft}
                  onFocus={e => e.target.select()}
                  onChange={e => handleSumChange(e.target.value)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">so'm</span>
              </div>
            </div>
          )}

          {overStock && (
            <p className="text-xs font-medium text-destructive">
              Omborda faqat {product.stockQuantity} {unit} bor — shunga tushiriladi.
            </p>
          )}
          <div className="flex items-center justify-between rounded-2xl bg-success/10 px-4 py-3">
            <span className="text-sm font-medium text-success">Jami</span>
            <span className="text-base font-bold text-success">
              {finalQty > 0 ? `${finalQty} ${unit} · ${formatCurrency(finalQty * product.price)}` : '—'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {inCart && (
            <button
              type="button"
              onClick={handleRemove}
              className="h-12 px-4 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0 press"
              aria-label="Savatchadan o'chirish"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={!validQty}
            className="flex-1 h-12 rounded-2xl text-base font-bold"
          >
            Tayyor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One basket line. The quantity is typeable in place; the pencil opens the
 * QuantityModal (hand-typed kg or a target sum) — removal lives there too.
 */
function CartItemRow({ item, onEdit }: { item: CartItem; onEdit: () => void }) {
  const { addItem, decrementItem, setItemQuantity } = useCart();
  const { product, quantity } = item;
  const unit = getProductUnit(product.id);
  // null = mirror the cart; a string while the cashier is mid-type, so typing
  // "27" isn't clamped/normalized after the first keystroke.
  const [qtyDraft, setQtyDraft] = useState<string | null>(null);

  function applyQty(raw: string) {
    const n = Number(raw);
    if (raw !== '' && Number.isFinite(n)) setItemQuantity(product.id, n);
  }

  return (
    <div className="flex flex-col gap-3 p-3 rounded-2xl bg-muted/20">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight mb-1 break-words">{product.name}</p>
          <p className="text-sm text-muted-foreground">{formatCurrency(product.price)} / {unit}</p>
        </div>
        <button
          type="button"
          aria-label="Qo'lda kiritish"
          onClick={onEdit}
          className="h-10 w-10 -mt-1 -mr-1 shrink-0 flex items-center justify-center text-primary bg-primary/10 rounded-xl transition-colors press"
        >
          <Pencil className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-lg text-primary min-w-0 truncate">{formatCurrency(product.price * quantity)}</p>
        <div className="flex items-center gap-1 bg-background rounded-xl p-1 shadow-sm border border-border shrink-0">
          <button
            type="button"
            aria-label="Kamaytirish"
            onClick={() => { setQtyDraft(null); decrementItem(product.id); }}
            className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-foreground press"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            aria-label="Miqdor"
            className="w-14 h-10 text-center font-bold text-base tabular-nums bg-transparent outline-none rounded-lg focus:bg-muted/50"
            value={qtyDraft ?? String(quantity)}
            onFocus={e => e.target.select()}
            onChange={e => { setQtyDraft(e.target.value); applyQty(e.target.value); }}
            onBlur={() => setQtyDraft(null)}
          />
          <button
            type="button"
            aria-label="Qo'shish"
            disabled={quantity >= product.stockQuantity}
            onClick={() => { setQtyDraft(null); addItem(product); }}
            className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center disabled:opacity-30 press"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutSheet({ open, onOpenChange, onCompleted }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCompleted: () => void;
}) {
  const { items, totalPrice, clear } = useCart();
  const [editProduct, setEditProduct] = useState<ProductResponse | null>(null);
  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { paymentMethod: 'CASH', customerName: '', customerPhone: '' },
  });
  const paymentMethod = form.watch('paymentMethod');
  const isCredit = paymentMethod === 'CREDIT';
  // A discount can never make an order negative or drop below zero to pay.
  const discount = Math.min(Math.max(0, Number(form.watch('discountAmount')) || 0), totalPrice);
  const payable = totalPrice - discount;

  // One key per opened cart, deliberately NOT per submit: if the first attempt's
  // response is lost to a dropped connection, the retry carries the same key and
  // the server returns the sale it already recorded instead of charging twice.
  const idempotencyKey = useRef(newIdempotencyKey());

  useEffect(() => {
    if (open) {
      form.reset({ paymentMethod: 'CASH', discountAmount: 0, customerName: '', customerPhone: '' });
      idempotencyKey.current = newIdempotencyKey();
    }
  }, [open, form]);

  async function onSubmit(values: CheckoutForm) {
    if (items.length === 0) return;
    const insufficientItem = items.find(item => item.quantity > item.product.stockQuantity);
    if (insufficientItem) {
      toast.error(`${insufficientItem.product.name} uchun ombordagi qoldiq yetarli emas`);
      return;
    }
    try {
      await ordersApi.create({
        items: items.map(c => ({ productId: c.product.id, quantity: c.quantity })),
        paymentMethod: values.paymentMethod,
        discountAmount: discount > 0 ? discount : undefined,
        customerName: values.customerName || undefined,
        customerPhone: values.customerPhone || undefined,
        // Qarzga: nothing is paid up front, the balance becomes a debt.
        paidAmount: values.paymentMethod === 'CREDIT' ? 0 : undefined,
      }, idempotencyKey.current);
      notify.success('Savdo yakunlandi');
      clear();
      onOpenChange(false);
      onCompleted();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  const handleClear = () => {
    clear();
    onOpenChange(false);
  };

  const payButtonClass = (method: CheckoutForm['paymentMethod']) => cn(
    'h-14 rounded-2xl font-bold text-base transition-colors border-2 press',
    paymentMethod === method
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-border bg-background text-foreground'
  );

  return (
    <MobileOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Savatcha"
      action={items.length > 0 ? (
        <button
          type="button"
          onClick={handleClear}
          className="text-sm font-semibold text-destructive px-2 py-2 press whitespace-nowrap"
        >
          Tozalash
        </button>
      ) : undefined}
    >
      <div className="flex flex-col h-full bg-muted/10">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
          <div className="bg-background rounded-3xl p-2 space-y-2 shadow-sm border border-border">
            {items.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground flex flex-col items-center justify-center opacity-60">
                <ShoppingCart className="h-12 w-12 mb-3" />
                <p>Savatcha bo'sh</p>
              </div>
            ) : items.map(c => (
              <CartItemRow key={c.product.id} item={c} onEdit={() => setEditProduct(c.product)} />
            ))}
          </div>

          <Form {...form}>
            <form id="checkout-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <p className="font-bold text-base mb-3 px-1">To'lov usuli</p>
                <div className="grid grid-cols-3 gap-3">
                  <button type="button" onClick={() => form.setValue('paymentMethod', 'CASH')} className={payButtonClass('CASH')}>Naqd</button>
                  <button type="button" onClick={() => form.setValue('paymentMethod', 'CARD')} className={payButtonClass('CARD')}>Karta</button>
                  <button type="button" onClick={() => form.setValue('paymentMethod', 'CREDIT')} className={payButtonClass('CREDIT')}>Qarzga</button>
                </div>
              </div>

              <div>
                <p className="font-bold text-base mb-3 px-1">Chegirma (ixtiyoriy)</p>
                <FormField control={form.control} name="discountAmount" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number" inputMode="numeric" min={0}
                          className="h-14 rounded-2xl bg-muted/50 border-0 text-base px-4 pr-14 font-semibold"
                          placeholder="0"
                          {...field}
                          value={field.value === 0 || field.value === undefined ? '' : field.value}
                          onChange={e => {
                            // min={0} only disarms the spinner — the keyboard can
                            // still type "-2000", which failed zod with no message
                            // anywhere and left "Tasdiqlash" dead mid-sale.
                            const n = Number(e.target.value);
                            field.onChange(e.target.value === '' || !Number.isFinite(n) ? 0 : Math.max(0, n));
                          }}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium pointer-events-none">so'm</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {paymentMethod === 'CREDIT' && (
                <div className="bg-background rounded-3xl p-4 space-y-4 shadow-sm border border-border">
                  <p className="font-bold text-sm text-muted-foreground px-1">Mijoz ma'lumotlari</p>
                  {/* Without these, the zod refine below silently blocked the
                      submit: the cashier pressed "Tasdiqlash" and nothing at all
                      happened — no message, no toast, a dead button mid-sale. */}
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input className="h-14 rounded-2xl bg-muted/50 border-0 text-base px-4 font-semibold" placeholder="Mijoz ismi" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input className="h-14 rounded-2xl bg-muted/50 border-0 text-base px-4 font-semibold" type="tel" inputMode="tel" placeholder="+998901234567" autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
            </form>
          </Form>
        </div>

        {/* A floating card held clear of the screen edge (like the nav dock),
            not a bar welded to it: the confirm button used to sit flush against
            the bottom, half under the thumb. One calc'd margin, not mb-6 +
            safe-area-mb — both set margin-bottom, so one would silently lose. */}
        <div className="shrink-0 bg-background border border-border mx-3 mb-[calc(1.25rem+var(--inset-bottom,0px))] px-4 py-4 rounded-3xl shadow-hover">
          {/* Jami and Chegirma only appear once there's a discount to explain —
              otherwise the payable line would just repeat the subtotal. */}
          {discount > 0 && (
            <div className="space-y-1 mb-2 px-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Jami:</p>
                <p className="text-sm font-semibold">{formatCurrency(totalPrice)}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Chegirma:</p>
                <p className="text-sm font-semibold text-destructive">− {formatCurrency(discount)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 mb-3 px-1">
            <p className="text-sm text-muted-foreground font-medium shrink-0">
              {isCredit ? 'Qarzga yoziladi:' : "To'lash kerak:"}
            </p>
            <p className={cn(
              'text-2xl font-black truncate',
              isCredit ? 'text-brand' : 'text-success'
            )}>
              {formatCurrency(payable)}
            </p>
          </div>
          <Button
            type="submit"
            form="checkout-form"
            className="w-full h-14 rounded-2xl text-lg font-bold bg-success hover:bg-success/90"
            disabled={form.formState.isSubmitting || items.length === 0}
          >
            {form.formState.isSubmitting ? 'Saqlanmoqda...' : 'Buyurtmani tasdiqlash'}
          </Button>
        </div>
      </div>
      <QuantityModal
        product={editProduct}
        open={!!editProduct}
        onOpenChange={v => { if (!v) setEditProduct(null); }}
      />
    </MobileOverlay>
  );
}

export default function SellPage() {
  const [products, setProducts] = useState<ProductResponse[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [gridEditProduct, setGridEditProduct] = useState<ProductResponse | null>(null);
  const { totalCount, totalPrice, addItem, quantityOf } = useCart();
  // While the cashier types in search, the fixed checkout pill would park
  // itself right above the keyboard (Android resizes the webview under it),
  // covering the very results being searched — step aside until typing ends.
  const keyboardOpen = useKeyboardOpen();

  // Nothing sold out belongs on a till screen — you cannot sell it, and it only
  // pushes the sellable products further down the grid. The server has no
  // "in stock only" filter, so every page is fetched and narrowed here: filtering
  // one 60-row page instead used to hide product #61 from the till entirely, and
  // could claim the whole shop was sold out when only the first 60 rows were.
  const sellable = (products ?? []).filter(p => p.stockQuantity > 0);
  const allSoldOut = !!products && products.length > 0 && sellable.length === 0;

  // A broad query ("c") fans out into many page fetches and can land AFTER the
  // narrow query typed a second later — the till then shows results for "c"
  // under a search box that says "cola". Only the latest request may render.
  const loadSeq = useRef(0);
  const load = useCallback(async (q: string) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const res = await fetchAllPages<ProductResponse>(
        (page, size) => productsApi.getAll(q || undefined, page, size),
      );
      if (seq !== loadSeq.current) return;
      setProducts(res.items);
      setTruncated(res.truncated);
    } catch {
      if (seq !== loadSeq.current) return;
      setProducts(null);
      toast.error('Mahsulotlar yuklanmadi');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleScanned = useCallback(async (barcode: string) => {
    try {
      const product = await productsApi.getByBarcode(barcode);
      if (!product) { toast.error('Bu shtrix-kodli mahsulot topilmadi'); return; }
      // addItem silently refuses to go past the stock ceiling, so without these
      // two checks a scan of a sold-out product would still toast "qo'shildi".
      if (product.stockQuantity <= 0) {
        toast.error(`${product.name} — omborda tugagan`);
        return;
      }
      if (quantityOf(product.id) >= product.stockQuantity) {
        toast.error(`${product.name} — ombordagi qoldiq yetarli emas`);
        return;
      }
      addItem(product);
      toast.success(`${product.name} savatchaga qo'shildi`);
    } catch {
      toast.error('Bu shtrix-kodli mahsulot topilmadi');
    }
  }, [addItem, quantityOf]);

  return (
    <MainLayout>
      <div className={cn('p-4 md:p-6', totalCount > 0 && 'pb-24')}>
        <PageHeader
          title="Sotish"
          description="Mahsulotlarni tanlab tezkor savdo qiling"
          action={<ScanButton onClick={() => setScannerOpen(true)} />}
        />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-12 rounded-xl md:h-9"
            placeholder="Mahsulot qidirish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {truncated && !loading && (
          <p className="mb-3 text-xs text-muted-foreground">
            Mahsulot juda ko'p — barchasi ko'rsatilmadi. Qidiruvdan foydalaning.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 items-stretch">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[140px] rounded-2xl" />)
          ) : !products ? (
            <div className="col-span-full flex flex-col items-center py-12 text-muted-foreground">
              <p className="text-sm mb-3">Mahsulotlar yuklanmadi</p>
              <Button variant="outline" className="press" onClick={() => load(search)}>Qayta urinish</Button>
            </div>
          ) : allSoldOut ? (
            <div className="col-span-full flex flex-col items-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">
                {search
                  ? "Bu qidiruv bo'yicha sotuvga tayyor mahsulot yo'q"
                  : "Sotuvga tayyor mahsulot yo'q — barchasi tugagan"}
              </p>
            </div>
          ) : sellable.length === 0 ? (
            <p className="col-span-full text-center py-10 text-sm text-muted-foreground">Mahsulot topilmadi</p>
          ) : sellable.map(p => (
            <ProductGridCard key={p.id} product={p} onEdit={() => setGridEditProduct(p)} />
          ))}
        </div>
      </div>

      {totalCount > 0 && !keyboardOpen && (
        <button
          type="button"
          onClick={() => setCheckoutOpen(true)}
          className="fixed md:absolute bottom-above-nav md:bottom-6 left-1/2 md:left-auto md:right-6 -translate-x-1/2 md:translate-x-0 w-[calc(100%-2rem)] max-w-[398px] md:max-w-sm z-30 flex items-center justify-between gap-3 px-5 h-14 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/30 ring-1 ring-black/5 press"
        >
          <span className="flex items-center gap-3 shrink-0">
            <span className="relative flex items-center justify-center">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-2 -right-2 h-4 min-w-4 px-1 rounded-full bg-white text-primary text-[10px] font-bold flex items-center justify-center shadow-sm">
                {totalCount}
              </span>
            </span>
            <span className="font-semibold text-sm">Savatcha</span>
          </span>
          <span className="font-bold text-base truncate">{formatCurrency(totalPrice)}</span>
        </button>
      )}

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScanned}
        title="Mahsulotni skanerlash"
      />
      <QuantityModal
        product={gridEditProduct}
        open={!!gridEditProduct}
        onOpenChange={v => { if (!v) setGridEditProduct(null); }}
      />
      <CheckoutSheet open={checkoutOpen} onOpenChange={setCheckoutOpen} onCompleted={() => load(search)} />
    </MainLayout>
  );
}
