import { useEffect, useState } from 'react';
import { createRestaurantImageSignedUrl } from '../lib/restaurantMedia';

export function PrivateRestaurantImage({ value, alt, className = '' }: {
  value: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    void createRestaurantImageSignedUrl(value)
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(null); });
    return () => { cancelled = true; };
  }, [value]);

  if (!src) return <div className={`animate-pulse bg-ink-50 ${className}`} aria-label={alt} />;
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}
