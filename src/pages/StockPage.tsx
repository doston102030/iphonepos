import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Package, PackageX, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import {
  productsApi, fetchAllPages,
  LOW_STOCK_THRESHOLD, type ProductResponse,
} from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { getProductUnit } from '@/lib/units';

type StockGroup = 'IN_STOCK' | 'LOW' | 'OUT';

const GROUP_TABS: { value: StockGroup; label: string }[] = [
  { value: 'IN_STOCK', label: 'Omborda bor' },
  { value: 'LOW', label: 'Kam qolgan' },
  { value: 'OUT', label: 'Tugagan' },
];

/** Same cutoff the server uses for GET /api/products/low-stock. */
function groupOf(p: ProductResponse): StockGroup {
  if (p.stockQuantity <= 0) return 'OUT';
  if (p.stockQuantity <= LOW_STOCK_THRESHOLD) return 'LOW';
  return 'IN_STOCK';
}


function StockCard({ product }: { product: ProductResponse }) {
  const group = groupOf(product);
  const tone =
    group === 'OUT' ? 'text-destructive' :
    group === 'LOW' ? 'text-brand' : 'text-success';

  return (
    <Card className="rounded-2xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10)] dark:shadow-[0_2px_10px_-2px_rgba(0,0,0,0.45)]">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn(
          'h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center',
          group === 'OUT' ? 'bg-destructive/10 text-destructive' :
          group === 'LOW' ? 'bg-brand/10 text-brand' : 'bg-success/10 text-success',
        )}>
          {group === 'OUT'
            ? <PackageX className="h-5 w-5" />
            : group === 'LOW'
              ? <AlertTriangle className="h-5 w-5" />
              : <Package className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight break-words">{product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {product.barcode ? product.barcode : 'Shtrix-kodsiz'} · {formatCurrency(product.price)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('text-lg font-black tabular-nums', tone)}>{product.stockQuantity}</p>
          <p className="text-[11px] text-muted-foreground">{getProductUnit(product.id)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StockPage() {
  const [products, setProducts] = useState<ProductResponse[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<StockGroup>('IN_STOCK');
  const [search, setSearch] = useState('');

  // Every product, not one server page: the three counts sit on the tabs, and a
  // count that had only seen 100 of 300 products would be a lie on the tab.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAllPages<ProductResponse>(
        (page, size) => productsApi.getAll(undefined, page, size),
      );
      setProducts(res.items);
      setTruncated(res.truncated);
    } catch {
      setProducts(null);
      toast.error('Ombor yuklanmadi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const base: Record<StockGroup, number> = { IN_STOCK: 0, LOW: 0, OUT: 0 };
    for (const p of products ?? []) base[groupOf(p)]++;
    return base;
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter(p => {
      if (groupOf(p) !== group) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q);
    });
  }, [products, group, search]);

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader title="Ombor" description="Mahsulot qoldiqlari holati" />

        <div className="flex gap-1 p-1 rounded-2xl bg-muted border border-border mb-4">
          {GROUP_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setGroup(tab.value)}
              className={cn(
                'flex-1 min-w-0 h-11 px-2 rounded-xl text-[13px] font-semibold transition-colors press border',
                group === tab.value
                  ? 'bg-card text-foreground border-border shadow-sm'
                  : 'text-muted-foreground border-transparent',
              )}
            >
              <span className="block truncate">{tab.label}</span>
              {/* "—", not 0, when the fetch failed: a zero here is a claim about
                  the warehouse, and we do not know anything about it. */}
              <span className="block text-[11px] font-bold opacity-70 tabular-nums">
                {loading || !products ? '—' : counts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-12 rounded-xl md:h-9"
            placeholder="Nomi yoki shtrix-kod..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {truncated && !loading && (
          <p className="mb-3 text-xs text-muted-foreground">
            Mahsulot juda ko'p — barchasi ko'rsatilmadi. Qidiruvdan foydalaning.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)
          ) : !products ? (
            <div className="col-span-full flex flex-col items-center py-12 text-muted-foreground">
              <p className="text-sm mb-3">Ombor yuklanmadi</p>
              <Button variant="outline" className="press" onClick={load}>Qayta urinish</Button>
            </div>
          ) : visible.length === 0 ? (
            <p className="col-span-full text-center py-10 text-sm text-muted-foreground">Mahsulot yo'q</p>
          ) : visible.map(p => <StockCard key={p.id} product={p} />)}
        </div>
      </div>
    </MainLayout>
  );
}
