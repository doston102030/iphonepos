import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Delete, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/common/Logo';
import { authApi } from '@/lib/api';
import { homePathFor } from '@/routes';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const isDemoMode = import.meta.env.VITE_USE_MOCK === 'true';
// The PIN submits itself once this many digits are entered — there is no
// confirm button. Bump this if PINs ever get longer than four digits.
const PIN_LENGTH = 4;

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ProtectedRoute stashes where the user was headed before it bounced them
  // here; going anywhere else would silently drop a deep link.
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? null;

  const submit = useCallback(async (value: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ pin: value });
      login(res);
      toast.success(`Xush kelibsiz, ${res.fullName}!`);
      // No deep link to honour: land on whatever "home" means for this role — a
      // cashier has no dashboard, so sending them to "/" would only bounce.
      navigate(from ?? homePathFor(res.role), { replace: true });
    } catch (err) {
      // request() already turns a dead network into an Uzbek sentence, so
      // whatever arrives here is safe to show as-is.
      setError(err instanceof Error && err.message ? err.message : "PIN noto'g'ri");
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [login, navigate, from]);

  // Fire once the last digit lands. The ref guards against a second submit for
  // the same PIN if this effect re-runs before `loading` has flipped.
  const submittingRef = useRef(false);
  useEffect(() => {
    if (pin.length < PIN_LENGTH || submittingRef.current) return;
    submittingRef.current = true;
    submit(pin).finally(() => { submittingRef.current = false; });
  }, [pin, submit]);

  function press(digit: string) {
    if (loading) return;
    setError('');
    setPin(prev => (prev.length >= PIN_LENGTH ? prev : prev + digit));
  }

  function backspace() {
    if (loading) return;
    setError('');
    setPin(prev => prev.slice(0, -1));
  }

  return (
    <div className="min-h-[100dvh] flex bg-background">
      {/* Brand panel — desktop only */}
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

      {/* PIN panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 safe-area-top safe-area-bottom">
        <div className="w-full max-w-[340px] flex flex-col items-center gap-7">
          <div className="flex flex-col items-center gap-5">
            <Logo className="h-9" />
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground tracking-tight">PIN kodni kiriting</h2>
              {isDemoMode && (
                <p className="text-muted-foreground text-xs mt-1">Demo: 0000 · 1111 · 2222</p>
              )}
            </div>
          </div>

          {/* PIN dots */}
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center justify-center gap-3 h-9">
              {showPin ? (
                <span className="text-3xl font-bold tracking-[0.3em] tabular-nums text-foreground">
                  {pin || '—'}
                </span>
              ) : (
                Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-3.5 w-3.5 rounded-full transition-colors duration-150',
                      i < pin.length ? 'bg-primary' : 'bg-muted border border-border'
                    )}
                  />
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPin(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground h-9 px-3 rounded-full press"
            >
              {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPin ? 'Yashirish' : "Ko'rsatish"}
            </button>

            {/* Fixed-height slot so the keypad doesn't shift when a message appears. */}
            <div className="min-h-10 w-full flex items-start justify-center">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-[13px] px-3 py-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span>Tekshirilmoqda...</span>
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 text-destructive text-[13px] bg-destructive/10 px-3 py-2 rounded-xl text-center">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => press(d)}
                disabled={loading}
                className="h-16 rounded-2xl bg-muted/50 text-2xl font-semibold text-foreground active:bg-muted disabled:opacity-40 press"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin('')}
              disabled={loading || pin.length === 0}
              className="h-16 rounded-2xl text-sm font-semibold text-muted-foreground disabled:opacity-30 press"
            >
              Tozalash
            </button>
            <button
              type="button"
              onClick={() => press('0')}
              disabled={loading}
              className="h-16 rounded-2xl bg-muted/50 text-2xl font-semibold text-foreground active:bg-muted disabled:opacity-40 press"
            >
              0
            </button>
            <button
              type="button"
              onClick={backspace}
              disabled={loading || pin.length === 0}
              aria-label="O'chirish"
              className="h-16 rounded-2xl flex items-center justify-center text-muted-foreground disabled:opacity-30 press"
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
