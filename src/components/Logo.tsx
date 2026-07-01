export function Logo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="relative inline-flex items-center justify-center rounded-xl bg-ink-900 text-white shadow-card"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <span
          className="font-display font-extrabold tracking-tight text-ember-500"
          style={{ fontSize: size * 0.52 }}
        >
          K
        </span>
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ember-500"
          aria-hidden
        />
      </span>
      {withText && (
        <span className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
          Kiyo <span className="text-ember-500">Food</span>
        </span>
      )}
    </div>
  );
}
