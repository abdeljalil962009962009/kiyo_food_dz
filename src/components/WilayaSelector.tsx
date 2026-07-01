import { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, Search, Check, ChevronDown } from 'lucide-react';
import { useWilaya, getWilayaName, type Wilaya } from '../context/WilayaContext';
import { useT } from '../lib/i18n-react';
import { Spinner } from './feedback';

export function WilayaSelector({ variant = 'dropdown' }: { variant?: 'dropdown' | 'inline' }) {
  const { t } = useT();
  const { wilayas, selectedWilaya, setSelectedWilaya, loading, detectLocation, detectionInProgress, error, locale } = useWilaya();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? wilayas.filter((w) => {
        const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const names = [w.name_en, w.name_fr, w.name_ar].map((n) =>
          n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
        return names.some((n) => n.includes(q));
      })
    : wilayas;

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleSelect = (wilaya: Wilaya) => {
    setSelectedWilaya(wilaya);
    setOpen(false);
    setQuery('');
  };

  const handleDetect = async () => {
    await detectLocation();
    setOpen(false);
  };

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-ember-500" />
        {loading ? (
          <span className="text-sm text-ink-400">{t('common.loading')}</span>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-sm font-medium text-ink-700 hover:text-ink-900"
          >
            {selectedWilaya ? getWilayaName(selectedWilaya, locale) : t('wilaya.select')}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        )}
        {open && (
          <WilayaModal
            wilayas={filtered}
            query={query}
            setQuery={setQuery}
            selectedWilaya={selectedWilaya}
            onSelect={handleSelect}
            onDetect={handleDetect}
            detectionInProgress={detectionInProgress}
            error={error}
            locale={locale}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm transition-colors hover:border-ink-200 hover:bg-ink-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <MapPin className="h-4 w-4 text-ember-500" />
        {loading ? (
          <span className="text-ink-400">{t('common.loading')}</span>
        ) : selectedWilaya ? (
          <span className="font-medium text-ink-700">{getWilayaName(selectedWilaya, locale)}</span>
        ) : (
          <span className="text-ink-500">{t('wilaya.select')}</span>
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <WilayaModal
            wilayas={filtered}
            query={query}
            setQuery={setQuery}
            selectedWilaya={selectedWilaya}
            onSelect={handleSelect}
            onDetect={handleDetect}
            detectionInProgress={detectionInProgress}
            error={error}
            locale={locale}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </div>
  );
}

function WilayaModal({
  wilayas,
  query,
  setQuery,
  selectedWilaya,
  onSelect,
  onDetect,
  detectionInProgress,
  error,
  locale,
  onClose,
}: {
  wilayas: Wilaya[];
  query: string;
  setQuery: (q: string) => void;
  selectedWilaya: Wilaya | null;
  onSelect: (w: Wilaya) => void;
  onDetect: () => void;
  detectionInProgress: boolean;
  error: string | null;
  locale: 'en' | 'fr' | 'ar';
  onClose: () => void;
}) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, wilayas.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, wilayas.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (wilayas[highlightedIndex]) {
          onSelect(wilayas[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  return (
    <div className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card-lg">
      <div className="border-b border-ink-100 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('wilaya.searchPlaceholder')}
            className="w-full rounded-lg border border-ink-100 bg-ink-50 py-2 pl-9 pr-3 text-sm placeholder:text-ink-400 focus:border-ember-500 focus:outline-none focus:ring-1 focus:ring-ember-500"
          />
        </div>
        <button
          onClick={onDetect}
          disabled={detectionInProgress}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-ember-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-ember-600 disabled:opacity-50"
        >
          {detectionInProgress ? (
            <>
              <Spinner className="h-3 w-3" />
              {t('wilaya.detecting')}
            </>
          ) : (
            <>
              <Navigation className="h-3 w-3" />
              {t('wilaya.detectLocation')}
            </>
          )}
        </button>
        {error && (
          <p className="mt-2 text-xs text-error-500">{error}</p>
        )}
      </div>
      <div
        ref={listRef}
        className="max-h-64 overflow-y-auto overscroll-contain"
        role="listbox"
      >
        {wilayas.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-ink-500">
            {t('wilaya.noResults')}
          </div>
        ) : (
          wilayas.map((w, i) => {
            const isSelected = selectedWilaya?.id === w.id;
            const isHighlighted = i === highlightedIndex;
            return (
              <button
                key={w.id}
                onClick={() => onSelect(w)}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                  isHighlighted ? 'bg-ink-50' : ''
                } ${isSelected ? 'bg-ember-50 text-ember-700' : 'text-ink-700 hover:bg-ink-50'}`}
                role="option"
                aria-selected={isSelected}
              >
                <span className="font-medium">{getWilayaName(w, locale)}</span>
                {isSelected && <Check className="h-4 w-4 text-ember-500" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
