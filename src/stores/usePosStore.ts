import { create } from 'zustand';

export interface CartItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
  /** Stok layak jual saat item dimasukkan — dipakai sebagai batas qty di keranjang. */
  stock: number;
}

interface PosStore {
  cart: CartItem[];
  addToCart: (product: Omit<CartItem, 'qty'>) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
}

export const usePosStore = create<PosStore>((set, get) => ({
  cart: [],

  addToCart: (product) => {
    const cart = get().cart;
    const existing = cart.find((item) => item.id === product.id);

    if (existing) {
      if (existing.qty >= product.stock) return; // jangan melebihi stok
      set({
        cart: cart.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1, stock: product.stock } : item
        ),
      });
    } else {
      if (product.stock <= 0) return;
      set({ cart: [...cart, { ...product, qty: 1 }] });
    }
  },

  removeFromCart: (id) => set({ cart: get().cart.filter((item) => item.id !== id) }),

  updateQty: (id, qty) => {
    if (qty <= 0) {
      get().removeFromCart(id);
      return;
    }
    set({
      cart: get().cart.map((item) =>
        // BUG LAMA: `item.id === item.id` selalu true sehingga SEMUA item ikut berubah
        item.id === id ? { ...item, qty: Math.min(qty, item.stock) } : item
      ),
    });
  },

  clearCart: () => set({ cart: [] }),

  getTotalPrice: () => get().cart.reduce((total, item) => total + item.price * item.qty, 0),
}));