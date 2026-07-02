import { useEffect, useState } from 'react';
import { MapPin, Home, Briefcase, Heart, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import DeliveryMap from './DeliveryMap';

type SavedAddress = {
  id: string;
  label: 'home' | 'work' | 'family' | 'other';
  address: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
  created_at: string;
};

const LABEL_ICONS = {
  home: Home,
  work: Briefcase,
  family: Heart,
  other: MapPin,
};

const LABEL_COLORS = {
  home: 'text-sage-600 bg-sage-50',
  work: 'text-blue-600 bg-blue-50',
  family: 'text-ember-600 bg-ember-50',
  other: 'text-ink-600 bg-ink-100',
};

export function AddressManager() {
  const { t } = useT();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState<'home' | 'work' | 'family' | 'other'>('home');
  const [newLocation, setNewLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      void loadAddresses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('customer_id', user!.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses((data as SavedAddress[]) ?? []);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  };

  const addAddress = async () => {
    if (!newLocation || !user) return;

    try {
      const { error } = await supabase
        .from('saved_addresses')
        .insert({
          customer_id: user.id,
          label: newLabel,
          address: newLocation.address,
          latitude: newLocation.lat,
          longitude: newLocation.lng,
          is_default: addresses.length === 0,
        });

      if (error) throw error;
      setShowAddForm(false);
      setNewLocation(null);
      await loadAddresses();
    } catch {
      // Non-fatal
    }
  };

  const setDefault = async (id: string) => {
    if (!user) return;

    try {
      // Clear default from all, then set the new one
      await supabase
        .from('saved_addresses')
        .update({ is_default: false })
        .eq('customer_id', user.id);

      await supabase
        .from('saved_addresses')
        .update({ is_default: true })
        .eq('id', id);

      await loadAddresses();
    } catch {
      // Non-fatal
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      await supabase
        .from('saved_addresses')
        .delete()
        .eq('id', id);

      await loadAddresses();
    } catch {
      // Non-fatal
    }
  };

  if (!user) {
    return (
      <div className="rounded-lg bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
        Sign in to manage your saved addresses.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink-900">Saved Addresses</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="kiyo-btn-secondary text-xs"
        >
          <Plus className="h-3 w-3" />
          Add New
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-ink-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {addresses.map((addr) => {
            const Icon = LABEL_ICONS[addr.label];
            const colorClass = LABEL_COLORS[addr.label];

            return (
              <div
                key={addr.id}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  addr.is_default ? 'border-ember-500 bg-ember-50/50' : 'border-ink-100 bg-white hover:border-ink-200'
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {addr.label}
                    </span>
                    {addr.is_default && (
                      <span className="rounded bg-ember-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-700">{addr.address}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!addr.is_default && (
                    <button
                      onClick={() => setDefault(addr.id)}
                      className="rounded p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-600"
                      title="Set as default"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteAddress(addr.id)}
                    className="rounded p-1.5 text-ink-400 hover:bg-error-50 hover:text-error-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {addresses.length === 0 && !showAddForm && (
            <div className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
              No saved addresses yet. Add your home, work, or favorite delivery spots.
            </div>
          )}
        </div>
      )}

      {showAddForm && (
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm font-medium text-ink-700">Label:</span>
            {(['home', 'work', 'family', 'other'] as const).map((label) => {
              const Icon = LABEL_ICONS[label];
              const isActive = newLabel === label;
              return (
                <button
                  key={label}
                  onClick={() => setNewLabel(label)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-ink-900 text-white'
                      : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </button>
              );
            })}
          </div>

          <DeliveryMap
            onLocationChange={(loc) => setNewLocation(loc)}
          />

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewLocation(null);
              }}
              className="kiyo-btn-ghost text-xs"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              onClick={addAddress}
              disabled={!newLocation}
              className="kiyo-btn-primary text-xs"
            >
              <Check className="h-3 w-3" />
              Save Address
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
