import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, X } from 'lucide-react';
import { useT } from '../lib/i18n-react';

type DialogTone = 'default' | 'danger' | 'success';

type DialogBase = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type ConfirmRequest = DialogBase & { kind: 'confirm' };
type PromptRequest = DialogBase & {
  kind: 'prompt';
  inputLabel: string;
  placeholder?: string;
  initialValue?: string;
  required?: boolean;
};
type DialogRequest = ConfirmRequest | PromptRequest;

type ActionDialogContextValue = {
  confirmAction: (request: Omit<ConfirmRequest, 'kind'>) => Promise<boolean>;
  requestText: (request: Omit<PromptRequest, 'kind'>) => Promise<string | null>;
};

const ActionDialogContext = createContext<ActionDialogContextValue | null>(null);

const DIALOG_COPY = {
  en: { confirm: 'Confirm', cancel: 'Cancel', close: 'Close dialog', required: 'Please enter a reason before continuing.' },
  fr: { confirm: 'Confirmer', cancel: 'Annuler', close: 'Fermer la fenêtre', required: 'Saisissez un motif avant de continuer.' },
  ar: { confirm: 'تأكيد', cancel: 'إلغاء', close: 'إغلاق النافذة', required: 'يرجى كتابة السبب قبل المتابعة.' },
} as const;

export function ActionDialogProvider({ children }: { children: ReactNode }) {
  const { locale } = useT();
  const copy = DIALOG_COPY[locale];
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const resolverRef = useRef<((result: boolean | string | null) => void) | null>(null);
  const cancelResultRef = useRef<boolean | null>(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback((next: DialogRequest) => {
    resolverRef.current?.(cancelResultRef.current);
    return new Promise<boolean | string | null>((resolve) => {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      resolverRef.current = resolve;
      cancelResultRef.current = next.kind === 'prompt' ? null : false;
      setValue(next.kind === 'prompt' ? (next.initialValue ?? '') : '');
      setValidationError(null);
      setRequest(next);
    });
  }, []);

  const finish = useCallback((result: boolean | string | null) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    setValidationError(null);
    resolve?.(result);
    window.setTimeout(() => previousFocusRef.current?.focus(), 0);
  }, []);

  const confirmAction = useCallback(
    (next: Omit<ConfirmRequest, 'kind'>) => open({ ...next, kind: 'confirm' }) as Promise<boolean>,
    [open],
  );
  const requestText = useCallback(
    (next: Omit<PromptRequest, 'kind'>) => open({ ...next, kind: 'prompt' }) as Promise<string | null>,
    [open],
  );

  useEffect(() => {
    if (!request) return;
    const focusTimer = window.setTimeout(() => {
      if (request.kind === 'prompt') inputRef.current?.focus();
      else confirmRef.current?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(request.kind === 'prompt' ? null : false);
      if (event.key === 'Tab') {
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [finish, request]);

  useEffect(() => () => resolverRef.current?.(cancelResultRef.current), []);

  const contextValue = useMemo(() => ({ confirmAction, requestText }), [confirmAction, requestText]);

  const submit = () => {
    if (!request) return;
    if (request.kind === 'confirm') {
      finish(true);
      return;
    }
    const trimmed = value.trim();
    if (request.required && !trimmed) {
      setValidationError(copy.required);
      inputRef.current?.focus();
      return;
    }
    finish(trimmed || null);
  };

  const tone = request?.tone ?? 'default';
  const ToneIcon = tone === 'danger' ? AlertTriangle : tone === 'success' ? CheckCircle2 : HelpCircle;
  const iconClass = tone === 'danger'
    ? 'bg-error-500/10 text-error-600'
    : tone === 'success'
      ? 'bg-sage-500/10 text-sage-600'
      : 'bg-ember-500/10 text-ember-600';
  const confirmClass = tone === 'danger'
    ? 'bg-error-600 text-white hover:bg-error-700 focus-visible:ring-error-500'
    : 'bg-ink-950 text-white hover:bg-ink-800 focus-visible:ring-ink-700';

  return (
    <ActionDialogContext.Provider value={contextValue}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) finish(request.kind === 'prompt' ? null : false);
          }}
        >
          <section
            ref={dialogRef}
            className="max-h-[min(88dvh,680px)] w-full overflow-y-auto rounded-t-xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-card-lg sm:max-w-md sm:rounded-xl sm:p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="kiyo-action-dialog-title"
            aria-describedby={request.message ? 'kiyo-action-dialog-message' : undefined}
          >
            <div className="mb-4 flex items-start gap-3">
              <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                <ToneIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="kiyo-action-dialog-title" className="font-display text-lg font-bold text-ink-950">{request.title}</h2>
                {request.message && <p id="kiyo-action-dialog-message" className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-600">{request.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => finish(request.kind === 'prompt' ? null : false)}
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label={copy.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {request.kind === 'prompt' && (
              <label className="mb-5 block">
                <span className="kiyo-label">{request.inputLabel}</span>
                <textarea
                  ref={inputRef}
                  value={value}
                  onChange={(event) => {
                    setValue(event.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder={request.placeholder}
                  rows={4}
                  className="kiyo-input min-h-28 w-full resize-y"
                  aria-invalid={Boolean(validationError)}
                  aria-describedby={validationError ? 'kiyo-action-dialog-error' : undefined}
                />
                {validationError && <span id="kiyo-action-dialog-error" className="mt-1.5 block text-xs font-medium text-error-600" role="alert">{validationError}</span>}
              </label>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => finish(request.kind === 'prompt' ? null : false)}
                className="kiyo-btn-secondary min-h-11 flex-1"
              >
                {request.cancelLabel ?? copy.cancel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={submit}
                className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${confirmClass}`}
              >
                {request.confirmLabel ?? copy.confirm}
              </button>
            </div>
          </section>
        </div>
      )}
    </ActionDialogContext.Provider>
  );
}

export function useActionDialog() {
  const context = useContext(ActionDialogContext);
  if (!context) throw new Error('useActionDialog must be used within ActionDialogProvider');
  return context;
}
