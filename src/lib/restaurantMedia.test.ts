import { describe, expect, it } from 'vitest';
import {
  publicRestaurantImageUrl,
  restaurantImageObjectPath,
  validateRestaurantImage,
} from './restaurantMedia';

describe('restaurant media privacy helpers', () => {
  const path = '123e4567-e89b-12d3-a456-426614174000/logo-1.webp';

  it('keeps new private object paths stable', () => {
    expect(restaurantImageObjectPath(path)).toBe(path);
  });

  it('extracts paths from legacy public URLs without losing existing files', () => {
    const legacy = `https://example.supabase.co/storage/v1/object/public/restaurant-applications/${path}`;
    expect(restaurantImageObjectPath(legacy)).toBe(path);
  });

  it('uses the verified public image gateway for private bucket objects', () => {
    expect(publicRestaurantImageUrl(path)).toBe(`/api/public-restaurant-image?path=${encodeURIComponent(path)}`);
  });

  it('leaves unrelated external images unchanged', () => {
    expect(publicRestaurantImageUrl('https://images.example.com/food.jpg')).toBe('https://images.example.com/food.jpg');
  });

  it('accepts only supported application image formats', () => {
    expect(validateRestaurantImage(new File(['image'], 'logo.webp', { type: 'image/webp' }))).toBeNull();
    expect(validateRestaurantImage(new File(['document'], 'menu.pdf', { type: 'application/pdf' }))).toBe('type');
  });

  it('rejects application images larger than 5 MB', () => {
    const oversized = new File(
      [new Uint8Array((5 * 1024 * 1024) + 1)],
      'cover.jpg',
      { type: 'image/jpeg' },
    );
    expect(validateRestaurantImage(oversized)).toBe('size');
  });
});
