import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { PaginationControls } from '@/components/common/PaginationControls';
import {
  ordersApi, type OrderResponse, extractContent, extractPage
} from '@/lib/api';
import { formatCurrency, formatDateTime, getPaymentTypeLabel } from '@/lib/utils';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
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
    } catch { toast.error('Buyurtmalar yuklanmadi'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const paymentBadgeVariant = (type: string) => {
    if (type === 'CASH') return 'default';
    if (type === 'CARD') return 'secondary';
    return 'destructive';
  };

  return (
    <MainLayout>
      <div className="p-6">
        <PageHeader
          title="Buyurtmalar"
          description="Barcha buyurtmalar ro'yxati"
          action={
            <Button size="sm" onClick={() => navigate('/sell')}>
              <Plus className="h-4 w-4 mr-1.5" />
              Yangi buyurtma
            </Button>
          }
        />

        <Card className="shadow-card">
          <CardContent className="p-0">
            {isMobile ? (
              <div className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4"><Skeleton className="h-14 w-full" /></div>
                  ))
                ) : orders.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Buyurtma topilmadi</p>
                ) : orders.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setViewOrder(o)}
                    className="w-full text-left p-3.5 active:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">#{o.id} · {o.cashierName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(o.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-accent">{formatCurrency(o.totalPrice)}</p>
                        <Badge variant={paymentBadgeVariant(o.paymentType)} className="mt-1">
                          {getPaymentTypeLabel(o.paymentType)}
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
                    <TableHead className="whitespace-nowrap">Kassir</TableHead>
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
                        {Array.from({ length: 6 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                        Buyurtma topilmadi
                      </TableCell>
                    </TableRow>
                  ) : orders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">#{o.id}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{o.cashierName}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">{formatCurrency(o.totalPrice)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={paymentBadgeVariant(o.paymentType)}>
                          {getPaymentTypeLabel(o.paymentType)}
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

      {/* View Order Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={o => !o && setViewOrder(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buyurtma #{viewOrder?.id}</DialogTitle>
          </DialogHeader>
          {viewOrder && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Kassir:</span> <span className="font-medium">{viewOrder.cashierName}</span></div>
                <div><span className="text-muted-foreground">Sana:</span> <span className="font-medium">{formatDateTime(viewOrder.createdAt)}</span></div>
                <div><span className="text-muted-foreground">To'lov:</span> <Badge variant={viewOrder.paymentType === 'DEBT' ? 'destructive' : 'default'}>{getPaymentTypeLabel(viewOrder.paymentType)}</Badge></div>
                {viewOrder.customerName && <div><span className="text-muted-foreground">Mijoz:</span> <span className="font-medium">{viewOrder.customerName}</span></div>}
                {viewOrder.customerPhone && <div><span className="text-muted-foreground">Telefon:</span> <span className="font-medium">{viewOrder.customerPhone}</span></div>}
              </div>
              <Separator />
              <div className="space-y-1">
                {(viewOrder.items ?? []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.productName} × {item.quantity}</span>
                    <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Jami:</span>
                <span className="text-accent">{formatCurrency(viewOrder.totalPrice)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
