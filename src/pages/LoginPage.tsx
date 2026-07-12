import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/common/Logo';
import { authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const isDemoMode = import.meta.env.VITE_USE_MOCK === 'true';

export default function LoginPage() {
  const [pin, setPin] = useState(isDemoMode ? '0000' : '');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) {
      setError("PIN kod kiritilmadi");
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ pin });
      login(res);
      toast.success(`Xush kelibsiz, ${res.username}!`);
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
        setError('Server bilan bog\'lanib bo\'lmadi. Internet aloqasini tekshiring yoki PIN kodingizni tekshiring.');
      } else {
        setError(msg || 'PIN noto\'g\'ri');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col items-center justify-center p-12">
        <div className="max-w-sm w-full text-center">
          <img src="/logo-dark.png" alt="inPOS" className="h-12 w-auto object-contain mx-auto mb-6" />
          <p className="text-white/70 text-base leading-relaxed">
            Mahsulot, buyurtma, qarz va hisobotlarni boshqarish uchun professional tizim
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {['Mahsulotlar', 'Buyurtmalar', 'Hisobotlar'].map(item => (
              <div key={item} className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-white/90 text-xs font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center mb-8">
            <Logo className="h-8" />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Tizimga kirish</h2>
            {isDemoMode && <p className="text-muted-foreground text-sm mt-1">Demo rejim — API ulanmaydi</p>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN kod</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  placeholder={isDemoMode ? '0000 / 1111 / 2222' : 'PIN kodni kiriting'}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  className="pr-10"
                  autoComplete="current-password"
                  maxLength={20}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPin(v => !v)}
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isDemoMode && (
                <p className="text-xs text-muted-foreground">
                  Demo PIN: <span className="font-mono font-semibold">0000</span> (SUPER_ADMIN) ·{' '}
                  <span className="font-mono font-semibold">1111</span> (ADMIN) ·{' '}
                  <span className="font-mono font-semibold">2222</span> (KASSIR)
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-md">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Kirilmoqda...' : 'Kirish'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
