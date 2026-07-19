import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, RefreshCw, Search, ShieldCheck, Store, XCircle } from 'lucide-react';
import { supabase, type Profile, type PublicationReadiness, type RestaurantApplication, type RestaurantApplicationStatus } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import { ErrorState, Skeleton, Spinner } from './feedback';
import { RestaurantApplicationThread } from './RestaurantApplicationThread';
import {
  isApplicationWaitingOnAdmin,
  normalizeRestaurantApplicationStatus,
} from '../lib/restaurantApplicationStateMachine';
import { localizePublicationBlocker } from '../lib/publicationReadiness';
import { callAdminAction } from '../lib/adminApi';
import { callUserAction } from '../lib/userApi';
import { PrivateRestaurantImage } from './PrivateRestaurantImage';
import { applicationStatusLabel } from '../lib/domainStatus';

type Applicant = Pick<Profile, 'id' | 'email' | 'full_name' | 'phone'>;

const labels = {
  en: {
    title: 'Restaurant applications',
    waiting: 'Waiting on you',
    search: 'Search applications',
    empty: 'No applications match this filter.',
    details: 'Application file',
    start: 'Start review',
    changes: 'Request changes',
    reject: 'Reject',
    approve: 'Preliminary approval',
    menu: 'Start menu review',
    ready: 'Mark ready to publish',
    publish: 'Publish restaurant',
    suspend: 'Suspend',
    reactivate: 'Reactivate onboarding',
    reason: 'Decision reason shown to applicant',
    notes: 'Private admin notes',
    saveNotes: 'Save private notes',
    foodRate: 'Approved food commission (%)',
    deliveryRate: 'Approved delivery share (%)',
    base: 'Commission base',
    all: 'All',
    refresh: 'Refresh',
    readiness: 'Publication readiness',
    readyNow: 'All publication requirements are complete.',
    blocked: 'Publication is blocked by:',
    legalName: 'Legal name',
    phone: 'Phone',
    cuisine: 'Cuisine',
    address: 'Address',
    deliveryRadius: 'Delivery radius',
    minimumOrder: 'Minimum order',
    coordinates: 'Coordinates',
    proposedFoodCommission: 'Proposed food commission',
    proposedDeliveryShare: 'Proposed delivery share',
    notProposed: 'Not proposed',
    description: 'Description',
    openingHours: 'Opening hours',
    newBadge: 'new',
    foodOnly: 'Food subtotal only',
    foodDelivery: 'Food and delivery combined',
    ratesInvalid: 'Approved rates must be between 0% and 100%.',
    loadFailed: 'Restaurant applications could not be loaded. Retry in a moment.',
    actionFailed: 'The application action could not be completed. Review the status and try again.',
    approveConfirm: (name: string, rate: string) => `Approve ${name} for onboarding with ${rate}% food commission?`,
    publishConfirm: (name: string) => `Publish ${name} to all customers?`,
    transitionConfirm: (status: string, name: string) => `${status.replace(/_/g, ' ')}: ${name}?`,
  },
  fr: {
    title: 'Demandes de restaurants',
    waiting: 'En attente de vous',
    search: 'Rechercher une demande',
    empty: 'Aucune demande ne correspond à ce filtre.',
    details: 'Dossier de demande',
    start: 'Commencer l’examen',
    changes: 'Demander des modifications',
    reject: 'Rejeter',
    approve: 'Approbation préliminaire',
    menu: 'Commencer l’examen du menu',
    ready: 'Marquer prêt à publier',
    publish: 'Publier le restaurant',
    suspend: 'Suspendre',
    reactivate: 'Réactiver l’intégration',
    reason: 'Motif de décision visible par le demandeur',
    notes: 'Notes administrateur privées',
    saveNotes: 'Enregistrer les notes privées',
    foodRate: 'Commission nourriture approuvée (%)',
    deliveryRate: 'Part livraison approuvée (%)',
    base: 'Base de commission',
    all: 'Toutes',
    refresh: 'Actualiser',
    readiness: 'État de préparation à la publication',
    readyNow: 'Toutes les conditions de publication sont remplies.',
    blocked: 'La publication est bloquée par :',
    legalName: 'Nom légal',
    phone: 'Téléphone',
    cuisine: 'Cuisine',
    address: 'Adresse',
    deliveryRadius: 'Rayon de livraison',
    minimumOrder: 'Commande minimale',
    coordinates: 'Coordonnées',
    proposedFoodCommission: 'Commission nourriture proposée',
    proposedDeliveryShare: 'Part livraison proposée',
    notProposed: 'Non proposée',
    description: 'Description',
    openingHours: 'Horaires',
    newBadge: 'nouveau',
    foodOnly: 'Sous-total nourriture uniquement',
    foodDelivery: 'Nourriture et livraison',
    ratesInvalid: 'Les taux approuvés doivent être entre 0 % et 100 %.',
    loadFailed: 'Les demandes de restaurants n’ont pas pu être chargées. Réessayez dans un instant.',
    actionFailed: 'L’action sur la demande n’a pas pu être terminée. Vérifiez le statut puis réessayez.',
    approveConfirm: (name: string, rate: string) => `Approuver ${name} pour l’intégration avec ${rate} % de commission nourriture ?`,
    publishConfirm: (name: string) => `Publier ${name} pour tous les clients ?`,
    transitionConfirm: (status: string, name: string) => `${status.replace(/_/g, ' ')} : ${name} ?`,
  },
  ar: {
    title: 'طلبات المطاعم',
    waiting: 'بانتظار قرارك',
    search: 'البحث في الطلبات',
    empty: 'لا توجد طلبات مطابقة.',
    details: 'ملف الطلب',
    start: 'بدء المراجعة',
    changes: 'طلب تعديلات',
    reject: 'رفض',
    approve: 'موافقة أولية',
    menu: 'بدء مراجعة القائمة',
    ready: 'تحديد كجاهز للنشر',
    publish: 'نشر المطعم',
    suspend: 'تعليق',
    reactivate: 'إعادة تفعيل الإعداد',
    reason: 'سبب القرار الظاهر لمقدم الطلب',
    notes: 'ملاحظات إدارية خاصة',
    saveNotes: 'حفظ الملاحظات الخاصة',
    foodRate: 'عمولة الطعام المعتمدة (%)',
    deliveryRate: 'حصة التوصيل المعتمدة (%)',
    base: 'أساس العمولة',
    all: 'الكل',
    refresh: 'تحديث',
    readiness: 'جاهزية النشر',
    readyNow: 'اكتملت جميع متطلبات النشر.',
    blocked: 'النشر متوقف بسبب:',
    legalName: 'الاسم القانوني',
    phone: 'الهاتف',
    cuisine: 'نوع المطبخ',
    address: 'العنوان',
    deliveryRadius: 'نطاق التوصيل',
    minimumOrder: 'الحد الأدنى للطلب',
    coordinates: 'الإحداثيات',
    proposedFoodCommission: 'عمولة الطعام المقترحة',
    proposedDeliveryShare: 'حصة التوصيل المقترحة',
    notProposed: 'غير مقترحة',
    description: 'الوصف',
    openingHours: 'ساعات العمل',
    newBadge: 'جديد',
    foodOnly: 'إجمالي الطعام فقط',
    foodDelivery: 'الطعام والتوصيل معاً',
    ratesInvalid: 'يجب أن تكون النسب المعتمدة بين 0٪ و100٪.',
    loadFailed: 'تعذر تحميل طلبات المطاعم. أعد المحاولة بعد لحظات.',
    actionFailed: 'تعذر إكمال إجراء الطلب. تحقق من الحالة ثم أعد المحاولة.',
    approveConfirm: (name: string, rate: string) => `هل توافق على إدماج ${name} بعمولة طعام ${rate}٪؟`,
    publishConfirm: (name: string) => `هل تريد نشر ${name} لجميع العملاء؟`,
    transitionConfirm: (status: string, name: string) => `${status.replace(/_/g, ' ')}: ${name}؟`,
  },
} as const;

export function RestaurantApplicationsPanel() {
  const { locale, t } = useT();
  const tx = labels[locale];
  const [applications, setApplications] = useState<RestaurantApplication[]>([]);
  const [applicants, setApplicants] = useState<Record<string, Applicant>>({});
  const [unreadByApplication, setUnreadByApplication] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'waiting' | RestaurantApplicationStatus>('waiting');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [foodRate, setFoodRate] = useState('7');
  const [deliveryRate, setDeliveryRate] = useState('0');
  const [commissionBase, setCommissionBase] = useState<'food_subtotal' | 'food_plus_delivery'>('food_subtotal');
  const [readiness, setReadiness] = useState<PublicationReadiness | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: applicationRows, error: applicationsError } = await supabase
      .from('restaurant_applications')
      .select('*')
      .order('updated_at', { ascending: false });
    if (applicationsError) {
      console.error('[Kiyo] Load restaurant applications error:', applicationsError);
      setLoading(false);
      setError(tx.loadFailed);
      return;
    }
    const normalized = ((applicationRows ?? []) as Array<Omit<RestaurantApplication, 'status'> & { status: string }>)
      .map(normalizeApplication);
    const applicantIds = [...new Set(normalized.map((application) => application.applicant_id))];
    let profileMap: Record<string, Applicant> = {};
    if (applicantIds.length > 0) {
      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id,email,full_name,phone')
        .in('id', applicantIds);
      if (profilesError) {
        console.error('[Kiyo] Load application applicants error:', profilesError);
        setLoading(false);
        setError(tx.loadFailed);
        return;
      }
      profileMap = Object.fromEntries(((profileRows ?? []) as Applicant[]).map((profile) => [profile.id, profile]));
    }
    const { data: unreadRows } = await supabase
      .from('restaurant_application_messages')
      .select('application_id')
      .eq('sender_role', 'applicant')
      .is('read_by_recipient_at', null);
    const unreadMap: Record<string, number> = {};
    for (const row of (unreadRows ?? []) as Array<{ application_id: string }>) {
      unreadMap[row.application_id] = (unreadMap[row.application_id] ?? 0) + 1;
    }
    setApplications(normalized);
    setApplicants(profileMap);
    setUnreadByApplication(unreadMap);
    setSelectedId((current) => current && normalized.some((item) => item.id === current)
      ? current : normalized[0]?.id ?? null);
    setLoading(false);
  }, [tx.loadFailed]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('owner-restaurant-applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_applications' }, () => { void load(); })
      .subscribe();
    const messagesChannel = supabase
      .channel('owner-restaurant-application-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_application_messages' }, () => { void load(); })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(messagesChannel);
    };
  }, [load]);

  const filtered = useMemo(() => applications.filter((application) => {
    if (filter === 'waiting' && !isApplicationWaitingOnAdmin(application.status)) return false;
    if (filter !== 'all' && filter !== 'waiting' && application.status !== filter) return false;
    const applicant = applicants[application.applicant_id];
    const haystack = `${application.restaurant_name} ${application.legal_name ?? ''} ${applicant?.email ?? ''} ${applicant?.full_name ?? ''}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [applications, applicants, filter, query]);

  const selected = applications.find((application) => application.id === selectedId) ?? null;
  const canSuspendSelected = Boolean(selected && selected.status !== 'suspended' && selected.status !== 'rejected' && selected.status !== 'archived' && (
    selected.restaurant_id || ['preliminarily_approved', 'onboarding_in_progress', 'menu_review', 'ready_to_publish', 'published'].includes(selected.status)
  ));

  useEffect(() => {
    if (!selected) return;
    setInternalNotes(selected.admin_internal_notes ?? '');
    setFoodRate(String(Number(selected.proposed_food_commission_rate ?? 0.07) * 100));
    setDeliveryRate(String(Number(selected.proposed_delivery_share_rate ?? 0) * 100));
    setCommissionBase(selected.proposed_commission_base ?? 'food_subtotal');
    setReason('');
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    setReadiness(null);
    if (!selected?.restaurant_id) return;
    void callUserAction<PublicationReadiness>('get_restaurant_publication_readiness', {
      p_restaurant_id: selected.restaurant_id,
    }).then(({ data, error: readinessError }) => {
      if (!cancelled && !readinessError) setReadiness(data as PublicationReadiness);
    });
    return () => { cancelled = true; };
  }, [selected?.restaurant_id, selected?.application_version]);

  const run = async (operation: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (acting) return;
    setActing(true);
    setError(null);
    const result = await operation();
    setActing(false);
    if (result.error) {
      console.error('[Kiyo] Restaurant application action failed:', result.error);
      setError(tx.actionFailed);
      return;
    }
    await load();
  };

  const transition = async (target: RestaurantApplicationStatus, needsReason = false) => {
    if (!selected) return;
    if (needsReason && reason.trim().length < 3) {
      setError(tx.reason);
      return;
    }
    if (['rejected', 'suspended'].includes(target) && !window.confirm(tx.transitionConfirm(applicationStatusLabel(target, locale), selected.restaurant_name))) return;
    await run(() => callAdminAction('review_restaurant_application', {
      p_application_id: selected.id,
      p_target_status: target,
      p_reason: reason.trim() || null,
      p_expected_version: selected.application_version,
    }));
  };

  const preliminaryApprove = async () => {
    if (!selected) return;
    const food = Number(foodRate) / 100;
    const delivery = Number(deliveryRate) / 100;
    if (!Number.isFinite(food) || food < 0 || food > 1 || !Number.isFinite(delivery) || delivery < 0 || delivery > 1) {
      setError(tx.ratesInvalid);
      return;
    }
    if (!window.confirm(tx.approveConfirm(selected.restaurant_name, foodRate))) return;
    await run(() => callAdminAction('preliminarily_approve_restaurant_application', {
      p_application_id: selected.id,
      p_food_commission_rate: food,
      p_delivery_share_rate: delivery,
      p_commission_base: commissionBase,
      p_note: reason.trim() || null,
      p_expected_version: selected.application_version,
    }));
  };

  const publish = async () => {
    if (!selected?.restaurant_id) return;
    if (!window.confirm(tx.publishConfirm(selected.restaurant_name))) return;
    await run(() => callAdminAction('publish_restaurant', {
      p_restaurant_id: selected.restaurant_id,
      p_expected_application_version: selected.application_version,
    }));
  };

  const saveNotes = async () => {
    if (!selected) return;
    await run(() => callAdminAction('update_restaurant_application_internal_notes', {
      p_application_id: selected.id,
      p_notes: internalNotes,
      p_expected_version: selected.application_version,
    }));
  };

  if (loading) return <Skeleton count={4} />;
  if (error && applications.length === 0) {
    return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  }

  const statuses = [...new Set(applications.map((application) => application.status))];
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-ink-900">{tx.title}</h2>
          <p className="text-xs text-ink-400">{applications.filter((item) => isApplicationWaitingOnAdmin(item.status)).length} {tx.waiting.toLowerCase()}</p>
        </div>
        <button type="button" onClick={load} className="kiyo-btn-secondary min-h-11 px-3" title={tx.refresh}>
          <RefreshCw className="h-4 w-4" /><span className="sr-only">{tx.refresh}</span>
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-ink-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="kiyo-input min-h-11 pl-10" placeholder={tx.search} />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="kiyo-input min-h-11 sm:w-56">
          <option value="waiting">{tx.waiting}</option>
          <option value="all">{tx.all}</option>
          {statuses.map((status) => <option key={status} value={status}>{applicationStatusLabel(status, locale)}</option>)}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
        <div className="space-y-2">
          {filtered.length === 0 ? <p className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-400">{tx.empty}</p> : filtered.map((application) => {
            const applicant = applicants[application.applicant_id];
            const selectedRow = application.id === selectedId;
            return (
              <button key={application.id} type="button" onClick={() => setSelectedId(application.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedRow ? 'border-ember-300 bg-ember-50' : 'border-ink-100 bg-white hover:border-ink-200'}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-ink-900 text-white"><Store className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-900">{application.restaurant_name}</p>
                    <p className="truncate text-xs text-ink-400">{applicant?.full_name ?? applicant?.email ?? application.applicant_id}</p>
                    <span className="mt-1 inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">{applicationStatusLabel(application.status, locale)}</span>
                    {(unreadByApplication[application.id] ?? 0) > 0 && (
                      <span className="ml-1 inline-flex rounded-full bg-ember-600 px-2 py-0.5 text-[11px] font-bold text-white">
                        {unreadByApplication[application.id]} {tx.newBadge}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="space-y-5 rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">{tx.details}</p>
                <h3 className="font-display text-xl font-extrabold text-ink-900">{selected.restaurant_name}</h3>
                <p className="text-sm text-ink-500">{applicants[selected.applicant_id]?.email}</p>
              </div>
              <span className="rounded-full bg-ember-50 px-3 py-1 text-xs font-bold text-ember-700">{applicationStatusLabel(selected.status, locale)}</span>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label={tx.legalName} value={selected.legal_name ?? '-'} />
              <Info label={tx.phone} value={selected.phone} />
              <Info label={tx.cuisine} value={selected.cuisine.join(', ') || '-'} />
              <Info label={tx.address} value={selected.address} />
              <Info label={tx.deliveryRadius} value={`${selected.max_delivery_km} km`} />
              <Info label={tx.minimumOrder} value={`${selected.min_order_amount} DZD`} />
              <Info label={tx.coordinates} value={selected.latitude == null ? '-' : `${selected.latitude.toFixed(6)}, ${selected.longitude?.toFixed(6)}`} />
              <Info label={tx.proposedFoodCommission} value={selected.proposed_food_commission_rate == null ? tx.notProposed : `${(Number(selected.proposed_food_commission_rate) * 100).toFixed(2)}%`} />
              <Info label={tx.proposedDeliveryShare} value={selected.proposed_delivery_share_rate == null ? tx.notProposed : `${(Number(selected.proposed_delivery_share_rate) * 100).toFixed(2)}%`} />
            </dl>

            {selected.description && <div><p className="text-xs font-semibold text-ink-400">{tx.description}</p><p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{selected.description}</p></div>}
            {Object.keys(selected.opening_hours).length > 0 && <div><p className="text-xs font-semibold text-ink-400">{tx.openingHours}</p><pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-xs text-ink-700">{JSON.stringify(selected.opening_hours, null, 2)}</pre></div>}
            {(selected.logo_url || selected.cover_image_url) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {selected.logo_url && <PrivateRestaurantImage value={selected.logo_url} alt={`${selected.restaurant_name} logo`} className="h-32 w-full rounded-lg border border-ink-100 object-cover" />}
                {selected.cover_image_url && <PrivateRestaurantImage value={selected.cover_image_url} alt={`${selected.restaurant_name} cover`} className="h-32 w-full rounded-lg border border-ink-100 object-cover" />}
              </div>
            )}

            {selected.changes_requested_reason && <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">{selected.changes_requested_reason}</div>}
            {selected.rejection_reason && <div className="rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-700">{selected.rejection_reason}</div>}

            {readiness && (
              <div className={`rounded-xl border p-3 ${readiness.ready ? 'border-sage-200 bg-sage-50' : 'border-warning-200 bg-warning-50'}`}>
                <p className="text-sm font-bold text-ink-800">{tx.readiness}</p>
                {readiness.ready ? (
                  <p className="mt-1 text-sm text-sage-700">{tx.readyNow}</p>
                ) : (
                  <div className="mt-1 text-sm text-warning-800">
                    <p>{tx.blocked}</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {readiness.blockers.map((blocker) => (
                        <li key={blocker}>{localizePublicationBlocker(blocker, locale)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="kiyo-label" htmlFor="application-reason">{tx.reason}</label>
              <textarea id="application-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="kiyo-input min-h-20" />
            </div>

            {selected.status === 'under_review' && (
              <div className="grid gap-3 rounded-xl border border-ink-100 bg-ink-50 p-3 sm:grid-cols-2">
                <label><span className="kiyo-label">{tx.foodRate}</span><input className="kiyo-input" type="number" min="0" max="100" step="0.1" value={foodRate} onChange={(event) => setFoodRate(event.target.value)} /></label>
                <label><span className="kiyo-label">{tx.deliveryRate}</span><input className="kiyo-input" type="number" min="0" max="100" step="0.1" value={deliveryRate} onChange={(event) => setDeliveryRate(event.target.value)} /></label>
                <label className="sm:col-span-2"><span className="kiyo-label">{tx.base}</span><select className="kiyo-input" value={commissionBase} onChange={(event) => setCommissionBase(event.target.value as typeof commissionBase)}><option value="food_subtotal">{tx.foodOnly}</option><option value="food_plus_delivery">{tx.foodDelivery}</option></select></label>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {['submitted', 'resubmitted'].includes(selected.status) && <Action icon={<FileText className="h-4 w-4" />} label={tx.start} disabled={acting} onClick={() => transition('under_review')} />}
              {selected.status === 'under_review' && <><Action icon={<RefreshCw className="h-4 w-4" />} label={tx.changes} disabled={acting} onClick={() => transition('changes_requested', true)} /><Action icon={<ShieldCheck className="h-4 w-4" />} label={tx.approve} primary disabled={acting} onClick={preliminaryApprove} /><Action icon={<XCircle className="h-4 w-4" />} label={tx.reject} danger disabled={acting} onClick={() => transition('rejected', true)} /></>}
              {selected.status === 'onboarding_in_progress' && <Action icon={<FileText className="h-4 w-4" />} label={tx.menu} disabled={acting} onClick={() => transition('menu_review')} />}
              {selected.status === 'menu_review' && <><Action icon={<CheckCircle2 className="h-4 w-4" />} label={tx.ready} disabled={acting || readiness?.ready !== true} onClick={() => transition('ready_to_publish')} /><Action icon={<RefreshCw className="h-4 w-4" />} label={tx.changes} disabled={acting} onClick={() => transition('changes_requested', true)} /></>}
              {selected.status === 'ready_to_publish' && <Action icon={<CheckCircle2 className="h-4 w-4" />} label={tx.publish} primary disabled={acting || !selected.restaurant_id} onClick={publish} />}
              {canSuspendSelected && <Action icon={<XCircle className="h-4 w-4" />} label={tx.suspend} danger disabled={acting} onClick={() => transition('suspended', true)} />}
              {selected.status === 'suspended' && <Action icon={<RefreshCw className="h-4 w-4" />} label={tx.reactivate} disabled={acting} onClick={() => transition('onboarding_in_progress')} />}
              {acting && <Spinner className="h-5 w-5 self-center" />}
            </div>

            <div className="space-y-2 border-t border-ink-100 pt-4">
              <label className="kiyo-label" htmlFor="admin-internal-notes">{tx.notes}</label>
              <textarea id="admin-internal-notes" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} className="kiyo-input min-h-20" />
              <button type="button" onClick={saveNotes} disabled={acting} className="kiyo-btn-secondary min-h-11">{tx.saveNotes}</button>
            </div>

            <div className="border-t border-ink-100 pt-4">
              <RestaurantApplicationThread applicationId={selected.id} viewer="super_admin" />
            </div>
            {error && <p className="rounded-lg bg-error-50 p-3 text-sm font-medium text-error-700">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold text-ink-400">{label}</dt><dd className="mt-0.5 break-words font-medium text-ink-800">{value}</dd></div>;
}

function Action({ label, icon, onClick, disabled, primary, danger }: { label: string; icon: React.ReactNode; onClick: () => void; disabled: boolean; primary?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${primary ? 'bg-ink-900 text-white hover:bg-ink-800' : danger ? 'border border-error-200 text-error-700 hover:bg-error-50' : 'border border-ink-200 text-ink-700 hover:bg-ink-50'}`}>{icon}<span>{label}</span></button>;
}

function normalizeApplication(application: Omit<RestaurantApplication, 'status'> & { status: string }): RestaurantApplication {
  return {
    ...application,
    status: normalizeRestaurantApplicationStatus(application.status),
    application_version: application.application_version ?? 1,
    restaurant_id: application.restaurant_id ?? null,
    submission_key: application.submission_key ?? null,
    wilaya_id: application.wilaya_id ?? null,
    proposed_food_commission_rate: application.proposed_food_commission_rate ?? null,
    proposed_delivery_share_rate: application.proposed_delivery_share_rate ?? null,
    proposed_commission_base: application.proposed_commission_base ?? null,
    changes_requested_reason: application.changes_requested_reason ?? null,
    admin_internal_notes: application.admin_internal_notes ?? null,
    submitted_at: application.submitted_at ?? application.created_at,
    resubmitted_at: application.resubmitted_at ?? null,
    last_transition_at: application.last_transition_at ?? application.updated_at,
    last_message_at: application.last_message_at ?? null,
  };
}
