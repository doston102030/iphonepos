import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { PaginationControls } from '@/components/common/PaginationControls';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import {
  ordersApi, type OrderResponse, type PaymentMethod, extractContent, extractPage
} from '@/lib/api';
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

function paymentBadgeVariant(method: PaymentMethod): BadgeVariant {
  const variants: Record<PaymentMethod, BadgeVariant> = {
    CASH: 'default',
    CARD: 'secondary',
    MIXED: 'outline',
    CREDIT: 'destructive',
  };
  return variants[method];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderResponse[] | null>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [viewOrder, setViewOrder] = useState<OrderResponse | null>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.getAll(page, 20);
      setOrders(extractContent(res));
      const pg = extractPage(res);
      setTotalPages(pg.totalPages);
      setTotalElements(pg.totalElements);
    } catch {
      // null, not []: "Buyurtma topilmadi" would state that the shop has no
      // orders, which is a very different thing from a failed request.
      setOrders(null);
      toast.error('Buyurtmalar yuklanmadi');
    }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader
          title="Buyurtmalar"
          description="Barcha buyurtmalar ro'yxati"
          action={
            <Button aria-label="Yangi buyurtma" onClick={() => navigate('/sell')}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Yangi buyurtma</span>
            </Button>
          }
        />

        <Card className="shadow-card rounded-2xl">
          <CardContent className="p-0">
            {isMobile ? (
              <div className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4"><Skeleton className="h-14 w-full" /></div>
                  ))
                ) : !orders ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <p className="text-sm text-muted-foreground">Buyurtmalar yuklanmadi</p>
                    <Button variant="outline" size="sm" className="press" onClick={load}>Qayta urinish</Button>
                  </div>
                ) : orders.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Buyurtma topilmadi</p>
                ) : orders.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setViewOrder(o)}
                    className="w-full text-left p-4 min-h-[3.75rem] active:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">#{o.id}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(o.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-brand">{formatCurrency(o.totalAmount)}</p>
                        <Badge variant={paymentBadgeVariant(o.paymentMethod)} className="mt-1">
                          {getPaymentMethodLabel(o.paymentMethod)}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">ID</TableHead>
                    <TableHead className="whitespace-nowrap">Umumiy summa</TableHead>
                    <TableHead className="whitespace-nowrap">To'lov turi</TableHead>
                    <TableHead className="whitespace-nowrap">Sana</TableHead>
                    <TableHead className="whitespace-nowrap">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !orders ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                        Buyurtmalar yuklanmadi —{' '}
                        <button type="button" className="text-primary font-medium underline" onClick={load}>
                          qayta urinish
                        </button>
                      </TableCell>
                    </TableRow>
                  ) : orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                        Buyurtma topilmadi
                      </TableCell>
                    </TableRow>
                  ) : orders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">#{o.id}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(o.totalAmount)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={paymentBadgeVariant(o.paymentMethod)}>
                          {getPaymentMethodLabel(o.paymentMethod)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(o.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => setViewOrder(o)}>
                          Ko'rish
                        </Button>
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
                totalElements={totalElements} size={20}
                onPageChange={setPage}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Order Overlay */}
      <MobileOverlay
        open={!!viewOrder}
        onOpenChange={o => !o && setViewOrder(null)}
        title={`Buyurtma #${viewOrder?.id ?? ''}`}
      >
        {viewOrder && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Sana:</span> <span className="font-medium">{formatDateTime(viewOrder.createdAt)}</span></div>
              <div>
                <span className="text-muted-foreground">To'lov:</span>{' '}
                <Badge variant={paymentBadgeVariant(viewOrder.paymentMethod)}>
                  {getPaymentMethodLabel(viewOrder.paymentMethod)}
                </Badge>
              </div>
            </div>
            <Separator />
            <div className="space-y-1">
              {(viewOrder.items ?? []).map((item, i) => (
                <div key={i} className="flex justify-between text-sm gap-3">
                  <span className="min-w-0 break-words">{item.productName} × {item.quantity}</span>
                  <span className="font-medium shrink-0">{formatCurrency(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Oraliq summa:</span>
                <span className="font-medium text-right">{formatCurrency(viewOrder.subtotal)}</span>
              </div>
              {viewOrder.discountAmount > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Chegirma:</span>
                  <span className="font-medium text-right">-{formatCurrency(viewOrder.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold gap-3 pt-1">
                <span>Jami:</span>
                <span className="text-brand text-right">{formatCurrency(viewOrder.totalAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </MobileOverlay>
    </MainLayout>
  );
}
