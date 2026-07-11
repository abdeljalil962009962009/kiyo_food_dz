import type { AddressParts } from './geo';

export type AlgeriaWilaya = {
  id: number;
  code: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
};

const ADMIN_WORDS = /\b(wilaya|wilayat|province|state|governorate|de|du|d')\b/gi;
const ARABIC_ADMIN_WORDS = /(ولاية|ولايه|محافظة|الجزائر)/g;

export function normalizeWilayaText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(ARABIC_ADMIN_WORDS, ' ')
    .replace(ADMIN_WORDS, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function aliases(wilaya: AlgeriaWilaya): string[] {
  return [
    wilaya.name_en,
    wilaya.name_fr,
    wilaya.name_ar,
    wilaya.code,
    String(wilaya.id),
    String(wilaya.id).padStart(2, '0'),
  ].map(normalizeWilayaText).filter(Boolean);
}

export function matchWilayaName(value: string | null | undefined, wilayas: AlgeriaWilaya[]): AlgeriaWilaya | null {
  if (!value) return null;
  const candidate = normalizeWilayaText(value);
  if (!candidate) return null;

  let best: { wilaya: AlgeriaWilaya; score: number } | null = null;
  for (const wilaya of wilayas) {
    for (const alias of aliases(wilaya)) {
      let score = 0;
      if (candidate === alias) score = 100;
      else if (candidate.startsWith(`${alias} `) || candidate.endsWith(` ${alias}`)) score = 85;
      else if (alias.length >= 4 && candidate.includes(alias)) score = 70;
      if (score > (best?.score ?? 0)) best = { wilaya, score };
    }
  }
  return best?.wilaya ?? null;
}

export function matchWilayaFromAddress(parts: AddressParts | null, wilayas: AlgeriaWilaya[]): AlgeriaWilaya | null {
  if (!parts) return null;
  const provinceMatch = matchWilayaName(parts.province, wilayas);
  if (provinceMatch) return provinceMatch;

  // Google and OSM occasionally omit administrative_area_level_1. Only then
  // fall back to locality fields; never let a locality override a province.
  return matchWilayaName(parts.city, wilayas)
    || matchWilayaName(parts.commune, wilayas)
    || null;
}

