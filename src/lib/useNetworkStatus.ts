import { useEffect, useState } from 'react';
import { getConnectionQuality } from './locationNetwork';

type NetworkInformation = {
  effectiveType?: string;
  downlink?: number;
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
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const quality = getConnectionQuality(online, info);
  return {
    online,
    slow: quality === 'slow',
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
