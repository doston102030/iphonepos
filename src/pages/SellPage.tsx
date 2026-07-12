import React, { useCallback, useEffect, useState } from 'react';
import { Search, ShoppingCart, Minus, Plus, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { BarcodeScannerDialog, ScanButton } from '@/components/common/BarcodeScanner';
import { useCart } from '@/contexts/CartContext';
import { productsApi, ordersApi, type ProductResponse, extractContent } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';

const checkoutSchema = z.object({
  paymentType: z.enum(['CASH', 'CARD', 'DEBT']),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
}).refine(data => {
  if (data.paymentType === 'DEBT') return !!data.customerName && !!data.customerPhone;
  return true;
}, { message: "Qarz to'lovda mijoz ma'lumotlari shart", path: ['customerName'] });

type CheckoutForm = z.infer<typeof checkoutSchema>;

function ProductGridCard({ product }: { product: ProductResponse }) {
  const { quantityOf, addItem, decrementItem } = useCart();
  const qty = quantityOf(product.id);
  const outOfStock = product.quantity <= 0;

  return (
    <Card className="shadow-card relative">
      <CardContent className="p-3.5">
        {qty > 0 && (
          <span className="absolute -top-2 -right-2 h-6 min-w-6 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-hover z-10">
            {qty}
          </span>
        )}
        <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center mb-2.5">
          <Package className="h-6 w-6 text-white" />
        </div>
        <p className="text-sm font-semibold truncate">{product.name}</p>
        <p className="text-sm font-bold text-primary mt-0.5">{formatCurrency(product.price)}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {outOfStock ? 'Tugagan' : `${product.quantity} ${product.unit}`}
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          <button
            type="button"
            disabled={qty === 0}
            onClick={() => decrementItem(product.id)}
            className="flex-1 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center disabled:opacity-30 transition-opacity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => addItem(product)}
            className="flex-1 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center disabled:opacity-30 transition-opacity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

import { MobileOverlay } from '@/components/common/MobileOverlay';
import { Trash2 } from 'lucide-react';

function CheckoutSheet({ open, onOpenChange, onCompleted }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCompleted: () => void;
}) {
  const { items, totalPrice, clear, addItem, decrementItem, removeItem } = useCart();
  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { paymentType: 'CASH', customerName: '', customerPhone: '' },
  });
  const paymentType = form.watch('paymentType');

  useEffect(() => {
    if (open) form.reset({ paymentType: 'CASH', customerName: '', customerPhone: '' });
  }, [open, form]);

  async function onSubmit(values: CheckoutForm) {
    if (items.length === 0) return;
    try {
      await ordersApi.create({
        items: items.map(c => ({ productId: c.product.id, quantity: c.quantity })),
        paymentType: values.paymentType,
        customerName: values.customerName || undefined,
        customerPhone: values.customerPhone || undefined,
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

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title="Savatcha">
      <div className="flex flex-col h-full bg-muted/10 relative">
        <div className="absolute top-[-56px] right-4 z-50">
          {items.length > 0 && (
            <button onClick={handleClear} className="text-sm font-semibold text-destructive px-2 py-2">
              Tozalash
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-4">
          <div className="bg-background rounded-3xl p-2 space-y-2 shadow-sm border border-border/50">
            {items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground flex flex-col items-center justify-center opacity-60">
                <ShoppingCart className="h-12 w-12 mb-3" />
                <p>Savatcha bo'sh</p>
              </div>
            ) : items.map(c => (
              <div key={c.product.id} className="flex flex-col gap-3 p-3 rounded-2xl bg-muted/20">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <p className="font-bold text-base leading-tight mb-1">{c.product.name}</p>
                    <p className="text-sm text-muted-foreground">{formatCurrency(c.product.price)} / {c.product.unit}</p>
                  </div>
                  <button onClick={() => removeItem(c.product.id)} className="p-2 -mt-1 -mr-1 text-muted-foreground hover:text-destructive rounded-xl transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-lg text-primary">{formatCurrency(c.product.price * c.quantity)}</p>
                  <div className="flex items-center gap-3 bg-background rounded-xl p-1 shadow-sm border border-border/50">
                    <button type="button" onClick={() => decrementItem(c.product.id)} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-foreground hover:bg-muted/80">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center font-bold text-base">{c.quantity}</span>
                    <button type="button" onClick={() => addItem(c.product)} className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-warning/10 border border-warning/20 rounded-2xl p-4 text-warning-foreground text-sm font-medium">
            <p>Eng ko'pi {formatCurrency(totalPrice)} gacha chegirma qila olasiz. (tannarxdan pastga sota olmaysiz)</p>
          </div>

          <Form {...form}>
            <form id="checkout-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <p className="font-bold text-base mb-3 px-1">To'lov usuli</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => form.setValue('paymentType', 'CASH')} className={cn("h-14 rounded-2xl font-bold text-base transition-all border-2", paymentType === 'CASH' ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-background text-foreground")}>Naqd</button>
                  <button type="button" onClick={() => form.setValue('paymentType', 'CARD')} className={cn("h-14 rounded-2xl font-bold text-base transition-all border-2", paymentType === 'CARD' ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-background text-foreground")}>Karta</button>
                  <button type="button" disabled className={cn("h-14 rounded-2xl font-bold text-base transition-all border-2 opacity-50", "border-border/50 bg-background text-foreground")}>Aralash</button>
                  <button type="button" onClick={() => form.setValue('paymentType', 'DEBT')} className={cn("h-14 rounded-2xl font-bold text-base transition-all border-2", paymentType === 'DEBT' ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-background text-foreground")}>Qarzga</button>
                </div>
              </div>

              {paymentType === 'DEBT' && (
                <div className="bg-background rounded-3xl p-4 space-y-4 shadow-sm border border-border/50 mt-4">
                  <p className="font-bold text-sm text-muted-foreground px-1">Mijoz ma'lumotlari</p>
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                      <FormControl><Input className="h-14 rounded-2xl bg-muted/50 border-0 text-base px-4 font-semibold" placeholder="Mijoz ismi" autoComplete="off" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormControl><Input className="h-14 rounded-2xl bg-muted/50 border-0 text-base px-4 font-semibold" placeholder="+998901234567" autoComplete="off" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              )}
            </form>
          </Form>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border/50 p-4 pb-6 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-end mb-4 px-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-medium">Jami:</p>
              <p className="text-sm text-muted-foreground font-medium">To'lash kerak:</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-sm font-bold">{formatCurrency(totalPrice)}</p>
              <p className="text-xl font-black text-success">{formatCurrency(totalPrice)}</p>
            </div>
          </div>
          <Button
            type="submit"
            form="checkout-form"
            className="w-full h-16 rounded-[1.25rem] text-xl font-bold bg-success hover:bg-success/90 shadow-lg shadow-success/20"
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
  const { totalCount, totalPrice, addItem } = useCart();

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

  async function handleScanned(barcode: string) {
    try {
      const product = await productsApi.getByBarcode(barcode);
      if (!product) { toast.error("Bu shtrix-kodli mahsulot topilmadi"); return; }
      addItem(product);
      toast.success(`${product.name} savatchaga qo'shildi`);
    } catch {
      toast.error("Bu shtrix-kodli mahsulot topilmadi");
    }
  }

  return (
    <MainLayout>
      <div className={cn('p-6', totalCount > 0 && 'pb-28')}>
        <PageHeader
          title="Sotish"
          description="Mahsulotlarni tanlab tezkor savdo qiling"
          action={<ScanButton onClick={() => setScannerOpen(true)} />}
        />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Mahsulot qidirish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[168px] rounded-xl" />)
          ) : products.length === 0 ? (
            <p className="col-span-full text-center py-10 text-sm text-muted-foreground">Mahsulot topilmadi</p>
          ) : products.map(p => <ProductGridCard key={p.id} product={p} />)}
        </div>
      </div>

      {totalCount > 0 && (
        <button
          type="button"
          onClick={() => setCheckoutOpen(true)}
          className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-30 flex items-center justify-between px-5 h-14 rounded-2xl bg-primary text-primary-foreground shadow-card hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex items-center justify-center">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-2 -right-2 h-4 min-w-4 px-1 rounded-full bg-white text-primary text-[10px] font-bold flex items-center justify-center shadow-sm">
                {totalCount}
              </span>
            </span>
            <span className="font-semibold text-sm">Savatcha</span>
          </div>
          <span className="font-bold text-base">{formatCurrency(totalPrice)}</span>
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
