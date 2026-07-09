export const ALGERIA_MAP_CENTER: [number, number] = [28.0, 2.0];

export const ALGERIA_MAP_BOUNDS: [[number, number], [number, number]] = [
  [18.5, -9.0],
  [37.6, 12.2],
];

export const MAP_TILE_PROVIDERS = {
  carto: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  },
  osm: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
} as const;

export type MapTileProviderKey = keyof typeof MAP_TILE_PROVIDERS;

export function nextTileProvider(provider: MapTileProviderKey): MapTileProviderKey {
  return provider === 'carto' ? 'osm' : 'carto';
}
