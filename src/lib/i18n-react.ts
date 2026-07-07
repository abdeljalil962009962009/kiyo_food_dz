import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { translate, type TranslationKey, type Locale } from './i18n';

/** Translation hook bound to the current locale from AuthContext. */
export function useT() {
  const { locale } = useAuth();
  const t = useCallback((key: TranslationKey) => translate(locale, key), [locale]);
  return { t, locale, currentLocale: locale } as const;
}

export type { Locale, TranslationKey };
