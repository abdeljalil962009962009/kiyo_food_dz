import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Truck, Settings, ChevronLeft,
  AlertCircle, Save, Wallet, MapPin,
} from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type Restaurant } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import DeliveryMap, { type DeliveryMapLocation } from '../components/DeliveryMap';

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

type HoursEntry = { open: string; close: string } | null;
type OpeningHours = Record<string, HoursEntry>;

export default function RestaurantSettingsPage() {
  const { t } = useT();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Business hours state
  const [hours, setHours] = useState<OpeningHours>({});

  // Delivery settings
  const [deliveryRadius, setDeliveryRadius] = useState('10');
  const [minOrder, setMinOrder] = useState('0');
  const [estimatedDeliveryMin, setEstimatedDeliveryMin] = useState('45');
  const [commissionRate, setCommissionRate] = useState('7');
  const [location, setLocation] = useState<DeliveryMapLocation | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const { data: r, error: re } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', profile.id)
        .maybeSingle();
      if (re) throw re;
      
      if (!r) {
        setError('No restaurant assigned to your account. Please contact the platform administrator to onboard your restaurant.');
        return;
      }

      const activeRes = r as Restaurant;
      setRestaurant(activeRes);
      setHours(activeRes.opening_hours as OpeningHours || {});
      setDeliveryRadius(String(activeRes.max_delivery_km || 10));
      setMinOrder(String(activeRes.min_order_amount || 0));
      setEstimatedDeliveryMin(String(activeRes.estimated_delivery_min || 45));
      setCommissionRate(String(Number(activeRes.commission_rate ?? 0.07) * 100));
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
      setError(err instanceof Error ? err.message : t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  useEffect(() => { void load(); }, [load]);

  const saveSettings = async () => {
    if (!restaurant || saving) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    // Validate the new commission rate value
    const rateNum = Number(commissionRate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setSaveError(t('restaurant.settings.invalidCommissionRate'));
      setSaving(false);
      return;
    }
    if (!location?.confirmed) {
      setSaveError(t('map.confirmRequired'));
      setSaving(false);
      return;
    }

    try {
      const { error: e } = await supabase
        .from('restaurants')
        .update({
          opening_hours: hours,
          max_delivery_km: Number(deliveryRadius),
          min_order_amount: Number(minOrder),
          estimated_delivery_min: Number(estimatedDeliveryMin),
          commission_rate: rateNum / 100,
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurant.id);
      if (e) throw e;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : t('error.genericBody'));
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
          title={t('error.genericTitle')} message={error ?? 'Error'}
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
          <Settings className="mr-2 inline h-6 w-6" />
          {t('restaurant.settings.title')}
        </h1>
        <p className="text-xs text-ink-400">{restaurant.name}</p>
      </div>

      <ErrorBoundary variant="inline">
        <div className="space-y-6">
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
            <div>
              <label className="kiyo-label">{t('restaurant.settings.commissionRate')}</label>
              <input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                min="0"
                max="100"
                step="0.1"
                className="kiyo-input"
              />
              <p className="mt-1 text-xs text-ink-400">
                {t('restaurant.settings.commissionDesc')}
              </p>
            </div>
          </div>

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
                    const { error: e } = await supabase
                      .from('restaurants')
                      .update({ operational_status: status })
                      .eq('id', restaurant.id);
                    if (!e) {
                      setRestaurant({ ...restaurant, operational_status: status as Restaurant['operational_status'] });
                    }
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
