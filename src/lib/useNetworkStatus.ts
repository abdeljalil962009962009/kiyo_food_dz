import { useEffect, useState } from 'react';

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
};

function connection() {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function readStatus() {
  const info = connection();
  const effectiveType = info?.effectiveType ?? '';
  return {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    slow: Boolean(info?.saveData || effectiveType === 'slow-2g' || effectiveType === '2g'),
  };
}

export function useNetworkStatus() {
  const [status, setStatus] = useState(readStatus);

  useEffect(() => {
    const update = () => setStatus(readStatus());
    const info = connection();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    info?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      info?.removeEventListener?.('change', update);
    };
  }, []);

  return status;
}
