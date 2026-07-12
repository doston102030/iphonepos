import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { settingsApi, type SettingsResponse } from '@/lib/api';

const settingsSchema = z.object({
  storeName: z.string().min(1, 'Do\'kon nomi kiritilishi shart'),
  currency: z.string().min(1, 'Valyuta kiritilishi shart'),
  taxRate: z.coerce.number().min(0).max(100),
  address: z.string().optional(),
  phone: z.string().optional(),
  monthlyTarget: z.coerce.number().min(0).optional(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      storeName: '', currency: 'UZS', taxRate: 0, address: '', phone: '', monthlyTarget: 0,
    },
  });

  useEffect(() => {
    settingsApi.get()
      .then(data => {
        form.reset({
          storeName: data.storeName ?? '',
          currency: data.currency ?? 'UZS',
          taxRate: data.taxRate ?? 0,
          address: (data.address as string) ?? '',
          phone: (data.phone as string) ?? '',
          monthlyTarget: data.monthlyTarget ?? 0,
        });
      })
      .catch(() => toast.error('Sozlamalar yuklanmadi'))
      .finally(() => setLoading(false));
  }, [form]);

  async function onSubmit(values: SettingsForm) {
    try {
      await settingsApi.update(values as SettingsResponse);
      toast.success('Sozlamalar saqlandi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-2xl">
        <PageHeader title="Sozlamalar" description="Tizim sozlamalarini boshqarish" />

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Umumiy sozlamalar</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="storeName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Do'kon nomi</FormLabel>
                      <FormControl><Input placeholder="Do'kon nomi" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="currency" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valyuta</FormLabel>
                        <FormControl><Input placeholder="UZS" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="taxRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Soliq stavkasi (%)</FormLabel>
                        <FormControl><Input type="number" min={0} max={100} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manzil (ixtiyoriy)</FormLabel>
                      <FormControl><Input placeholder="Do'kon manzili" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon (ixtiyoriy)</FormLabel>
                      <FormControl><Input placeholder="+998901234567" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="monthlyTarget" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Oylik savdo maqsadi (so'm)</FormLabel>
                      <FormControl><Input type="number" min={0} placeholder="0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="pt-2">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      <Save className="h-4 w-4 mr-1.5" />
                      {form.formState.isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
