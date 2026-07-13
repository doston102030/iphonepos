import { useCallback, useEffect, useState } from 'react';
import { Send, MessageSquare, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import {
  smsApi, type SmsCampaignResponse, type SmsBalanceResponse,
  parseRecipients, extractContent
} from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

// SmsSendRequest is exactly { recipients, message } — the server has no campaign
// name, so the form only collects those two things.
const smsSchema = z.object({
  message: z.string().min(1, 'Xabar matni kiritilishi shart'),
  recipients: z.string().min(1, 'Kamida bitta telefon raqami kiritilishi shart'),
});

type SmsForm = z.infer<typeof smsSchema>;

function splitRecipients(raw: string): string[] {
  return raw.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean);
}

function SendSmsDialog({ open, onOpenChange, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void;
}) {
  const form = useForm<SmsForm>({
    resolver: zodResolver(smsSchema),
    defaultValues: { message: '', recipients: '' },
  });

  useEffect(() => { if (open) form.reset(); }, [open, form]);

  async function onSubmit(values: SmsForm) {
    const recipients = splitRecipients(values.recipients);
    if (recipients.length === 0) {
      form.setError('recipients', { message: 'Telefon raqami kiritilishi shart' });
      return;
    }
    try {
      await smsApi.sendSms({ recipients, message: values.message });
      toast.success('SMS yuborildi');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      // POST /api/sms/send answers 501 until Eskiz is wired up; api.ts turns that
      // into "Bu xizmat hali ulanmagan." — surface it verbatim.
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  return (
    <MobileOverlay open={open} onOpenChange={onOpenChange} title="SMS yuborish">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-5 h-full flex flex-col">
          <FormField control={form.control} name="message" render={({ field }) => (
            <FormItem>
              <FormLabel>Xabar matni</FormLabel>
              <FormControl>
                <Textarea placeholder="SMS xabar matni..." rows={4} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="recipients" render={({ field }) => (
            <FormItem>
              <FormLabel>Telefon raqamlar (vergul yoki yangi qator bilan ajrating)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="+998901234567&#10;+998901234568"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="pt-4 pb-6 mt-auto">
            <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/25" disabled={form.formState.isSubmitting}>
              <Send className="h-4 w-4 mr-1.5" />
              {form.formState.isSubmitting ? 'Yuborilmoqda...' : 'Yuborish'}
            </Button>
          </div>
        </form>
      </Form>
    </MobileOverlay>
  );
}

export default function SmsPage() {
  // null = the fetch failed. [] = there really are no campaigns. Rendering
  // "Kampaniya yo'q" for both would state something we do not know.
  const [campaigns, setCampaigns] = useState<SmsCampaignResponse[] | null>([]);
  const [balance, setBalance] = useState<SmsBalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const isMobile = useIsMobile();

  // Separately settled: /api/sms/balance answers 501 until the Eskiz integration
  // is wired up (see api.ts), and Promise.all let that failure throw away the
  // campaign list that had loaded perfectly well — the page then claimed there
  // were no campaigns at all.
  const loadData = useCallback(async () => {
    setLoading(true);
    const [c, b] = await Promise.allSettled([
      smsApi.getCampaigns(),
      smsApi.getBalance(),
    ]);

    if (c.status === 'fulfilled') setCampaigns(extractContent(c.value));
    else { setCampaigns(null); toast.error('Kampaniyalar yuklanmadi'); }

    setBalance(b.status === 'fulfilled' ? b.value : null);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader
          title="SMS"
          description="SMS xabarlar va kampaniyalar"
          action={
            <Button aria-label="SMS yuborish" onClick={() => setSendOpen(true)}>
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">SMS yuborish</span>
            </Button>
          }
        />

        {/* Balance card — the server sends a bare number, so the unit is the
            literal word "SMS". `mock` means the figure is not from Eskiz. */}
        <Card className="shadow-card mb-4 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">SMS Balans</p>
                {loading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold truncate">
                      {balance ? `${balance.balance} SMS` : '—'}
                    </p>
                    {balance?.mock && <Badge variant="secondary" className="shrink-0">Mock</Badge>}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaigns */}
        <Card className="shadow-card rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Kampaniyalar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isMobile ? (
              <div className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4"><Skeleton className="h-14 w-full" /></div>
                  ))
                ) : !campaigns ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <p className="text-sm text-muted-foreground">Kampaniyalar yuklanmadi</p>
                    <Button variant="outline" size="sm" className="press" onClick={loadData}>Qayta urinish</Button>
                  </div>
                ) : campaigns.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Kampaniya yo'q</p>
                ) : campaigns.map(c => (
                  <div key={c.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">#{c.id}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.message}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {parseRecipients(c.recipients).length} ta raqam
                        </p>
                        <p className="text-xs text-muted-foreground">{c.smsCount} SMS</p>
                        <Badge variant={c.delivered ? 'default' : 'secondary'} className="mt-1">
                          {c.delivered ? 'Yuborildi' : 'Yuborilmadi'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">{formatDateTime(c.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">ID</TableHead>
                    <TableHead className="whitespace-nowrap">Xabar</TableHead>
                    <TableHead className="whitespace-nowrap">Raqamlar</TableHead>
                    <TableHead className="whitespace-nowrap">SMS soni</TableHead>
                    <TableHead className="whitespace-nowrap">Holat</TableHead>
                    <TableHead className="whitespace-nowrap">Sana</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !campaigns ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                        Kampaniyalar yuklanmadi —{' '}
                        <button type="button" className="text-primary font-medium underline" onClick={loadData}>
                          qayta urinish
                        </button>
                      </TableCell>
                    </TableRow>
                  ) : campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                        Kampaniya yo'q
                      </TableCell>
                    </TableRow>
                  ) : campaigns.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap font-medium">#{c.id}</TableCell>
                      <TableCell className="max-w-48 truncate text-sm">{c.message}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {parseRecipients(c.recipients).length} ta
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {c.smsCount}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={c.delivered ? 'default' : 'secondary'}>
                          {c.delivered ? 'Yuborildi' : 'Yuborilmadi'}
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
            )}
          </CardContent>
        </Card>
      </div>

      <SendSmsDialog open={sendOpen} onOpenChange={setSendOpen} onSaved={loadData} />
    </MainLayout>
  );
}
