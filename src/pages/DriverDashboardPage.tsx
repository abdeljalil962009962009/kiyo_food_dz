import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bike, Car, Navigation, Package, Star, Clock, Power, MapPin, Check, X, AlertTriangle
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton } from '../components/feedback';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { watchCurrentPosition, type LiveGeoPoint } from '../lib/geo';
import { callUserAction } from '../lib/userApi';

type Driver = {
  id: string;
  user_id: string;
  vehicle_type: 'bicycle' | 'motorcycle' | 'car' | 'scooter';
  vehicle_plate: string | null;
  is_online: boolean;
  is_verified: boolean;
  is_active: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  location_accuracy_m: number | null;
  heading: number | null;
  speed_mps: number | null;
  last_location_at: string | null;
  last_location_update: string | null;
  rating: number;
  delivery_count: number;
};

type LocationRpcResult = {
  ok?: boolean;
  suspicious?: boolean;
  reason?: string;
};

type Delivery = {
  id: string;
  order_id: string;
  status: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  driver_notes: string | null;
  created_at: string;
  updated_at: string;
  orders: {
    id: string;
    restaurant_id: string;
    total: string;
    delivery_address: string | null;
    restaurants: {
      id: string;
      name: string;
      address: string | null;
    };
  };
};

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'watching' | 'error'>('idle');
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [lastGpsPoint, setLastGpsPoint] = useState<LiveGeoPoint | null>(null);
  const [earnings, setEarnings] = useState<{ today: number; week: number; pending: number }>({
    today: 0, week: 0, pending: 0
  });
  const lastLocationWriteRef = useRef(0);
  const locationWriteInFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Load driver profile
      const { data: d, error: de } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (de) throw de;
      if (!d) {
        // Driver doesn't exist yet - show onboarding
        navigate('/driver/onboarding', { replace: true });
        return;
      }
      setDriver(d as Driver);

      if (!(d as Driver).is_verified) {
        setError(t('driver.dash.pendingVerification'));
        setLoading(false);
        return;
      }

      // Load pending assignments
      const { data: pending } = await supabase
        .from('deliveries')
        .select('id, order_id, status, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, driver_notes, created_at, orders!inner(id, restaurant_id, total, delivery_address, restaurants!inner(id, name, address))')
        .eq('driver_id', (d as Driver).id)
        .in('status', ['assigned', 'driver_accepted', 'picking_up', 'picked_up', 'en_route', 'arrived'])
        .order('created_at', { ascending: true });

      const deliveries = (pending as unknown as Delivery[]) ?? [];
      setPendingDeliveries(deliveries);

      // Find active delivery
      const active = deliveries.find(d =>
        ['driver_accepted', 'picking_up', 'picked_up', 'en_route', 'arrived'].includes(d.status)
      );
      setActiveDelivery(active ?? null);

      // Load earnings
      const { data: earningsData } = await supabase
        .from('driver_earnings')
        .select('total, created_at, settlement_status')
        .eq('driver_id', (d as Driver).id);

      if (earningsData) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        setEarnings({
          today: earningsData
            .filter(e => new Date(e.created_at) >= today)
            .reduce((sum, e) => sum + Number(e.total), 0),
          week: earningsData
            .filter(e => new Date(e.created_at) >= weekAgo)
            .reduce((sum, e) => sum + Number(e.total), 0),
          pending: earningsData
            .filter(e => e.settlement_status === 'pending')
            .reduce((sum, e) => sum + Number(e.total), 0),
        });
      }
    } catch (err) {
      setError((err as Error)?.message ?? t('driver.dash.failedLoad'));
    } finally {
      setLoading(false);
    }
  }, [user, navigate, t]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!driver?.id || !driver.is_online || !driver.is_verified) {
      setGpsStatus('idle');
      return;
    }

    setGpsStatus('watching');
    setGpsNotice(null);
    const stop = watchCurrentPosition(
      async (point) => {
        setLastGpsPoint(point);
        const now = Date.now();
        if (locationWriteInFlightRef.current || now - lastLocationWriteRef.current < 4000) {
          return;
        }

        locationWriteInFlightRef.current = true;
        lastLocationWriteRef.current = now;
        try {
          const { data, error: rpcError } = await callUserAction<LocationRpcResult>('update_driver_live_location', {
            p_driver_id: driver.id,
            p_lat: point.lat,
            p_lng: point.lng,
            p_accuracy_m: point.accuracy,
            p_heading: point.heading,
            p_speed_mps: point.speed,
            p_recorded_at: new Date(point.timestamp).toISOString(),
          });

          if (rpcError) throw rpcError;
          const result = data as LocationRpcResult | null;
          if (result?.suspicious) {
            setGpsNotice(result.reason === 'low_accuracy'
              ? t('map.driverWeakGps')
              : t('map.driverJump'));
          } else {
            setGpsNotice(null);
          }

          setDriver((prev) => prev ? {
            ...prev,
            current_latitude: point.lat,
            current_longitude: point.lng,
            location_accuracy_m: point.accuracy,
            heading: point.heading,
            speed_mps: point.speed,
            last_location_at: new Date(point.timestamp).toISOString(),
            last_location_update: new Date(point.timestamp).toISOString(),
          } : prev);
        } catch {
          setGpsStatus('error');
          setGpsNotice(t('map.driverSyncFailed'));
        } finally {
          locationWriteInFlightRef.current = false;
        }
      },
      () => {
        setGpsStatus('error');
        setGpsNotice(t('map.driverPermissionRequired'));
      },
    );

    return stop;
  }, [driver?.id, driver?.is_online, driver?.is_verified, t]);

  const toggleOnline = async () => {
    if (!driver) return;
    const newStatus = !driver.is_online;
    setActionError(null);
    setPendingAction('online');
    setDriver(prev => prev ? { ...prev, is_online: newStatus } : null);
    const { error: e } = await supabase
      .from('drivers')
      .update({ is_online: newStatus, updated_at: new Date().toISOString() })
      .eq('id', driver.id);
    if (e) {
      setDriver(prev => prev ? { ...prev, is_online: !newStatus } : null);
      setActionError(e.message);
    }
    setPendingAction(null);
  };

  const acceptDelivery = async (deliveryId: string) => {
    setActionError(null);
    setPendingAction(deliveryId);
    const delivery = pendingDeliveries.find((item) => item.id === deliveryId);
    const { error: e } = await callUserAction('transition_delivery_status', {
      p_delivery_id: deliveryId,
      p_target_status: 'driver_accepted',
      p_reason: null,
      p_expected_updated_at: delivery?.updated_at ?? null,
    });
    if (e) {
      setActionError(e.message);
      setPendingAction(null);
      return;
    }
    await load();
    setPendingAction(null);
  };

  const declineDelivery = async (deliveryId: string) => {
    setActionError(null);
    setPendingAction(deliveryId);
    const delivery = pendingDeliveries.find((item) => item.id === deliveryId);
    const { error: e } = await callUserAction('transition_delivery_status', {
      p_delivery_id: deliveryId,
      p_target_status: 'driver_declined',
      p_reason: 'Driver declined assignment',
      p_expected_updated_at: delivery?.updated_at ?? null,
    });
    if (e) {
      setActionError(e.message);
      setPendingAction(null);
      return;
    }
    await load();
    setPendingAction(null);
  };

  const updateDeliveryStatus = async (deliveryId: string, newStatus: string) => {
    setActionError(null);
    setPendingAction(deliveryId);
    const delivery = activeDelivery || pendingDeliveries.find((item) => item.id === deliveryId);
    let reason: string | null = null;
    if (newStatus === 'failed') {
      reason = window.prompt('Please explain why delivery failed:')?.trim() ?? null;
      if (!reason || reason.length < 3) {
        setPendingAction(null);
        return;
      }
    }
    const { error: e } = await callUserAction('transition_delivery_status', {
      p_delivery_id: deliveryId,
      p_target_status: newStatus,
      p_reason: reason,
      p_expected_updated_at: delivery?.updated_at ?? null,
    });
    if (e) {
      setActionError(e.message);
      setPendingAction(null);
      return;
    }
    await load();
    setPendingAction(null);
  };

  if (loading) {
    return (
      <AppShell>
        <Skeleton count={4} />
      </AppShell>
    );
  }

  if (error && !driver?.is_verified) {
    return (
      <AppShell>
        <div className="kiyo-card p-6 text-center">
          <Clock className="mx-auto h-10 w-10 text-ink-300" />
          <p className="mt-3 text-sm text-ink-500">{error}</p>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="kiyo-card p-6 text-center">
          <p className="text-sm text-error-600">{error}</p>
          <button onClick={load} className="kiyo-btn-secondary mt-3">{t('error.retry')}</button>
        </div>
      </AppShell>
    );
  }

  const VEHICLE_ICONS = {
    bicycle: Bike,
    motorcycle: Bike,
    car: Car,
    scooter: Bike,
  };
  const VehicleIcon = driver ? VEHICLE_ICONS[driver.vehicle_type] : Bike;

  return (
    <AppShell>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
            {t('driver.dash.title')}
          </h1>
          <p className="text-xs text-ink-400">
            {driver?.is_online ? t('driver.dash.onlineAccepting') : t('driver.dash.offline')}
          </p>
          {driver?.is_online && (
            <p className={`mt-1 text-xs font-medium ${
              gpsStatus === 'watching' ? 'text-sage-600' : gpsStatus === 'error' ? 'text-error-600' : 'text-ink-400'
            }`}>
              {t('map.gps')}: {gpsStatus === 'watching'
                ? t('map.gpsLive')
                : gpsStatus === 'error'
                  ? t('map.gpsError')
                  : t('map.gpsIdle')}
              {lastGpsPoint?.accuracy
                ? ` - ${t('map.gpsAccuracy')}: ${Math.round(lastGpsPoint.accuracy)} m`
                : ''}
            </p>
          )}
        </div>
        <button
          onClick={toggleOnline}
          disabled={pendingAction === 'online'}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
            driver?.is_online
              ? 'bg-sage-500 text-white hover:bg-sage-600'
              : 'bg-ink-200 text-ink-600 hover:bg-ink-300'
          }`}
        >
          <Power className="mr-1.5 inline h-4 w-4" />
          {driver?.is_online ? t('driver.dash.online') : t('driver.dash.goOnline')}
        </button>
      </div>

      {/* Earnings summary */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="kiyo-card p-3">
          <div className="text-xs font-medium text-ink-400">{t('driver.dash.today')}</div>
          <div className="mt-1 font-display text-lg font-bold text-ink-900">
            {earnings.today.toLocaleString()} DZD
          </div>
        </div>
        <div className="kiyo-card p-3">
          <div className="text-xs font-medium text-ink-400">{t('driver.dash.thisWeek')}</div>
          <div className="mt-1 font-display text-lg font-bold text-ink-900">
            {earnings.week.toLocaleString()} DZD
          </div>
        </div>
        <div className="kiyo-card p-3">
          <div className="text-xs font-medium text-ink-400">{t('driver.dash.pending')}</div>
          <div className="mt-1 font-display text-lg font-bold text-ember-600">
            {earnings.pending.toLocaleString()} DZD
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-5 flex gap-4 text-sm text-ink-500">
        <span className="flex items-center gap-1">
          <Star className="h-4 w-4 text-amber-500" />
          {driver?.rating.toFixed(1) ?? '5.0'}
        </span>
        <span className="flex items-center gap-1">
          <Package className="h-4 w-4" />
          {driver?.delivery_count ?? 0} {t('driver.dash.deliveries')}
        </span>
        <span className="flex items-center gap-1">
          <VehicleIcon className="h-4 w-4" />
          {driver ? t(`driver.vehicle.${driver.vehicle_type}` as 'driver.vehicle.car') : ''}
        </span>
        {driver?.current_latitude != null && driver.current_longitude != null && (
          <span className="hidden items-center gap-1 sm:flex">
            <MapPin className="h-4 w-4" />
            {driver.current_latitude.toFixed(4)}, {driver.current_longitude.toFixed(4)}
          </span>
        )}
      </div>

      {gpsNotice && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{gpsNotice}</span>
        </div>
      )}
      {actionError && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-error-100 bg-error-50 px-3 py-2 text-xs font-medium text-error-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <ErrorBoundary variant="inline">
        {/* Active delivery */}
        {activeDelivery && (
          <div className="mb-5 kiyo-card border-l-4 border-ember-500 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-ember-600">
                {t('driver.dash.activeDelivery')}
              </span>
              <span className="rounded-full bg-ember-100 px-2 py-0.5 text-xs font-medium text-ember-700">
                {activeDelivery.status.replace('_', ' ')}
              </span>
            </div>
            <h3 className="font-display text-base font-bold text-ink-900">
              {activeDelivery.orders.restaurants.name}
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              {activeDelivery.orders.delivery_address}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink-900">
              {Number(activeDelivery.orders.total).toLocaleString()} DZD
            </p>

            {/* Status buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              {activeDelivery.status === 'driver_accepted' && (
                <button
                  onClick={() => updateDeliveryStatus(activeDelivery.id, 'picking_up')}
                  disabled={pendingAction === activeDelivery.id}
                  className="kiyo-btn-primary text-xs"
                >
                  <Navigation className="h-3 w-3" />
                  {t('driver.dash.headingToRestaurant')}
                </button>
              )}
              {activeDelivery.status === 'picking_up' && (
                <button
                  onClick={() => updateDeliveryStatus(activeDelivery.id, 'picked_up')}
                  disabled={pendingAction === activeDelivery.id}
                  className="kiyo-btn-primary text-xs"
                >
                  <Check className="h-3 w-3" />
                  {t('driver.dash.orderCollected')}
                </button>
              )}
              {activeDelivery.status === 'picked_up' && (
                <button
                  onClick={() => updateDeliveryStatus(activeDelivery.id, 'en_route')}
                  disabled={pendingAction === activeDelivery.id}
                  className="kiyo-btn-primary text-xs"
                >
                  <Navigation className="h-3 w-3" />
                  {t('driver.dash.enRouteToCustomer')}
                </button>
              )}
              {activeDelivery.status === 'en_route' && (
                <button
                  onClick={() => updateDeliveryStatus(activeDelivery.id, 'arrived')}
                  disabled={pendingAction === activeDelivery.id}
                  className="kiyo-btn-primary text-xs"
                >
                  <MapPin className="h-3 w-3" />
                  {t('driver.dash.arrived')}
                </button>
              )}
              {activeDelivery.status === 'arrived' && (
                <button
                  onClick={() => updateDeliveryStatus(activeDelivery.id, 'delivered')}
                  disabled={pendingAction === activeDelivery.id}
                  className="kiyo-btn-primary text-xs"
                >
                  <Check className="h-3 w-3" />
                  {t('driver.dash.markAsDelivered')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* New delivery requests */}
        {!activeDelivery && pendingDeliveries.filter(d => d.status === 'assigned').length > 0 && driver?.is_online && (
          <div className="mb-5">
            <h2 className="mb-2 text-sm font-semibold text-ink-600">{t('driver.dash.newRequest')}</h2>
            {pendingDeliveries.filter(d => d.status === 'assigned').map((delivery) => (
              <div key={delivery.id} className="kiyo-card mb-2 p-4">
                <h3 className="font-display text-base font-bold text-ink-900">
                  {delivery.orders.restaurants.name}
                </h3>
                <p className="mt-0.5 text-xs text-ink-500">
                  {t('driver.dash.pickup')}: {delivery.orders.restaurants.address}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {t('driver.dash.deliverTo')}: {delivery.orders.delivery_address}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink-900">
                  {Number(delivery.orders.total).toLocaleString()} DZD
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => acceptDelivery(delivery.id)}
                    disabled={pendingAction === delivery.id}
                    className="kiyo-btn-primary flex-1 text-xs"
                  >
                    <Check className="h-3 w-3" /> {t('driver.dash.accept')}
                  </button>
                  <button
                    onClick={() => declineDelivery(delivery.id)}
                    disabled={pendingAction === delivery.id}
                    className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-600 hover:bg-ink-50"
                  >
                    <X className="h-3 w-3" /> {t('driver.dash.decline')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!activeDelivery && pendingDeliveries.filter(d => d.status === 'assigned').length === 0 && (
          <div className="kiyo-card p-8 text-center">
            <Package className="mx-auto h-10 w-10 text-ink-200" />
            <p className="mt-3 text-sm text-ink-500">
              {driver?.is_online
                ? t('driver.dash.waiting')
                : t('driver.dash.goOnlineHelp')}
            </p>
          </div>
        )}
      </ErrorBoundary>
    </AppShell>
  );
}
