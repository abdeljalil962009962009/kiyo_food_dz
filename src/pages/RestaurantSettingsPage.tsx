import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, MapPin, Truck, DollarSign, Settings, ChevronLeft,
  Calendar, AlertCircle, Save, Plus, X
} from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type Restaurant } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import { Field } from '../components/Field';

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 0, label: 'Sunday' },
  { key: 1, label: 'Monday' },
  { key: 2, label: 'Tuesday' },
  { key: 3, label: 'Wednesday' },
  { key: 4, label: 'Thursday' },
  { key: 5, label: 'Friday' },
  { key: 6, label: 'Saturday' },
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

  // Business hours state
  const [hours, setHours] = useState<OpeningHours>({});

  // Delivery settings
  const [deliveryRadius, setDeliveryRadius] = useState('10');
  const [minOrder, setMinOrder] = useState('0');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [estimatedDeliveryMin, setEstimatedDeliveryMin] = useState('45');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data: r, error: re } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', profile.id)
        .maybeSingle();
      if (re) throw re;
      if (!r) {
        navigate('/restaurant/onboarding', { replace: true });
        return;
      }
      setRestaurant(r as Restaurant);
      setHours((r as Restaurant).opening_hours as OpeningHours || {});
      setDeliveryRadius(String((r as Restaurant).max_delivery_km || 10));
      setMinOrder(String((r as Restaurant).min_order_amount || 0));
      setEstimatedDeliveryMin(String((r as Restaurant).estimated_delivery_min || 45));
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [profile, navigate, t]);

  useEffect(() => { void load(); }, [load]);

  const saveSettings = async () => {
    if (!restaurant || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const { error: e } = await supabase
        .from('restaurants')
        .update({
          opening_hours: hours,
          max_delivery_km: Number(deliveryRadius),
          min_order_amount: Number(minOrder),
          estimated_delivery_min: Number(estimatedDeliveryMin),
          updated_at: new Date().toISOString(),
        })
        .eq('id', restaurant.id);
      if (e) throw e;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // non-fatal
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
          Restaurant Settings
        </h1>
        <p className="text-xs text-ink-400">{restaurant.name}</p>
      </div>

      <ErrorBoundary variant="inline">
        <div className="space-y-6">
          {/* Business Hours */}
          <div className="kiyo-card">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-ember-500" />
              <h2 className="font-display text-base font-bold text-ink-900">Business Hours</h2>
            </div>
            <p className="mb-4 text-xs text-ink-500">
              Set your opening and closing times for each day. Leave a day unchecked to mark it as closed.
            </p>
            <div className="space-y-3">
              {DAYS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="flex w-28 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!hours[key]}
                      onChange={() => toggleDay(key)}
                      className="h-4 w-4 rounded border-ink-300 text-ember-500 focus:ring-ember-500"
                    />
                    <span className="text-sm font-medium text-ink-700">{label}</span>
                  </label>
                  {hours[key] && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hours[key]?.open || '09:00'}
                        onChange={(e) => updateHours(key, e.target.value, hours[key]?.close || '22:00')}
                        className="kiyo-input text-sm"
                      />
                      <span className="text-ink-400">to</span>
                      <input
                        type="time"
                        value={hours[key]?.close || '22:00'}
                        onChange={(e) => updateHours(key, hours[key]?.open || '09:00', e.target.value)}
                        className="kiyo-input text-sm"
                      />
                    </div>
                  )}
                  {!hours[key] && (
                    <span className="text-xs text-ink-400">Closed</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Configuration */}
          <div className="kiyo-card">
            <div className="mb-4 flex items-center gap-2">
              <Truck className="h-5 w-5 text-sage-600" />
              <h2 className="font-display text-base font-bold text-ink-900">Delivery Configuration</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="kiyo-label">Max Delivery Radius (km)</label>
                <input
                  type="number"
                  value={deliveryRadius}
                  onChange={(e) => setDeliveryRadius(e.target.value)}
                  min="1"
                  max="100"
                  className="kiyo-input"
                />
                <p className="mt-1 text-xs text-ink-400">
                  Customers outside this radius cannot order from your restaurant.
                </p>
              </div>
              <div>
                <label className="kiyo-label">Minimum Order Amount (DZD)</label>
                <input
                  type="number"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  min="0"
                  className="kiyo-input"
                />
                <p className="mt-1 text-xs text-ink-400">
                  Orders below this amount will be rejected.
                </p>
              </div>
              <div>
                <label className="kiyo-label">Estimated Delivery Time (minutes)</label>
                <input
                  type="number"
                  value={estimatedDeliveryMin}
                  onChange={(e) => setEstimatedDeliveryMin(e.target.value)}
                  min="10"
                  max="120"
                  className="kiyo-input"
                />
                <p className="mt-1 text-xs text-ink-400">
                  This is shown to customers before they order.
                </p>
              </div>
            </div>
          </div>

          {/* Operational Status */}
          <div className="kiyo-card">
            <div className="mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning-500" />
              <h2 className="font-display text-base font-bold text-ink-900">Operational Status</h2>
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
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Open: Accepting orders normally. Busy: Extended preparation times.
              Closed: Not accepting orders.
            </p>
          </div>

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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </button>
            {saved && (
              <span className="text-sm font-medium text-sage-600">Settings saved!</span>
            )}
          </div>
        </div>
      </ErrorBoundary>
    </AppShell>
  );
}
