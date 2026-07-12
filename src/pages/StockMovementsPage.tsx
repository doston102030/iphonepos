import React, { useCallback, useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { PaginationControls } from '@/components/common/PaginationControls';
import {
  stockMovementsApi, type StockMovementResponse, extractContent, extractPage
} from '@/lib/api';
import { formatDateTime, getStockMovementTypeLabel } from '@/lib/utils';

const MOVEMENT_TYPES = ['IN', 'OUT', 'SALE', 'ADJUSTMENT'] as const;

function typeBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type === 'IN') return 'default';
  if (type === 'SALE') return 'secondary';
  if (type === 'OUT') return 'destructive';
  return 'outline';
}

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovementResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState<{
    from?: string; to?: string; type?: string;
  }>({});
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stockMovementsApi.getAll({
        from: appliedFilters.from,
        to: appliedFilters.to,
        type: appliedFilters.type,
        page,
        size: 20,
      });
      setMovements(extractContent(res));
      const pg = extractPage(res);
      setTotalPages(pg.totalPages);
      setTotalElements(pg.totalElements);
    } catch { toast.error('Ombor harakatlari yuklanmadi'); }
    finally { setLoading(false); }
  }, [appliedFilters, page]);

  useEffect(() => { load(); }, [load]);

  function applyFilters() {
    setPage(0);
    setAppliedFilters({
      from: fromDate ? `${fromDate}T00:00:00` : undefined,
      to: toDate ? `${toDate}T23:59:59` : undefined,
      type: filterType === 'all' ? undefined : filterType,
    });
  }

  function clearFilters() {
    setFromDate('');
    setToDate('');
    setFilterType('all');
    setPage(0);
    setAppliedFilters({});
  }

  return (
    <MainLayout>
      <div className="p-6">
        <PageHeader
          title="Ombor harakatlari"
          description="Mahsulot kirish va chiqishlarini kuzatish"
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Input
            type="date"
            className="w-40"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            placeholder="Dan"
          />
          <Input
            type="date"
            className="w-40"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            placeholder="Gacha"
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Harakat turi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              {MOVEMENT_TYPES.map(t => (
                <SelectItem key={t} value={t}>{getStockMovementTypeLabel(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={applyFilters} size="sm">
            <Filter className="h-4 w-4 mr-1.5" />
            Filtrlash
          </Button>
          {(appliedFilters.from || appliedFilters.to || appliedFilters.type) && (
            <Button variant="outline" size="sm" onClick={clearFilters}>Tozalash</Button>
          )}
        </div>

        <Card className="shadow-card">
          <CardContent className="p-0">
            {isMobile ? (
              <div className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4"><Skeleton className="h-14 w-full" /></div>
                  ))
                ) : movements.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Harakat topilmadi</p>
                ) : movements.map(m => (
                  <div key={m.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{m.productName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(m.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{m.quantity}</p>
                        <Badge variant={typeBadgeVariant(m.type)} className="mt-1">
                          {getStockMovementTypeLabel(m.type)}
                        </Badge>
                      </div>
                    </div>
                    {m.note && <p className="text-xs text-muted-foreground mt-1.5 truncate">{m.note}</p>}
                  </div>
                ))}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">ID</TableHead>
                    <TableHead className="whitespace-nowrap">Mahsulot</TableHead>
                    <TableHead className="whitespace-nowrap">Tur</TableHead>
                    <TableHead className="whitespace-nowrap">Miqdor</TableHead>
                    <TableHead className="whitespace-nowrap">Izoh</TableHead>
                    <TableHead className="whitespace-nowrap">Sana</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 7 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : movements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                        Harakat topilmadi
                      </TableCell>
                    </TableRow>
                  ) : movements.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">#{m.id}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{m.productName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={typeBadgeVariant(m.type)}>
                          {getStockMovementTypeLabel(m.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">{m.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-48 truncate">{m.note ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
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
    </MainLayout>
  );
}
