import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/common/Logo';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-6 px-6 pt-[calc(2.5rem+var(--inset-top))] pb-[calc(2.5rem+var(--inset-bottom))] text-center bg-background">
      <Logo className="h-8" />

      <div className="h-20 w-20 rounded-3xl bg-muted flex items-center justify-center">
        <SearchX className="h-9 w-9 text-muted-foreground" />
      </div>

      <div className="space-y-2 max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sahifa topilmadi</h1>
        <p className="text-sm text-muted-foreground">
          Siz qidirgan sahifa mavjud emas yoki o'chirilgan. Manzilni tekshirib qaytadan urinib ko'ring.
        </p>
      </div>

      <Button asChild className="h-12 rounded-2xl px-6 font-bold">
        <Link to="/">Bosh sahifaga qaytish</Link>
      </Button>
    </div>
  );
}
