import { useState, type FormEvent } from 'react';
import { CheckCircle2, ImagePlus, MapPin, Send, Store, AlertCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import DeliveryMap, { type DeliveryMapLocation } from '../components/DeliveryMap';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';

type Location = DeliveryMapLocation;

export default function RestaurantApplicationPage() {
  const { t } = useT();
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
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
    if (!Number.isFinite(maxKm) || maxKm <= 0 || maxKm > 100) return setError(t('restaurant.apply.errorDelivery'));
    if (!Number.isFinite(minOrder) || minOrder < 0) return setError(t('restaurant.apply.errorMinOrder'));

    setSubmitting(true);
    try {
      const logoUrl = logo ? await uploadApplicationImage(profile.id, logo, 'logo') : null;
      const coverUrl = cover ? await uploadApplicationImage(profile.id, cover, 'cover') : null;

      const { error: insertError } = await supabase.from('restaurant_applications').insert({
        applicant_id: profile.id,
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
        status: 'pending',
      });
      if (insertError) throw insertError;
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
  const { data } = supabase.storage.from('restaurant-applications').getPublicUrl(path);
  return data.publicUrl;
}
