import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

type RequestLike = { method?: string; query?: Record<string, string | string[] | undefined> };
type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  redirect(status: number, location: string): void;
};

const BUCKET = 'restaurant-applications';

function objectPath(value: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  if (value.includes(marker)) return decodeURIComponent(value.split(marker)[1].split('?')[0]);
  return value.replace(/^\/+/, '').split('?')[0];
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== 'GET') {
    response.status(405).json({ code: 'method_not_allowed' });
    return;
  }
  const raw = request.query?.path;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const path = typeof requested === 'string' ? objectPath(requested) : '';
  if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i.test(path)) {
    response.status(400).json({ code: 'invalid_image_path' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    response.status(503).json({ code: 'image_service_unavailable' });
    return;
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicMarker = `/storage/v1/object/public/${BUCKET}/${path}`;
  const { data: restaurant } = await client
    .from('restaurants')
    .select('id')
    .eq('status', 'published')
    .or(`image_url.eq.${path},image_url.like.%${publicMarker}%`)
    .limit(1)
    .maybeSingle();
  if (!restaurant) {
    response.status(404).json({ code: 'image_not_public' });
    return;
  }

  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    response.status(404).json({ code: 'image_not_found' });
    return;
  }
  response.setHeader('Cache-Control', 'public, max-age=45, stale-while-revalidate=120');
  response.redirect(302, data.signedUrl);
}
