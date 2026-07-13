import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, ImagePlus, MapPin, Send, Store, AlertCircle, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import DeliveryMap, { type DeliveryMapLocation } from '../components/DeliveryMap';
import { RestaurantApplicationThread } from '../components/RestaurantApplicationThread';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { supabase, type RestaurantApplication } from '../lib/supabase';
import { normalizeRestaurantApplicationStatus } from '../lib/restaurantApplicationStateMachine';

type Location = DeliveryMapLocation;
const RESTAURANT_APPLICATION_DRAFT_KEY = 'kiyo-restaurant-application-draft-v2';

export default function RestaurantApplicationPage() {
  const { locale, t } = useT();
  const workflow = applicationWorkflowCopy[locale];
  const { profile } = useAuth();
  const [restaurantName, setRestaurantName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [maxDeliveryKm, setMaxDeliveryKm] = useState('8');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [proposedCommission, setProposedCommission] = useState('');
  const [proposedDeliveryShare, setProposedDeliveryShare] = useState('0');
  const [commissionBase, setCommissionBase] = useState<'food_subtotal' | 'food_plus_delivery'>('food_subtotal');
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentApplication, setCurrentApplication] = useState<RestaurantApplication | null>(null);
  const [loadingApplication, setLoadingApplication] = useState(true);
  const submissionKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESTAURANT_APPLICATION_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (typeof draft.restaurantName === 'string') setRestaurantName(draft.restaurantName);
      if (typeof draft.legalName === 'string') setLegalName(draft.legalName);
      if (typeof draft.description === 'string') setDescription(draft.description);
      if (typeof draft.phone === 'string') setPhone(draft.phone);
      if (typeof draft.address === 'string') setAddress(draft.address);
      if (typeof draft.cuisine === 'string') setCuisine(draft.cuisine);
      if (typeof draft.openingHours === 'string') setOpeningHours(draft.openingHours);
      if (typeof draft.maxDeliveryKm === 'string') setMaxDeliveryKm(draft.maxDeliveryKm);
      if (typeof draft.minOrderAmount === 'string') setMinOrderAmount(draft.minOrderAmount);
      if (typeof draft.proposedCommission === 'string') setProposedCommission(draft.proposedCommission);
      if (typeof draft.proposedDeliveryShare === 'string') setProposedDeliveryShare(draft.proposedDeliveryShare);
      if (draft.commissionBase === 'food_plus_delivery') setCommissionBase('food_plus_delivery');
      if (draft.location && typeof draft.location === 'object') setLocation(draft.location as Location);
    } catch {
      localStorage.removeItem(RESTAURANT_APPLICATION_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void (async () => {
      setLoadingApplication(true);
      const { data, error: loadError } = await supabase
        .from('restaurant_applications')
        .select('*')
        .eq('applicant_id', profile.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLoadingApplication(false);
      if (loadError) {
        setError(loadError.message);
        return;
      }
      if (!data) return;
      const application = normalizeApplication(data as Omit<RestaurantApplication, 'status'> & { status: string });
      setCurrentApplication(application);
      if (application.status === 'changes_requested' || application.status === 'draft') {
        setRestaurantName(application.restaurant_name);
        setLegalName(application.legal_name ?? '');
        setDescription(application.description ?? '');
        setPhone(application.phone);
        setAddress(application.address);
        setCuisine(application.cuisine.join(', '));
        setOpeningHours(String(application.opening_hours.notes ?? ''));
        setMaxDeliveryKm(String(application.max_delivery_km));
        setMinOrderAmount(String(application.min_order_amount));
        setProposedCommission(application.proposed_food_commission_rate == null
          ? '' : String(Number(application.proposed_food_commission_rate) * 100));
        setProposedDeliveryShare(application.proposed_delivery_share_rate == null
          ? '0' : String(Number(application.proposed_delivery_share_rate) * 100));
        setCommissionBase(application.proposed_commission_base ?? 'food_subtotal');
        if (application.latitude != null && application.longitude != null) {
          setLocation({
            lat: application.latitude,
            lng: application.longitude,
            address: application.address,
            accuracy: application.location_accuracy_m,
            confirmed: application.location_confirmed,
            placeId: application.place_id,
            source: application.location_source ?? 'manual',
            addressQuality: application.address_quality === 'precise' || application.address_quality === 'approximate'
              ? application.address_quality : 'manual',
            requiresManualAdjustment: false,
            addressParts: {
              displayName: application.address,
              street: application.street ?? undefined,
              neighborhood: application.neighborhood ?? undefined,
              commune: application.commune ?? undefined,
              city: application.city ?? undefined,
              province: application.province ?? undefined,
              postalCode: application.postal_code ?? undefined,
              country: application.country ?? undefined,
              placeId: application.place_id ?? undefined,
              provider: application.location_source === 'manual' ? 'manual' : 'google',
            },
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`restaurant-application-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'restaurant_applications',
        filter: `applicant_id=eq.${profile.id}`,
      }, (event) => {
        if (event.eventType === 'DELETE') {
          setCurrentApplication(null);
          return;
        }
        setCurrentApplication(normalizeApplication(
          event.new as Omit<RestaurantApplication, 'status'> & { status: string },
        ));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(RESTAURANT_APPLICATION_DRAFT_KEY, JSON.stringify({
        restaurantName,
        legalName,
        description,
        phone,
        address,
        cuisine,
        openingHours,
        maxDeliveryKm,
        minOrderAmount,
        proposedCommission,
        proposedDeliveryShare,
        commissionBase,
        location,
        updatedAt: new Date().toISOString(),
      }));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [restaurantName, legalName, description, phone, address, cuisine, openingHours, maxDeliveryKm, minOrderAmount, proposedCommission, proposedDeliveryShare, commissionBase, location]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || submitting) return;
    setError(null);

    if (restaurantName.trim().length < 2) return setError(t('restaurant.apply.errorName'));
    if (phone.trim().length < 6) return setError(t('restaurant.apply.errorPhone'));
    if (address.trim().length < 5) return setError(t('restaurant.apply.errorAddress'));
    if (!location) return setError(t('restaurant.apply.errorLocation'));
    if (!location.confirmed) return setError(t('map.confirmRequired'));

    const maxKm = Number(maxDeliveryKm);
    const minOrder = Number(minOrderAmount);
    const proposedRate = proposedCommission.trim() ? Number(proposedCommission) / 100 : null;
    const proposedDeliveryRate = proposedDeliveryShare.trim() ? Number(proposedDeliveryShare) / 100 : 0;
    if (!Number.isFinite(maxKm) || maxKm <= 0 || maxKm > 100) return setError(t('restaurant.apply.errorDelivery'));
    if (!Number.isFinite(minOrder) || minOrder < 0) return setError(t('restaurant.apply.errorMinOrder'));
    if (proposedRate != null && (!Number.isFinite(proposedRate) || proposedRate < 0 || proposedRate > 1)) {
      return setError('Proposed commission must be between 0% and 100%.');
    }
    if (!Number.isFinite(proposedDeliveryRate) || proposedDeliveryRate < 0 || proposedDeliveryRate > 1) {
      return setError('Proposed delivery share must be between 0% and 100%.');
    }

    setSubmitting(true);
    try {
      const logoUrl = logo ? await uploadApplicationImage(profile.id, logo, 'logo') : null;
      const coverUrl = cover ? await uploadApplicationImage(profile.id, cover, 'cover') : null;

      const payload = {
        restaurant_name: restaurantName.trim(),
        legal_name: legalName.trim() || null,
        description: description.trim() || null,
        phone: phone.trim(),
        address: address.trim(),
        cuisine: cuisine.split(',').map((item) => item.trim()).filter(Boolean),
        opening_hours: openingHours.trim() ? { notes: openingHours.trim() } : {},
        max_delivery_km: maxKm,
        min_order_amount: minOrder,
        logo_url: logoUrl,
        cover_image_url: coverUrl,
        latitude: location.lat,
        longitude: location.lng,
        location_accuracy_m: location.accuracy,
        location_confirmed: location.confirmed,
        place_id: location.placeId,
        location_source: location.source,
        address_quality: location.addressQuality,
        street: location.addressParts?.street ?? null,
        neighborhood: location.addressParts?.neighborhood ?? null,
        commune: location.addressParts?.commune ?? null,
        city: location.addressParts?.city ?? null,
        province: location.addressParts?.province ?? null,
        postal_code: location.addressParts?.postalCode ?? null,
        country: location.addressParts?.country ?? 'Algeria',
        proposed_food_commission_rate: proposedRate,
        proposed_delivery_share_rate: proposedDeliveryRate,
        proposed_commission_base: commissionBase,
      };

      let submitted: RestaurantApplication | null = null;
      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_restaurant_application', {
        p_payload: payload,
        p_submission_key: submissionKeyRef.current,
      });
      if (rpcError && isMissingApplicationRpc(rpcError)) {
        const {
          proposed_food_commission_rate: _proposedFoodRate,
          proposed_delivery_share_rate: _proposedDeliveryRate,
          proposed_commission_base: _proposedBase,
          ...legacyPayload
        } = payload;
        void _proposedFoodRate;
        void _proposedDeliveryRate;
        void _proposedBase;
        const { data: legacyData, error: insertError } = await supabase
          .from('restaurant_applications')
          .insert({ applicant_id: profile.id, ...legacyPayload, status: 'pending' })
          .select('*')
          .single();
        if (insertError) throw insertError;
        submitted = normalizeApplication(legacyData as RestaurantApplication & { status: string });
      } else if (rpcError) {
        throw rpcError;
      } else {
        const value = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        submitted = value ? normalizeApplication(value as RestaurantApplication & { status: string }) : null;
      }
      localStorage.removeItem(RESTAURANT_APPLICATION_DRAFT_KEY);
      submissionKeyRef.current = crypto.randomUUID();
      setCurrentApplication(submitted);
      setSuccess(true);
    } catch (err) {
      console.error('Failed to submit restaurant application', err);
      setError(err instanceof Error ? err.message : t('error.genericBody'));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg rounded-2xl border border-sage-200 bg-sage-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-sage-600" />
          <h1 className="mt-3 font-display text-xl font-extrabold text-ink-900">
            {t('restaurant.apply.successTitle')}
          </h1>
          <p className="mt-2 text-sm text-ink-600">{t('restaurant.apply.successBody')}</p>
        </div>
      </AppShell>
    );
  }

  if (loadingApplication) {
    return <AppShell><div className="flex min-h-48 items-center justify-center"><Spinner className="h-6 w-6" /></div></AppShell>;
  }

  if (currentApplication && !['draft', 'changes_requested', 'rejected', 'archived'].includes(currentApplication.status)) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="kiyo-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-white">
                <Clock3 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase text-ink-400">{workflow.application}</p>
                <h1 className="truncate font-display text-xl font-extrabold text-ink-900">{currentApplication.restaurant_name}</h1>
                <span className="mt-2 inline-flex rounded-full bg-ember-50 px-2.5 py-1 text-xs font-bold text-ember-700">
                  {workflow.status[currentApplication.status]}
                </span>
              </div>
            </div>
            {currentApplication.changes_requested_reason && (
              <div className="mt-4 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">
                {currentApplication.changes_requested_reason}
              </div>
            )}
          </div>
          {currentApplication.restaurant_id && ['onboarding_in_progress', 'menu_review', 'ready_to_publish', 'published'].includes(currentApplication.status) && (
            <Link to="/restaurant" className="kiyo-btn-primary w-full sm:w-auto">
              <Store className="h-4 w-4" />
              {workflow.openWorkspace}
            </Link>
          )}
          <div className="kiyo-card p-5">
            <RestaurantApplicationThread applicationId={currentApplication.id} viewer="applicant" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-white">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('restaurant.apply.title')}</h1>
            <p className="text-sm text-ink-500">{t('restaurant.apply.subtitle')}</p>
          </div>
        </div>

        <ErrorBoundary variant="inline">
          <form onSubmit={submit} className="kiyo-card space-y-4 p-5">
            {currentApplication?.changes_requested_reason && (
              <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800">
                <p className="font-bold">{workflow.changesRequested}</p>
                <p className="mt-1">{currentApplication.changes_requested_reason}</p>
                {currentApplication.restaurant_id && (
                  <Link to="/restaurant" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-warning-300 bg-white px-3 py-2 font-bold text-ink-800">
                    <Store className="h-4 w-4" />{workflow.openWorkspace}
                  </Link>
                )}
              </div>
            )}
            {currentApplication?.rejection_reason && (
              <div className="rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-800">
                <p className="font-bold">{workflow.rejected}</p>
                <p className="mt-1">{currentApplication.rejection_reason}</p>
              </div>
            )}
            <Field name="restaurantName" label={t('restaurant.apply.name')} value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required />
            <Field name="legalName" label={t('restaurant.apply.legalName')} value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            <Field name="phone" label={t('restaurant.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required />
            <Field
              name="address"
              label={t('restaurant.address')}
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                setLocation(null);
              }}
              readOnly={Boolean(location)}
              required
            />

            <div>
              <label className="kiyo-label" htmlFor="description">{t('restaurant.description')}</label>
              <textarea id="description" className="kiyo-input min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <Field name="cuisine" label={t('restaurant.cuisine')} value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Pizza, Grill, Coffee" />
            <div>
              <label className="kiyo-label" htmlFor="openingHours">{t('restaurant.apply.openingHours')}</label>
              <textarea id="openingHours" className="kiyo-input min-h-20" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder={t('restaurant.apply.openingHoursPlaceholder')} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="maxDeliveryKm" label={t('restaurant.settings.maxRadius')} value={maxDeliveryKm} onChange={(e) => setMaxDeliveryKm(e.target.value)} type="number" min="1" max="100" step="0.5" required />
              <Field name="minOrderAmount" label={t('restaurant.settings.minOrder')} value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} type="number" min="0" step="50" required />
            </div>

            <fieldset className="space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-4">
              <legend className="px-1 text-sm font-bold text-ink-900">{workflow.proposedTerms}</legend>
              <p className="text-xs text-ink-500">{workflow.proposedTermsHelp}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="proposedCommission" label={workflow.foodCommission} value={proposedCommission} onChange={(e) => setProposedCommission(e.target.value)} type="number" min="0" max="100" step="0.1" />
                <Field name="proposedDeliveryShare" label={workflow.deliveryShare} value={proposedDeliveryShare} onChange={(e) => setProposedDeliveryShare(e.target.value)} type="number" min="0" max="100" step="0.1" />
              </div>
              <label className="block">
                <span className="kiyo-label">{workflow.commissionBase}</span>
                <select className="kiyo-input" value={commissionBase} onChange={(e) => setCommissionBase(e.target.value as typeof commissionBase)}>
                  <option value="food_subtotal">{workflow.foodOnly}</option>
                  <option value="food_plus_delivery">{workflow.foodDelivery}</option>
                </select>
              </label>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <FileField label={t('restaurant.apply.logo')} file={logo} onChange={setLogo} />
              <FileField label={t('restaurant.apply.cover')} file={cover} onChange={setCover} />
            </div>

            <div className="space-y-3 border-t border-ink-100 pt-4">
              <div className="mb-3 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-ember-600" />
                <div>
                  <p className="text-sm font-bold text-ink-900">{t('restaurant.onboard.locationTitle')}</p>
                  <p className="text-xs text-ink-500">{t('restaurant.onboard.locationHelp')}</p>
                </div>
              </div>
              <DeliveryMap
                purpose="restaurant"
                initialAddress={address}
                initialLocation={location}
                onLocationChange={(loc) => {
                  setLocation(loc);
                  setAddress(loc.address);
                }}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2 text-xs text-error-600">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {currentApplication && ['changes_requested', 'rejected'].includes(currentApplication.status) && (
              <div className="border-t border-ink-100 pt-4">
                <RestaurantApplicationThread applicationId={currentApplication.id} viewer="applicant" />
              </div>
            )}

            <button type="submit" disabled={submitting} className="kiyo-btn-primary w-full">
              {submitting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {submitting ? t('restaurant.apply.submitting') : t('restaurant.apply.submit')}
            </button>
          </form>
        </ErrorBoundary>
      </div>
    </AppShell>
  );
}

const applicationWorkflowCopy = {
  en: {
    application: 'Restaurant application', openWorkspace: 'Open restaurant workspace',
    changesRequested: 'Changes requested', rejected: 'Application decision',
    proposedTerms: 'Proposed commercial terms', proposedTermsHelp: 'Your proposal is informational. Only terms approved by Kiyo Food can become active.',
    foodCommission: 'Proposed food commission (%)', deliveryShare: 'Proposed delivery share (%)',
    commissionBase: 'Commission calculation base', foodOnly: 'Food subtotal only', foodDelivery: 'Food and delivery combined',
    status: { draft: 'Draft', submitted: 'Submitted', under_review: 'Under review', changes_requested: 'Changes requested', resubmitted: 'Resubmitted', preliminarily_approved: 'Preliminarily approved', onboarding_in_progress: 'Onboarding in progress', menu_review: 'Menu review', ready_to_publish: 'Ready to publish', published: 'Published', rejected: 'Rejected', suspended: 'Suspended', archived: 'Archived' },
  },
  fr: {
    application: 'Candidature restaurant', openWorkspace: 'Ouvrir l’espace restaurant',
    changesRequested: 'Modifications demandées', rejected: 'Décision concernant la candidature',
    proposedTerms: 'Conditions commerciales proposées', proposedTermsHelp: 'Votre proposition est informative. Seules les conditions approuvées par Kiyo Food peuvent entrer en vigueur.',
    foodCommission: 'Commission proposée sur les plats (%)', deliveryShare: 'Part proposée sur la livraison (%)',
    commissionBase: 'Base de calcul de la commission', foodOnly: 'Sous-total des plats uniquement', foodDelivery: 'Plats et livraison combinés',
    status: { draft: 'Brouillon', submitted: 'Envoyée', under_review: 'En cours d’examen', changes_requested: 'Modifications demandées', resubmitted: 'Renvoyée', preliminarily_approved: 'Approbation préliminaire', onboarding_in_progress: 'Configuration en cours', menu_review: 'Examen du menu', ready_to_publish: 'Prête à publier', published: 'Publiée', rejected: 'Rejetée', suspended: 'Suspendue', archived: 'Archivée' },
  },
  ar: {
    application: 'طلب مطعم', openWorkspace: 'فتح مساحة إدارة المطعم',
    changesRequested: 'التعديلات المطلوبة', rejected: 'قرار الطلب',
    proposedTerms: 'الشروط التجارية المقترحة', proposedTermsHelp: 'اقتراحك للمراجعة فقط. لا تصبح نافذة إلا الشروط التي تعتمدها كيو فود.',
    foodCommission: 'عمولة الطعام المقترحة (%)', deliveryShare: 'حصة التوصيل المقترحة (%)',
    commissionBase: 'أساس حساب العمولة', foodOnly: 'المجموع الفرعي للطعام فقط', foodDelivery: 'الطعام والتوصيل معاً',
    status: { draft: 'مسودة', submitted: 'تم الإرسال', under_review: 'قيد المراجعة', changes_requested: 'تعديلات مطلوبة', resubmitted: 'أعيد الإرسال', preliminarily_approved: 'موافقة أولية', onboarding_in_progress: 'الإعداد جارٍ', menu_review: 'مراجعة القائمة', ready_to_publish: 'جاهز للنشر', published: 'منشور', rejected: 'مرفوض', suspended: 'معلّق', archived: 'مؤرشف' },
  },
} as const;

function FileField({ label, file, onChange }: { label: string; file: File | null; onChange: (file: File | null) => void }) {
  return (
    <label className="block rounded-xl border border-dashed border-ink-200 bg-white p-4 text-sm text-ink-600 hover:border-ember-300">
      <span className="mb-2 flex items-center gap-2 font-semibold text-ink-900">
        <ImagePlus className="h-4 w-4" />
        {label}
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="block w-full text-xs"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {file && <span className="mt-2 block truncate text-xs text-ink-400">{file.name}</span>}
    </label>
  );
}

async function uploadApplicationImage(userId: string, file: File, kind: 'logo' | 'cover'): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const path = `${userId}/${kind}-${Date.now()}.${safeExt}`;
  const { error } = await supabase.storage.from('restaurant-applications').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  return path;
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

function isMissingApplicationRpc(error: { code?: string; message?: string }) {
  return error.code === 'PGRST202'
    || error.code === '42883'
    || /submit_restaurant_application/i.test(error.message ?? '') && /not find|does not exist/i.test(error.message ?? '');
}
