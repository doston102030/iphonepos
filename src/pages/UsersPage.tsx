import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { PaginationControls } from '@/components/common/PaginationControls';
import { MobileOverlay } from '@/components/common/MobileOverlay';
import {
  usersApi, type UserResponse, extractContent, extractPage
} from '@/lib/api';
import { getRoleBadgeVariant, getRoleLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// The API only knows CASHIER and SUPER_ADMIN. PIN is required to create a user
// (UserRequest) but optional to update one (UserUpdateRequest) — so an empty PIN
// is legal when editing and means "keep the current one". Demanding a new PIN
// just to rename someone was our invention, not the contract's.
const userSchema = z.object({
  fullName: z.string().min(1, "To'liq ism kiritilishi shart"),
  pin: z.string().regex(/^\d{4}$/, "PIN 4 ta raqamdan iborat bo'lishi kerak").or(z.literal('')),
  role: z.enum(['CASHIER', 'SUPER_ADMIN']),
});

type UserForm = z.infer<typeof userSchema>;

function UserDialog({
  open, onOpenChange, user, onSaved
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  user: UserResponse | null; onSaved: () => void;
}) {
  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { fullName: '', pin: '', role: 'CASHIER' },
  });

  useEffect(() => {
    if (user) {
      form.reset({ fullName: user.fullName, pin: '', role: user.role });
    } else {
      form.reset({ fullName: '', pin: '', role: 'CASHIER' });
    }
  }, [user, open, form]);

  async function onSubmit(values: UserForm) {
    // A new user must get a PIN — there is no other way to log in.
    if (!user && !values.pin) {
      form.setError('pin', { message: 'PIN kiritilishi shart' });
      return;
    }
    try {
      if (user) {
        await usersApi.update(user.id, {
          fullName: values.fullName,
          role: values.role,
          // Left blank: keep whatever PIN they have now.
          pin: values.pin || undefined,
        });
        toast.success('Foydalanuvchi yangilandi');
      } else {
        await usersApi.create({ ...values, pin: values.pin });
        toast.success('Foydalanuvchi yaratildi');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    }
  }

  return (
    <MobileOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={user ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-5 h-full flex flex-col">
          <FormField control={form.control} name="fullName" render={({ field }) => (
            <FormItem>
              <FormLabel>To'liq ism</FormLabel>
              <FormControl>
                <Input className="h-11" placeholder="Masalan: Aziz Karimov" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="pin" render={({ field }) => (
            <FormItem>
              <FormLabel>
                {user ? "PIN kod (o'zgartirmasangiz — bo'sh qoldiring)" : 'PIN kod (4 ta raqam)'}
              </FormLabel>
              <FormControl>
                <Input
                  className="h-11" type="password" inputMode="numeric"
                  maxLength={4} autoComplete="off"
                  placeholder={user ? 'O‘zgarishsiz' : '••••'} {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="role" render={({ field }) => (
            <FormItem>
              <FormLabel>Rol</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="CASHIER">Kassir</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <div className="pt-4 pb-6 mt-auto">
            <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-bold" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </form>
      </Form>
    </MobileOverlay>
  );
}

export default function UsersPage() {
  // null = the load FAILED — "no users" may only come from a successful
  // empty response, never from a network error.
  const [users, setUsers] = useState<UserResponse[] | null>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [editUser, setEditUser] = useState<UserResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { isSuperAdmin, user: currentUser } = useAuth();
  const isMobile = useIsMobile();

  // By id, not by name: two employees can share a full name, and comparing names
  // then disabled delete/deactivate on the wrong row — while leaving the real
  // self-protection off.
  const isSelf = (u: UserResponse) => !!currentUser && u.id === currentUser.id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll(page, 20);
      const pg = extractPage(res);
      // Deleting the last row of the last page leaves `page` past the end, and
      // the refetch then returns nothing — the admin sees an empty list and a
      // "3 / 2" counter. Step back instead.
      if (page > 0 && page > pg.totalPages - 1) {
        setPage(Math.max(0, pg.totalPages - 1));
        return;
      }
      setUsers(extractContent(res));
      setTotalPages(pg.totalPages);
      setTotalElements(pg.totalElements);
    } catch {
      setUsers(null);
      toast.error('Foydalanuvchilar yuklanmadi');
    }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(u: UserResponse) {
    try {
      await usersApi.toggleStatus(u.id, !u.active);
      toast.success('Holat o\'zgartirildi');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato');
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await usersApi.delete(deleteId);
      toast.success("Foydalanuvchi o'chirildi");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato');
    } finally { setDeleteId(null); }
  }

  if (!isSuperAdmin) {
    return (
      <MainLayout>
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-center h-64 text-center text-muted-foreground">
            Bu sahifaga kirish huquqingiz yo'q
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <PageHeader
          title="Foydalanuvchilar"
          description="Kassir va super adminlarni boshqarish"
          action={
            <Button aria-label="Yangi foydalanuvchi" onClick={() => { setEditUser(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Yangi foydalanuvchi</span>
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
                ) : users === null ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground text-sm mb-3">Foydalanuvchilar yuklanmadi</p>
                    <Button variant="outline" size="sm" className="press" onClick={load}>Qayta urinish</Button>
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">Foydalanuvchi topilmadi</p>
                ) : users.map(u => (
                  <div key={u.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{u.fullName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant={getRoleBadgeVariant(u.role)}>{getRoleLabel(u.role)}</Badge>
                          <Badge variant={u.active ? 'default' : 'outline'}>
                            {u.active ? 'Faol' : 'Nofaol'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center shrink-0">
                        <Button
                          variant="ghost" size="icon" className="h-11 w-11"
                          title={u.active ? 'Nofaol qilish' : 'Faollashtirish'}
                          aria-label={u.active ? 'Nofaol qilish' : 'Faollashtirish'}
                          onClick={() => handleToggle(u)}
                          disabled={isSelf(u)}
                        >
                          {u.active
                            ? <ToggleRight className="h-4 w-4 text-primary" />
                            : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          }
                        </Button>
                        <Button variant="ghost" size="icon" className="h-11 w-11"
                          title="Tahrirlash" aria-label="Tahrirlash"
                          onClick={() => { setEditUser(u); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-11 w-11 text-destructive hover:text-destructive"
                          title="O'chirish" aria-label="O'chirish"
                          disabled={isSelf(u)}
                          onClick={() => setDeleteId(u.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">To'liq ism</TableHead>
                    <TableHead className="whitespace-nowrap">Rol</TableHead>
                    <TableHead className="whitespace-nowrap">Holat</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : users === null ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <p className="text-muted-foreground text-sm mb-3">Foydalanuvchilar yuklanmadi</p>
                        <Button variant="outline" size="sm" className="press" onClick={load}>Qayta urinish</Button>
                      </TableCell>
                    </TableRow>
                  ) : users.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="whitespace-nowrap font-medium">{u.fullName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={getRoleBadgeVariant(u.role)}>{getRoleLabel(u.role)}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={u.active ? 'default' : 'outline'}>
                          {u.active ? 'Faol' : 'Nofaol'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title={u.active ? 'Nofaol qilish' : 'Faollashtirish'}
                            onClick={() => handleToggle(u)}
                            disabled={isSelf(u)}
                          >
                            {u.active
                              ? <ToggleRight className="h-3.5 w-3.5 text-primary" />
                              : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                            }
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            title="Tahrirlash"
                            onClick={() => { setEditUser(u); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            title="O'chirish"
                            disabled={isSelf(u)}
                            onClick={() => setDeleteId(u.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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

      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editUser} onSaved={load} />

      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Foydalanuvchini o'chirish</AlertDialogTitle>
            <AlertDialogDescription>Bu amalni qaytarib bo'lmaydi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
