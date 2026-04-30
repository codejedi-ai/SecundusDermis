/**
 * CartContext — single source of truth for the patron's portfolio (cart).
 *
 * Only active when the patron is logged in. Anonymous sessions have no
 * cart — they must sign in to reserve pieces.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import * as fashionApi from '../services/fashionApi';

export type CartItem = fashionApi.CartItem;

interface CartContextType {
  cart: fashionApi.CartResponse;
  cartCount: number;
  addToCart: (item: { product_id: string; product_name: string; price: number; image_url: string }) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const EMPTY_CART: fashionApi.CartResponse = { items: [], total: 0 };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const sessionId = session?.session_id ?? null;

  const [cart, setCart] = useState<fashionApi.CartResponse>(EMPTY_CART);

  const refreshCart = useCallback(async () => {
    if (!sessionId) {
      setCart(EMPTY_CART);
      return;
    }
    try {
      const data = await fashionApi.getCart(sessionId);
      setCart(data);
    } catch { /* ignore */ }
  }, [sessionId]);

  // Refresh whenever the logged-in session changes
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (item: { product_id: string; product_name: string; price: number; image_url: string }) => {
    if (!sessionId) return;
    try {
      const updated = await fashionApi.addToCart(sessionId, item);
      setCart(updated);
    } catch (err) {
      console.error('Failed to add to cart:', err);
      throw err;
    }
  };

  const removeFromCart = async (productId: string) => {
    if (!sessionId) return;
    const updated = await fashionApi.removeCartItem(sessionId, productId);
    setCart(updated);
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!sessionId) return;
    const updated = await fashionApi.updateCartItem(sessionId, productId, quantity);
    setCart(updated);
  };

  const cartCount = cart.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, cartCount, addToCart, removeFromCart, updateQuantity, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
