export type RecentRestaurantSummary = {
  restaurant_id: string;
  order_count: number;
  last_order_at: string;
  restaurants: {
    id: string;
    name: string;
    image_url: string | null;
    rating: number;
    estimated_delivery_min: number | null;
    status: string;
    operational_status: 'open' | 'closed' | 'busy';
    is_vacation_mode: boolean;
  } | null;
};

export type UsualRestaurant = NonNullable<RecentRestaurantSummary['restaurants']> & {
  orderCount: number;
  lastOrderAt: string;
};

export function pickUsualRestaurant(
  summaries: RecentRestaurantSummary[],
): UsualRestaurant | null {
  const eligible = summaries
    .filter((summary) => (
      summary.order_count > 0
      && summary.restaurants?.status === 'published'
    ))
    .sort((left, right) => (
      right.order_count - left.order_count
      || Date.parse(right.last_order_at) - Date.parse(left.last_order_at)
      || left.restaurant_id.localeCompare(right.restaurant_id)
    ));

  const selected = eligible[0];
  if (!selected?.restaurants) return null;

  return {
    ...selected.restaurants,
    orderCount: selected.order_count,
    lastOrderAt: selected.last_order_at,
  };
}

export function usualRestaurantIsAvailable(restaurant: UsualRestaurant): boolean {
  return restaurant.operational_status !== 'closed' && !restaurant.is_vacation_mode;
}
