import {
  createContext, useContext, useEffect, useMemo, useReducer, useCallback,
  type ReactNode,
} from 'react';
import type { MenuItem } from '../lib/supabase';

export type CartLine = {
  item: MenuItem;
  quantity: number;
  notes?: string;
};

type CartState = {
  restaurantId: string | null;
  restaurantName: string | null;
  lines: CartLine[];
};

type CartAction =
  | { type: 'ADD'; item: MenuItem; quantity?: number; notes?: string }
  | { type: 'REMOVE'; itemId: string }
  | { type: 'SET_QTY'; itemId: string; quantity: number }
  | { type: 'SET_NOTES'; itemId: string; notes: string }
  | { type: 'SET_RESTAURANT_NAME'; name: string }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; state: CartState };

const STORAGE_KEY = 'kiyo-cart';

function emptyState(): CartState {
  return { restaurantId: null, restaurantName: null, lines: [] };
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state ?? emptyState();
    case 'ADD': {
      // Switching restaurants wipes the cart (standard for delivery apps).
      if (state.restaurantId && state.restaurantId !== action.item.restaurant_id) {
        return {
          restaurantId: action.item.restaurant_id,
          restaurantName: null,
          lines: [
            { item: action.item, quantity: action.quantity ?? 1, notes: action.notes },
          ],
        };
      }
      const existing = state.lines.find((l) => l.item.id === action.item.id);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.item.id === action.item.id
              ? { ...l, quantity: l.quantity + (action.quantity ?? 1) }
              : l,
          ),
        };
      }
      return {
        ...state,
        restaurantId: action.item.restaurant_id,
        lines: [
          ...state.lines,
          { item: action.item, quantity: action.quantity ?? 1, notes: action.notes },
        ],
      };
    }
    case 'REMOVE':
      return {
        ...state,
        lines: state.lines.filter((l) => l.item.id !== action.itemId),
      };
    case 'SET_QTY': {
      if (action.quantity <= 0) {
        return {
          ...state,
          lines: state.lines.filter((l) => l.item.id !== action.itemId),
        };
      }
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.item.id === action.itemId ? { ...l, quantity: action.quantity } : l,
        ),
      };
    }
    case 'SET_NOTES':
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.item.id === action.itemId ? { ...l, notes: action.notes } : l,
        ),
      };
    case 'SET_RESTAURANT_NAME':
      return { ...state, restaurantName: action.name };
    case 'CLEAR':
      return emptyState();
    default:
      return state;
  }
}

type CartContextValue = {
  state: CartState;
  totalItems: number;
  subtotal: number;
  addItem: (item: MenuItem, quantity?: number, notes?: string) => void;
  removeItem: (itemId: string) => void;
  setQuantity: (itemId: string, qty: number) => void;
  setNotes: (itemId: string, notes: string) => void;
  setRestaurantName: (name: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, emptyState);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (parsed && Array.isArray(parsed.lines)) {
          dispatch({ type: 'HYDRATE', state: parsed });
        }
      }
    } catch {
      // ignore corrupt cart
    }
  }, []);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or disabled; non-fatal
    }
  }, [state]);

  const addItem = useCallback((item: MenuItem, quantity?: number, notes?: string) => {
    dispatch({ type: 'ADD', item, quantity, notes });
  }, []);
  const removeItem = useCallback((itemId: string) => dispatch({ type: 'REMOVE', itemId }), []);
  const setQuantity = useCallback((itemId: string, quantity: number) =>
    dispatch({ type: 'SET_QTY', itemId, quantity }), []);
  const setNotes = useCallback((itemId: string, notes: string) =>
    dispatch({ type: 'SET_NOTES', itemId, notes }), []);
  const setRestaurantName = useCallback((name: string) =>
    dispatch({ type: "SET_RESTAURANT_NAME", name }), []);
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const totalItems = state.lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = state.lines.reduce(
    (sum, l) => sum + Number(l.item.price) * l.quantity,
    0,
  );

  const value = useMemo<CartContextValue>(
    () => ({
      state, totalItems, subtotal,
      addItem, removeItem, setQuantity, setNotes, setRestaurantName, clear,
    }),
    [state, totalItems, subtotal, addItem, removeItem, setQuantity, setNotes, setRestaurantName, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
