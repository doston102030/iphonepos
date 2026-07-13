import { useCallback, useEffect, useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import MainLayout, { PageHeader } from '@/components/layouts/MainLayout';
import { useTheme } from '@/contexts/ThemeContext';
import { settingsApi } from '@/lib/api';

/** The server stores `language` as a free string; the UI only offers these two. */
type Language = 'uz' | 'ru';

const LANGUAGE_LABELS: Record<Language, string> = {
  uz: "O'zbekcha",
  ru: 'Ruscha',
};

function toLanguage(value: string | undefined): Language {
  return value === 'ru' ? 'ru' : 'uz';
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState<Language>('uz');

  // darkMode is not local state: it *is* the live theme, so the switch, the
  // header toggle and the saved value can never drift apart.
  //
  // The server's darkMode is deliberately NOT applied on mount. It used to be —
  // by *toggling* against the live theme — so a cashier who switched to dark
  // from the menu and then opened Sozlamalar was snapped straight back to light,
  // their choice silently undone. The live theme (persisted in localStorage) is
  // what the user last chose; "Saqlash" is what writes it to the server.
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';

  // If the GET fails, the form must NOT fall back to its defaults and stay
  // editable: it would show "O'zbekcha" to a Russian-language user, and the
  // first press of "Saqlash" would write that guess over their real setting.
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    settingsApi.get()
      .then(data => setLanguage(toLanguage(data.language)))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await settingsApi.update({ language, darkMode });
      toast.success('Sozlamalar saqlandi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-2xl">
        <PageHeader title="Sozlamalar" description="Tizim sozlamalarini boshqarish" />

        <Card className="shadow-card rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Umumiy sozlamalar</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                ))}
                <Skeleton className="h-11 w-32" />
              </div>
            ) : loadFailed ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-muted-foreground max-w-xs leading-snug">
                  Sozlamalar yuklanmadi. Saqlangan qiymatlar noma'lum — shuning uchun
                  forma ochilmadi, aks holda saqlash serverdagini o'chirib yuborardi.
                </p>
                <Button variant="outline" className="h-11 press" onClick={load}>
                  Qayta urinish
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="language">Til</Label>
                  <Select
                    value={language}
                    onValueChange={value => setLanguage(toLanguage(value))}
                  >
                    <SelectTrigger id="language" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LANGUAGE_LABELS) as Language[]).map(code => (
                        <SelectItem key={code} value={code}>{LANGUAGE_LABELS[code]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-4 min-h-[44px]">
                  <div className="space-y-0.5">
                    <Label htmlFor="darkMode">Qorong'u rejim</Label>
                    <p className="text-xs text-muted-foreground">
                      Ilova ko'rinishini darhol o'zgartiradi
                    </p>
                  </div>
                  <Switch
                    id="darkMode"
                    checked={darkMode}
                    onCheckedChange={() => toggleTheme()}
                  />
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    onClick={handleSave}
                    className="w-full sm:w-auto h-11 press"
                    disabled={saving}
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed border-t pt-4">
                  Do'kon nomi, valyuta va soliq sozlamalari hozircha serverda mavjud emas —
                  ular saqlanmaydi. Hozircha faqat til va qorong'u rejim sozlanadi.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
