import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

import handler from './public-restaurant-image.js';

const PATH = '123e4567-e89b-42d3-a456-426614174000/menu-item-1.webp';

function query(result: { data: unknown; error?: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'or', 'limit']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  return builder;
}

function response() {
  const state: { status: number; body: unknown; redirect: string | null } = {
    status: 200,
    body: null,
    redirect: null,
  };
  const target = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      state.status = code;
      return target;
    }),
    json: vi.fn((body: unknown) => {
      state.body = body;
    }),
    redirect: vi.fn((code: number, location: string) => {
      state.status = code;
      state.redirect = location;
    }),
  };
  return { target, state };
}

beforeEach(() => {
  createClientMock.mockReset();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://production.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
});

describe('public restaurant image gateway', () => {
  it('serves an available menu image only when its restaurant is published', async () => {
    const directRestaurant = query({ data: null });
    const menuItem = query({ data: { restaurant_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } });
    const menuRestaurant = query({ data: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/menu.webp' },
      error: null,
    });
    let restaurantReads = 0;
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'menu_items') return menuItem;
        restaurantReads += 1;
        return restaurantReads === 1 ? directRestaurant : menuRestaurant;
      }),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    });
    const { target, state } = response();

    await handler({ method: 'GET', query: { path: PATH } }, target);

    expect(state.status).toBe(302);
    expect(state.redirect).toBe('https://signed.example/menu.webp');
    expect(menuItem.eq).toHaveBeenCalledWith('is_available', true);
    expect(menuRestaurant.eq).toHaveBeenCalledWith('status', 'published');
  });

  it('does not expose an image with no published restaurant reference', async () => {
    const directRestaurant = query({ data: null });
    const menuItem = query({ data: null });
    const createSignedUrl = vi.fn();
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => table === 'menu_items' ? menuItem : directRestaurant),
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    });
    const { target, state } = response();

    await handler({ method: 'GET', query: { path: PATH } }, target);

    expect(state.status).toBe(404);
    expect(state.body).toEqual({ code: 'image_not_public' });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
