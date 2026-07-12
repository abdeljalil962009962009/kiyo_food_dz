const ALGERIAN_MOBILE_SUBSCRIBER = /^[567]\d{8}$/;
const ALLOWED_PHONE_CHARACTERS = /^[+\d\s().-]+$/;

export function normalizeAlgerianPhone(value: string): string | null {
  const raw = value.trim();
  if (!raw || !ALLOWED_PHONE_CHARACTERS.test(raw)) return null;

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00213')) digits = digits.slice(5);
  else if (digits.startsWith('213')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);

  return ALGERIAN_MOBILE_SUBSCRIBER.test(digits) ? `+213${digits}` : null;
}

export function isValidAlgerianPhone(value: string): boolean {
  return normalizeAlgerianPhone(value) !== null;
}
