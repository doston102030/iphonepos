import { Input } from '@/components/ui/input';

/** 1250000 → "1 250 000" — same grouping formatCurrency uses everywhere. */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * A price field that grows its thousand separators as the cashier types:
 * "8000" reads as "8 000" without anyone placing a space. Stores a plain
 * number — react-hook-form fields plug straight in via value/onChange.
 */
export function MoneyInput({
  value, onChange, className, placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? '0'}
      className={className}
      value={value ? group(String(value)) : ''}
      onChange={e => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
        onChange(digits ? Number(digits) : 0);
      }}
    />
  );
}
