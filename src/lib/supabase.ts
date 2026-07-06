import { createClient } from '@supabase/supabase-js';

let rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://rjdhzfcrsxibcszzlxyp.supabase.co').trim();
if (rawSupabaseUrl) {
  rawSupabaseUrl = rawSupabaseUrl.replace(/\/+$/, ""); // Remove trailing slashes
  if (rawSupabaseUrl.endsWith('/rest/v1')) {
    rawSupabaseUrl = rawSupabaseUrl.slice(0, -8);
  }
  rawSupabaseUrl = rawSupabaseUrl.replace(/\/+$/, ""); // Clean trailing slashes again
}
const supabaseUrl = rawSupabaseUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6CBu9iy67V-xLAVqyzZdwQ_kcGOKFaq';

const isValidUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
};

export const isSupabaseConfigured = isValidUrl(supabaseUrl) && !!supabaseAnonKey;

const dummyUrl = 'https://placeholder-project-id.supabase.co';
const dummyKey = 'placeholder-anon-key';

export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl! : dummyUrl,
  supabaseAnonKey || dummyKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'kiyo-auth',
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
    global: {
      headers: { 'x-application': 'kiyo-web' },
    },
  }
);

export type UserRole = 'customer' | 'restaurant_owner' | 'super_admin' | 'driver';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  preferred_language: 'en' | 'fr' | 'ar';
  selected_wilaya_id: number | null;
  failed_login_attempts: number;
  locked_until: string | null;
  is_suspended: boolean;
  suspended_reason: string | null;
  suspended_at: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string;
};

export type Wilaya = {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RestaurantStatus =
  | 'draft' | 'pending_approval' | 'published' | 'hidden' | 'suspended';

export type Restaurant = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  wilaya_id: number | null;
  status: RestaurantStatus;
  operational_status: 'open' | 'closed' | 'busy';
  is_vacation_mode: boolean;
  image_url: string | null;
  cuisine: string[] | null;
  avg_price_range: '$' | '$$' | '$$$' | '$$$$' | null;
  opening_hours: Record<string, { open: string; close: string } | undefined>;
  rating: number;
  review_count: number;
  estimated_delivery_min: number | null;
  latitude: number | null;
  longitude: number | null;
  max_delivery_km: number;
  min_order_amount: number;
  commission_rate: number | string;
  is_verified: boolean;
  is_featured: boolean;
  featured_until: string | null;
  created_at: string;
  updated_at: string;
};

export type MenuCategory = {
  id: string;
  restaurant_id: string;
  name: string;
  position: number;
  created_at: string;
};

export type MenuItem = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  is_available: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type OrderStatus =
  | 'pending' | 'accepted' | 'preparing'
  | 'out_for_delivery' | 'delivered' | 'cancelled'
  | 'failed_delivery' | 'refunded';

export type OrderRow = {
  id: string;
  customer_id: string;
  restaurant_id: string;
  status: OrderStatus;
  idempotency_key: string;
  subtotal: string;
  delivery_fee: string;
  service_fee: string;
  total: string;
  delivery_address: string | null;
  delivery_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  name: string;
  quantity: number;
  unit_price: string;
  notes: string | null;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SavedAddress = {
  id: string;
  customer_id: string;
  label: 'home' | 'work' | 'family' | 'other';
  custom_name: string | null;
  address: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Review = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  owner_reply: string | null;
  replied_at: string | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

export type LedgerEntry = {
  id: string;
  order_id: string;
  restaurant_id: string;
  customer_id: string;
  order_total: string;
  subtotal: string;
  delivery_fee: string;
  service_fee: string;
  platform_commission: string;
  restaurant_payout: string;
  settlement_status: 'pending' | 'settled' | 'disputed';
  settled_at: string | null;
  locked_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type Settlement = {
  id: string;
  restaurant_id: string;
  period_start: string;
  period_end: string;
  gross_sales: string;
  platform_commission: string;
  service_fees: string;
  restaurant_payout: string;
  amount_owed: string;
  amount_paid: string;
  balance: string;
  status: 'pending' | 'paid' | 'overdue' | 'disputed' | 'partially_paid';
  due_date: string | null;
  settled_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformSetting = {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type SupportTicket = {
  id: string;
  requester_id: string;
  subject: string;
  body: string;
  category: 'general' | 'bug' | 'abuse' | 'complaint' | 'billing' | 'other';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to: string | null;
  order_id: string | null;
  restaurant_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

export type PromoCode = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  min_order_amount: string;
  max_discount: string | null;
  usage_limit: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export const MOCK_RESTAURANTS: Restaurant[] = [
  {
    id: 'f947e33a-86a0-4a81-bb0b-333333333331',
    owner_id: 'admin-fallback-id',
    name: 'El Bahia Traditional Kitchen',
    description: 'Authentic Algerian traditional food from Oran. Famous for Couscous, Tajine, and Harira.',
    phone: '0555 12 34 56',
    address: 'Rue de la Gare, Oran',
    city: 'Oran',
    wilaya_id: 31, // Oran
    status: 'published',
    operational_status: 'open',
    is_vacation_mode: false,
    image_url: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=800&q=60&auto=format&fit=crop',
    cuisine: ['Traditional', 'Algerian', 'Tajine'],
    avg_price_range: '$$',
    opening_hours: {
      mon: { open: '11:00', close: '23:00' },
      tue: { open: '11:00', close: '23:00' },
      wed: { open: '11:00', close: '23:00' },
      thu: { open: '11:00', close: '23:00' },
      fri: { open: '16:00', close: '23:00' },
      sat: { open: '11:00', close: '23:00' },
      sun: { open: '11:00', close: '23:00' }
    },
    rating: 4.8,
    review_count: 142,
    estimated_delivery_min: 30,
    latitude: 35.6987,
    longitude: -0.6318,
    max_delivery_km: 15,
    min_order_amount: 500,
    is_verified: true,
    is_featured: true,
    featured_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'f947e33a-86a0-4a81-bb0b-333333333332',
    owner_id: 'admin-fallback-id',
    name: 'Casbah Burger & Grill',
    description: 'Artisanal burgers with an Algerian touch. Premium local beef and custom home-made sauces.',
    phone: '0555 98 76 54',
    address: 'Didouche Mourad St, Algiers Centre',
    city: 'Algiers',
    wilaya_id: 16, // Algiers
    status: 'published',
    operational_status: 'open',
    is_vacation_mode: false,
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=60&auto=format&fit=crop',
    cuisine: ['Burgers', 'Fast Food', 'Grill'],
    avg_price_range: '$$',
    opening_hours: {
      mon: { open: '12:00', close: '23:30' },
      tue: { open: '12:00', close: '23:30' },
      wed: { open: '12:00', close: '23:30' },
      thu: { open: '12:00', close: '01:00' },
      fri: { open: '14:30', close: '01:00' },
      sat: { open: '12:00', close: '01:00' },
      sun: { open: '12:00', close: '23:30' }
    },
    rating: 4.6,
    review_count: 289,
    estimated_delivery_min: 25,
    latitude: 36.7525,
    longitude: 3.042,
    max_delivery_km: 12,
    min_order_amount: 400,
    is_verified: true,
    is_featured: false,
    featured_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'f947e33a-86a0-4a81-bb0b-333333333333',
    owner_id: 'admin-fallback-id',
    name: 'Le Gourmet Pastry & Café',
    description: 'Fine French and traditional Algerian pastries. Fresh coffee, tea, and desserts.',
    phone: '0555 45 45 45',
    address: 'Boulevard du 1er Novembre, Constantine',
    city: 'Constantine',
    wilaya_id: 25, // Constantine
    status: 'published',
    operational_status: 'open',
    is_vacation_mode: false,
    image_url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&q=60&auto=format&fit=crop',
    cuisine: ['Pastry', 'Desserts', 'Café'],
    avg_price_range: '$$$',
    opening_hours: {
      mon: { open: '07:30', close: '21:00' },
      tue: { open: '07:30', close: '21:00' },
      wed: { open: '07:30', close: '21:00' },
      thu: { open: '07:30', close: '22:00' },
      fri: { open: '08:00', close: '22:00' },
      sat: { open: '07:30', close: '22:00' },
      sun: { open: '07:30', close: '21:00' }
    },
    rating: 4.7,
    review_count: 98,
    estimated_delivery_min: 20,
    latitude: 36.365,
    longitude: 6.6147,
    max_delivery_km: 8,
    min_order_amount: 300,
    is_verified: true,
    is_featured: false,
    featured_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const MOCK_CATEGORIES: MenuCategory[] = [
  { id: 'cat-1', restaurant_id: 'any', name: 'Pizzas & Breads', position: 1, created_at: new Date().toISOString() },
  { id: 'cat-2', restaurant_id: 'any', name: 'Burgers & Grills', position: 2, created_at: new Date().toISOString() },
  { id: 'cat-3', restaurant_id: 'any', name: 'Desserts & Sweets', position: 3, created_at: new Date().toISOString() },
  { id: 'cat-4', restaurant_id: 'any', name: 'Traditional Specialties', position: 4, created_at: new Date().toISOString() },
  { id: 'cat-5', restaurant_id: 'any', name: 'Beverages', position: 5, created_at: new Date().toISOString() }
];

export const MOCK_MENU_ITEMS: MenuItem[] = [
  {
    id: 'item-1',
    restaurant_id: 'any',
    category_id: 'cat-1',
    name: 'Margherita Pizza',
    description: 'Fresh mozzarella, tomato sauce, basil, olive oil, and herbs.',
    price: '700',
    image_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=60&auto=format&fit=crop',
    is_available: true,
    position: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'item-2',
    restaurant_id: 'any',
    category_id: 'cat-1',
    name: 'Algerian Pizza (Carrée)',
    description: 'Traditional rectangular street pizza with thick tomato sauce, garlic, olives, and hot peppers.',
    price: '850',
    image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=60&auto=format&fit=crop',
    is_available: true,
    position: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'item-3',
    restaurant_id: 'any',
    category_id: 'cat-2',
    name: 'Casbah Special Burger',
    description: 'Fresh local beef patty, cheddar, caramelized onions, smoked beef bacon, and house burger sauce.',
    price: '950',
    image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=60&auto=format&fit=crop',
    is_available: true,
    position: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'item-4',
    restaurant_id: 'any',
    category_id: 'cat-2',
    name: 'Spicy Chicken Burger',
    description: 'Crispy fried chicken breast, pepper jack cheese, spicy slaw, jalapeños, and Sriracha mayo.',
    price: '850',
    image_url: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=800&q=60&auto=format&fit=crop',
    is_available: true,
    position: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'item-5',
    restaurant_id: 'any',
    category_id: 'cat-3',
    name: 'Mhancha Dessert',
    description: 'Traditional Algerian almond snake pastry baked to golden perfection, coated with pure orange-blossom honey.',
    price: '450',
    image_url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&q=60&auto=format&fit=crop',
    is_available: true,
    position: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'item-6',
    restaurant_id: 'any',
    category_id: 'cat-4',
    name: 'Royal Couscous',
    description: 'Fine rolled semolina steamed over aromatic vegetable broth, served with slow-cooked lamb shoulder and chicken.',
    price: '1800',
    image_url: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=800&q=60&auto=format&fit=crop',
    is_available: true,
    position: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'item-7',
    restaurant_id: 'any',
    category_id: 'cat-5',
    name: 'Hamoud Boualem (Cola)',
    description: 'The legendary Algerian carbonated soft drink, fresh and ice cold.',
    price: '150',
    image_url: null,
    is_available: true,
    position: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'item-8',
    restaurant_id: 'any',
    category_id: 'cat-5',
    name: 'Traditional Mint Tea',
    description: 'Aromatic green tea brewed with fresh spearmint leaves and served hot with roasted pine nuts.',
    price: '200',
    image_url: null,
    is_available: true,
    position: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];
