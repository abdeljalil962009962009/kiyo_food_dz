import type { InputHTMLAttributes, ReactNode } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  icon?: ReactNode;
};

/**
 * Autofill-safe text field.
 *
 * We use a fully controlled input with onChange (React >= 16 reacts to
 * browser autofill via synthetic InputEvent). Combined with proper
 * autoComplete attributes and the webkit-autofill CSS shim in index.css,
 * this captures password-manager / browser autofill values reliably.
 */
export function Field({ label, error, icon, id, className = '', ...rest }: FieldProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      <label htmlFor={inputId} className="kiyo-label">{label}</label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`kiyo-input ${icon ? 'pl-10' : ''} ${error ? 'border-error-500 focus:border-error-500 focus:ring-error-500/10' : ''} ${className}`}
          {...rest}
        />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-error-600">{error}</p>}
    </div>
  );
}
