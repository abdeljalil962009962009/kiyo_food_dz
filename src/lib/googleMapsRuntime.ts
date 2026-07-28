export type GoogleMapsRuntimeFailure = 'authorization' | 'network';

type AuthFailureState = {
  installed: boolean;
  generation: number;
  listeners: Set<() => void>;
  previousHandler?: () => void;
};

type MapsWindow = Window & {
  gm_authFailure?: () => void;
  __kiyoMapsAuthFailureState?: AuthFailureState;
};

function mapsWindow(): MapsWindow | null {
  return typeof window === 'undefined' ? null : window as MapsWindow;
}

function authFailureState(): AuthFailureState | null {
  const target = mapsWindow();
  if (!target) return null;
  if (!target.__kiyoMapsAuthFailureState) {
    target.__kiyoMapsAuthFailureState = {
      installed: false,
      generation: 0,
      listeners: new Set(),
    };
  }
  return target.__kiyoMapsAuthFailureState;
}

export function ensureGoogleMapsAuthFailureHandler(): void {
  const target = mapsWindow();
  const state = authFailureState();
  if (!target || !state || state.installed) return;

  state.previousHandler = target.gm_authFailure;
  target.gm_authFailure = () => {
    state.generation += 1;
    state.listeners.forEach((listener) => listener());
    state.previousHandler?.();
  };
  state.installed = true;
}

export function hasGoogleMapsAuthFailure(): boolean {
  ensureGoogleMapsAuthFailureHandler();
  return (authFailureState()?.generation ?? 0) > 0;
}

export function subscribeToGoogleMapsAuthFailure(listener: () => void): () => void {
  ensureGoogleMapsAuthFailureHandler();
  const state = authFailureState();
  if (!state) return () => undefined;
  state.listeners.add(listener);
  if (state.generation > 0) listener();
  return () => state.listeners.delete(listener);
}

export function classifyGoogleMapsLoadFailure(
  error: unknown,
  online = typeof navigator === 'undefined' ? true : navigator.onLine,
): GoogleMapsRuntimeFailure {
  if (!online) return 'network';
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : JSON.stringify(error ?? '');
  const normalized = message.toLowerCase();
  if (
    normalized.includes('api key')
    || normalized.includes('auth')
    || normalized.includes('referer')
    || normalized.includes('referrer')
    || normalized.includes('billing')
    || normalized.includes('quota')
    || normalized.includes('request denied')
  ) {
    return 'authorization';
  }
  return 'network';
}

export function containsNativeGoogleMapErrorText(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ã©/g, 'e')
    .replace(/â€™/g, "'")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return [
    'google maps did not load correctly',
    "this page can't load google maps correctly",
    "google maps ne s'est pas charg",
    "google maps ne s'est pas charge correctement",
    'veuillez consulter la console javascript',
    'consultez la console javascript',
    'check the javascript console',
    'for development purposes only',
  ].some((marker) => normalized.includes(marker));
}
