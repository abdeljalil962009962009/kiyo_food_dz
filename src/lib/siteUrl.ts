const FALLBACK_PRODUCTION_URL = 'https://kiyo-food.store';

function normalizeUrl(value: string | undefined | null): string | null {
  const raw = (value ?? '').trim().replace(/\/+$/, '');
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function getRuntimeOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  return normalizeUrl(window.location.origin);
}

export function getPublicSiteUrl(): string {
  const configured = normalizeUrl(import.meta.env.VITE_SITE_URL);
  const runtime = getRuntimeOrigin();

  if (import.meta.env.DEV) {
    return runtime ?? configured ?? FALLBACK_PRODUCTION_URL;
  }

  return configured ?? runtime ?? FALLBACK_PRODUCTION_URL;
}

export function getAuthRedirectUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicSiteUrl()}${cleanPath}`;
}
