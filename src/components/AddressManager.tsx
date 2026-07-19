import { useEffect, useState } from 'react';
import { MapPin, Home, Briefcase, Heart, Plus, Trash2, Check, X, Archive, Copy, Star, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { type TranslationKey } from '../lib/i18n';

import DeliveryMap, { type DeliveryMapLocation } from './DeliveryMap';
import { EMPTY_DELIVERY_DETAILS, type DeliveryDetails } from '../lib/location';
import { userFacingError } from '../lib/userFacingError';

type SavedAddress = {
  id: string;
  label: 'home' | 'work' | 'family' | 'other';
  address: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  place_id?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  commune?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  location_source?: string | null;
  location_confirmed?: boolean;
  is_default: boolean;
  is_favorite?: boolean;
  is_archived?: boolean;
  last_used_at?: string | null;
  custom_name?: string | null;
  landmark?: string | null;
  driver_instructions?: string | null;
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
  const { t, locale } = useT();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState<'home' | 'work' | 'family' | 'other'>('home');
  const [newLocation, setNewLocation] = useState<DeliveryMapLocation | null>(null);
  const [customName, setCustomName] = useState('');
  const [details, setDetails] = useState<DeliveryDetails>(EMPTY_DELIVERY_DETAILS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAddressId, setBusyAddressId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      void loadAddresses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAddresses = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('customer_id', user!.id)
        .or('is_archived.is.null,is_archived.eq.false')
        .order('is_default', { ascending: false })
        .order('is_favorite', { ascending: false })
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses((data as SavedAddress[]) ?? []);
    } catch (err) {
      console.error('Failed to load saved addresses', err);
      setActionError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setLoading(false);
    }
  };

  const saveAddress = async () => {
    if (!user) return;
    if (!newLocation?.confirmed) {
      setActionError(t('map.confirmRequired'));
      return;
    }

    setActionError(null);
    try {
      const payload = {
          customer_id: user.id,
          label: newLabel,
          custom_name: customName.trim() || null,
          address: newLocation.address,
          latitude: newLocation.lat,
          longitude: newLocation.lng,
          accuracy_m: newLocation.accuracy,
          place_id: newLocation.placeId,
          street: newLocation.addressParts?.street ?? null,
          neighborhood: newLocation.addressParts?.neighborhood ?? null,
          commune: newLocation.addressParts?.commune ?? null,
          city: newLocation.addressParts?.city ?? null,
          province: newLocation.addressParts?.province ?? null,
          postal_code: newLocation.addressParts?.postalCode ?? null,
          country: newLocation.addressParts?.country ?? 'Algeria',
          location_source: newLocation.source,
          location_confirmed: true,
          is_default: editingId ? addresses.find((item) => item.id === editingId)?.is_default ?? false : addresses.length === 0,
          landmark: details.landmark.trim() || null,
          driver_instructions: details.instructions.trim() || null,
          last_used_at: new Date().toISOString(),
        };
      const request = editingId
        ? supabase.from('saved_addresses').update(payload).eq('id', editingId).eq('customer_id', user.id)
        : supabase.from('saved_addresses').insert(payload);
      const { error } = await request;

      if (error) throw error;
      setShowAddForm(false);
      setNewLocation(null);
      setEditingId(null);
      setCustomName('');
      setDetails(EMPTY_DELIVERY_DETAILS);
      await loadAddresses();
    } catch (err) {
      console.error('Failed to save address', err);
      setActionError(userFacingError(err, locale, t('error.genericBody')));
    }
  };

  const editAddress = (address: SavedAddress) => {
    const nextDetails = {
      landmark: address.landmark ?? '',
      instructions: address.driver_instructions ?? '',
    };
    setEditingId(address.id);
    setNewLabel(address.label);
    setCustomName(address.custom_name ?? '');
    setDetails(nextDetails);
    setNewLocation({
      lat: address.latitude,
      lng: address.longitude,
      address: address.address,
      accuracy: address.accuracy_m ?? null,
      placeId: address.place_id ?? null,
      source: (address.location_source as DeliveryMapLocation['source']) ?? 'manual',
      confirmed: true,
      addressQuality: 'manual',
      requiresManualAdjustment: false,
      addressParts: {
        displayName: address.address,
        street: address.street ?? undefined,
        neighborhood: address.neighborhood ?? undefined,
        commune: address.commune ?? undefined,
        city: address.city ?? undefined,
        province: address.province ?? undefined,
        postalCode: address.postal_code ?? undefined,
        country: address.country ?? 'Algeria',
        placeId: address.place_id ?? undefined,
        provider: address.place_id ? 'google' : 'manual',
      },
      details: nextDetails,
    });
    setShowAddForm(true);
  };

  const setDefault = async (id: string) => {
    if (!user) return;

    setActionError(null);
    setBusyAddressId(id);
    try {
      const { error: clearError } = await supabase
        .from('saved_addresses')
        .update({ is_default: false })
        .eq('customer_id', user.id);
      if (clearError) throw clearError;

      const { error: defaultError } = await supabase
        .from('saved_addresses')
        .update({ is_default: true, last_used_at: new Date().toISOString() })
        .eq('id', id);
      if (defaultError) throw defaultError;

      await loadAddresses();
    } catch (err) {
      console.error('Failed to set default address', err);
      setActionError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setBusyAddressId(null);
    }
  };

  const toggleFavorite = async (addr: SavedAddress) => {
    setActionError(null);
    setBusyAddressId(addr.id);
    try {
      const { error } = await supabase
        .from('saved_addresses')
        .update({ is_favorite: !addr.is_favorite })
        .eq('id', addr.id);
      if (error) throw error;

      await loadAddresses();
    } catch (err) {
      console.error('Failed to update favorite address', err);
      setActionError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setBusyAddressId(null);
    }
  };

  const duplicateAddress = async (addr: SavedAddress) => {
    if (!user) return;
    setActionError(null);
    setBusyAddressId(addr.id);
    try {
      const { error } = await supabase
        .from('saved_addresses')
        .insert({
          customer_id: user.id,
          label: addr.label,
          address: addr.address,
          latitude: addr.latitude,
          longitude: addr.longitude,
          accuracy_m: addr.accuracy_m ?? null,
          place_id: addr.place_id ?? null,
          street: addr.street ?? null,
          neighborhood: addr.neighborhood ?? null,
          commune: addr.commune ?? null,
          city: addr.city ?? null,
          province: addr.province ?? null,
          postal_code: addr.postal_code ?? null,
          country: addr.country ?? 'Algeria',
          location_source: addr.location_source ?? 'manual',
          location_confirmed: addr.location_confirmed ?? true,
          landmark: addr.landmark ?? null,
          driver_instructions: addr.driver_instructions ?? null,
          is_default: false,
          is_favorite: false,
          last_used_at: null,
        });

      if (error) throw error;
      await loadAddresses();
    } catch (err) {
      console.error('Failed to duplicate address', err);
      setActionError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setBusyAddressId(null);
    }
  };

  const archiveAddress = async (id: string) => {
    setActionError(null);
    setBusyAddressId(id);
    try {
      const { error } = await supabase
        .from('saved_addresses')
        .update({ is_archived: true, is_default: false })
        .eq('id', id);
      if (error) throw error;

      await loadAddresses();
    } catch (err) {
      console.error('Failed to archive address', err);
      setActionError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setBusyAddressId(null);
    }
  };

  const deleteAddress = async (id: string) => {
    setActionError(null);
    setBusyAddressId(id);
    try {
      const { error } = await supabase
        .from('saved_addresses')
        .delete()
        .eq('id', id);
      if (error) throw error;

      await loadAddresses();
    } catch (err) {
      console.error('Failed to delete address', err);
      setActionError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setBusyAddressId(null);
    }
  };

  if (!user) {
    return (
      <div className="rounded-lg bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
        {t('profile.addresses.signinToManage')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink-900">{t('profile.addresses.title')}</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="kiyo-btn-secondary text-xs"
        >
          <Plus className="h-3 w-3" />
          {t('profile.addresses.addNew')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-ink-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {actionError && (
            <div className="rounded-lg bg-error-500/10 px-3 py-2 text-xs font-medium text-error-600">
              {actionError}
            </div>
          )}

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
                      {t(`profile.addresses.${addr.label}` as TranslationKey)}
                    </span>
                    {addr.is_default && (
                      <span className="rounded bg-ember-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {t('profile.addresses.default')}
                      </span>
                    )}
                    {addr.is_favorite && (
                      <span className="inline-flex items-center rounded bg-sage-100 px-1.5 py-0.5 text-[10px] font-semibold text-sage-700">
                        <Star className="h-3 w-3 fill-sage-500 text-sage-500" />
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-700">{addr.address}</p>
                  {addr.last_used_at && (
                    <p className="mt-1 text-[10px] font-medium text-ink-400">
                      {new Date(addr.last_used_at).toLocaleDateString(locale)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => editAddress(addr)}
                    disabled={busyAddressId === addr.id}
                    className="rounded p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                    title={t('common.edit')}
                    aria-label={t('common.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleFavorite(addr)}
                    disabled={busyAddressId === addr.id}
                    className="rounded p-1.5 text-ink-400 hover:bg-sage-50 hover:text-sage-600"
                    title={t('profile.addresses.favorite')}
                    aria-label={t('profile.addresses.favorite')}
                  >
                    <Star className={`h-4 w-4 ${addr.is_favorite ? 'fill-sage-500 text-sage-500' : ''}`} />
                  </button>
                  <button
                    onClick={() => duplicateAddress(addr)}
                    disabled={busyAddressId === addr.id}
                    className="rounded p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-600"
                    title={t('profile.addresses.duplicate')}
                    aria-label={t('profile.addresses.duplicate')}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {!addr.is_default && (
                    <button
                      onClick={() => setDefault(addr.id)}
                      disabled={busyAddressId === addr.id}
                      className="rounded p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-600"
                      title={t('profile.addresses.setAsDefault')}
                      aria-label={t('profile.addresses.setAsDefault')}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => archiveAddress(addr.id)}
                    disabled={busyAddressId === addr.id}
                    className="rounded p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-600"
                    title={t('profile.addresses.archive')}
                    aria-label={t('profile.addresses.archive')}
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteAddress(addr.id)}
                    disabled={busyAddressId === addr.id}
                    className="rounded p-1.5 text-ink-400 hover:bg-error-50 hover:text-error-600"
                    title={t('profile.addresses.delete')}
                    aria-label={t('profile.addresses.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {addresses.length === 0 && !showAddForm && (
            <div className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-500">
              {t('profile.addresses.none')}
            </div>
          )}
        </div>
      )}

      {showAddForm && (
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm font-medium text-ink-700">{t('profile.addresses.label')}:</span>
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
                  {t(`profile.addresses.${label}` as TranslationKey)}
                </button>
              );
            })}
          </div>

          <label className="mb-3 block">
            <span className="kiyo-label">{t('location.customLabel')}</span>
            <input className="kiyo-input h-11" value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={60} />
          </label>

          <DeliveryMap
            purpose="customer"
            initialLocation={newLocation}
            onLocationChange={(loc) => setNewLocation(loc)}
          />
          {newLocation && !newLocation.confirmed && (
            <p className="mt-2 rounded-lg bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-700">
              {t('map.confirmRequired')}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <AddressDetail label={t('location.landmark')} value={details.landmark} onChange={(landmark) => setDetails((current) => ({ ...current, landmark }))} className="sm:col-span-2" />
            <AddressDetail label={t('location.instructions')} value={details.instructions} onChange={(instructions) => setDetails((current) => ({ ...current, instructions }))} className="sm:col-span-2" />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewLocation(null);
                setEditingId(null);
                setCustomName('');
                setDetails(EMPTY_DELIVERY_DETAILS);
              }}
              className="kiyo-btn-ghost text-xs"
            >
              <X className="h-3 w-3" />
              {t('common.cancel')}
            </button>
            <button
              onClick={saveAddress}
              disabled={!newLocation?.confirmed}
              className="kiyo-btn-primary text-xs"
            >
              <Check className="h-3 w-3" />
              {t('profile.addresses.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddressDetail({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={className}>
      <span className="kiyo-label">{label}</span>
      <input className="kiyo-input h-11" value={value} onChange={(event) => onChange(event.target.value)} maxLength={240} />
    </label>
  );
}
