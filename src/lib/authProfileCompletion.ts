import { isValidAlgerianPhone } from './phone';

type AuthIdentity = {
  app_metadata?: Record<string, unknown> | null;
};

export function isGoogleIdentity(user: AuthIdentity | null | undefined): boolean {
  const metadata = user?.app_metadata;
  if (!metadata) return false;

  if (metadata.provider === 'google') return true;
  return Array.isArray(metadata.providers) && metadata.providers.includes('google');
}

export function requiresGooglePhoneCompletion(
  user: AuthIdentity | null | undefined,
  phone: string | null | undefined,
): boolean {
  return isGoogleIdentity(user) && !isValidAlgerianPhone(phone ?? '');
}
