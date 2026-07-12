import React, { useEffect, useState } from 'react';
import { Send, MessageSquare, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import {
  smsApi, type SmsCampaignResponse, type SmsBalanceResponse
} from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

const smsSchema = z.object({
  campaignName: z.string().optional(),
  message: z.string().min(1, 'Xabar matni kiritilishi shart'),
  phones: z.string().min(1, 'Kamida bitta telefon raqami kiritilishi shart'),
});

type SmsForm = z.infer<typeof smsSchema>;

function SendSmsDialog({ open, onOpenChange, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void;
}) {
  const form = useForm<SmsForm>({
    resolver: zodResolver(smsSchema),
    defaultValues: { campaignName: '', message: '', phones: '' },
  });

  useEffect(() => { if (open) form.reset(); }, [open, form]);

  async function onSubmit(values: SmsForm) {
    const phones = values.phones
      .split(/[\n,;]+/)
      .map(p => p.trim())
      .filter(Boolean);
    if (phones.length === 0) {
      form.setError('phones', { message: 'Telefon raqami kiritilishi shart' });
      return;
    }
    try {
      await smsApi.sendSms({
        message: values.message,
        phones,
        campaignName: values.campaignName || undefined,
      });
      toast.success('SMS kampaniyasi saqlandi');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <DialogHeader><DialogTitle>SMS yuborish</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="campaignName" render={({ field }) => (
              <FormItem>
                <FormLabel>Kampaniya nomi (ixtiyoriy)</FormLabel>
                <FormControl><Input className="h-11" placeholder="Kampaniya nomi..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="message" render={({ field }) => (
              <FormItem>
                <FormLabel>Xabar matni</FormLabel>
                <FormControl>
                  <Textarea placeholder="SMS xabar matni..." rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phones" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefon raqamlar (vergul yoki yangi qator bilan ajrating)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="+998901234567&#10;+998901234568"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-11" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
              <Button type="submit" className="flex-1 rounded-xl h-11" disabled={form.formState.isSubmitting}>
                <Send className="h-4 w-4 mr-1.5" />
                {form.formState.isSubmitting ? 'Yuborilmoqda...' : 'Yuborish'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function SmsPage() {
  const [campaigns, setCampaigns] = useState<SmsCampaignResponse[]>([]);
  const [balance, setBalance] = useState<SmsBalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [c, b] = await Promise.all([
        smsApi.getCampaigns(),
        smsApi.getBalance(),
      ]);
      setCampaigns(c);
      setBalance(b);
    } catch { toast.error('Ma\'lumotlar yuklanmadi'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);

  return (
    <MainLayout>
      <div className="p-6">
        <PageHeader
          title="SMS"
          description="SMS xabarlar va kampaniyalar"
          action={
            <Button size="sm" onClick={() => setSendOpen(true)}>
              <Send className="h-4 w-4 mr-1.5" />
              SMS yuborish
            </Button>
          }
        />

        {/* Balance card */}
        <Card className="shadow-card mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SMS Balans</p>
                {loading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <p className="text-xl font-bold">
                    {balance ? `${balance.balance} ${balance.currency}` : '—'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaigns */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Kampaniyalar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Kampaniya</TableHead>
                    <TableHead className="whitespace-nowrap">Xabar</TableHead>
                    <TableHead className="whitespace-nowrap">Telefonlar</TableHead>
                    <TableHead className="whitespace-nowrap">Holat</TableHead>
                    <TableHead className="whitespace-nowrap">Sana</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                        Kampaniya yo'q
                      </TableCell>
                    </TableRow>
                  ) : campaigns.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {c.campaignName ?? `#${c.id}`}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-sm">{c.message}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {c.phones?.length ?? 0} ta
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={c.delivered ? 'default' : 'secondary'}>
                          {c.delivered ? 'Yuborildi' : 'Mock'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(c.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <SendSmsDialog open={sendOpen} onOpenChange={setSendOpen} onSaved={loadData} />
    </MainLayout>
  );
}
