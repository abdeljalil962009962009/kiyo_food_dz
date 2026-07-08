import { useState } from 'react';
import { AlertTriangle, Check, Copy, Database, Key, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

export function SupabaseConfigMissing() {
  const [copiedChecklist, setCopiedChecklist] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReload = () => {
    window.location.reload();
  };

  const productionChecklist = `KIYO FOOD PRODUCTION CHECKLIST

1. Vercel environment variables
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

2. Supabase database
- Apply every migration in /supabase/migrations in order.
- Confirm RLS is enabled on production tables.
- Confirm owner/super_admin permissions through database RBAC.

3. Owner account
- Create the owner account normally.
- Assign role = super_admin only to the authorized owner profile.
- Verify Control Center, audit logs, business rules, settlements, users, restaurants, drivers, and geography.

4. Launch verification
- Vercel deployment is Ready.
- Signup/login works.
- Checkout creates real orders.
- Restaurant dashboard receives orders.
- Driver dashboard updates status/location.
- Owner business rules affect checkout and finance.`;

  const handleCopyChecklist = async () => {
    try {
      await navigator.clipboard.writeText(productionChecklist);
      setCopiedChecklist(true);
      setTimeout(() => setCopiedChecklist(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to copy the production checklist.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fdfdfc] p-6 text-slate-800 antialiased selection:bg-amber-100">
      <div className="w-full max-w-2xl rounded-3xl border border-amber-100 bg-white p-8 shadow-md md:p-12">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Kiyo Food DZ
            </span>
            <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Supabase production setup required
            </h1>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          Kiyo Food is blocking startup because the Supabase environment variables are missing or invalid. This is intentional:
          production should never silently connect to a placeholder database.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Key className="h-4 w-4 text-amber-500" />
              1. Add Vercel environment variables
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              In Vercel, open Project Settings, then Environment Variables, and add the production Supabase values:
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <code className="select-all font-mono text-xs font-bold text-amber-600">VITE_SUPABASE_URL</code>
                <span className="text-[10px] font-medium text-slate-400">Supabase project URL</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <code className="select-all font-mono text-xs font-bold text-amber-600">VITE_SUPABASE_ANON_KEY</code>
                <span className="text-[10px] font-medium text-slate-400">public anon key</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100/50 bg-amber-50/40 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-amber-500" />
              2. Apply the database schema
            </h2>
            <p className="mt-1.5 text-xs text-slate-600">
              Apply the SQL files in <code className="rounded bg-amber-100/60 px-1 font-mono">supabase/migrations</code>
              to production in order. The migrations are the production source of truth for tables, RLS policies, functions,
              triggers, indexes, maps, finance, delivery rules, and owner controls.
            </p>

            <p className="mt-3 rounded-xl border border-amber-100 bg-white/70 px-3 py-2 text-xs text-slate-600">
              Do not use old copied setup snippets for production. They may miss later security hardening migrations.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100/50 bg-blue-50/50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-blue-900">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              3. Verify owner access through RBAC
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Do not rely on a hardcoded email or frontend-only permission. Create the owner account, assign the
              <code className="mx-1 rounded bg-blue-100/50 px-1 font-mono text-blue-700">super_admin</code>
              role in the production database, and confirm RLS blocks unauthorized users.
            </p>
            <button
              onClick={handleCopyChecklist}
              className="mt-3 flex items-center gap-2 rounded-lg bg-blue-100/70 px-3 py-1.5 text-[11px] font-semibold text-blue-900 transition-all hover:bg-blue-100"
            >
              {copiedChecklist ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedChecklist ? 'Checklist copied' : 'Copy production checklist'}
            </button>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleReload}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-sm font-bold text-white shadow-md shadow-amber-500/10 transition-all hover:bg-amber-600 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Recheck configuration
          </button>
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">
        Kiyo Food DZ - secure production configuration
      </p>
    </div>
  );
}
