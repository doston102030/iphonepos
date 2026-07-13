import React, { useCallback, useEffect, useState } from 'react';
import { Search, ShoppingCart, Minus, Plus, Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form, FormControl, FormField, FormItem
} from '@/components/ui/form';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { BarcodeScannerDialog, ScanButton } from '@/components/common/BarcodeScanner';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import { useCart } from '@/contexts/CartContext';
import { productsApi, ordersApi, type ProductResponse, extractContent } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';

// The API's paymentMethod also allows MIXED, but that needs a paidAmount split
// this screen does not collect — so it is not offered here.
const checkoutSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'CREDIT']),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
}).refine(data => {
  if (data.paymentMethod === 'CREDIT') return !!data.customerName && !!data.customerPhone;
  return true;
}, { message: "Qarzga sotuvda mijoz ma'lumotlari shart", path: ['customerName'] });

type CheckoutForm = z.infer<typeof checkoutSchema>;

function ProductGridCard({ product }: { product: ProductResponse }) {
  const { quantityOf, addItem, decrementItem } = useCart();
  const qty = quantityOf(product.id);
  // Sold-out products never reach this grid, so the only ceiling left to hold
  // is "don't put more in the cart than the shelf actually has".
  const atStockLimit = qty >= product.stockQuantity;

  return (
    <Card className="shadow-card relative rounded-2xl h-full">
      <CardContent className="flex h-full flex-col p-3">
        {qty > 0 && (
          <span className="absolute -top-2 -right-2 h-6 min-w-6 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-hover z-10">
            {qty}
          </span>
        )}
        <p className="text-base font-bold leading-tight line-clamp-2 break-words">{product.name}</p>
        <p className="text-base font-bold text-brand mt-1.5">{formatCurrency(product.price)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{product.stockQuantity} dona</p>
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

function CheckoutSheet({ open, onOpenChange, onCompleted }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCompleted: () => void;
}) {
  const { items, totalPrice, clear, addItem, decrementItem, removeItem } = useCart();
  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { paymentMethod: 'CASH', customerName: '', customerPhone: '' },
  });
  const paymentMethod = form.watch('paymentMethod');
  const isCredit = paymentMethod === 'CREDIT';

  useEffect(() => {
    if (open) form.reset({ paymentMethod: 'CASH', customerName: '', customerPhone: '' });
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
        customerName: values.customerName || undefined,
        customerPhone: values.customerPhone || undefined,
        // Qarzga: nothing is paid up front, the balance becomes a debt.
        paidAmount: values.paymentMethod === 'CREDIT' ? 0 : undefined,
      });
      toast.success('Savdo yakunlandi');
      clear();
      onOpenChange(false);
      onCompleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
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
      : 'border-border/60 bg-background text-foreground'
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
          <div className="bg-background rounded-3xl p-2 space-y-2 shadow-sm border border-border/50">
            {items.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground flex flex-col items-center justify-center opacity-60">
                <ShoppingCart className="h-12 w-12 mb-3" />
                <p>Savatcha bo'sh</p>
              </div>
            ) : items.map(c => (
              <div key={c.product.id} className="flex flex-col gap-3 p-3 rounded-2xl bg-muted/20">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base leading-tight mb-1 break-words">{c.product.name}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(c.product.price)} / dona</p>
                  </div>
                  <button
                    type="button"
                    aria-label="O'chirish"
                    onClick={() => removeItem(c.product.id)}
                    className="h-10 w-10 -mt-1 -mr-1 shrink-0 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-xl transition-colors press"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-lg text-primary min-w-0 truncate">{formatCurrency(c.product.price * c.quantity)}</p>
                  <div className="flex items-center gap-2 bg-background rounded-xl p-1 shadow-sm border border-border/50 shrink-0">
                    <button
                      type="button"
                      aria-label="Kamaytirish"
                      onClick={() => decrementItem(c.product.id)}
                      className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-foreground press"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-7 text-center font-bold text-base tabular-nums">{c.quantity}</span>
                    <button
                      type="button"
                      aria-label="Qo'shish"
                      disabled={c.quantity >= c.product.stockQuantity}
                      onClick={() => addItem(c.product)}
                      className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center disabled:opacity-30 press"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
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

              {paymentMethod === 'CREDIT' && (
                <div className="bg-background rounded-3xl p-4 space-y-4 shadow-sm border border-border/50">
                  <p className="font-bold text-sm text-muted-foreground px-1">Mijoz ma'lumotlari</p>
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input className="h-14 rounded-2xl bg-muted/50 border-0 text-base px-4 font-semibold" placeholder="Mijoz ismi" autoComplete="off" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input className="h-14 rounded-2xl bg-muted/50 border-0 text-base px-4 font-semibold" type="tel" inputMode="tel" placeholder="+998901234567" autoComplete="off" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              )}
            </form>
          </Form>
        </div>

        <div className="shrink-0 bg-background border-t border-border/50 px-4 pt-4 pb-4 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)] safe-area-bottom">
          {/* One number, one label. This screen collects no discount, so a
              separate "Jami" line would only repeat the total — and on a credit
              sale nothing is collected now, so calling it "to'lash kerak" would
              be a lie. */}
          <div className="flex items-center justify-between gap-3 mb-3 px-1">
            <p className="text-sm text-muted-foreground font-medium shrink-0">
              {isCredit ? 'Qarzga yoziladi:' : "To'lash kerak:"}
            </p>
            <p className={cn(
              'text-2xl font-black truncate',
              isCredit ? 'text-brand' : 'text-success'
            )}>
              {formatCurrency(totalPrice)}
            </p>
          </div>
          <Button
            type="submit"
            form="checkout-form"
            className="w-full h-14 rounded-2xl text-lg font-bold bg-success hover:bg-success/90 shadow-lg shadow-success/20"
            disabled={form.formState.isSubmitting || items.length === 0}
          >
            {form.formState.isSubmitting ? 'Saqlanmoqda...' : 'Buyurtmani tasdiqlash'}
          </Button>
        </div>
      </div>
    </MobileOverlay>
  );
}

export default function SellPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { totalCount, totalPrice, addItem, quantityOf } = useCart();

  // Nothing sold out belongs on a till screen — you cannot sell it, and it only
  // pushes the sellable products further down the grid. The server has no
  // "in stock only" filter, so the fetched page is narrowed here.
  const sellable = products.filter(p => p.stockQuantity > 0);
  const allSoldOut = products.length > 0 && sellable.length === 0;

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await productsApi.getAll(q || undefined, 0, 60);
      setProducts(extractContent(res));
    } catch {
      toast.error('Mahsulotlar yuklanmadi');
    } finally {
      setLoading(false);
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

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 items-stretch">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[140px] rounded-2xl" />)
          ) : allSoldOut ? (
            <div className="col-span-full flex flex-col items-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Sotuvga tayyor mahsulot yo'q — barchasi tugagan</p>
            </div>
          ) : sellable.length === 0 ? (
            <p className="col-span-full text-center py-10 text-sm text-muted-foreground">Mahsulot topilmadi</p>
          ) : sellable.map(p => <ProductGridCard key={p.id} product={p} />)}
        </div>
      </div>

      {totalCount > 0 && (
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
      <CheckoutSheet open={checkoutOpen} onOpenChange={setCheckoutOpen} onCompleted={() => load(search)} />
    </MainLayout>
  );
}
