export type SearchableRestaurant = {
  name: string;
  description?: string | null;
  cuisine?: string[] | null;
  distance_km?: number | null;
};

export function sanitizeMarketplaceSearchTerm(value: string): string {
  return value
    .replace(/[%_*,()"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase();
}

export function scoreMarketplaceRestaurant(
  restaurant: SearchableRestaurant,
  query: string,
  matchingDishName?: string,
): number {
  const term = normalized(query);
  if (!term) return 0;

  const name = normalized(restaurant.name);
  const description = normalized(restaurant.description);
  const cuisines = (restaurant.cuisine ?? []).map(normalized);
  const dish = normalized(matchingDishName);

  let score = 0;
  if (name === term) score = 100;
  else if (name.startsWith(term)) score = 90;
  else if (name.includes(term)) score = 80;
  else if (cuisines.some((cuisine) => cuisine === term)) score = 75;
  else if (cuisines.some((cuisine) => cuisine.includes(term))) score = 70;
  else if (dish === term) score = 68;
  else if (dish.startsWith(term)) score = 64;
  else if (dish.includes(term)) score = 60;
  else if (description.includes(term)) score = 50;

  const distance = restaurant.distance_km;
  if (score > 0 && typeof distance === 'number' && Number.isFinite(distance)) {
    score += Math.max(0, 8 - Math.min(distance, 20) * 0.4);
  }

  return score;
}
