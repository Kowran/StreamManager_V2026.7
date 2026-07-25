import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image_url?: string | null;
  quantity: number;
  variationId?: string;
  variationName?: string;
  seller_id?: string | null;
  seller_name?: string;
  account_recharge?: boolean;
  manual_delivery?: boolean;
  auto_delivery?: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variationId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variationId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = 'sm_cart_items';

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === item.productId && i.variationId === item.variationId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((productId: string, variationId?: string) => {
    setItems(prev => prev.filter(i => !(i.productId === productId && i.variationId === variationId)));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, variationId?: string) => {
    setItems(prev => prev.map(i =>
      i.productId === productId && i.variationId === variationId
        ? { ...i, quantity: Math.max(1, quantity) }
        : i
    ));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isOpen, setIsOpen }}>
      {children}
    </CartContext.Provider>
  );
}
