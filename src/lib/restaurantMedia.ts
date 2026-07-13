import { supabase } from './supabase';

const MAX_RESTAURANT_IMAGE_BYTES = 5 * 1024 * 1024;
export const RESTAURANT_APPLICATIONS_BUCKET = 'restaurant-applications';
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function validateRestaurantImage(file: File): 'type' | 'size' | null {
  if (!IMAGE_EXTENSIONS[file.type]) return 'type';
  if (file.size > MAX_RESTAURANT_IMAGE_BYTES) return 'size';
  return null;
}

export async function uploadRestaurantImage(userId: string, file: File): Promise<string> {
  const validationError = validateRestaurantImage(file);
  if (validationError) throw new Error(`restaurant_image_${validationError}`);

  const extension = IMAGE_EXTENSIONS[file.type];
  const path = `${userId}/public-profile-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(RESTAURANT_APPLICATIONS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export function restaurantImageObjectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = `/storage/v1/object/public/${RESTAURANT_APPLICATIONS_BUCKET}/`;
  if (value.includes(marker)) return decodeURIComponent(value.split(marker)[1].split('?')[0]);
  if (/^https?:\/\//i.test(value)) return null;
  return value.replace(/^\/+/, '').split('?')[0] || null;
}

export function publicRestaurantImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = restaurantImageObjectPath(value);
  if (!path) return value;
  return `/api/public-restaurant-image?path=${encodeURIComponent(path)}`;
}

export async function createRestaurantImageSignedUrl(value: string): Promise<string> {
  const path = restaurantImageObjectPath(value);
  if (!path) return value;
  const { data, error } = await supabase.storage
    .from(RESTAURANT_APPLICATIONS_BUCKET)
    .createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error ?? new Error('restaurant_image_unavailable');
  return data.signedUrl;
}
