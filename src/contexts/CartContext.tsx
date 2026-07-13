import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ProductResponse } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface CartItem { product: ProductResponse; quantity: number }

interface CartContextValue {
  items: CartItem[];
  addItem: (product: ProductResponse) => void;
  incrementItem: (productId: number) => void;
  decrementItem: (productId: number) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
  totalCount: number;
  totalPrice: number;
  quantityOf: (productId: number) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // A cart belongs to the cashier who built it. "Chiqish" is a client-side
  // navigation — this provider is never unmounted — so without this the next
  // cashier logged in to find the previous one's basket waiting, and could ring
  // it up under their own name.
  useEffect(() => { setItems([]); }, [userId]);

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

  const clear = useCallback(() => setItems([]), []);

  const totalCount = useMemo(() => items.reduce((s, c) => s + c.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((s, c) => s + c.product.price * c.quantity, 0), [items]);
  const quantityOf = useCallback(
    (productId: number) => items.find(c => c.product.id === productId)?.quantity ?? 0,
    [items],
  );

  const value: CartContextValue = {
    items, addItem, incrementItem, decrementItem, removeItem, clear, totalCount, totalPrice, quantityOf,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
