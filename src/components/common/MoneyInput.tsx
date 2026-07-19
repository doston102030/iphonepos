import { useLayoutEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

/** 1250000 → "1 250 000" — same grouping formatCurrency uses everywhere. */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Index in `formatted` that sits just after the n-th digit. */
function caretAfterDigits(formatted: string, n: number): number {
  let pos = 0;
  let seen = 0;
  while (pos < formatted.length && seen < n) {
    if (/\d/.test(formatted[pos])) seen++;
    pos++;
  }
  return pos;
}

/**
 * A price field that grows its thousand separators as the cashier types:
 * "8000" reads as "8 000" without anyone placing a space. Stores a plain
 * number — react-hook-form fields plug straight in via value/onChange.
 *
 * The caret is tracked in digits, not characters: React rewriting the input
 * with a re-spaced value always parks the caret at the end, so editing the
 * middle of "1 250 000" used to scatter the next keystrokes to the tail and
 * save a silently wrong price.
 */
export function MoneyInput({
  value, onChange, className, placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || caretDigits.current === null) return;
    if (document.activeElement === el) {
      const pos = caretAfterDigits(el.value, caretDigits.current);
      el.setSelectionRange(pos, pos);
    }
    caretDigits.current = null;
  });

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? '0'}
      className={className}
      value={value ? group(String(value)) : ''}
      onChange={e => {
        const el = e.target;
        const sel = el.selectionStart ?? el.value.length;
        const digits = el.value.replace(/\D/g, '').slice(0, 12);
        const digitsBefore = Math.min(el.value.slice(0, sel).replace(/\D/g, '').length, digits.length);
        const next = digits ? Number(digits) : 0;
        if (next === value) {
          // Deleting a separator leaves the number unchanged — React bails out
          // of re-rendering, so the un-spaced text would stay on screen. Put
          // the formatted text and the caret back by hand.
          el.value = value ? group(String(value)) : '';
          const pos = caretAfterDigits(el.value, digitsBefore);
          el.setSelectionRange(pos, pos);
          return;
        }
        caretDigits.current = digitsBefore;
        onChange(next);
      }}
    />
  );
}
