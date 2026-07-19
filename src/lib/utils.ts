import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { OutflowReason, PaymentMethod, Role } from '@/lib/api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "so'm"): string {
  return new Intl.NumberFormat('uz-UZ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ` ${currency}`;
}

// ─── Calendar dates for report windows ───────────────────────────────────────
// Always the shop's own day, never UTC's. `new Date().toISOString()` prints the
// UTC date, and Tashkent runs at UTC+5 — so from midnight until 05:00 it names
// YESTERDAY, which silently shifted every report range a day back.

export function toDateStr(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

export function monthStartStr(): string {
  const d = new Date();
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

// Spelled out by hand, not toLocaleDateString('uz-UZ') — WebView builds differ
// on whether they ship the uz locale, and a shopkeeper must never see "July".
const UZ_WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** A calendar date as the shopkeeper says it: "Dushanba, 14-iyul". */
export function uzDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${UZ_WEEKDAYS[d.getDay()]}, ${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    // An invalid date does not throw — toLocaleDateString happily prints the
    // English words "Invalid Date", so the catch alone never fires.
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('uz-UZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Human time, not a timestamp: "Bugun 19:58", "Kecha 00:32", "15-iyul, 00:32"
 * (year appears only when it isn't this year). A cashier scanning a receipt
 * list reads "Bugun" instantly; "19/07/2026, 19:58" they have to parse.
 */
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((dayStart(now) - dayStart(d)) / 86_400_000);
    if (diffDays === 0) return `Bugun ${time}`;
    if (diffDays === 1) return `Kecha ${time}`;
    const day = `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
    return d.getFullYear() === now.getFullYear()
      ? `${day}, ${time}`
      : `${day} ${d.getFullYear()}, ${time}`;
  } catch {
    return dateStr;
  }
}

// The server has exactly two roles, four payment methods and three outflow
// reasons — each map below is total, so no fallback branch is needed.
export function getRoleBadgeVariant(role: Role): 'default' | 'secondary' | 'destructive' | 'outline' {
  return role === 'SUPER_ADMIN' ? 'destructive' : 'secondary';
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    SUPER_ADMIN: 'Super Admin',
    CASHIER: 'Kassir',
  };
  return labels[role];
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    CASH: 'Naqd',
    CARD: 'Karta',
    MIXED: 'Aralash',
    CREDIT: 'Qarzga',
  };
  return labels[method];
}

export function getOutflowReasonLabel(reason: OutflowReason): string {
  const labels: Record<OutflowReason, string> = {
    DAMAGED: 'Buzilgan',
    LOST: "Yo'qolgan",
    RETURNED: 'Qaytarilgan',
  };
  return labels[reason];
}

export function getStockMovementTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    IN: 'Kirish',
    OUT: 'Chiqish',
    SALE: 'Sotuv',
    ADJUSTMENT: 'Tuzatish',
  };
  return labels[type] ?? type;
}

export function getDebtStatusLabel(status: string): string {
  if (status === 'PAID') return "To'langan";
  if (status === 'PARTIAL') return 'Qisman';
  if (status === 'UNPAID') return "To'lanmagan";
  return status;
}
