const fs = require('fs');
let code = fs.readFileSync('src/lib/geo.ts', 'utf8');

const replacement = `
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY || '';

function parseGoogleAddress(result: any): AddressParts {
  const components = result.address_components || [];
  const getComponent = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name;
  
  return {
    displayName: result.formatted_address || 'Selected location',
    street: [getComponent('route'), getComponent('street_number')].filter(Boolean).join(' '),
    neighborhood: getComponent('neighborhood') || getComponent('sublocality'),
    commune: getComponent('locality') || getComponent('administrative_area_level_2'),
    city: getComponent('administrative_area_level_2') || getComponent('locality'),
    province: getComponent('administrative_area_level_1'),
    postalCode: getComponent('postal_code'),
    country: getComponent('country'),
    placeId: result.place_id,
    provider: 'google',
  };
}

export async function reverseGeocode(lat: number, lng: number, language = 'fr'): Promise<AddressParts> {
  if (!isCoordinateInAlgeria(lat, lng)) {
    return {
      displayName: \`\${lat.toFixed(5)}, \${lng.toFixed(5)}\`,
      country: 'Algeria',
      provider: 'manual',
    };
  }

  if (API_KEY && API_KEY !== 'YOUR_API_KEY') {
    try {
      const res = await fetch(\`https://maps.googleapis.com/maps/api/geocode/json?latlng=\${lat},\${lng}&key=\${API_KEY}&language=\${language}\`);
      const data = await res.json();
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return parseGoogleAddress(data.results[0]);
      }
    } catch (err) {
      console.warn('Google Geocoding failed, falling back to OSM', err);
    }
  }

  await waitForNominatimSlot();
  try {
    const res = await fetch(
      \`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=\${lat}&lon=\${lng}&zoom=18&addressdetails=1\`,
      { headers: { 'Accept-Language': language } },
    );
    if (!res.ok) throw new Error('Reverse geocode failed');
    return normalizeOsmAddress(await res.json());
  } catch {
    return {
      displayName: \`\${lat.toFixed(5)}, \${lng.toFixed(5)}\`,
      provider: 'manual',
    };
  }
}

export async function searchAddresses(query: string, language = 'fr', limit = 5): Promise<GeoSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  
  if (API_KEY && API_KEY !== 'YOUR_API_KEY') {
    try {
      const res = await fetch(\`https://maps.googleapis.com/maps/api/geocode/json?address=\${encodeURIComponent(trimmed)}&components=country:DZ&key=\${API_KEY}&language=\${language}\`);
      const data = await res.json();
      if (data.status === 'OK' && data.results) {
        return data.results.slice(0, limit).map((r: any) => ({
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          label: r.formatted_address,
          placeId: r.place_id,
          provider: 'google',
        }));
      }
    } catch (err) {
      console.warn('Google Geocoding search failed, falling back to OSM', err);
    }
  }

  await waitForNominatimSlot();
  try {
    const res = await fetch(
      \`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=dz&limit=\${limit}&q=\${encodeURIComponent(trimmed)}\`,
      { headers: { 'Accept-Language': language } },
    );
    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => ({
        lat: Number.parseFloat(item.lat),
        lng: Number.parseFloat(item.lon),
        label: item.display_name as string,
        placeId: item.place_id ? String(item.place_id) : undefined,
        provider: 'osm' as const,
      }))
      .filter((item) => isCoordinateInAlgeria(item.lat, item.lng));
  } catch {
    return [];
  }
}
`;

const regex = /export async function reverseGeocode[\s\S]*?export async function searchAddresses[\s\S]*?\}\n\}/m;
if (!regex.test(code)) {
  console.log('Regex match failed');
}
code = code.replace(regex, replacement.trim());
fs.writeFileSync('src/lib/geo.ts', code);
