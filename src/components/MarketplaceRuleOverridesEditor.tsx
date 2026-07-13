import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, RefreshCw, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import { Spinner } from './feedback';

type ScopeType = 'wilaya' | 'restaurant';
type RuleValues = Record<string, Record<string, number>>;

type OverrideRow = {
  id: string;
  scope_type: ScopeType;
  scope_id: string;
  version: number;
  status: 'active' | 'scheduled';
  values: RuleValues;
  effective_at: string;
  reason: string | null;
};

type WilayaOption = { id: number; code: string; name_en: string; name_fr: string; name_ar: string };
type RestaurantOption = { id: string; name: string; wilaya_id: number | null; status: string };

type FieldDefinition = {
  group: 'delivery' | 'commission' | 'taxes_fees';
  key: string;
  label: Record<'en' | 'fr' | 'ar', string>;
  globalKey: string;
  suffix: string;
  min: number;
  max?: number;
  step: number;
};

const FIELDS: FieldDefinition[] = [
  { group: 'delivery', key: 'price_per_km', globalKey: 'price_per_km', suffix: 'DZD/km', min: 0, step: 1, label: { en: 'Price per kilometre', fr: 'Prix par kilomètre', ar: 'السعر لكل كيلومتر' } },
  { group: 'delivery', key: 'min_fee', globalKey: 'min_fee', suffix: 'DZD', min: 0, step: 1, label: { en: 'Minimum delivery fee', fr: 'Frais de livraison minimum', ar: 'الحد الأدنى لرسوم التوصيل' } },
  { group: 'delivery', key: 'max_fee', globalKey: 'max_fee', suffix: 'DZD', min: 0, step: 1, label: { en: 'Maximum delivery fee', fr: 'Frais de livraison maximum', ar: 'الحد الأقصى لرسوم التوصيل' } },
  { group: 'delivery', key: 'free_delivery_threshold', globalKey: 'free_delivery_threshold', suffix: 'DZD', min: 0, step: 1, label: { en: 'Free-delivery threshold', fr: 'Seuil de livraison gratuite', ar: 'حد التوصيل المجاني' } },
  { group: 'delivery', key: 'max_delivery_km', globalKey: 'default_max_delivery_km', suffix: 'km', min: 0.1, max: 100, step: 0.1, label: { en: 'Maximum delivery distance', fr: 'Distance maximale de livraison', ar: 'أقصى مسافة للتوصيل' } },
  { group: 'delivery', key: 'minimum_order', globalKey: 'minimum_order', suffix: 'DZD', min: 0, step: 1, label: { en: 'Minimum order', fr: 'Commande minimum', ar: 'الحد الأدنى للطلب' } },
  { group: 'commission', key: 'service_fee_rate', globalKey: 'service_fee_rate', suffix: '%', min: 0, max: 100, step: 0.1, label: { en: 'Customer service fee', fr: 'Frais de service client', ar: 'رسوم خدمة العميل' } },
  { group: 'taxes_fees', key: 'vat_rate', globalKey: 'vat_rate', suffix: '%', min: 0, max: 100, step: 0.1, label: { en: 'VAT rate', fr: 'Taux de TVA', ar: 'نسبة ضريبة القيمة المضافة' } },
];

const COPY = {
  en: { title: 'Wilaya and restaurant overrides', subtitle: 'Restaurant override → Wilaya rule → global default', wilaya: 'Wilaya', restaurant: 'Restaurant', choose: 'Choose a scope', inherited: 'Inherited', overridden: 'Overridden', global: 'Global default', wilayaSource: 'Wilaya rule', version: 'Version', active: 'Active now', scheduled: 'Scheduled', reason: 'Reason for this change', reasonPlaceholder: 'Required for the audit history', effective: 'Effective date (optional)', save: 'Save override', remove: 'Remove override', refresh: 'Refresh', empty: 'Select at least one value to override.', reasonRequired: 'Enter a clear reason for this change.', saved: 'Override saved.', removed: 'Override removed; inherited values are active again.', stale: 'This rule changed in another session. Refresh it before trying again.', terms: 'Food commission is governed separately by the approved commercial agreement.' },
  fr: { title: 'Exceptions par Wilaya et restaurant', subtitle: 'Exception restaurant → règle Wilaya → valeur globale', wilaya: 'Wilaya', restaurant: 'Restaurant', choose: 'Choisir une portée', inherited: 'Héritée', overridden: 'Remplacée', global: 'Valeur globale', wilayaSource: 'Règle Wilaya', version: 'Version', active: 'Active maintenant', scheduled: 'Planifiée', reason: 'Motif de cette modification', reasonPlaceholder: "Obligatoire pour l’historique d’audit", effective: 'Date d’effet (facultative)', save: 'Enregistrer l’exception', remove: 'Supprimer l’exception', refresh: 'Actualiser', empty: 'Sélectionnez au moins une valeur à remplacer.', reasonRequired: 'Saisissez un motif clair pour cette modification.', saved: 'Exception enregistrée.', removed: 'Exception supprimée ; les valeurs héritées sont de nouveau actives.', stale: 'Cette règle a été modifiée dans une autre session. Actualisez-la avant de réessayer.', terms: 'La commission sur les plats est gérée séparément par l’accord commercial approuvé.' },
  ar: { title: 'استثناءات الولاية والمطعم', subtitle: 'استثناء المطعم ← قاعدة الولاية ← الإعداد العام', wilaya: 'الولاية', restaurant: 'المطعم', choose: 'اختر النطاق', inherited: 'موروثة', overridden: 'مستبدلة', global: 'الإعداد العام', wilayaSource: 'قاعدة الولاية', version: 'الإصدار', active: 'نشطة الآن', scheduled: 'مجدولة', reason: 'سبب هذا التغيير', reasonPlaceholder: 'مطلوب لسجل التدقيق', effective: 'تاريخ السريان (اختياري)', save: 'حفظ الاستثناء', remove: 'حذف الاستثناء', refresh: 'تحديث', empty: 'اختر قيمة واحدة على الأقل لاستبدالها.', reasonRequired: 'اكتب سبباً واضحاً لهذا التغيير.', saved: 'تم حفظ الاستثناء.', removed: 'تم حذف الاستثناء وعادت القيم الموروثة.', stale: 'تم تعديل هذه القاعدة في جلسة أخرى. حدّث البيانات قبل المحاولة مجدداً.', terms: 'تُدار عمولة الطعام بشكل منفصل من خلال الاتفاق التجاري المعتمد.' },
};

const cloneValues = (value?: RuleValues | null): RuleValues => JSON.parse(JSON.stringify(value ?? {})) as RuleValues;

export function MarketplaceRuleOverridesEditor({ globalSettings }: { globalSettings: Record<string, Record<string, unknown>> }) {
  const { locale } = useT();
  const text = COPY[locale];
  const [scopeType, setScopeType] = useState<ScopeType>('wilaya');
  const [scopeId, setScopeId] = useState('');
  const [wilayas, setWilayas] = useState<WilayaOption[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [draft, setDraft] = useState<RuleValues>({});
  const [reason, setReason] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [wilayaResult, restaurantResult, overrideResult] = await Promise.all([
      supabase.from('wilayas').select('id,code,name_en,name_fr,name_ar').eq('is_active', true).order('code'),
      supabase.from('restaurants').select('id,name,wilaya_id,status').order('name'),
      supabase.from('marketplace_rule_overrides').select('id,scope_type,scope_id,version,status,values,effective_at,reason').in('status', ['active', 'scheduled']).order('version', { ascending: false }),
    ]);
    const failure = wilayaResult.error ?? restaurantResult.error ?? overrideResult.error;
    if (failure) {
      setError(failure.message);
    } else {
      setWilayas((wilayaResult.data ?? []) as WilayaOption[]);
      setRestaurants((restaurantResult.data ?? []) as RestaurantOption[]);
      setOverrides((overrideResult.data ?? []) as OverrideRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const options = scopeType === 'wilaya' ? wilayas : restaurants;
  useEffect(() => {
    if (!options.some((option) => String(option.id) === scopeId)) {
      setScopeId(options[0] ? String(options[0].id) : '');
    }
  }, [options, scopeId]);

  const current = useMemo(
    () => overrides.find((row) => row.scope_type === scopeType && row.scope_id === scopeId) ?? null,
    [overrides, scopeId, scopeType],
  );

  useEffect(() => {
    setDraft(cloneValues(current?.values));
    setReason('');
    setEffectiveAt(current?.status === 'scheduled' ? current.effective_at.slice(0, 16) : '');
    setError(null);
  }, [current, scopeId, scopeType]);

  const selectedRestaurant = scopeType === 'restaurant'
    ? restaurants.find((restaurant) => restaurant.id === scopeId)
    : undefined;
  const wilayaOverride = selectedRestaurant?.wilaya_id == null
    ? null
    : overrides.find((row) => row.scope_type === 'wilaya' && row.scope_id === String(selectedRestaurant.wilaya_id)) ?? null;

  const inheritedValue = (field: FieldDefinition) => {
    const wilayaValue = wilayaOverride?.values?.[field.group]?.[field.key];
    const globalRaw = globalSettings[field.group]?.[field.globalKey];
    const globalValue = typeof globalRaw === 'number' ? globalRaw : 0;
    const value = scopeType === 'restaurant' && typeof wilayaValue === 'number' ? wilayaValue : globalValue;
    return field.group === 'commission' && field.key.endsWith('_rate') ? value * 100 : value;
  };

  const overrideValue = (field: FieldDefinition) => {
    const value = draft[field.group]?.[field.key];
    if (typeof value !== 'number') return inheritedValue(field);
    return field.group === 'commission' && field.key.endsWith('_rate') ? value * 100 : value;
  };

  const hasOverride = (field: FieldDefinition) => typeof draft[field.group]?.[field.key] === 'number';

  const toggleField = (field: FieldDefinition, enabled: boolean) => {
    setDraft((previous) => {
      const next = cloneValues(previous);
      if (enabled) {
        next[field.group] = { ...(next[field.group] ?? {}), [field.key]: field.group === 'commission' && field.key.endsWith('_rate') ? inheritedValue(field) / 100 : inheritedValue(field) };
      } else if (next[field.group]) {
        delete next[field.group][field.key];
        if (Object.keys(next[field.group]).length === 0) delete next[field.group];
      }
      return next;
    });
  };

  const changeField = (field: FieldDefinition, displayValue: number) => {
    const stored = field.group === 'commission' && field.key.endsWith('_rate') ? displayValue / 100 : displayValue;
    setDraft((previous) => ({ ...previous, [field.group]: { ...(previous[field.group] ?? {}), [field.key]: stored } }));
  };

  const validate = () => {
    if (!scopeId || Object.keys(draft).length === 0) return text.empty;
    if (reason.trim().length < 3) return text.reasonRequired;
    for (const field of FIELDS) {
      if (!hasOverride(field)) continue;
      const value = overrideValue(field);
      if (!Number.isFinite(value) || value < field.min || (field.max != null && value > field.max)) return `${field.label[locale]}: ${field.min}–${field.max ?? '∞'}`;
    }
    const minFee = Number(draft.delivery?.min_fee ?? inheritedValue(FIELDS[1]));
    const maxFee = Number(draft.delivery?.max_fee ?? inheritedValue(FIELDS[2]));
    if (maxFee > 0 && maxFee < minFee) return locale === 'ar' ? 'يجب أن تكون الرسوم القصوى أكبر من الرسوم الدنيا.' : locale === 'fr' ? 'Les frais maximum doivent être supérieurs aux frais minimum.' : 'Maximum fee must be greater than minimum fee.';
    return null;
  };

  const save = async () => {
    const validationError = validate();
    if (validationError) return setError(validationError);
    setSaving(true);
    setError(null);
    setMessage(null);
    const { error: saveError } = await supabase.rpc('set_marketplace_rule_override', {
      p_scope_type: scopeType,
      p_scope_id: scopeId,
      p_values: draft,
      p_effective_at: effectiveAt ? new Date(effectiveAt).toISOString() : new Date().toISOString(),
      p_reason: reason.trim(),
      p_expected_version: current?.version ?? null,
    });
    if (saveError) setError(saveError.code === '40001' ? text.stale : saveError.message);
    else {
      await load();
      setMessage(text.saved);
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!current || reason.trim().length < 3) return setError(text.reasonRequired);
    setSaving(true);
    setError(null);
    const { error: removeError } = await supabase.rpc('remove_marketplace_rule_override', {
      p_scope_type: scopeType,
      p_scope_id: scopeId,
      p_expected_version: current.version,
      p_reason: reason.trim(),
    });
    if (removeError) setError(removeError.code === '40001' ? text.stale : removeError.message);
    else {
      await load();
      setMessage(text.removed);
    }
    setSaving(false);
  };

  const optionLabel = (option: WilayaOption | RestaurantOption) => {
    if ('code' in option) return `${option.code} · ${locale === 'ar' ? option.name_ar : locale === 'fr' ? option.name_fr : option.name_en}`;
    return `${option.name} · ${option.status}`;
  };

  return (
    <section className="kiyo-card p-5" aria-labelledby="marketplace-overrides-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ember-50 text-ember-600"><SlidersHorizontal className="h-4 w-4" /></span>
          <div><h3 id="marketplace-overrides-title" className="font-display text-base font-bold text-ink-900">{text.title}</h3><p className="mt-1 text-xs text-ink-500">{text.subtitle}</p></div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || saving} className="kiyo-btn-secondary min-h-11 text-xs"><RefreshCw className="h-4 w-4" />{text.refresh}</button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="inline-flex h-11 rounded-lg border border-ink-100 bg-ink-50 p-1">
          {(['wilaya', 'restaurant'] as ScopeType[]).map((type) => <button key={type} type="button" onClick={() => { setMessage(null); setScopeType(type); }} className={`min-h-9 rounded-md px-4 text-sm font-semibold ${scopeType === type ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}>{type === 'wilaya' ? text.wilaya : text.restaurant}</button>)}
        </div>
        <label><span className="sr-only">{text.choose}</span><select className="kiyo-input min-h-11 w-full" value={scopeId} onChange={(event) => { setMessage(null); setScopeId(event.target.value); }} disabled={loading}>{options.length === 0 && <option value="">{text.choose}</option>}{options.map((option) => <option key={option.id} value={String(option.id)}>{optionLabel(option)}</option>)}</select></label>
      </div>

      {current && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-sage-50 px-2.5 py-1 font-semibold text-sage-700">{current.status === 'active' ? text.active : text.scheduled}</span><span className="text-ink-500">{text.version} {current.version}</span><span className="text-ink-400">{new Date(current.effective_at).toLocaleString(locale === 'ar' ? 'ar-DZ' : locale === 'fr' ? 'fr-DZ' : 'en-DZ')}</span></div>}

      <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{text.terms}</p>
      {loading ? <div className="flex min-h-40 items-center justify-center"><Spinner /></div> : (
        <div className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-100">
          {FIELDS.map((field) => {
            const enabled = hasOverride(field);
            const source = scopeType === 'restaurant' && wilayaOverride?.values?.[field.group]?.[field.key] != null ? text.wilayaSource : text.global;
            return <div key={`${field.group}.${field.key}`} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)] sm:items-center">
              <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={enabled} onChange={(event) => toggleField(field, event.target.checked)} className="h-5 w-5 accent-ember-500" /><span><span className="block text-sm font-semibold text-ink-800">{field.label[locale]}</span><span className="block text-xs text-ink-400">{enabled ? text.overridden : `${text.inherited} · ${source}: ${inheritedValue(field)} ${field.suffix}`}</span></span></label>
              <div className="relative"><input aria-label={field.label[locale]} type="number" min={field.min} max={field.max} step={field.step} disabled={!enabled} value={overrideValue(field)} onChange={(event) => changeField(field, Number(event.target.value))} className="kiyo-input min-h-11 w-full pe-16 disabled:bg-ink-50 disabled:text-ink-400" /><span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-ink-400">{field.suffix}</span></div>
            </div>;
          })}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label><span className="kiyo-label">{text.reason}</span><input className="kiyo-input min-h-11 w-full" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={text.reasonPlaceholder} /></label>
        <label><span className="kiyo-label">{text.effective}</span><div className="relative"><Clock className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-ink-400" /><input type="datetime-local" className="kiyo-input min-h-11 w-full ps-10" value={effectiveAt} onChange={(event) => setEffectiveAt(event.target.value)} /></div></label>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>}
      {message && <p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-sage-50 px-3 py-2 text-sm text-sage-700"><CheckCircle className="h-4 w-4" />{message}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {current && <button type="button" onClick={() => void remove()} disabled={saving} className="kiyo-btn-secondary min-h-11 text-xs"><RotateCcw className="h-4 w-4" />{text.remove}</button>}
        <button type="button" onClick={() => void save()} disabled={saving || loading || !scopeId} className="kiyo-btn-primary min-h-11 text-xs">{saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}{text.save}</button>
      </div>
    </section>
  );
}
