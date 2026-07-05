import { useState } from 'react';
import { Database, Key, RefreshCw, Copy, Download, Check, AlertTriangle, Sparkles, UserCheck } from 'lucide-react';

export function SupabaseConfigMissing() {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedClean, setCopiedClean] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReload = () => {
    window.location.reload();
  };

  const handleCopySchema = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/supabase_schema.sql');
      if (!response.ok) {
        throw new Error('Impossible de charger le fichier SQL. Vérifiez que l\'application est lancée.');
      }
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la copie du schéma');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSchema = () => {
    const link = document.createElement('a');
    link.href = '/supabase_schema.sql';
    link.download = 'supabase_schema.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const cleanStartSql = `-- ⚠️ SCRIPT DE RÉINITIALISATION PROPRE ET SÉCURISÉ
-- Ce script ne plantera jamais, même si les tables n'existent pas encore !

-- Étape 1 : Supprimer tous les utilisateurs enregistrés dans Supabase Auth (suppression en cascade vers profiles)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DELETE FROM auth.users;
  END IF;
END $$;

-- Étape 2 : Vider toutes les tables publiques proprement (seulement si elles existent)
DO $$
DECLARE
  tab text;
BEGIN
  FOR tab IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('order_items', 'orders', 'reviews', 'modifier_options', 'menu_item_modifiers', 'menu_items', 'menu_categories', 'restaurants', 'profiles', 'financial_ledger', 'notifications', 'support_messages', 'support_tickets', 'audit_logs')
  LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(tab) || ' CASCADE;';
  END LOOP;
END $$;`;

  const handleCopyCleanSql = async () => {
    try {
      await navigator.clipboard.writeText(cleanStartSql);
      setCopiedClean(true);
      setTimeout(() => setCopiedClean(false), 3000);
    } catch {
      setError('Impossible de copier le script de nettoyage');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fdfdfc] p-6 text-slate-800 antialiased selection:bg-amber-100">
      <div className="w-full max-w-2xl rounded-3xl border border-amber-100 bg-white p-8 shadow-md md:p-12">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Database className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wider uppercase text-amber-600">
              Kiyo Food DZ
            </span>
            <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              Assistant d'Installation Supabase
            </h1>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          Bienvenue sur <strong>Kiyo Food</strong>, votre plateforme moderne de livraison de repas ! Pour que l'authentification et la base de données fonctionnent, vous devez lier votre propre projet Supabase.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-600 border border-red-100">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Section 1: Env Keys */}
          <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Key className="h-4 w-4 text-amber-500" />
              1. Configurer vos Clés Supabase
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Récupérez vos clés dans l'onglet <strong>Project Settings &gt; API</strong> de Supabase et ajoutez-les dans Google AI Studio (bouton de paramètres) :
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-slate-200">
                <code className="font-mono text-xs font-bold text-amber-600 select-all">VITE_SUPABASE_URL</code>
                <span className="text-[10px] font-medium text-slate-400">URL de l'API Supabase</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-slate-200">
                <code className="font-mono text-xs font-bold text-amber-600 select-all">VITE_SUPABASE_ANON_KEY</code>
                <span className="text-[10px] font-medium text-slate-400">Clé anonyme (anon key)</span>
              </div>
            </div>
          </div>

          {/* Section 2: SQL Schema Copy & Explain */}
          <div className="rounded-2xl bg-amber-50/40 p-5 border border-amber-100/50">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Sparkles className="h-4 w-4 text-amber-500" />
              2. Initialiser la Base de Données
            </h2>
            <p className="mt-1.5 text-xs text-slate-600">
              <strong>C'est quoi <code className="font-mono bg-amber-100/50 px-1 rounded text-amber-800">supabase_schema.sql</code> ?</strong><br />
              C'est le fichier complet qui crée toutes vos tables (restaurants, commandes, profils), fonctions de sécurité, RLS et déclencheurs de Kiyo Food. Vous devez l'exécuter dans l'éditeur SQL de votre projet Supabase.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleCopySchema}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2.5 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {loading ? 'Chargement...' : copied ? 'Schéma SQL Copié !' : 'Copier tout le Schéma SQL'}
              </button>

              <button
                onClick={handleDownloadSchema}
                className="flex items-center gap-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs px-4 py-2.5 transition-all active:scale-[0.98]"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger le fichier SQL
              </button>
            </div>

            <div className="mt-4 border-t border-amber-100/60 pt-4">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Pourquoi l'erreur "relation public.order_items does not exist" ?
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Cette erreur s'est produite car vous avez essayé de vider les tables avant de les créer ! Vous ne pouvez pas supprimer des tables qui n'existent pas encore. Exécutez d'abord le schéma ci-dessus.
              </p>
              
              <div className="mt-3">
                <button
                  onClick={handleCopyCleanSql}
                  className="flex items-center gap-2 rounded-lg bg-amber-100/50 hover:bg-amber-100 text-amber-900 font-semibold text-[11px] px-3 py-1.5 transition-all"
                >
                  {copiedClean ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedClean ? 'Script de nettoyage copié !' : 'Copier le script de nettoyage sécurisé (sans plantage)'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Super Admin Info */}
          <div className="rounded-2xl bg-blue-50/50 p-5 border border-blue-100/50">
            <h2 className="flex items-center gap-2 font-bold text-blue-900 text-sm">
              <UserCheck className="h-4 w-4 text-blue-600" />
              3. Accès à votre Compte Super Admin
            </h2>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Pour accéder au panneau d'administration suprême (Super Admin) :
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1.5 text-[11px] text-slate-600">
              <li>Inscrivez-vous simplement sur Kiyo Food avec votre adresse e-mail : <strong className="text-blue-700 bg-blue-100/50 px-1 py-0.5 rounded font-mono">sameraldjaber@gmail.com</strong></li>
              <li>Le déclencheur de la base de données détectera automatiquement cet e-mail et vous attribuera le rôle <code className="font-mono text-blue-700 bg-blue-100/50 px-1 rounded">super_admin</code> instantanément !</li>
              <li>Vous pourrez ensuite gérer tous les restaurants, clients, livreurs et paramètres de la plateforme.</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleReload}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-sm font-bold text-white transition-all hover:bg-amber-600 active:scale-[0.98] shadow-md shadow-amber-500/10"
          >
            <RefreshCw className="h-4 w-4" />
            Vérifier et Actualiser l'Application
          </button>
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">
        Kiyo Food DZ • Développé en toute sécurité avec Google AI Studio
      </p>
    </div>
  );
}

