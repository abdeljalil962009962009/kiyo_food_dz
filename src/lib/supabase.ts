import { createClient } from '@supabase/supabase-js';

let rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
if (rawSupabaseUrl) {
  rawSupabaseUrl = rawSupabaseUrl.replace(/\/+$/, ""); // Remove trailing slashes
  if (rawSupabaseUrl.endsWith('/rest/v1')) {
    rawSupabaseUrl = rawSupabaseUrl.slice(0, -8);
  }
  rawSupabaseUrl = rawSupabaseUrl.replace(/\/+$/, ""); // Clean trailing slashes again
}
const supabaseUrl = rawSupabaseUrl;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isValidUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
};

export const isSupabaseConfigured = isValidUrl(supabaseUrl) && !!supabaseAnonKey;

const fallbackUrl = 'http://localhost:54321';
const fallbackKey = 'missing-supabase-anon-key';

export const supabase = createClient(
  isValidUrl(supabaseUrl) ? supabaseUrl! : fallbackUrl,
  supabaseAnonKey || fallbackKey,
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
  place_id: string | null;
  country: string | null;
  region: string | null;
  province: string | null;
  postal_code: string | null;
  timezone: string | null;
  geohash: string | null;
  location_accuracy_m: number | null;
  location_verified: boolean;
  location_updated_at: string | null;
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
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_accuracy_m: number | null;
  driver_id: string | null;
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
  place_id: string | null;
  street: string | null;
  neighborhood: string | null;
  commune: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  geohash: string | null;
  accuracy_m: number | null;
  is_default: boolean;
  is_archived: boolean;
  is_favorite: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DriverLocationEvent = {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  heading: number | null;
  speed_mps: number | null;
  distance_from_previous_m: number | null;
  calculated_speed_mps: number | null;
  suspicious: boolean;
  suspicious_reason: string | null;
  recorded_at: string;
  created_at: string;
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
