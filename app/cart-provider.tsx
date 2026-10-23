'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { CartItem, CatalogProduct } from '@/lib/catalog-types';
import CartDrawer from './cart-drawer';
import { useOnlineSales } from './admin-data-provider';

interface CartContextValue {
  cart: CartItem[];
  itemCount: number;
  total: number;
  savings: number;
  openCart: () => void;
  addToCart: (product: CatalogProduct, quantity?: number) => void;
  changeQuantity: (productId: string, change: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_STORAGE_KEY = 'verdevale-cart-v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { venda_online_ativa } = useOnlineSales();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
        if (storedCart) {
          const parsedCart: unknown = JSON.parse(storedCart);
          if (Array.isArray(parsedCart)) {
            setCart(
              parsedCart.filter(
                (item): item is CartItem =>
                  typeof item === 'object' &&
                  item !== null &&
                  'product' in item &&
                  'quantity' in item &&
                  typeof item.quantity === 'number' &&
                  item.quantity > 0,
              ),
            );
          }
        }
      } catch (error) {
        console.error('Não foi possível restaurar o carrinho salvo.', error);
      } finally {
        setIsLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error('Não foi possível salvar o carrinho neste dispositivo.', error);
    }
  }, [cart, isLoaded]);

  const openCart = useCallback(() => {
    if (!venda_online_ativa) return;
    setIsCartOpen(true);
  }, [venda_online_ativa]);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const addToCart = useCallback(
    (product: CatalogProduct, quantity = 1) => {
      if (!venda_online_ativa) return;
      setCart((current) => {
        const existing = current.find(
          (item) => item.product.id === product.id,
        );
        return existing
          ? current.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            )
          : [...current, { product, quantity }];
      });
    },
    [venda_online_ativa],
  );

  const changeQuantity = useCallback((productId: string, change: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId ? { ...item, quantity } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((current) =>
      current.filter((item) => item.product.id !== productId),
    );
  }, []);

  const value = useMemo(
    () => ({
      cart,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      total: cart.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      ),
      savings: cart.reduce(
        (sum, item) =>
          sum +
          Math.max(0, (item.product.oldPrice ?? item.product.price) - item.product.price) *
            item.quantity,
        0,
      ),
      openCart,
      addToCart,
      changeQuantity,
      setQuantity,
      removeFromCart,
    }),
    [addToCart, cart, changeQuantity, openCart, removeFromCart, setQuantity],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer open={isCartOpen && venda_online_ativa} onClose={closeCart} />
    </CartContext.Provider>
  );
}

export function useShoppingCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useShoppingCart deve ser usado dentro de CartProvider.');
  }
  return context;
}
