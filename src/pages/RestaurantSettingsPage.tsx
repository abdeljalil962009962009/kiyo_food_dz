import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Truck, Settings, ChevronLeft, ImagePlus,
  AlertCircle, Save, Wallet, MapPin, Store, CalendarDays, Plus, Trash2,
} from 'lucide-react';
import { useT } from '../lib/i18n-react';
import {
  supabase,
  type PublicationReadiness,
  type Restaurant,
  type RestaurantCommercialTerm,
  type RestaurantSpecialHours,
} from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import DeliveryMap, { type DeliveryMapLocation } from '../components/DeliveryMap';
import { localizePublicationBlocker } from '../lib/publicationReadiness';
import { uploadRestaurantImage, validateRestaurantImage } from '../lib/restaurantMedia';
import { PrivateRestaurantImage } from '../components/PrivateRestaurantImage';
import { callUserAction } from '../lib/userApi';
import { matchWilayaFromAddress } from '../lib/algeriaLocation';
import { FALLBACK_WILAYAS } from '../context/WilayaContext';
import { userFacingError } from '../lib/userFacingError';
import { algeriaAvailabilityDateRange } from '../lib/restaurantAvailability';

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const DAYS: { key: DayOfWeek; labelKey: 'day.0' | 'day.1' | 'day.2' | 'day.3' | 'day.4' | 'day.5' | 'day.6' }[] = [
  { key: 0, labelKey: 'day.0' },
  { key: 1, labelKey: 'day.1' },
  { key: 2, labelKey: 'day.2' },
  { key: 3, labelKey: 'day.3' },
  { key: 4, labelKey: 'day.4' },
  { key: 5, labelKey: 'day.5' },
  { key: 6, labelKey: 'day.6' },
];

const profileLabels = {
  en: {
    title: 'Public profile', name: 'Restaurant name', description: 'Description', phone: 'Contact phone',
    cuisines: 'Cuisines (comma separated)', image: 'Public image or logo', imageUrl: 'Image URL',
    imageHelp: 'Upload a JPG, PNG or WebP image up to 5 MB, or provide an HTTPS image URL.',
    invalidProfile: 'Enter a restaurant name and a valid contact phone.', invalidImageUrl: 'Use a valid HTTPS image URL.',
    invalidImageType: 'Choose a JPG, PNG or WebP image.', invalidImageSize: 'The image must be 5 MB or smaller.',
    deliveryParticipation: 'Delivery participation', termsPending: 'Commercial terms are awaiting platform approval.',
    termsControlled: 'Approved commercial terms are controlled by Kiyo Food and cannot be changed here.',
    readiness: 'Publication readiness', ready: 'Your restaurant meets all publication requirements.',
  },
  fr: {
    title: 'Profil public', name: 'Nom du restaurant', description: 'Description', phone: 'Téléphone de contact',
    cuisines: 'Cuisines (séparées par des virgules)', image: 'Image publique ou logo', imageUrl: "URL de l'image",
    imageHelp: 'Importez une image JPG, PNG ou WebP de 5 Mo maximum, ou indiquez une URL HTTPS.',
    invalidProfile: 'Saisissez un nom de restaurant et un numéro de téléphone valides.', invalidImageUrl: 'Utilisez une URL d’image HTTPS valide.',
    invalidImageType: 'Choisissez une image JPG, PNG ou WebP.', invalidImageSize: "L'image ne doit pas dépasser 5 Mo.",
    deliveryParticipation: 'Participation à la livraison', termsPending: "Les conditions commerciales attendent l'approbation de la plateforme.",
    termsControlled: 'Les conditions commerciales approuvées sont contrôlées par Kiyo Food et ne peuvent pas être modifiées ici.',
    readiness: 'Préparation à la publication', ready: 'Votre restaurant remplit toutes les conditions de publication.',
  },
  ar: {
    title: 'الملف العام', name: 'اسم المطعم', description: 'الوصف', phone: 'هاتف التواصل',
    cuisines: 'أنواع المطبخ (مفصولة بفواصل)', image: 'الصورة العامة أو الشعار', imageUrl: 'رابط الصورة',
    imageHelp: 'ارفع صورة JPG أو PNG أو WebP بحجم أقصى 5 ميغابايت، أو أدخل رابط HTTPS.',
    invalidProfile: 'أدخل اسم المطعم ورقم هاتف صالحين.', invalidImageUrl: 'استخدم رابط صورة HTTPS صالحًا.',
    invalidImageType: 'اختر صورة JPG أو PNG أو WebP.', invalidImageSize: 'يجب ألا يتجاوز حجم الصورة 5 ميغابايت.',
    deliveryParticipation: 'المشاركة في التوصيل', termsPending: 'الشروط التجارية بانتظار موافقة المنصة.',
    termsControlled: 'تتحكم Kiyo Food في الشروط التجارية المعتمدة ولا يمكن تعديلها هنا.',
    readiness: 'جاهزية النشر', ready: 'مطعمك يستوفي جميع متطلبات النشر.',
  },
} as const;

const scheduleLabels = {
  en: {
    vacation: 'Vacation mode', vacationBody: 'Stop all new orders until you switch this off. Your restaurant and existing orders stay visible to you.',
    vacationOn: 'Vacation mode is active', vacationOff: 'Accept orders according to the schedule',
    exceptions: 'Exceptional hours', exceptionsBody: 'Plan a holiday closure or different opening hours for a specific date.',
    date: 'Date', allDayClosed: 'Closed all day', opens: 'Opens', closes: 'Closes', reason: 'Reason (optional)',
    reasonPlaceholder: 'Public holiday, maintenance...', add: 'Save exceptional hours', none: 'No upcoming exceptions.',
    remove: 'Remove', removeConfirm: 'Remove these exceptional hours?', confirmRemove: 'Yes, remove', cancel: 'Cancel',
    invalid: 'Choose a future date and two different opening times, or mark the restaurant closed all day.',
    saveFailed: 'Exceptional hours could not be saved. Try again.', deleteFailed: 'Exceptional hours could not be removed. Try again.',
  },
  fr: {
    vacation: 'Mode vacances', vacationBody: 'Suspendez toutes les nouvelles commandes jusqu’à sa désactivation. Votre restaurant et les commandes existantes restent accessibles.',
    vacationOn: 'Le mode vacances est actif', vacationOff: 'Accepter les commandes selon les horaires',
    exceptions: 'Horaires exceptionnels', exceptionsBody: 'Planifiez une fermeture ou des horaires différents pour une date précise.',
    date: 'Date', allDayClosed: 'Fermé toute la journée', opens: 'Ouverture', closes: 'Fermeture', reason: 'Motif (facultatif)',
    reasonPlaceholder: 'Jour férié, maintenance...', add: 'Enregistrer cet horaire', none: 'Aucun horaire exceptionnel à venir.',
    remove: 'Supprimer', removeConfirm: 'Supprimer cet horaire exceptionnel ?', confirmRemove: 'Oui, supprimer', cancel: 'Annuler',
    invalid: 'Choisissez une date à venir et deux heures différentes, ou indiquez une fermeture toute la journée.',
    saveFailed: 'Impossible d’enregistrer cet horaire. Réessayez.', deleteFailed: 'Impossible de supprimer cet horaire. Réessayez.',
  },
  ar: {
    vacation: 'وضع العطلة', vacationBody: 'أوقف جميع الطلبات الجديدة حتى تعطّل هذا الوضع. يبقى المطعم والطلبات الحالية ظاهرين لك.',
    vacationOn: 'وضع العطلة مفعّل', vacationOff: 'قبول الطلبات حسب أوقات العمل',
    exceptions: 'أوقات العمل الاستثنائية', exceptionsBody: 'حدّد إغلاقا أو أوقات عمل مختلفة ليوم معيّن.',
    date: 'التاريخ', allDayClosed: 'مغلق طوال اليوم', opens: 'يفتح', closes: 'يغلق', reason: 'السبب (اختياري)',
    reasonPlaceholder: 'عطلة رسمية، صيانة...', add: 'حفظ الوقت الاستثنائي', none: 'لا توجد أوقات استثنائية قادمة.',
    remove: 'حذف', removeConfirm: 'هل تريد حذف هذا الوقت الاستثنائي؟', confirmRemove: 'نعم، حذف', cancel: 'إلغاء',
    invalid: 'اختر تاريخا قادما ووقتَي فتح وإغلاق مختلفين، أو حدّد أن المطعم مغلق طوال اليوم.',
    saveFailed: 'تعذر حفظ الوقت الاستثنائي. حاول مجددا.', deleteFailed: 'تعذر حذف الوقت الاستثنائي. حاول مجددا.',
  },
} as const;

type HoursEntry = { open: string; close: string } | null;
type OpeningHours = Record<string, HoursEntry>;

export default function RestaurantSettingsPage() {
  const { t, locale } = useT();
  const profileTx = profileLabels[locale];
  const scheduleTx = scheduleLabels[locale];
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Business hours state
  const [hours, setHours] = useState<OpeningHours>({});
  const [vacationMode, setVacationMode] = useState(false);
  const [specialHours, setSpecialHours] = useState<RestaurantSpecialHours[]>([]);
  const [specialDraft, setSpecialDraft] = useState({
    date: algeriaAvailabilityDateRange().to,
    is_closed: true,
    open_time: '09:00',
    close_time: '22:00',
    reason: '',
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [pendingSpecialDelete, setPendingSpecialDelete] = useState<string | null>(null);

  // Delivery settings
  const [deliveryRadius, setDeliveryRadius] = useState('10');
  const [minOrder, setMinOrder] = useState('0');
  const [estimatedDeliveryMin, setEstimatedDeliveryMin] = useState('45');
  const [commercialTerm, setCommercialTerm] = useState<RestaurantCommercialTerm | null>(null);
  const [readiness, setReadiness] = useState<PublicationReadiness | null>(null);
  const [location, setLocation] = useState<DeliveryMapLocation | null>(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [cuisines, setCuisines] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const { data: managedRestaurantId, error: managedRestaurantError } = await supabase.rpc('get_user_restaurant_id');
      if (managedRestaurantError) throw managedRestaurantError;
      const { data: r, error: re } = managedRestaurantId
        ? await supabase.from('restaurants').select('*').eq('id', managedRestaurantId).maybeSingle()
        : { data: null, error: null };
      if (re) throw re;
      
      if (!r) {
        setError('No restaurant assigned to your account. Please contact the platform administrator to onboard your restaurant.');
        return;
      }

      const activeRes = r as Restaurant;
      setRestaurant(activeRes);
      setRestaurantName(activeRes.name);
      setDescription(activeRes.description ?? '');
      setPhone(activeRes.phone ?? '');
      setCuisines((activeRes.cuisine ?? []).join(', '));
      setImageUrl(activeRes.image_url ?? '');
      setHours(activeRes.opening_hours as OpeningHours || {});
      setVacationMode(Boolean(activeRes.is_vacation_mode));
      setDeliveryRadius(String(activeRes.max_delivery_km || 10));
      setMinOrder(String(activeRes.min_order_amount || 0));
      setEstimatedDeliveryMin(String(activeRes.estimated_delivery_min || 45));
      const [{ data: term, error: termError }, { data: readinessData, error: readinessError }, specialResult] = await Promise.all([
        supabase.from('restaurant_commercial_terms').select('*')
          .eq('restaurant_id', activeRes.id).eq('status', 'active').maybeSingle(),
        callUserAction<PublicationReadiness>('get_restaurant_publication_readiness', { p_restaurant_id: activeRes.id }),
        supabase.from('restaurant_special_hours').select('*')
          .eq('restaurant_id', activeRes.id)
          .gte('date', algeriaAvailabilityDateRange().to)
          .order('date')
          .limit(30),
      ]);
      if (termError) throw termError;
      if (readinessError) throw readinessError;
      if (specialResult.error) throw specialResult.error;
      setCommercialTerm((term as RestaurantCommercialTerm | null) ?? null);
      setReadiness((readinessData as PublicationReadiness | null) ?? null);
      setSpecialHours((specialResult.data as RestaurantSpecialHours[] | null) ?? []);
      if (activeRes.latitude != null && activeRes.longitude != null) {
        setLocation({
          lat: activeRes.latitude,
          lng: activeRes.longitude,
          address: activeRes.address ?? `${activeRes.latitude}, ${activeRes.longitude}`,
          accuracy: activeRes.location_accuracy_m,
          source: activeRes.location_source ?? 'manual',
          confirmed: activeRes.location_verified,
          placeId: activeRes.place_id,
          addressQuality: 'manual',
          requiresManualAdjustment: !activeRes.location_verified,
          addressParts: {
            displayName: activeRes.address ?? '',
            street: activeRes.street ?? undefined,
            neighborhood: activeRes.neighborhood ?? undefined,
            commune: activeRes.commune ?? undefined,
            city: activeRes.city ?? undefined,
            province: activeRes.province ?? undefined,
            postalCode: activeRes.postal_code ?? undefined,
            country: activeRes.country ?? 'Algeria',
            placeId: activeRes.place_id ?? undefined,
            provider: activeRes.place_id ? 'google' : 'manual',
          },
        });
      }
    } catch (err: unknown) {
      console.error(err);
      setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setLoading(false);
    }
  }, [locale, profile, t]);

  useEffect(() => { void load(); }, [load]);

  const saveSettings = async () => {
    if (!restaurant || saving) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    if (!location?.confirmed) {
      setSaveError(t('map.confirmRequired'));
      setSaving(false);
      return;
    }

    if (restaurantName.trim().length < 2 || phone.replace(/\D/g, '').length < 6) {
      setSaveError(profileTx.invalidProfile);
      setSaving(false);
      return;
    }

    if (!imageFile && imageUrl.trim() && !/^https:\/\//i.test(imageUrl.trim())) {
      setSaveError(profileTx.invalidImageUrl);
      setSaving(false);
      return;
    }

    try {
      const nextImageUrl = imageFile && profile
        ? await uploadRestaurantImage(profile.id, imageFile)
        : imageUrl.trim() || null;
      const cuisineList = cuisines.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12);
      const matchedWilaya = matchWilayaFromAddress(location.addressParts, FALLBACK_WILAYAS);
      const { error: e } = await supabase
        .from('restaurants')
        .update({
          name: restaurantName.trim(),
          description: description.trim() || null,
          phone: phone.trim(),
          cuisine: cuisineList,
          image_url: nextImageUrl,
          opening_hours: hours,
          is_vacation_mode: vacationMode,
          max_delivery_km: Number(deliveryRadius),
          min_order_amount: Number(minOrder),
          estimated_delivery_min: Number(estimatedDeliveryMin),
          address: location.address,
          latitude: location.lat,
          longitude: location.lng,
          location_accuracy_m: location.accuracy,
          location_verified: true,
          location_source: location.source,
          location_updated_at: new Date().toISOString(),
          place_id: location.placeId,
          street: location.addressParts?.street ?? null,
          neighborhood: location.addressParts?.neighborhood ?? null,
          commune: location.addressParts?.commune ?? null,
          city: location.addressParts?.city ?? null,
          province: location.addressParts?.province ?? null,
          postal_code: location.addressParts?.postalCode ?? null,
          country: location.addressParts?.country ?? 'Algeria',
          wilaya_id: matchedWilaya?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurant.id);
      if (e) throw e;
      const { data: readinessData } = await callUserAction<PublicationReadiness>('get_restaurant_publication_readiness', {
        p_restaurant_id: restaurant.id,
      });
      setReadiness((readinessData as PublicationReadiness | null) ?? null);
      setImageUrl(nextImageUrl ?? '');
      setImageFile(null);
      setRestaurant({
        ...restaurant,
        name: restaurantName.trim(),
        description: description.trim() || null,
        phone: phone.trim(),
        cuisine: cuisineList,
        image_url: nextImageUrl,
        opening_hours: hours as Restaurant['opening_hours'],
        is_vacation_mode: vacationMode,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : '';
      setSaveError(message === 'restaurant_image_type'
        ? profileTx.invalidImageType
        : message === 'restaurant_image_size'
          ? profileTx.invalidImageSize
          : userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Skeleton count={4} />
      </AppShell>
    );
  }
  if (error || !restaurant) {
    return (
      <AppShell>
        <ErrorState
          title={t('error.genericTitle')} message={error ?? t('error.genericBody')}
          onRetry={load} retryLabel={t('error.retry')}
        />
      </AppShell>
    );
  }

  const updateHours = (day: DayOfWeek, open: string, close: string) => {
    setHours(prev => ({
      ...prev,
      [day]: (open && close) ? { open, close } : null,
    }));
  };

  const toggleDay = (day: DayOfWeek) => {
    setHours(prev => ({
      ...prev,
      [day]: prev[day] ? null : { open: '09:00', close: '22:00' },
    }));
  };

  const toggleVacationMode = async () => {
    if (!restaurant || scheduleSaving) return;
    const next = !vacationMode;
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const { error: updateError } = await supabase
        .from('restaurants')
        .update({ is_vacation_mode: next, updated_at: new Date().toISOString() })
        .eq('id', restaurant.id);
      if (updateError) throw updateError;
      setVacationMode(next);
      setRestaurant({ ...restaurant, is_vacation_mode: next });
    } catch (updateError) {
      setScheduleError(userFacingError(updateError, locale, t('error.genericBody')));
    } finally {
      setScheduleSaving(false);
    }
  };

  const saveSpecialHours = async () => {
    if (!restaurant || scheduleSaving) return;
    const invalid = !specialDraft.date
      || specialDraft.date < algeriaAvailabilityDateRange().to
      || (!specialDraft.is_closed && (
        !specialDraft.open_time
        || !specialDraft.close_time
        || specialDraft.open_time === specialDraft.close_time
      ));
    if (invalid) {
      setScheduleError(scheduleTx.invalid);
      return;
    }

    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const { data, error: upsertError } = await supabase
        .from('restaurant_special_hours')
        .upsert({
          restaurant_id: restaurant.id,
          date: specialDraft.date,
          is_closed: specialDraft.is_closed,
          open_time: specialDraft.is_closed ? null : specialDraft.open_time,
          close_time: specialDraft.is_closed ? null : specialDraft.close_time,
          reason: specialDraft.reason.trim() || null,
        }, { onConflict: 'restaurant_id,date' })
        .select('*')
        .single();
      if (upsertError) throw upsertError;
      const savedEntry = data as RestaurantSpecialHours;
      setSpecialHours((current) => [...current.filter((entry) => entry.date !== savedEntry.date), savedEntry]
        .sort((a, b) => a.date.localeCompare(b.date)));
      setSpecialDraft((current) => ({ ...current, reason: '' }));
    } catch (upsertError) {
      setScheduleError(userFacingError(upsertError, locale, scheduleTx.saveFailed));
    } finally {
      setScheduleSaving(false);
    }
  };

  const deleteSpecialHours = async (entry: RestaurantSpecialHours) => {
    if (!restaurant || scheduleSaving) return;
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const { error: deleteError } = await supabase
        .from('restaurant_special_hours')
        .delete()
        .eq('id', entry.id)
        .eq('restaurant_id', restaurant.id);
      if (deleteError) throw deleteError;
      setSpecialHours((current) => current.filter((item) => item.id !== entry.id));
      setPendingSpecialDelete(null);
    } catch (deleteError) {
      setScheduleError(userFacingError(deleteError, locale, scheduleTx.deleteFailed));
    } finally {
      setScheduleSaving(false);
    }
  };

  return (
    <AppShell>
      <button
        onClick={() => navigate('/restaurant')}
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('restaurant.dashboard')}
      </button>

      <div className="mb-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
          <Settings className="me-2 inline h-6 w-6" />
          {t('restaurant.settings.title')}
        </h1>
        <p className="text-xs text-ink-400">{restaurant.name}</p>
      </div>

      <ErrorBoundary variant="inline">
        <div className="space-y-6">
          <div className="kiyo-card">
            <div className="mb-4 flex items-center gap-2">
              <Store className="h-5 w-5 text-ember-600" />
              <h2 className="font-display text-base font-bold text-ink-900">{profileTx.title}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="kiyo-label">{profileTx.name}</span><input className="kiyo-input" value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} maxLength={120} /></label>
              <label><span className="kiyo-label">{profileTx.phone}</span><input className="kiyo-input" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" maxLength={24} /></label>
              <label className="sm:col-span-2"><span className="kiyo-label">{profileTx.description}</span><textarea className="kiyo-input min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} /></label>
              <label className="sm:col-span-2"><span className="kiyo-label">{profileTx.cuisines}</span><input className="kiyo-input" value={cuisines} onChange={(event) => setCuisines(event.target.value)} maxLength={240} /></label>
              <label className="sm:col-span-2">
                <span className="kiyo-label">{profileTx.image}</span>
                <span className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-200 bg-ink-50 px-3 py-2 text-sm font-semibold text-ink-700 hover:border-ember-300">
                  <ImagePlus className="h-4 w-4" />
                  <span className="truncate">{imageFile?.name ?? profileTx.image}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      const validation = file ? validateRestaurantImage(file) : null;
                      if (validation) {
                        setSaveError(validation === 'type' ? profileTx.invalidImageType : profileTx.invalidImageSize);
                        setImageFile(null);
                      } else {
                        setSaveError(null);
                        setImageFile(file);
                      }
                    }}
                  />
                </span>
              </label>
              <label className="sm:col-span-2"><span className="kiyo-label">{profileTx.imageUrl}</span><input className="kiyo-input" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." inputMode="url" /></label>
              <p className="text-xs text-ink-400 sm:col-span-2">{profileTx.imageHelp}</p>
              {imageUrl && !imageFile && <PrivateRestaurantImage value={imageUrl} alt={restaurantName} className="h-40 w-full rounded-lg border border-ink-100 object-cover sm:col-span-2" />}
            </div>
          </div>

          {/* Business Hours */}
          <div className="kiyo-card">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-ember-500" />
              <h2 className="font-display text-base font-bold text-ink-900">{t('restaurant.settings.businessHours')}</h2>
            </div>
            <p className="mb-4 text-xs text-ink-500">
              {t('restaurant.settings.hoursDesc')}
            </p>
            <div className="space-y-3">
              {DAYS.map(({ key, labelKey }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="flex w-28 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!hours[key]}
                      onChange={() => toggleDay(key)}
                      className="h-4 w-4 rounded border-ink-300 text-ember-500 focus:ring-ember-500"
                    />
                    <span className="text-sm font-medium text-ink-700">{t(labelKey)}</span>
                  </label>
                  {hours[key] && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hours[key]?.open || '09:00'}
                        onChange={(e) => updateHours(key, e.target.value, hours[key]?.close || '22:00')}
                        className="kiyo-input text-sm"
                      />
                      <span className="text-ink-400">{t('common.to')}</span>
                      <input
                        type="time"
                        value={hours[key]?.close || '22:00'}
                        onChange={(e) => updateHours(key, hours[key]?.open || '09:00', e.target.value)}
                        className="kiyo-input text-sm"
                      />
                    </div>
                  )}
                  {!hours[key] && (
                    <span className="text-xs text-ink-400">{t('common.closed')}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-ink-100 pt-5">
              <button
                type="button"
                role="switch"
                aria-checked={vacationMode}
                disabled={scheduleSaving}
                onClick={toggleVacationMode}
                className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-start transition-colors hover:border-ink-200 disabled:opacity-60"
              >
                <span>
                  <span className="block text-sm font-bold text-ink-900">{scheduleTx.vacation}</span>
                  <span className="mt-0.5 block text-xs text-ink-500">{scheduleTx.vacationBody}</span>
                </span>
                <span className={`relative h-6 w-11 flex-none rounded-full transition-colors ${vacationMode ? 'bg-error-500' : 'bg-ink-300'}`}>
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-[inset-inline-start] ${
                      vacationMode ? '[inset-inline-start:1.5rem]' : '[inset-inline-start:0.25rem]'
                    }`}
                  />
                </span>
              </button>
              <p className={`mt-2 text-xs font-semibold ${vacationMode ? 'text-error-600' : 'text-sage-700'}`}>
                {vacationMode ? scheduleTx.vacationOn : scheduleTx.vacationOff}
              </p>
            </div>
          </div>

          <div className="kiyo-card">
            <div className="mb-1 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-ember-600" />
              <h2 className="font-display text-base font-bold text-ink-900">{scheduleTx.exceptions}</h2>
            </div>
            <p className="mb-4 text-xs text-ink-500">{scheduleTx.exceptionsBody}</p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label>
                <span className="kiyo-label">{scheduleTx.date}</span>
                <input
                  type="date"
                  min={algeriaAvailabilityDateRange().to}
                  value={specialDraft.date}
                  onChange={(event) => setSpecialDraft((current) => ({ ...current, date: event.target.value }))}
                  className="kiyo-input"
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 self-end rounded-lg border border-ink-100 px-3">
                <input
                  type="checkbox"
                  checked={specialDraft.is_closed}
                  onChange={(event) => setSpecialDraft((current) => ({ ...current, is_closed: event.target.checked }))}
                  className="h-4 w-4 rounded border-ink-300 text-ember-500 focus:ring-ember-500"
                />
                <span className="text-sm font-semibold text-ink-700">{scheduleTx.allDayClosed}</span>
              </label>
              {!specialDraft.is_closed && (
                <>
                  <label>
                    <span className="kiyo-label">{scheduleTx.opens}</span>
                    <input type="time" value={specialDraft.open_time} onChange={(event) => setSpecialDraft((current) => ({ ...current, open_time: event.target.value }))} className="kiyo-input" />
                  </label>
                  <label>
                    <span className="kiyo-label">{scheduleTx.closes}</span>
                    <input type="time" value={specialDraft.close_time} onChange={(event) => setSpecialDraft((current) => ({ ...current, close_time: event.target.value }))} className="kiyo-input" />
                  </label>
                </>
              )}
              <label className="sm:col-span-2 lg:col-span-3">
                <span className="kiyo-label">{scheduleTx.reason}</span>
                <input
                  value={specialDraft.reason}
                  onChange={(event) => setSpecialDraft((current) => ({ ...current, reason: event.target.value }))}
                  placeholder={scheduleTx.reasonPlaceholder}
                  maxLength={160}
                  className="kiyo-input"
                />
              </label>
              <button type="button" onClick={saveSpecialHours} disabled={scheduleSaving} className="kiyo-btn-primary self-end">
                {scheduleSaving ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {scheduleTx.add}
              </button>
            </div>

            {scheduleError && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2 text-xs font-semibold text-error-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                {scheduleError}
              </div>
            )}

            <div className="mt-4 space-y-2">
              {specialHours.length === 0 && <p className="text-sm text-ink-400">{scheduleTx.none}</p>}
              {specialHours.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-ink-100 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink-900">
                        {new Date(`${entry.date}T12:00:00`).toLocaleDateString(
                          locale === 'ar' ? 'ar-DZ' : locale === 'fr' ? 'fr-DZ' : 'en-DZ',
                          { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' },
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {entry.is_closed
                          ? scheduleTx.allDayClosed
                          : `${entry.open_time?.slice(0, 5)} ${t('common.to')} ${entry.close_time?.slice(0, 5)}`}
                        {entry.reason ? ` · ${entry.reason}` : ''}
                      </p>
                    </div>
                    {pendingSpecialDelete !== entry.id && (
                      <button type="button" onClick={() => setPendingSpecialDelete(entry.id)} className="kiyo-btn-secondary min-h-11 text-error-600">
                        <Trash2 className="h-4 w-4" />
                        {scheduleTx.remove}
                      </button>
                    )}
                  </div>
                  {pendingSpecialDelete === entry.id && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-error-50 px-3 py-2">
                      <span className="text-xs font-semibold text-error-700">{scheduleTx.removeConfirm}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setPendingSpecialDelete(null)} className="kiyo-btn-secondary min-h-11">{scheduleTx.cancel}</button>
                        <button
                          type="button"
                          onClick={() => void deleteSpecialHours(entry)}
                          disabled={scheduleSaving}
                          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-error-600 px-4 text-sm font-bold text-white transition-colors hover:bg-error-700 disabled:opacity-60"
                        >
                          {scheduleTx.confirmRemove}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Configuration */}
          <div className="kiyo-card">
            <div className="mb-4 flex items-start gap-2">
              <MapPin className="mt-0.5 h-5 w-5 text-ember-600" />
              <div>
                <h2 className="font-display text-base font-bold text-ink-900">{t('restaurant.onboard.locationTitle')}</h2>
                <p className="mt-0.5 text-xs text-ink-500">{t('restaurant.onboard.locationHelp')}</p>
              </div>
            </div>
            <DeliveryMap
              purpose="restaurant"
              initialAddress={restaurant.address ?? ''}
              initialLocation={location}
              onLocationChange={setLocation}
            />
          </div>

          {/* Delivery Configuration */}
          <div className="kiyo-card">
            <div className="mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-sage-600" />
              <h2 className="font-display text-base font-bold text-ink-900">{t('restaurant.settings.deliveryConfig')}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="kiyo-label">{t('restaurant.settings.maxRadius')}</label>
                <input
                  type="number"
                  value={deliveryRadius}
                  onChange={(e) => setDeliveryRadius(e.target.value)}
                  min="1"
                  max="100"
                  className="kiyo-input"
                />
                <p className="mt-1 text-xs text-ink-400">
                  {t('restaurant.settings.maxRadiusDesc')}
                </p>
              </div>
              <div>
                <label className="kiyo-label">{t('restaurant.settings.minOrder')}</label>
                <input
                  type="number"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  min="0"
                  className="kiyo-input"
                />
                <p className="mt-1 text-xs text-ink-400">
                  {t('restaurant.settings.minOrderDesc')}
                </p>
              </div>
              <div>
                <label className="kiyo-label">{t('restaurant.settings.estTime')}</label>
                <input
                  type="number"
                  value={estimatedDeliveryMin}
                  onChange={(e) => setEstimatedDeliveryMin(e.target.value)}
                  min="10"
                  max="120"
                  className="kiyo-input"
                />
                <p className="mt-1 text-xs text-ink-400">
                  {t('restaurant.settings.estTimeDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Settings */}
          <div className="kiyo-card">
            <div className="mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              <h2 className="font-display text-base font-bold text-ink-900">{t('restaurant.settings.financialTitle')}</h2>
            </div>
            {commercialTerm ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-ink-400">{t('restaurant.settings.commissionRate')}</dt><dd className="font-bold text-ink-900">{(Number(commercialTerm.food_commission_rate) * 100).toFixed(2)}%</dd></div>
                <div><dt className="text-xs text-ink-400">{profileTx.deliveryParticipation}</dt><dd className="font-bold text-ink-900">{(Number(commercialTerm.delivery_share_rate) * 100).toFixed(2)}%</dd></div>
              </dl>
            ) : (
              <p className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700">{profileTx.termsPending}</p>
            )}
            <p className="mt-3 text-xs text-ink-400">{profileTx.termsControlled}</p>
          </div>

          {readiness && (
            <div className="kiyo-card">
              <h2 className="font-display text-base font-bold text-ink-900">{profileTx.readiness}</h2>
              {readiness.ready ? (
                <p className="mt-2 text-sm text-sage-700">{profileTx.ready}</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-warning-800">
                  {readiness.blockers.map((blocker) => (
                    <li key={blocker}>{localizePublicationBlocker(blocker, locale)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Operational Status */}
          <div className="kiyo-card">
            <div className="mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning-500" />
              <h2 className="font-display text-base font-bold text-ink-900">{t('restaurant.settings.opStatus')}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {['open', 'busy', 'closed'].map((status) => (
                <button
                  key={status}
                  onClick={async () => {
                    if (!restaurant) return;
                    setSaveError(null);
                    const { error: e } = await supabase
                      .from('restaurants')
                      .update({ operational_status: status })
                      .eq('id', restaurant.id);
                    if (e) {
                      console.error('[Kiyo] Restaurant operational status update failed:', e);
                      setSaveError(userFacingError(e, locale, t('error.genericBody')));
                      return;
                    }
                    setRestaurant({ ...restaurant, operational_status: status as Restaurant['operational_status'] });
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    restaurant.operational_status === status
                      ? status === 'open'
                        ? 'bg-sage-500 text-white'
                        : status === 'busy'
                        ? 'bg-amber-500 text-white'
                        : 'bg-ink-700 text-white'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                >
                  {status === 'open' ? t('restaurant.open') : status === 'busy' ? t('restaurant.busy') : t('restaurant.closed')}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-400">
              {t('restaurant.settings.opStatusDesc')}
            </p>
          </div>

          {saveError && (
            <div className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2.5 text-xs text-error-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{saveError}</span>
            </div>
          )}

          {/* Save Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="kiyo-btn-primary"
            >
              {saving ? (
                <>
                  <Spinner className="h-4 w-4" />
                  {t('restaurant.settings.saving')}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t('restaurant.settings.saveSettings')}
                </>
              )}
            </button>
            {saved && (
              <span className="text-sm font-medium text-sage-600">{t('restaurant.settings.saved')}</span>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </AppShell>
  );
}
