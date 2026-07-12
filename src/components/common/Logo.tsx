import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <img
      src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
      alt="inPOS"
      className={cn('h-7 w-auto object-contain', className)}
    />
  );
}

export function LogoIcon({ className }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <img
      src={theme === 'dark' ? '/icon-dark.png' : '/icon-light.png'}
      alt="inPOS"
      className={cn('h-7 w-auto object-contain', className)}
    />
  );
}
