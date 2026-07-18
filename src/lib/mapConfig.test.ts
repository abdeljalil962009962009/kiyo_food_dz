import { describe, expect, it } from 'vitest';
import { ALGERIA_LEAFLET_BOUNDS, MAP_TILE_PROVIDERS, nextTileProvider } from './mapConfig';

describe('backup map providers', () => {
  it('uses two independent HTTPS tile sources with required attribution', () => {
    expect(MAP_TILE_PROVIDERS.carto.url).toMatch(/^https:/);
    expect(MAP_TILE_PROVIDERS.osm.url).toMatch(/^https:/);
    expect(MAP_TILE_PROVIDERS.carto.attribution).toContain('OpenStreetMap');
    expect(MAP_TILE_PROVIDERS.osm.attribution).toContain('OpenStreetMap');
  });

  it('switches providers deterministically after tile failure', () => {
    expect(nextTileProvider('carto')).toBe('osm');
    expect(nextTileProvider('osm')).toBe('carto');
  });

  it('keeps fallback navigation inside Algeria', () => {
    expect(ALGERIA_LEAFLET_BOUNDS).toEqual([[18.5, -9], [37.6, 12.2]]);
  });
});
