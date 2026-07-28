import {
  createContext, useContext, useEffect, useMemo, useReducer, useCallback,
  type ReactNode,
} from 'react';
import type { MenuItem, SelectedModifierOption } from '../lib/supabase';
import { cartLineId, modifierPriceTotal } from '../lib/menuCustomization';

export type CartLine = {
  lineId: string;
  item: MenuItem;
  quantity: number;
  notes?: string;
  selectedOptions: SelectedModifierOption[];
  unitPriceSnapshot: number;
};

type CartState = {
  restaurantId: string | null;
  restaurantName: string | null;
  lines: CartLine[];
  updatedAt: number | null;
};

type CartAction =
  | { type: 'ADD'; line: CartLine }
  | { type: 'REMOVE'; lineId: string }
  | { type: 'SET_QTY'; lineId: string; quantity: number }
  | { type: 'SET_NOTES'; lineId: string; notes: string }
  | { type: 'SET_RESTAURANT_NAME'; name: string }
  | { type: 'REPLACE'; restaurantId: string; restaurantName: string; lines: CartLine[] }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; state: CartState };

const STORAGE_KEY = 'kiyo-cart';

function emptyState(): CartState {
  return { restaurantId: null, restaurantName: null, lines: [], updatedAt: null };
}

function normalizeLine(line: Partial<CartLine> & Pick<CartLine, 'item' | 'quantity'>): CartLine {
  const selectedOptions = Array.isArray(line.selectedOptions) ? line.selectedOptions : [];
  const notes = typeof line.notes === 'string' ? line.notes : undefined;
  return {
    lineId: line.lineId || cartLineId(line.item.id, selectedOptions, notes),
    item: line.item,
    quantity: Number.isFinite(line.quantity) ? Math.max(1, Math.min(99, line.quantity)) : 1,
    notes,
    selectedOptions,
    unitPriceSnapshot: Number.isFinite(Number(line.unitPriceSnapshot))
      ? Number(line.unitPriceSnapshot)
      : Number(line.item.price) + modifierPriceTotal(selectedOptions),
  };
}

function normalizeState(state: CartState): CartState {
  const lines = Array.isArray(state?.lines)
    ? state.lines.filter((line) => line?.item?.id).map(normalizeLine)
    : [];
  const parsedUpdatedAt = Number(state?.updatedAt);
  return {
    restaurantId: state?.restaurantId ?? null,
    restaurantName: state?.restaurantName ?? null,
    lines,
    updatedAt: Number.isFinite(parsedUpdatedAt) && parsedUpdatedAt > 0
      ? parsedUpdatedAt
      : lines.length > 0
        ? Date.now()
        : null,
  };
}

function touch(state: Omit<CartState, 'updatedAt'>): CartState {
  return { ...state, updatedAt: Date.now() };
}

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return normalizeState(action.state ?? emptyState());
    case 'ADD': {
      // Switching restaurants wipes the cart (standard for delivery apps).
      if (state.restaurantId && state.restaurantId !== action.line.item.restaurant_id) {
        return {
          restaurantId: action.line.item.restaurant_id,
          restaurantName: null,
          lines: [action.line],
          updatedAt: Date.now(),
        };
      }
      const existing = state.lines.find((line) => line.lineId === action.line.lineId);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.lineId === action.line.lineId
              ? { ...l, quantity: Math.min(99, l.quantity + action.line.quantity) }
              : l,
          ),
          updatedAt: Date.now(),
        };
      }
      return touch({
        ...state,
        restaurantId: action.line.item.restaurant_id,
        lines: [...state.lines, action.line],
      });
    }
    case 'REMOVE':
      return touch({
        ...state,
        lines: state.lines.filter((line) => line.lineId !== action.lineId),
      });
    case 'SET_QTY': {
      if (action.quantity <= 0) {
        return touch({
          ...state,
          lines: state.lines.filter((line) => line.lineId !== action.lineId),
        });
      }
      return touch({
        ...state,
        lines: state.lines.map((l) =>
          l.lineId === action.lineId ? { ...l, quantity: Math.min(99, action.quantity) } : l,
        ),
      });
    }
    case 'SET_NOTES':
      return touch({
        ...state,
        lines: state.lines.map((l) =>
          l.lineId === action.lineId ? { ...l, notes: action.notes } : l,
        ),
      });
    case 'SET_RESTAURANT_NAME':
      return { ...state, restaurantName: action.name };
    case 'REPLACE':
      return normalizeState({
        restaurantId: action.restaurantId,
        restaurantName: action.restaurantName,
        lines: action.lines,
        updatedAt: Date.now(),
      });
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
  addItem: (item: MenuItem, quantity?: number, notes?: string, selectedOptions?: SelectedModifierOption[]) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, qty: number) => void;
  setNotes: (lineId: string, notes: string) => void;
  setRestaurantName: (name: string) => void;
  replaceCart: (restaurantId: string, restaurantName: string, lines: CartLine[]) => void;
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

  const addItem = useCallback((item: MenuItem, quantity = 1, notes?: string, selectedOptions: SelectedModifierOption[] = []) => {
    dispatch({
      type: 'ADD',
      line: normalizeLine({
        lineId: cartLineId(item.id, selectedOptions, notes),
        item,
        quantity,
        notes,
        selectedOptions,
        unitPriceSnapshot: Number(item.price) + modifierPriceTotal(selectedOptions),
      }),
    });
  }, []);
  const removeItem = useCallback((lineId: string) => dispatch({ type: 'REMOVE', lineId }), []);
  const setQuantity = useCallback((lineId: string, quantity: number) =>
    dispatch({ type: 'SET_QTY', lineId, quantity }), []);
  const setNotes = useCallback((lineId: string, notes: string) =>
    dispatch({ type: 'SET_NOTES', lineId, notes }), []);
  const setRestaurantName = useCallback((name: string) =>
    dispatch({ type: "SET_RESTAURANT_NAME", name }), []);
  const replaceCart = useCallback((restaurantId: string, restaurantName: string, lines: CartLine[]) =>
    dispatch({ type: 'REPLACE', restaurantId, restaurantName, lines }), []);
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const totalItems = state.lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = state.lines.reduce(
    (sum, l) => sum + l.unitPriceSnapshot * l.quantity,
    0,
  );

  const value = useMemo<CartContextValue>(
    () => ({
      state, totalItems, subtotal,
      addItem, removeItem, setQuantity, setNotes, setRestaurantName, replaceCart, clear,
    }),
    [state, totalItems, subtotal, addItem, removeItem, setQuantity, setNotes, setRestaurantName, replaceCart, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
