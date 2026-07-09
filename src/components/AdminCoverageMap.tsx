/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';
import { APIProvider, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Activity, Layers } from 'lucide-react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

type LocationPoint = {
  id: string;
  lat: number;
  lng: number;
  type: 'customer' | 'restaurant' | 'pickup';
};

function HeatmapLayerComponent({ points, typeFilter }: { points: LocationPoint[], typeFilter: string }) {
  const map = useMap();
  const visualization = useMapsLibrary('visualization');
  const [heatmap, setHeatmap] = useState<any>(null);

  useEffect(() => {
    if (!map || !visualization) return;
    
    if (!heatmap) {
      const newHeatmap = new (visualization as any).HeatmapLayer({
        map,
        radius: 30,
        opacity: 0.8,
      });
      setHeatmap(newHeatmap);
    }
  }, [map, visualization, heatmap]);

  useEffect(() => {
    if (!heatmap || !window.google) return;
    
    const filtered = points.filter(p => typeFilter === 'all' || p.type === typeFilter);
    const data = filtered.map(p => {
      const weight = p.type === 'restaurant' ? 3 : 1;
      return {
        location: new google.maps.LatLng(p.lat, p.lng),
        weight
      };
    });
    
    heatmap.setData(data);
    
    // Change gradient based on type
    if (typeFilter === 'restaurant') {
      heatmap.setOptions({ gradient: [ 'rgba(0, 255, 255, 0)', 'rgba(0, 255, 255, 1)', 'rgba(0, 191, 255, 1)', 'rgba(0, 127, 255, 1)', 'rgba(0, 63, 255, 1)', 'rgba(0, 0, 255, 1)', 'rgba(0, 0, 223, 1)', 'rgba(0, 0, 191, 1)', 'rgba(0, 0, 159, 1)', 'rgba(0, 0, 127, 1)', 'rgba(63, 0, 91, 1)', 'rgba(127, 0, 63, 1)', 'rgba(191, 0, 31, 1)', 'rgba(255, 0, 0, 1)' ] });
    } else {
      heatmap.setOptions({ gradient: null }); // Default Google Maps gradient (Green->Yellow->Red)
    }

  }, [heatmap, points, typeFilter]);

  return null;
}

export default function AdminCoverageMap() {
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'restaurant'>('all');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Load restaurants
        const res1 = await supabase.from('restaurants').select('id, latitude, longitude').eq('status', 'published');
        // Load saved addresses (common delivery destinations)
        const res2 = await supabase.from('saved_addresses').select('id, latitude, longitude').not('latitude', 'is', null);
        
        const loadedPoints: LocationPoint[] = [];
        
        if (res1.data) {
          res1.data.forEach(r => {
            if (r.latitude && r.longitude) {
              loadedPoints.push({ id: `rest_${r.id}`, lat: r.latitude, lng: r.longitude, type: 'restaurant' });
            }
          });
        }
        
        if (res2.data) {
          res2.data.forEach(a => {
            if (a.latitude && a.longitude) {
              loadedPoints.push({ id: `addr_${a.id}`, lat: a.latitude, lng: a.longitude, type: 'customer' });
            }
          });
        }
        
        setPoints(loadedPoints);
      } catch (err) {
        console.error('[Kiyo] Failed to load coverage data', err);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  if (!hasValidKey) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-warning-200 bg-warning-50 px-4 text-center">
        <AlertTriangle className="mb-2 h-6 w-6 text-warning-500" />
        <p className="text-sm text-warning-700">Google Maps API key missing.</p>
      </div>
    );
  }

  return (
    <div className="kiyo-card overflow-hidden">
      <div className="border-b border-ink-100 bg-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-ember-500" />
          <h3 className="font-display text-sm font-bold text-ink-900">Delivery Diagnostics & Heatmap</h3>
        </div>
        <div className="flex bg-ink-100 p-0.5 rounded-lg">
          <button 
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${typeFilter === 'all' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
          >
            All Activity
          </button>
          <button 
            onClick={() => setTypeFilter('customer')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${typeFilter === 'customer' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
          >
            Destinations
          </button>
          <button 
            onClick={() => setTypeFilter('restaurant')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${typeFilter === 'restaurant' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
          >
            Restaurants
          </button>
        </div>
      </div>
      
      <div className="relative h-[400px] w-full bg-ink-50">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink-600">
              <Activity className="h-4 w-4 animate-spin" /> Analyzing location data...
            </span>
          </div>
        )}
        
        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            defaultCenter={{ lat: 36.7538, lng: 3.0588 }} // Algiers default
            defaultZoom={11}
            mapId="COVERAGE_MAP_ID"
            gestureHandling="greedy"
            disableDefaultUI
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          >
            <HeatmapLayerComponent points={points} typeFilter={typeFilter} />
          </Map>
        </APIProvider>
      </div>
      
      <div className="bg-ink-50 px-4 py-3 text-xs text-ink-500">
        Displaying {points.length} coordinate points. Use this heatmap to visualize common delivery destinations and popular pickup points, helping optimize delivery radius configuration for your restaurants.
      </div>
    </div>
  );
}
