import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Pencil, ChevronLeft, Utensils, X, Power, ImagePlus, SlidersHorizontal } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import {
  supabase,
  type Restaurant,
  type MenuItem,
  type MenuCategory,
  type MenuItemModifier,
  type ModifierOption,
} from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import { PriceTag, RestaurantImage } from '../components/ui';
import { Field } from '../components/Field';
import { userFacingError } from '../lib/userFacingError';
import { useActionDialog } from '../context/ActionDialogContext';
import { uploadRestaurantImage, validateRestaurantImage } from '../lib/restaurantMedia';

const menuCopy = {
  en: {
    uploadImage: 'Upload dish photo',
    imageHelp: 'JPG, PNG or WebP, up to 5 MB. Use a clear photo of the actual dish.',
    invalidImageType: 'Choose a JPG, PNG or WebP image.',
    invalidImageSize: 'The image must be 5 MB or smaller.',
    invalidImageUrl: 'Use a valid HTTPS image URL.',
  },
  fr: {
    uploadImage: 'Importer la photo du plat',
    imageHelp: 'JPG, PNG ou WebP, 5 Mo maximum. Utilisez une photo nette du plat réel.',
    invalidImageType: 'Choisissez une image JPG, PNG ou WebP.',
    invalidImageSize: "L'image ne doit pas dépasser 5 Mo.",
    invalidImageUrl: "Utilisez une URL d'image HTTPS valide.",
  },
  ar: {
    uploadImage: 'رفع صورة الطبق',
    imageHelp: 'صورة JPG أو PNG أو WebP بحجم أقصى 5 ميغابايت. استخدم صورة واضحة للطبق الحقيقي.',
    invalidImageType: 'اختر صورة بصيغة JPG أو PNG أو WebP.',
    invalidImageSize: 'يجب ألا يتجاوز حجم الصورة 5 ميغابايت.',
    invalidImageUrl: 'استخدم رابط صورة HTTPS صالحاً.',
  },
} as const;

const modifierCopy = {
  en: {
    options: 'Options & add-ons',
    optionsHelp: 'Create required choices, sizes, extras, and add-ons. Prices are verified again by Kiyo Food when an order is placed.',
    addGroup: 'Add choice group',
    groupName: 'Group name',
    groupExample: 'Example: Size',
    required: 'Required',
    multiple: 'Allow several choices',
    addOption: 'Add option',
    optionName: 'Option name',
    priceExtra: 'Extra price',
    defaultOption: 'Default',
    paused: 'Paused',
    noOptions: 'No choices configured for this dish yet.',
    deleteGroup: 'Delete this choice group and all its options?',
    deleteOption: 'Delete this option?',
  },
  fr: {
    options: 'Options et suppléments',
    optionsHelp: 'Créez des choix obligatoires, tailles et suppléments. Kiyo Food revérifie les prix au moment de la commande.',
    addGroup: 'Ajouter un groupe',
    groupName: 'Nom du groupe',
    groupExample: 'Exemple : Taille',
    required: 'Obligatoire',
    multiple: 'Autoriser plusieurs choix',
    addOption: 'Ajouter une option',
    optionName: "Nom de l'option",
    priceExtra: 'Supplément',
    defaultOption: 'Par défaut',
    paused: 'En pause',
    noOptions: "Aucun choix n'est encore configuré pour ce plat.",
    deleteGroup: 'Supprimer ce groupe et toutes ses options ?',
    deleteOption: 'Supprimer cette option ?',
  },
  ar: {
    options: 'الخيارات والإضافات',
    optionsHelp: 'أنشئ اختيارات إلزامية وأحجاما وإضافات. تعيد كيو فود التحقق من الأسعار عند إنشاء الطلب.',
    addGroup: 'إضافة مجموعة خيارات',
    groupName: 'اسم المجموعة',
    groupExample: 'مثال: الحجم',
    required: 'إلزامي',
    multiple: 'السماح بعدة اختيارات',
    addOption: 'إضافة خيار',
    optionName: 'اسم الخيار',
    priceExtra: 'السعر الإضافي',
    defaultOption: 'افتراضي',
    paused: 'متوقف',
    noOptions: 'لم تتم إضافة خيارات لهذا الطبق بعد.',
    deleteGroup: 'حذف هذه المجموعة وكل خياراتها؟',
    deleteOption: 'حذف هذا الخيار؟',
  },
} as const;

export default function RestaurantMenuPage() {
  const { t, locale } = useT();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { confirmAction } = useActionDialog();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [optionsItem, setOptionsItem] = useState<MenuItem | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data: managedRestaurantId, error: managedRestaurantError } = await supabase.rpc('get_user_restaurant_id');
      if (managedRestaurantError) throw managedRestaurantError;
      const { data: r, error: re } = managedRestaurantId
        ? await supabase.from('restaurants').select('*').eq('id', managedRestaurantId).maybeSingle()
        : { data: null, error: null };
      if (re) throw re;
      
      if (!r) {
        setError(t('restaurant.notAssigned'));
        return;
      }

      const activeRes = r as Restaurant;
      setRestaurant(activeRes);
      
      const [c, m] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', activeRes.id).order('position'),
        supabase.from('menu_items').select('*').eq('restaurant_id', activeRes.id).order('position'),
      ]);
      setCategories((c.data as MenuCategory[]) ?? []);
      setItems((m.data as MenuItem[]) ?? []);
    } catch (err: unknown) {
      console.error(err);
      setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setLoading(false);
    }
  }, [locale, profile, t]);

  useEffect(() => { void load(); }, [load]);

  const toggleAvailability = async (item: MenuItem) => {
    // Optimistic update; rollback on error.
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i)),
    );
    const { error: e } = await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id);
    if (e) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: item.is_available } : i)),
      );
      console.error(e);
      setError(t('error.genericBody'));
    }
  };

  const deleteItem = async (item: MenuItem) => {
    if (!await confirmAction({
      title: t('restaurant.delete'),
      message: t('restaurant.deleteItemConfirm').replace('{name}', item.name),
      confirmLabel: t('restaurant.delete'),
      tone: 'danger',
    })) return;

    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error: e } = await supabase.from('menu_items').delete().eq('id', item.id);
    if (e) {
      setItems(previous);
      console.error(e);
      setError(userFacingError(e, locale, t('error.genericBody')));
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
          title={t('error.genericTitle')} message={error ?? t('error.genericBody')}
          onRetry={load} retryLabel={t('error.retry')}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <button
        onClick={() => navigate('/restaurant')}
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('restaurant.dashboard')}
      </button>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
            {t('restaurant.manageMenu')}
          </h1>
          <p className="text-xs text-ink-400">{restaurant.name}</p>
        </div>
        <button
          onClick={() => { setEditingItem(null); setShowItemForm(true); }}
          className="kiyo-btn-primary"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('restaurant.addItem')}</span>
        </button>
      </div>

      <ErrorBoundary variant="inline">
        {categories.length === 0 && items.length === 0 ? (
          <div className="kiyo-card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Utensils className="h-8 w-8 text-ink-300" />
            <p className="text-sm text-ink-500">{t('restaurant.noMenu')}</p>
            <button
              onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              className="kiyo-btn-primary"
            >
              <Plus className="h-4 w-4" />
              {t('restaurant.addItem')}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Items without category first */}
            {items.filter((i) => !i.category_id).length > 0 && (
              <ItemGroup
                items={items.filter((i) => !i.category_id)}
                onToggle={toggleAvailability}
                onEdit={(it) => { setEditingItem(it); setShowItemForm(true); }}
                onDelete={deleteItem}
                onOptions={setOptionsItem}
              />
            )}
            {categories.map((cat) => (
              <div key={cat.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-ink-900">{cat.name}</h2>
                  <button
                    onClick={async () => {
                      if (!await confirmAction({
                        title: t('restaurant.delete'),
                        message: t('restaurant.deleteCategoryConfirm').replace('{name}', cat.name),
                        confirmLabel: t('restaurant.delete'),
                        tone: 'danger',
                      })) return;
                      const { error: e } = await supabase.from('menu_categories').delete().eq('id', cat.id);
                      if (e) {
                        console.error(e);
                        setError(userFacingError(e, locale, t('error.genericBody')));
                        return;
                      }
                      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
                    }}
                    className="text-ink-400 hover:text-error-600"
                    aria-label={t('restaurant.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <ItemGroup
                  items={items.filter((i) => i.category_id === cat.id)}
                  onToggle={toggleAvailability}
                  onEdit={(it) => { setEditingItem(it); setShowItemForm(true); }}
                  onDelete={deleteItem}
                  onOptions={setOptionsItem}
                />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowCategoryForm(true)}
          className="kiyo-btn-ghost mt-5"
        >
          <Plus className="h-4 w-4" />
          {t('restaurant.addCategory')}
        </button>
      </ErrorBoundary>

      {showItemForm && restaurant && (
        <ItemFormModal
          restaurantId={restaurant.id}
          uploaderId={profile?.id ?? restaurant.owner_id}
          categories={categories}
          item={editingItem}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }}
          onSaved={() => { setShowItemForm(false); setEditingItem(null); void load(); }}
        />
      )}

      {showCategoryForm && restaurant && (
        <CategoryFormModal
          restaurantId={restaurant.id}
          onClose={() => setShowCategoryForm(false)}
          onSaved={() => { setShowCategoryForm(false); void load(); }}
        />
      )}
      {optionsItem && (
        <ModifierManagerModal item={optionsItem} onClose={() => setOptionsItem(null)} />
      )}
    </AppShell>
  );
}

function ItemGroup({ items, onToggle, onEdit, onDelete, onOptions }: {
  items: MenuItem[];
  onToggle: (i: MenuItem) => void;
  onEdit: (i: MenuItem) => void;
  onDelete: (i: MenuItem) => void;
  onOptions: (i: MenuItem) => void;
}) {
  const { t, locale } = useT();
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="kiyo-card flex items-center gap-3 p-3">
          {item.image_url && (
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-ink-50">
              <RestaurantImage url={item.image_url} name={item.name} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-ink-900">{item.name}</h3>
              <PriceTag value={item.price} />
            </div>
            {item.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">{item.description}</p>
            )}
          </div>
          <button
            onClick={() => onToggle(item)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
              item.is_available
                ? 'bg-sage-100 text-sage-600 hover:bg-sage-200'
                : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
            }`}
            aria-label={item.is_available ? t('restaurant.outOfStock') : t('restaurant.available')}
          >
            <Power className="h-3 w-3" />
            {item.is_available ? t('restaurant.available') : t('restaurant.hidden')}
          </button>
          <button
            onClick={() => onOptions(item)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
            aria-label={modifierCopy[locale].options}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            onClick={() => onEdit(item)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
            aria-label={t('common.edit')}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-400 hover:bg-error-500/10 hover:text-error-600"
            aria-label={t('restaurant.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-card-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
          <button onClick={onClose} className="kiyo-btn-ghost p-2"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModifierManagerModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { t, locale } = useT();
  const copy = modifierCopy[locale];
  const { confirmAction } = useActionDialog();
  const [groups, setGroups] = useState<MenuItemModifier[]>([]);
  const [options, setOptions] = useState<ModifierOption[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupMultiple, setGroupMultiple] = useState(false);
  const [optionDrafts, setOptionDrafts] = useState<Record<string, { name: string; price: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const groupResult = await supabase
      .from('menu_item_modifiers')
      .select('*')
      .eq('menu_item_id', item.id)
      .order('position');
    if (groupResult.error) {
      setError(userFacingError(groupResult.error, locale, t('error.genericBody')));
      setLoading(false);
      return;
    }
    const loadedGroups = (groupResult.data as MenuItemModifier[]) ?? [];
    const ids = loadedGroups.map((group) => group.id);
    const optionResult = ids.length > 0
      ? await supabase.from('modifier_options').select('*').in('modifier_id', ids).order('position')
      : { data: [], error: null };
    if (optionResult.error) {
      setError(userFacingError(optionResult.error, locale, t('error.genericBody')));
      setLoading(false);
      return;
    }
    setGroups(loadedGroups);
    setOptions((optionResult.data as ModifierOption[]) ?? []);
    setLoading(false);
  }, [item.id, locale, t]);

  useEffect(() => { void load(); }, [load]);

  const addGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || groupName.trim().length < 2) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.from('menu_item_modifiers').insert({
      menu_item_id: item.id,
      name: groupName.trim(),
      is_required: groupRequired,
      is_multiple: groupMultiple,
      min_select: groupRequired ? 1 : 0,
      max_select: groupMultiple ? null : 1,
      position: groups.length,
      is_active: true,
    });
    setSaving(false);
    if (saveError) {
      setError(userFacingError(saveError, locale, t('error.genericBody')));
      return;
    }
    setGroupName('');
    setGroupRequired(false);
    setGroupMultiple(false);
    await load();
  };

  const updateGroup = async (group: MenuItemModifier, patch: Partial<MenuItemModifier>) => {
    setError(null);
    setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, ...patch } : entry));
    const { error: updateError } = await supabase
      .from('menu_item_modifiers')
      .update(patch)
      .eq('id', group.id);
    if (updateError) {
      setError(userFacingError(updateError, locale, t('error.genericBody')));
      await load();
    }
  };

  const removeGroup = async (group: MenuItemModifier) => {
    if (!await confirmAction({
      title: copy.options,
      message: copy.deleteGroup,
      confirmLabel: t('restaurant.delete'),
      tone: 'danger',
    })) return;
    const { error: deleteError } = await supabase.from('menu_item_modifiers').delete().eq('id', group.id);
    if (deleteError) {
      setError(userFacingError(deleteError, locale, t('error.genericBody')));
      return;
    }
    await load();
  };

  const addOption = async (group: MenuItemModifier) => {
    const draft = optionDrafts[group.id] ?? { name: '', price: '0' };
    const price = Number(draft.price);
    if (draft.name.trim().length < 1 || !Number.isFinite(price) || price < 0) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.from('modifier_options').insert({
      modifier_id: group.id,
      name: draft.name.trim(),
      price_adjustion: price,
      is_default: false,
      is_available: true,
      position: options.filter((option) => option.modifier_id === group.id).length,
    });
    setSaving(false);
    if (saveError) {
      setError(userFacingError(saveError, locale, t('error.genericBody')));
      return;
    }
    setOptionDrafts((current) => ({ ...current, [group.id]: { name: '', price: '0' } }));
    await load();
  };

  const updateOption = async (option: ModifierOption, patch: Partial<ModifierOption>) => {
    setError(null);
    if (patch.is_default) {
      const { error: resetError } = await supabase
        .from('modifier_options')
        .update({ is_default: false })
        .eq('modifier_id', option.modifier_id);
      if (resetError) {
        setError(userFacingError(resetError, locale, t('error.genericBody')));
        return;
      }
    }
    const { error: updateError } = await supabase.from('modifier_options').update(patch).eq('id', option.id);
    if (updateError) {
      setError(userFacingError(updateError, locale, t('error.genericBody')));
    }
    await load();
  };

  const removeOption = async (option: ModifierOption) => {
    if (!await confirmAction({
      title: copy.options,
      message: copy.deleteOption,
      confirmLabel: t('restaurant.delete'),
      tone: 'danger',
    })) return;
    const { error: deleteError } = await supabase.from('modifier_options').delete().eq('id', option.id);
    if (deleteError) setError(userFacingError(deleteError, locale, t('error.genericBody')));
    else await load();
  };

  return (
    <Modal title={`${copy.options} · ${item.name}`} onClose={onClose}>
      {loading ? <Skeleton count={4} /> : (
        <div className="max-h-[70dvh] space-y-4 overflow-y-auto pe-1">
          <p className="text-xs leading-5 text-ink-500">{copy.optionsHelp}</p>
          {error && <p className="rounded-lg bg-error-50 px-3 py-2 text-xs text-error-700" role="alert">{error}</p>}

          {groups.length === 0 && (
            <p className="rounded-lg bg-ink-50 px-3 py-4 text-center text-xs text-ink-500">{copy.noOptions}</p>
          )}
          {groups.map((group) => {
            const groupOptions = options.filter((option) => option.modifier_id === group.id);
            const draft = optionDrafts[group.id] ?? { name: '', price: '0' };
            return (
              <section key={group.id} className="rounded-xl border border-ink-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-ink-900">{group.name}</h4>
                    {!group.is_active && <span className="text-xs font-bold text-warning-700">{copy.paused}</span>}
                  </div>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => void updateGroup(group, { is_active: !group.is_active })}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
                      aria-label={group.is_active ? copy.paused : t('restaurant.available')}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeGroup(group)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-error-600 hover:bg-error-50"
                      aria-label={t('restaurant.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-3 text-xs">
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={group.is_required}
                      onChange={() => void updateGroup(group, {
                        is_required: !group.is_required,
                        min_select: group.is_required ? 0 : 1,
                      })}
                      className="h-5 w-5 accent-ember-600"
                    />
                    {copy.required}
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={group.is_multiple}
                      onChange={() => void updateGroup(group, {
                        is_multiple: !group.is_multiple,
                        max_select: group.is_multiple ? 1 : null,
                      })}
                      className="h-5 w-5 accent-ember-600"
                    />
                    {copy.multiple}
                  </label>
                </div>

                <div className="divide-y divide-ink-100">
                  {groupOptions.map((option) => (
                    <div key={option.id} className="flex min-h-12 items-center gap-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${option.is_available ? 'text-ink-800' : 'text-ink-400'}`}>{option.name}</p>
                        <p className="text-xs text-ink-400">+{Number(option.price_adjustion).toFixed(0)} DZD</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void updateOption(option, { is_default: !option.is_default })}
                        className={`min-h-11 rounded-lg px-2 text-xs font-bold ${option.is_default ? 'bg-sage-100 text-sage-700' : 'text-ink-400 hover:bg-ink-50'}`}
                      >
                        {copy.defaultOption}
                      </button>
                      <button type="button" onClick={() => void updateOption(option, { is_available: !option.is_available })} className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-50" aria-label={copy.paused}>
                        <Power className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => void removeOption(option)} className="flex h-11 w-11 items-center justify-center rounded-lg text-error-600 hover:bg-error-50" aria-label={t('restaurant.delete')}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-[1fr,100px,44px] gap-2">
                  <input
                    value={draft.name}
                    onChange={(event) => setOptionDrafts((current) => ({
                      ...current,
                      [group.id]: { ...draft, name: event.target.value },
                    }))}
                    className="kiyo-input min-w-0"
                    placeholder={copy.optionName}
                    aria-label={copy.optionName}
                  />
                  <input
                    value={draft.price}
                    onChange={(event) => setOptionDrafts((current) => ({
                      ...current,
                      [group.id]: { ...draft, price: event.target.value },
                    }))}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    className="kiyo-input min-w-0"
                    placeholder={copy.priceExtra}
                    aria-label={copy.priceExtra}
                  />
                  <button type="button" disabled={saving} onClick={() => void addOption(group)} className="kiyo-btn-primary flex h-11 w-11 items-center justify-center p-0" aria-label={copy.addOption}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </section>
            );
          })}

          <form onSubmit={addGroup} className="rounded-xl border border-dashed border-ink-300 p-3">
            <h4 className="mb-2 text-sm font-bold text-ink-900">{copy.addGroup}</h4>
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              className="kiyo-input"
              placeholder={copy.groupExample}
              aria-label={copy.groupName}
            />
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={groupRequired} onChange={(event) => setGroupRequired(event.target.checked)} className="h-5 w-5 accent-ember-600" />
                {copy.required}
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={groupMultiple} onChange={(event) => setGroupMultiple(event.target.checked)} className="h-5 w-5 accent-ember-600" />
                {copy.multiple}
              </label>
            </div>
            <button type="submit" disabled={saving || groupName.trim().length < 2} className="kiyo-btn-secondary mt-2 w-full">
              {saving ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {copy.addGroup}
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}

function ItemFormModal({ restaurantId, uploaderId, categories, item, onClose, onSaved }: {
  restaurantId: string;
  uploaderId: string;
  categories: MenuCategory[];
  item: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useT();
  const copy = menuCopy[locale];
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(item?.price ?? '');
  const existingImage = item?.image_url ?? '';
  const [imageUrl, setImageUrl] = useState(/^https:\/\//i.test(existingImage) ? existingImage : '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<string>(item?.category_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    if (name.trim().length < 2 || Number(price) <= 0) {
      setError(t('error.genericBody'));
      return;
    }
    if (!imageFile && imageUrl.trim() && !/^https:\/\//i.test(imageUrl.trim())) {
      setError(copy.invalidImageUrl);
      return;
    }
    setSaving(true);
    try {
      const nextImageUrl = imageFile
        ? await uploadRestaurantImage(uploaderId, imageFile, 'menu-item')
        : imageUrl.trim() || existingImage || null;
      const payload = {
        restaurant_id: restaurantId,
        category_id: categoryId || null,
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        image_url: nextImageUrl,
        is_available: item?.is_available ?? true,
      };
      const { error: e } = item
        ? await supabase.from('menu_items').update(payload).eq('id', item.id)
        : await supabase.from('menu_items').insert(payload);
      if (e) throw e;
      onSaved();
    } catch (err) {
      console.error('[Kiyo] Menu item save failed:', err);
      setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={item ? t('restaurant.editItem') : t('restaurant.newItem')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field name="i-name" label={t('restaurant.itemName')} value={name}
          onChange={(e) => setName(e.target.value)} required />
        <Field name="i-desc" label={t('restaurant.description')} value={description}
          onChange={(e) => setDescription(e.target.value)} />
        <Field name="i-price" label={t('restaurant.price')} value={price}
          onChange={(e) => setPrice(e.target.value)} type="number" inputMode="decimal"
          min="0" step="0.01" required />
        <label className="block">
          <span className="kiyo-label">{copy.uploadImage}</span>
          <span className="kiyo-btn-secondary flex min-h-11 w-full cursor-pointer items-center justify-center gap-2">
            <ImagePlus className="h-4 w-4" />
            <span className="truncate">{imageFile?.name ?? copy.uploadImage}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                const validation = file ? validateRestaurantImage(file) : null;
                if (validation) {
                  setError(validation === 'type' ? copy.invalidImageType : copy.invalidImageSize);
                  setImageFile(null);
                  return;
                }
                setError(null);
                setImageFile(file);
              }}
            />
          </span>
        </label>
        <p className="text-xs text-ink-400">{copy.imageHelp}</p>
        <Field name="i-img" label={t('restaurant.image')} value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)} type="url" placeholder="https://..." />
        {existingImage && !imageFile && (
          <div className="h-28 overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
            <RestaurantImage url={existingImage} name={name || t('restaurant.image')} />
          </div>
        )}
        {categories.length > 0 && (
          <div>
            <label htmlFor="i-cat" className="kiyo-label">{t('restaurant.category')}</label>
            <select
              id="i-cat" className="kiyo-input"
              value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">{t('common.none')}</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
        )}
        {error && <p className="text-xs text-error-600">{error}</p>}
        <button type="submit" disabled={saving} className="kiyo-btn-primary w-full">
          {saving && <Spinner className="h-4 w-4" />}
          {t('common.save')}
        </button>
      </form>
    </Modal>
  );
}

function CategoryFormModal({ restaurantId, onClose, onSaved }: {
  restaurantId: string; onClose: () => void; onSaved: () => void;
}) {
  const { t, locale } = useT();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || name.trim().length < 2) return;
    setSaving(true);
    setError(null);
    const { error: e2 } = await supabase
      .from('menu_categories')
      .insert({ restaurant_id: restaurantId, name: name.trim() });
    if (e2) {
      console.error('[Kiyo] Menu category save failed:', e2);
      setError(userFacingError(e2, locale, t('error.genericBody')));
      setSaving(false);
      return;
    }
    onSaved();
    setSaving(false);
  };

  return (
    <Modal title={t('restaurant.addCategory')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field name="c-name" label={t('restaurant.categoryName')} value={name}
          onChange={(e) => setName(e.target.value)} required autoFocus />
        {error && <p className="text-xs text-error-600">{error}</p>}
        <button type="submit" disabled={saving} className="kiyo-btn-primary w-full">
          {saving && <Spinner className="h-4 w-4" />}
          {t('common.save')}
        </button>
      </form>
    </Modal>
  );
}
