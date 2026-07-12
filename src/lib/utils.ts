import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "UZS"): string {
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

export function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (role === 'SUPER_ADMIN') return 'destructive';
  if (role === 'ADMIN') return 'default';
  return 'secondary';
}

export function getRoleLabel(role: string): string {
  if (role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'ADMIN') return 'Admin';
  if (role === 'KASSIR') return 'Kassir';
  return role;
}

export function getPaymentTypeLabel(type: string): string {
  if (type === 'CASH') return 'Naqd';
  if (type === 'CARD') return 'Karta';
  if (type === 'DEBT') return 'Qarz';
  return type;
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
