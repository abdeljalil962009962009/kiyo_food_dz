import type { CartLine } from '../context/CartContext';
import { supabase } from './supabase';
import { callUserAction } from './userApi';
import { withExponentialBackoff } from './locationNetwork';

export type AuthoritativeDeliveryQuote = {
  route_quote_id: string;
  items: { name: string; quantity: number; unit_price: string }[];
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  distance_km?: number;
  duration_minutes?: number;
  max_delivery_km?: number;
  route_expires_at?: string;
};

type QuoteLocation = { lat: number; lng: number };

const CACHE_PREFIX = 'kiyo-route-quote:';

function cacheKey(restaurantId: string, location: QuoteLocation, lines: CartLine[]) {
  const items = lines
    .map((line) => `${line.item.id}:${line.quantity}`)
    .sort()
    .join('|');
  return `${CACHE_PREFIX}${restaurantId}:${location.lat.toFixed(5)}:${location.lng.toFixed(5)}:${items}`;
}

function readCachedQuote(key: string) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const quote = JSON.parse(raw) as AuthoritativeDeliveryQuote;
    const expiresAt = Date.parse(quote.route_expires_at ?? '');
    if (!quote.route_quote_id || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 30_000) {
      sessionStorage.removeItem(key);
      return null;
    }
    return quote;
  } catch {
    return null;
  }
}

export function clearCachedDeliveryQuotes() {
  try {
    const keys: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Browser privacy settings may disable storage; there is nothing to clear.
  }
}

function cacheQuote(key: string, quote: AuthoritativeDeliveryQuote) {
  try {
    sessionStorage.setItem(key, JSON.stringify(quote));
  } catch {
    // A quote can still be used when browser storage is unavailable.
  }
}

export async function getAuthoritativeDeliveryQuote(
  restaurantId: string,
  location: QuoteLocation,
  lines: CartLine[],
): Promise<AuthoritativeDeliveryQuote> {
  const key = cacheKey(restaurantId, location, lines);
  const cached = readCachedQuote(key);
  if (cached) return cached;

  const items = lines.map((line) => ({
    menu_item_id: line.item.id,
    quantity: line.quantity,
  }));

  const quote = await withExponentialBackoff(async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      throw new Error('Your session expired. Sign in again.');
    }

    const response = await fetch('/api/delivery-route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        restaurantId,
        destination: { latitude: location.lat, longitude: location.lng },
      }),
    });
    const body = await response.json() as { routeQuoteId?: string; message?: string };
    if (!response.ok || !body.routeQuoteId) {
      throw new Error(body.message || 'Road-route delivery pricing is unavailable.');
    }

    const { data, error } = await callUserAction<AuthoritativeDeliveryQuote>('quote_delivery_order_by_route', {
      p_route_quote_id: body.routeQuoteId,
      p_items: items,
    });
    if (error || !data) throw error ?? new Error('The delivery quote was empty.');
    return data;
  }, { attempts: 3, timeoutMs: 25_000 });

  cacheQuote(key, quote);
  return quote;
}
