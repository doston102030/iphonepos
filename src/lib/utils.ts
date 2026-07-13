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

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('uz-UZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('uz-UZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
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
