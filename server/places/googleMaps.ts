/**
 * Google Maps restaurant lookup through SerpApi (engine=google_maps), used only when
 * neither the curated registry nor OpenStreetMap knows the name. Needs SERPAPI_API_KEY;
 * without it this lookup is skipped. Each call is a paid SerpApi search, so results
 * are cached for 24 h.
 *
 * Docs: https://serpapi.com/google-maps-api
 */

import { z } from 'zod';
import { foldName } from '../weather/openMeteo.ts';
import { RestaurantRecord } from './restaurants.ts';

export const GOOGLE_ATTRIBUTION = 'Google Maps via SerpApi';

const SERPAPI_URL = 'https://serpapi.com/search.json';
/** Same area as the OpenStreetMap snapshot: Colaba to Mira Road, Vashi. */
const BOUNDS = { south: 18.85, north: 19.35, west: 72.75, east: 73.15 };
const EATERY = /restaurant|caf[eé]|coffee|bar\b|pub|bistro|brewery|bakery|food|dhaba|eatery|kitchen|diner|canteen|sweet|ice cream|dessert|tea|juice|pizza|biryani|grill/i;

const Place = z.object({
  title: z.string(),
  place_id: z.string().optional(),
  data_id: z.string().optional(),
  gps_coordinates: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
  address: z.string().optional(),
  type: z.string().optional(),
  types: z.array(z.string()).optional(),
});
type Place = z.infer<typeof Place>;

const Response = z.object({
  error: z.string().optional(),
  local_results: z.array(z.unknown()).optional(),
  /** Returned instead of local_results when the query names one place. */
  place_results: z.unknown().optional(),
});

export function googleMapsConfigured(apiKey = process.env.SERPAPI_API_KEY): boolean {
  return !!apiKey && !apiKey.startsWith('MY_');
}

/** "Juhu Tara Rd, Juhu, Mumbai, Maharashtra 400049" → "Juhu". */
export function localityFromAddress(address: string | undefined): string {
  const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const city = parts.findIndex((p) => /^(mumbai|navi mumbai|thane|mira bhayandar)\b/i.test(p));
  return (city > 0 ? parts[city - 1] : parts[0]) || 'Mumbai';
}

function toRecord(p: Place): RestaurantRecord | null {
  const g = p.gps_coordinates;
  if (!g) return null;
  if (g.latitude < BOUNDS.south || g.latitude > BOUNDS.north || g.longitude < BOUNDS.west || g.longitude > BOUNDS.east) return null;
  const kinds = [p.type, ...(p.types ?? [])].filter((t): t is string => !!t);
  if (kinds.length && !kinds.some((t) => EATERY.test(t))) return null;
  return {
    id: `g:${p.place_id ?? p.data_id ?? `${g.latitude},${g.longitude}`}`,
    name: p.title,
    type: (p.type ?? 'restaurant').toLowerCase(),
    locality: localityFromAddress(p.address),
    lat: g.latitude,
    lon: g.longitude,
  };
}

const cache = new Map<string, { at: number; results: RestaurantRecord[] }>();

export async function searchRestaurantsGoogle(
  query: string,
  timeoutMs: number,
  apiKey = process.env.SERPAPI_API_KEY ?? '',
  fetchImpl: typeof fetch = fetch
): Promise<RestaurantRecord[]> {
  if (!googleMapsConfigured(apiKey)) return [];
  const key = foldName(query);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < 24 * 3600_000) return cached.results;

  const params = new URLSearchParams({
    engine: 'google_maps',
    type: 'search',
    q: `${query} restaurant Mumbai`,
    ll: '@19.07,72.88,11z', // centred on Mumbai, zoomed to cover the city
    hl: 'en',
    gl: 'in',
    google_domain: 'google.co.in',
    api_key: apiKey,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${SERPAPI_URL}?${params}`, { signal: controller.signal });
    const parsed = Response.safeParse(await res.json().catch(() => ({})));
    if (!res.ok || !parsed.success || parsed.data.error) {
      // "Google hasn't returned any results" is a normal miss, not a failure.
      if (parsed.success && /hasn't returned any results/i.test(parsed.data.error ?? '')) return [];
      throw new Error(`Google Maps search failed (${parsed.success && parsed.data.error ? parsed.data.error : `HTTP ${res.status}`})`);
    }
    const raw = parsed.data.local_results ?? (parsed.data.place_results ? [parsed.data.place_results] : []);
    const results = raw
      .map((r) => Place.safeParse(r))
      .flatMap((r) => (r.success ? [toRecord(r.data)] : []))
      .filter((r): r is RestaurantRecord => r !== null)
      .slice(0, 10);
    cache.set(key, { at: Date.now(), results });
    return results;
  } finally {
    clearTimeout(timer);
  }
}
