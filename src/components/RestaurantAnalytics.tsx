import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Users, Star, ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from './ErrorBoundary';
import { Spinner } from './feedback';

type AnalyticsSummary = {
  period_days: number;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  avg_prep_time: number | null;
  total_reviews: number;
  avg_rating: number | null;
  peak_hour: number | null;
  new_customers: number;
  repeat_customers: number;
};

type TopProduct = {
  product_id: string;
  product_name: string;
  orders_count: number;
  revenue: number;
};

export function RestaurantAnalyticsPanel({ restaurantId }: { restaurantId: string }) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    if (!restaurantId) return;

    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const [analyticsRes, productsRes] = await Promise.all([
          supabase.rpc('get_restaurant_analytics_summary', {
            p_restaurant_id: restaurantId,
            p_days: period,
          }),
          supabase.rpc('get_top_products', {
            p_restaurant_id: restaurantId,
            p_days: period,
            p_limit: 5,
          }),
        ]);

        if (!analyticsRes.error) {
          setAnalytics(analyticsRes.data as AnalyticsSummary);
        }
        if (!productsRes.error) {
          setTopProducts((productsRes.data as TopProduct[]) ?? []);
        }
      } catch {
        // Non-fatal
      } finally {
        setLoading(false);
      }
    };

    void loadAnalytics();
  }, [restaurantId, period]);

  if (loading) {
    return (
      <div className="kiyo-card flex items-center justify-center p-8">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const formatDZD = (n: number) => n.toLocaleString('fr-DZ') + ' DZD';

  return (
    <ErrorBoundary variant="inline">
      <div className="kiyo-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-ember-500" />
            <h3 className="font-display text-base font-bold text-ink-900">Analytics</h3>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value) as 7 | 30 | 90)}
            className="rounded-lg border border-ink-200 px-2 py-1 text-xs font-medium text-ink-600"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {analytics && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-ink-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <ShoppingBag className="h-3.5 w-3.5" />
                Orders
              </div>
              <div className="mt-1 font-display text-lg font-bold text-ink-900">
                {analytics.total_orders}
              </div>
            </div>
            <div className="rounded-lg bg-ink-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <TrendingUp className="h-3.5 w-3.5" />
                Revenue
              </div>
              <div className="mt-1 font-display text-lg font-bold text-ink-900">
                {formatDZD(analytics.total_revenue)}
              </div>
            </div>
            <div className="rounded-lg bg-ink-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <Users className="h-3.5 w-3.5" />
                New Customers
              </div>
              <div className="mt-1 font-display text-lg font-bold text-ink-900">
                {analytics.new_customers}
              </div>
            </div>
            <div className="rounded-lg bg-ink-50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <Star className="h-3.5 w-3.5" />
                Avg Rating
              </div>
              <div className="mt-1 font-display text-lg font-bold text-ink-900">
                {analytics.avg_rating?.toFixed(1) ?? '—'}
              </div>
            </div>
          </div>
        )}

        {/* Top Products */}
        {topProducts.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Top Products
            </h4>
            <div className="space-y-2">
              {topProducts.map((product, index) => (
                <div key={product.product_id} className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    index === 0 ? 'bg-amber-100 text-amber-700' :
                    index === 1 ? 'bg-ink-100 text-ink-600' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-ink-50 text-ink-500'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-800">
                      {product.product_name}
                    </div>
                    <div className="text-xs text-ink-400">
                      {product.orders_count} orders
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-ink-700">
                    {formatDZD(product.revenue)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!analytics && (
          <div className="py-6 text-center text-sm text-ink-400">
            No analytics data available yet.
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
