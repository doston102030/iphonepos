import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ProductResponse } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface CartItem { product: ProductResponse; quantity: number }

interface CartContextValue {
  items: CartItem[];
  addItem: (product: ProductResponse) => void;
  incrementItem: (productId: number) => void;
  decrementItem: (productId: number) => void;
  /** Typed-in amount: clamped to [1, stock] and floored to a whole number. */
  setItemQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
  totalCount: number;
  totalPrice: number;
  quantityOf: (productId: number) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'cart';

/** The cart is stored under the cashier who built it, never shared across them. */
function storageKeyFor(userId: number | null): string | null {
  return userId === null ? null : `${STORAGE_KEY}:${userId}`;
}

/** localStorage is a text file the user can edit — one hand-broken cart row
 * used to throw inside the totals useMemo and white-screen the whole app on
 * boot. Rows are validated one by one; the broken ones are simply dropped. */
function isCartItem(c: unknown): c is CartItem {
  if (typeof c !== 'object' || c === null) return false;
  const item = c as { product?: unknown; quantity?: unknown };
  if (typeof item.product !== 'object' || item.product === null) return false;
  const p = item.product as Record<string, unknown>;
  return typeof p.id === 'number'
    && typeof p.name === 'string'
    && typeof p.price === 'number' && Number.isFinite(p.price)
    && typeof p.stockQuantity === 'number'
    && typeof item.quantity === 'number'
    && Number.isFinite(item.quantity) && item.quantity >= 1;
}

function readCart(userId: number | null): CartItem[] {
  const key = storageKeyFor(userId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Survives a reload: a phone that reloads the tab mid-sale — or a cashier who
  // pulls to refresh by accident — used to lose the whole basket.
  const [items, setItems] = useState<CartItem[]>(() => readCart(userId));

  // A cart belongs to the cashier who built it. "Chiqish" is a client-side
  // navigation — this provider is never unmounted — so without this the next
  // cashier logged in to find the previous one's basket waiting, and could ring
  // it up under their own name.
  useEffect(() => { setItems(readCart(userId)); }, [userId]);

  useEffect(() => {
    const key = storageKeyFor(userId);
    if (!key) return;
    try {
      if (items.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(items));
    } catch { /* private mode / quota: the cart just stays in memory */ }
  }, [items, userId]);

  const addItem = useCallback((product: ProductResponse) => {
    setItems(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) return prev;
        return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      if (product.stockQuantity <= 0) return prev;
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems(prev => prev.filter(c => c.product.id !== productId));
  }, []);

  // Same stock ceiling as addItem — without it, any "+" wired to this function
  // would happily sell more than the shelf holds.
  const incrementItem = useCallback((productId: number) => {
    setItems(prev => prev.map(c =>
      c.product.id === productId && c.quantity < c.product.stockQuantity
        ? { ...c, quantity: c.quantity + 1 }
        : c
    ));
  }, []);

  const decrementItem = useCallback((productId: number) => {
    setItems(prev => {
      const existing = prev.find(c => c.product.id === productId);
      if (existing && existing.quantity <= 1) return prev.filter(c => c.product.id !== productId);
      return prev.map(c => c.product.id === productId ? { ...c, quantity: c.quantity - 1 } : c);
    });
  }, []);

  // The server's OrderItemRequest.quantity is int32, so whatever the cashier
  // types — including a sum converted to kg — lands on a whole number, capped
  // by the same stock ceiling as addItem. Zero doesn't remove the row (the
  // trash button does that); it just holds the line at 1 while they retype.
  const setItemQuantity = useCallback((productId: number, quantity: number) => {
    if (!Number.isFinite(quantity)) return;
    setItems(prev => prev.map(c =>
      c.product.id === productId
        ? { ...c, quantity: Math.min(Math.max(1, Math.floor(quantity)), c.product.stockQuantity) }
        : c
    ));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalCount = useMemo(() => items.reduce((s, c) => s + c.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((s, c) => s + c.product.price * c.quantity, 0), [items]);
  const quantityOf = useCallback(
    (productId: number) => items.find(c => c.product.id === productId)?.quantity ?? 0,
    [items],
  );

  const value: CartContextValue = {
    items, addItem, incrementItem, decrementItem, setItemQuantity, removeItem, clear,
    totalCount, totalPrice, quantityOf,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
