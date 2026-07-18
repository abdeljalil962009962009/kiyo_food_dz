import { useState } from 'react';
import { ChevronDown, Languages } from 'lucide-react';
import type { Locale } from '../lib/i18n';

const LANGUAGES: { code: Locale; label: string; shortLabel: string }[] = [
  { code: 'fr', label: 'Français', shortLabel: 'FR' },
  { code: 'ar', label: 'العربية', shortLabel: 'AR' },
  { code: 'en', label: 'English', shortLabel: 'EN' },
];

const ACCESSIBLE_LABEL: Record<Locale, string> = {
  en: 'Change language',
  fr: 'Changer de langue',
  ar: 'تغيير اللغة',
};

export function LocaleSwitcher({
  locale,
  onChange,
  inverted = false,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
  inverted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((language) => language.code === locale) ?? LANGUAGES[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
          inverted
            ? 'border-white/25 bg-black/20 text-white hover:bg-black/35'
            : 'border-ink-100 bg-white text-ink-700 hover:bg-ink-50'
        }`}
        aria-label={ACCESSIBLE_LABEL[locale]}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Languages className="h-4 w-4" aria-hidden />
        {current.shortLabel}
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-label={ACCESSIBLE_LABEL[locale]}
          />
          <ul
            className="absolute z-50 mt-1 w-36 overflow-hidden rounded-lg border border-ink-100 bg-white py-1 shadow-card-lg"
            style={{ insetInlineEnd: 0 }}
            role="listbox"
            aria-label={ACCESSIBLE_LABEL[locale]}
          >
            {LANGUAGES.map((language) => (
              <li key={language.code} role="option" aria-selected={language.code === locale}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(language.code);
                    setOpen(false);
                  }}
                  className={`flex min-h-11 w-full items-center justify-between px-3 py-2 text-sm ${
                    language.code === locale
                      ? 'bg-ink-50 font-bold text-ink-900'
                      : 'text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  <span>{language.label}</span>
                  <span className="text-xs opacity-60">{language.shortLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
