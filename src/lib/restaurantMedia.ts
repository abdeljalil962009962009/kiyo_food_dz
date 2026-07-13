import { supabase } from './supabase';

const MAX_RESTAURANT_IMAGE_BYTES = 5 * 1024 * 1024;
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
  const { error } = await supabase.storage.from('restaurant-applications').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('restaurant-applications').getPublicUrl(path).data.publicUrl;
}

