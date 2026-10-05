import { create } from 'zustand';

export interface CartItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  qty: number;
  expiredDate?: string;
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
    const currentCart = get().cart;
    const existingIndex = currentCart.findIndex((item) => item.id === product.id);

    if (existingIndex > -1) {
      const updatedCart = [...currentCart];
      updatedCart[existingIndex].qty += 1;
      set({ cart: updatedCart });
    } else {
      set({ cart: [...currentCart, { ...product, qty: 1 }] });
    }
  },
  removeFromCart: (id) => {
    set({ cart: get().cart.filter((item) => item.id !== id) });
  },
  updateQty: (id, qty) => {
    if (qty <= 0) {
      get().removeFromCart(id);
      return;
    }
    set({
      cart: get().cart.map((item) => (item.id === item.id ? { ...item, qty } : item)),
    });
  },
  clearCart: () => set({ cart: [] }),
  getTotalPrice: () => {
    return get().cart.reduce((total, item) => total + item.price * item.qty, 0);
  },
}));