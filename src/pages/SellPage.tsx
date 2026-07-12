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

function CheckoutSheet({ open, onOpenChange, onCompleted }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCompleted: () => void;
}) {
  const { items, totalPrice, clear } = useCart();
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] flex flex-col p-0">
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="px-4 pb-2 shrink-0">
          <h3 className="text-lg font-bold">Savatcha</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-4 space-y-2 mb-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Savatcha bo'sh</p>
          ) : items.map(c => (
            <div key={c.product.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-card shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.product.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(c.product.price)} × {c.quantity}</p>
              </div>
              <p className="text-sm font-bold shrink-0 text-accent">{formatCurrency(c.product.price * c.quantity)}</p>
            </div>
          ))}
        </div>
        <div className="shrink-0 bg-background px-4 pb-6 pt-2 border-t border-border mt-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="paymentType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase font-bold">To'lov turi</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12 rounded-xl text-base font-semibold"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="CASH" className="py-2.5 text-base font-semibold text-center">Naqd</SelectItem>
                      <SelectItem value="CARD" className="py-2.5 text-base font-semibold text-center">Karta</SelectItem>
                      <SelectItem value="DEBT" className="py-2.5 text-base font-semibold text-center">Qarz</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {paymentType === 'DEBT' && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                      <FormControl><Input className="h-11 rounded-xl bg-muted" placeholder="Ism familiya" autoComplete="off" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem>
                      <FormControl><Input className="h-11 rounded-xl bg-muted" placeholder="+998901234567" autoComplete="off" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-14 rounded-2xl text-base font-bold shadow-hover mt-2"
                disabled={form.formState.isSubmitting || items.length === 0}
              >
                {form.formState.isSubmitting ? 'Saqlanmoqda...' : `Tasdiqlash — ${formatCurrency(totalPrice)}`}
              </Button>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
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
