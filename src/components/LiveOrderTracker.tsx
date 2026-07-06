import { useEffect, useState, useRef, useCallback } from 'react';
import { Play, SkipForward, CheckCircle, Clock, Truck, RefreshCw } from 'lucide-react';
import { supabase, type OrderRow } from '../lib/supabase';
import TrackingMap from './TrackingMap';

type OrderWithRestaurant = OrderRow & {
  restaurants: { id: string; name: string; latitude: number | null; longitude: number | null } | null;
};

type Props = {
  order: OrderWithRestaurant;
  onRefresh: () => void;
};

export function LiveOrderTracker({ order, onRefresh }: Props) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0); // 0 to 100%
  const [simStatus, setSimStatus] = useState<string>(order.status);
  const [simDriverLat, setSimDriverLat] = useState<number | null>(null);
  const [simDriverLng, setSimDriverLng] = useState<number | null>(null);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fallback coords for Constantine center, Algeria if missing
  const restaurantLat = order.restaurants?.latitude ?? 36.3650;
  const restaurantLng = order.restaurants?.longitude ?? 6.6147;
  const deliveryLat = order.delivery_latitude ?? 36.3720;
  const deliveryLng = order.delivery_longitude ?? 6.6230;

  // Sync simulator status with Supabase order status
  useEffect(() => {
    setSimStatus(order.status);
    if (order.status !== 'out_for_delivery') {
      setSimDriverLat(null);
      setSimDriverLng(null);
      setSimProgress(0);
      setIsSimulating(false);
    }
  }, [order.status]);

  // Interpolate coordinates between Restaurant and Customer for animated travel
  const getInterpolatedCoords = (progress: number): [number, number] => {
    const fraction = progress / 100;
    const lat = restaurantLat + (deliveryLat - restaurantLat) * fraction;
    const lng = restaurantLng + (deliveryLng - restaurantLng) * fraction;
    return [lat, lng];
  };

  // Stop simulation loop
  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, []);

  // Update order status in Supabase (fully syncs other roles real-time!)
  const updateSupabaseStatus = async (nextStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error('[Kiyo] Failed to update simulator status:', err);
    }
  };

  // Start animated rider transit from restaurant to customer
  const startRiderTransit = () => {
    stopSimulation();
    setIsSimulating(true);
    setSimProgress(0);
    setSimDriverLat(restaurantLat);
    setSimDriverLng(restaurantLng);

    let currentProgress = 0;
    simTimerRef.current = setInterval(() => {
      currentProgress += 5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        const [lat, lng] = getInterpolatedCoords(100);
        setSimDriverLat(lat);
        setSimDriverLng(lng);
        setSimProgress(100);
        stopSimulation();
        // Automatically mark delivered at the end of transit
        void updateSupabaseStatus('delivered');
      } else {
        const [lat, lng] = getInterpolatedCoords(currentProgress);
        setSimDriverLat(lat);
        setSimDriverLng(lng);
        setSimProgress(currentProgress);
      }
    }, 450); // Animated step every 450ms
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  // Compute status step visual states
  const getStepState = (stepIndex: number) => {
    const statuses = ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered'];
    const currentIdx = statuses.indexOf(simStatus);
    if (currentIdx > stepIndex) return 'completed';
    if (currentIdx === stepIndex) return 'active';
    return 'upcoming';
  };

  const steps = [
    { label: 'Placed', icon: Clock, desc: 'Waiting for acceptance' },
    { label: 'Kitchen', icon: Clock, desc: 'Restaurant accepted' },
    { label: 'Preparing', icon: Clock, desc: 'Chef cooking your meal' },
    { label: 'Dispatch', icon: Truck, desc: 'Rider delivering' },
    { label: 'Handover', icon: CheckCircle, desc: 'Arrived & complete' }
  ];

  return (
    <div className="kiyo-card border-2 border-orange-500/20 bg-gradient-to-b from-orange-50/20 to-white p-5 shadow-md">
      {/* Tracker Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
        <div>
          <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700 animate-pulse">
            LIVE TRACKING
          </span>
          <h2 className="mt-1 font-display text-base font-extrabold text-ink-900">
            Order #{order.id.slice(0, 8)}
          </h2>
          <p className="text-xs text-ink-500">From {order.restaurants?.name}</p>
        </div>
        
        {/* Real-time sync indicator */}
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Live Engine Connected</span>
        </div>
      </div>

      {/* Map visualization */}
      <div className="mb-5">
        <TrackingMap
          restaurantLat={restaurantLat}
          restaurantLng={restaurantLng}
          deliveryLat={deliveryLat}
          deliveryLng={deliveryLng}
          driverLat={simDriverLat}
          driverLng={simDriverLng}
          status={simStatus}
        />
      </div>

      {/* Flow Stepper UI */}
      <div className="mb-6 relative flex flex-row items-center justify-between">
        {/* Background Line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-ink-100 z-0"></div>
        {/* Active Line Progress */}
        <div 
          className="absolute top-4 left-4 h-0.5 bg-orange-500 transition-all duration-500 z-0"
          style={{
            width: `${
              simStatus === 'pending' ? '0%' :
              simStatus === 'accepted' ? '25%' :
              simStatus === 'preparing' ? '50%' :
              simStatus === 'out_for_delivery' ? '75%' : '100%'
            }`
          }}
        ></div>

        {steps.map((st, idx) => {
          const state = getStepState(idx);
          const Icon = st.icon;
          return (
            <div key={idx} className="relative z-10 flex flex-col items-center flex-1">
              <div 
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  state === 'completed'
                    ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                    : state === 'active'
                    ? 'border-orange-600 bg-white text-orange-600 shadow-md ring-4 ring-orange-100 font-bold scale-110'
                    : 'border-ink-200 bg-white text-ink-400'
                }`}
              >
                {state === 'completed' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className={`mt-2 text-center text-xs font-bold ${state === 'active' ? 'text-orange-600' : 'text-ink-700'}`}>
                {st.label}
              </span>
              <span className="hidden sm:inline text-center text-[10px] text-ink-400 max-w-[80px]">
                {st.desc}
              </span>
            </div>
          );
        })}
      </div>

      {/* Smart Simulation Console */}
      <div className="rounded-xl bg-ink-950 p-4 text-white border border-ink-800 shadow-inner">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-ink-950 animate-bounce">
            ⚙️
          </div>
          <h3 className="font-display text-xs font-black uppercase tracking-wider text-orange-400">
            Interactive Order Simulator & Sandbox
          </h3>
        </div>
        
        <p className="text-xs text-ink-300 mb-4 leading-relaxed">
          Algerian on-demand delivery relies on precise coordination. Use these sandboxed triggers to advance the status of your order instantly and watch the map route recalculate in real-time.
        </p>

        <div className="flex flex-wrap gap-2.5">
          {simStatus === 'pending' && (
            <button
              onClick={() => updateSupabaseStatus('accepted')}
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-500 transition-colors shadow-sm"
            >
              <Play className="h-3.5 w-3.5" /> Accept Order (Restaurant)
            </button>
          )}

          {simStatus === 'accepted' && (
            <button
              onClick={() => updateSupabaseStatus('preparing')}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-colors shadow-sm"
            >
              <SkipForward className="h-3.5 w-3.5" /> Start Preparing (Kitchen)
            </button>
          )}

          {simStatus === 'preparing' && (
            <button
              onClick={() => updateSupabaseStatus('out_for_delivery')}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
            >
              <Truck className="h-3.5 w-3.5" /> Assign Rider & Dispatch
            </button>
          )}

          {simStatus === 'out_for_delivery' && (
            <div className="w-full flex flex-col gap-2">
              <div className="flex items-center gap-2 justify-between">
                <button
                  onClick={startRiderTransit}
                  disabled={isSimulating}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-extrabold text-white transition-all shadow-sm ${
                    isSimulating 
                      ? 'bg-ink-700 text-ink-400 cursor-not-allowed' 
                      : 'bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.02]'
                  }`}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
                  {isSimulating ? `Traveling (${simProgress}%)` : 'Animate Rider Movement Live!'}
                </button>
                
                <button
                  onClick={() => updateSupabaseStatus('delivered')}
                  className="rounded-lg bg-ink-800 border border-ink-700 px-3 py-2 text-xs font-semibold hover:bg-ink-700 hover:text-white transition-colors"
                >
                  Skip Animation
                </button>
              </div>

              {/* Progress bar */}
              {isSimulating && (
                <div className="mt-2 w-full bg-ink-900 rounded-full h-1.5 border border-ink-800 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    style={{ width: `${simProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}

          {simStatus === 'delivered' && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold py-1">
              <CheckCircle className="h-4 w-4" /> Order complete! Leave a review above to share your experience.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
