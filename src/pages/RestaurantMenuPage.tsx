import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Pencil, ChevronLeft, Utensils, X, Power } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type Restaurant, type MenuItem, type MenuCategory } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import { PriceTag } from '../components/ui';
import { Field } from '../components/Field';

export default function RestaurantMenuPage() {
  const { t } = useT();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

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
      setError(err instanceof Error ? err.message : t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

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
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error: e } = await supabase.from('menu_items').delete().eq('id', item.id);
    if (e) {
      setItems(previous);
      console.error(e);
      setError(t('error.genericBody'));
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
              />
            )}
            {categories.map((cat) => (
              <div key={cat.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-ink-900">{cat.name}</h2>
                  <button
                    onClick={async () => {
                      if (!confirm(t('restaurant.deleteCategoryConfirm').replace('{name}', cat.name))) return;
                      const { error: e } = await supabase.from('menu_categories').delete().eq('id', cat.id);
                      if (e) {
                        console.error(e);
                        setError(t('error.genericBody'));
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
    </AppShell>
  );
}

function ItemGroup({ items, onToggle, onEdit, onDelete }: {
  items: MenuItem[];
  onToggle: (i: MenuItem) => void;
  onEdit: (i: MenuItem) => void;
  onDelete: (i: MenuItem) => void;
}) {
  const { t } = useT();
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="kiyo-card flex items-center gap-3 p-3">
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
            onClick={() => onEdit(item)}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
            aria-label={t('common.edit')}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-error-500/10 hover:text-error-600"
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

function ItemFormModal({ restaurantId, categories, item, onClose, onSaved }: {
  restaurantId: string;
  categories: MenuCategory[];
  item: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(item?.price ?? '');
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? '');
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
    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        category_id: categoryId || null,
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        image_url: imageUrl.trim() || null,
        is_available: item?.is_available ?? true,
      };
      const { error: e } = item
        ? await supabase.from('menu_items').update(payload).eq('id', item.id)
        : await supabase.from('menu_items').insert(payload);
      if (e) throw e;
      onSaved();
    } catch (err) {
      setError((err as Error)?.message ?? t('error.genericBody'));
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
        <Field name="i-img" label={t('restaurant.image')} value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)} type="url" placeholder="https://..." />
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
  const { t } = useT();
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
      setError(e2.message);
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
