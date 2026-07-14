import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Utensils, AlertCircle, MapPin, ShieldCheck } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type Profile } from '../lib/supabase';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Field } from '../components/Field';
import { Spinner, ErrorState } from '../components/feedback';
import DeliveryMap, { type DeliveryMapLocation } from '../components/DeliveryMap';

const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=60&auto=format&fit=crop';

/**
 * Admin-only restaurant creation page.
 *
 * Lifecycle rule: the platform owner is the only person who can create a new
 * restaurant. The restaurants_insert_admin_only RLS policy enforces this
 * server-side. The created row starts at status='pending_approval' so the
 * admin can review before publishing.
 */
export default function RestaurantOnboardingPage() {
  const { t } = useT();
  const navigate = useNavigate();

  const [owners, setOwners] = useState<Profile[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(true);
  const [ownersError, setOwnersError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [desc, setDesc] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [location, setLocation] = useState<DeliveryMapLocation | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setOwnersLoading(true);
      setOwnersError(null);
      try {
        const { data, error: e } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'restaurant_owner')
          .order('created_at', { ascending: false })
          .limit(50);
        if (e) throw e;
        setOwners((data as Profile[]) ?? []);
      } catch (err) {
        console.error('Failed to load restaurant owners for onboarding', err);
        setOwners([]);
        setOwnersError(formatOnboardingError(err, t('error.genericBody')));
      } finally {
        setOwnersLoading(false);
      }
    })();
  }, [t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (name.trim().length < 2) return setError(t('restaurant.onboard.invalidName'));
    if (!ownerId) return setError(t('restaurant.onboard.ownerRequired'));
    if (!location?.confirmed) return setError(t('map.confirmRequired'));
    setSubmitting(true);
    try {
      const { error: e } = await supabase
        .from('restaurants')
        .insert({
          owner_id: ownerId,
          name: name.trim(),
          description: desc.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          location_accuracy_m: location?.accuracy ?? null,
          location_verified: Boolean(location?.confirmed),
          place_id: location?.placeId ?? null,
          location_source: location?.source ?? null,
          location_updated_at: location ? new Date().toISOString() : null,
          street: location?.addressParts?.street ?? null,
          neighborhood: location?.addressParts?.neighborhood ?? null,
          commune: location?.addressParts?.commune ?? null,
          city: location?.addressParts?.city ?? null,
          province: location?.addressParts?.province ?? null,
          postal_code: location?.addressParts?.postalCode ?? null,
          country: location?.addressParts?.country ?? 'Algeria',
          cuisine: cuisine.split(',').map((s) => s.trim()).filter(Boolean),
          image_url: imageUrl.trim() || PLACEHOLDER_IMG,
          status: 'pending_approval',
          operational_status: 'closed',
        })
        .select('id')
        .maybeSingle();
      if (e) throw e;

      navigate('/admin/restaurants', { replace: true });
    } catch (err) {
      console.error('Failed to create restaurant', err);
      setError(formatOnboardingError(err, t('error.genericBody')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <button
        onClick={() => navigate('/admin/restaurants')}
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('admin.restaurantsManagement')}
      </button>

      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-white">
            <Utensils className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
              {t('restaurant.openRestaurant')}
            </h1>
            <p className="text-xs text-ink-400">{t('restaurant.onboard.prompt')}</p>
          </div>
        </div>

        <ErrorBoundary variant="inline">
          <form onSubmit={submit} className="kiyo-card space-y-4 p-5">
            <Field
              name="r-name" label={t('restaurant.itemName')} value={name}
              onChange={(e) => setName(e.target.value)} required autoFocus
            />

            <div>
              <label htmlFor="r-owner" className="kiyo-label">
                {t('restaurant.owner')} {t('restaurant.onboard.existingOwnerHelp')}
              </label>
              {ownersLoading ? (
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <Spinner className="h-3.5 w-3.5" /> {t('common.loading')}
                </div>
              ) : ownersError ? (
                <p className="rounded-lg bg-error-500/10 px-3 py-2 text-xs text-error-600">
                  {ownersError}
                </p>
              ) : owners.length === 0 ? (
                <p className="rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-600">
                  {t('restaurant.onboard.noOwners')}
                </p>
              ) : (
                <select
                  id="r-owner" className="kiyo-input"
                  value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                  required
                >
                  <option value="">-</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.full_name ?? o.email} ({o.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="r-desc" className="kiyo-label">{t('restaurant.description')}</label>
              <textarea
                id="r-desc" className="kiyo-input min-h-20" value={desc}
                onChange={(e) => setDesc(e.target.value)} rows={3}
              />
            </div>
            <Field
              name="r-phone" label={t('restaurant.phone')} value={phone}
              onChange={(e) => setPhone(e.target.value)} inputMode="tel"
              autoComplete="tel"
            />
            <Field
              name="r-addr" label={t('restaurant.address')} value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                setLocation(null);
              }}
              readOnly={Boolean(location)}
            />
            <div className="space-y-3 border-t border-ink-100 pt-4">
              <div className="mb-3 flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ember-600" />
                <div>
                  <p className="text-sm font-bold text-ink-900">{t('restaurant.onboard.locationTitle')}</p>
                  <p className="text-xs text-ink-500">
                    {t('restaurant.onboard.locationHelp')}
                  </p>
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
              {location && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-sage-50 px-3 py-2 text-xs font-medium text-sage-700">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    {t('restaurant.onboard.coordinatesSaved')}: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
            <Field
              name="r-cuisine" label={t('restaurant.cuisine')} value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="Pizza, Burgers, ..."
            />
            <Field
              name="r-image" label={t('restaurant.image')} value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)} type="url"
              placeholder="https://..."
            />

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2 text-xs text-error-600">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <button type="submit" disabled={submitting || !ownerId} className="kiyo-btn-primary w-full">
              {submitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  {t('restaurant.creating')}
                </>
              ) : (
                t('restaurant.create')
              )}
            </button>
            <p className="text-center text-xs text-ink-400">
              {t('restaurant.onboard.pendingNotice')}
            </p>
          </form>
        </ErrorBoundary>
      </div>
    </AppShell>
  );
}

void ErrorState;

function formatOnboardingError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
