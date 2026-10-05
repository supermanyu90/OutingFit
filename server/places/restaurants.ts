/**
 * Mumbai restaurant directory: every named eatery in the OpenStreetMap snapshot
 * (server/data/mumbaiRestaurants.json, rebuilt by scripts/fetch-mumbai-restaurants.ts),
 * plus a live Nominatim lookup for places mapped after the snapshot was taken.
 *
 * Unlike the curated registry these entries carry real coordinates, so the forecast
 * point is the restaurant itself. They carry no amenity facts (valet, dress code, AC).
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { foldName } from '../weather/openMeteo.ts';

export const OSM_ATTRIBUTION = 'Data © OpenStreetMap contributors (ODbL)';

export interface RestaurantRecord {
  id: string;
  name: string;
  aliases?: string[];
  type: string;
  cuisine?: string[];
  locality: string;
  lat: number;
  lon: number;
}

interface Indexed {
  r: RestaurantRecord;
  names: string[];
  /** Words of the names and the locality, for "starbucks bandra"-style queries. */
  words: string[];
}

let index: Indexed[] | null = null;

function loadIndex(): Indexed[] {
  if (index) return index;
  const file = JSON.parse(readFileSync(new URL('../data/mumbaiRestaurants.json', import.meta.url), 'utf8'));
  index = (file.restaurants as RestaurantRecord[]).map((r) => {
    // "Bombay Canteen" should find "The Bombay Canteen" as an exact name.
    const names = [r.name, ...(r.aliases ?? [])].map(foldName).filter(Boolean).flatMap((n) => (n.startsWith('the ') ? [n, n.slice(4)] : [n]));
    return { r, names, words: [...new Set([...names, foldName(r.locality)].flatMap((n) => n.split(' ')))] };
  });
  return index;
}

export function restaurantCount(): number {
  return loadIndex().length;
}

/** Generic words that say what kind of place it is, not which one. */
const FILLER = new Set(['the', 'at', 'in', 'of', 'and', 'near', 'mumbai', 'restaurant', 'restro', 'cafe', 'bar', 'pub', 'hotel']);

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) [i, j] = [i + 1, j + 1];
    else {
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else [i, j] = [i + 1, j + 1];
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Restaurants matching a free-text query, strongest kind of match only. Tier 1: the exact
 * name ("Trishna", not "Trishna Fast Food"), else every meaningful word starting a word of
 * the name or locality ("mahesh lunch home juhu", "starbucks bandra"). Tier 2: a whole name
 * inside a sentence ("dinner at trishna tonight"). Tier 3: one-letter spelling slips in
 * long words ("britania" → Britannia).
 */
export function searchRestaurants(query: string): { restaurants: RestaurantRecord[]; tier: 1 | 2 | 3 } {
  const none = { restaurants: [], tier: 3 as const };
  const q = foldName(query);
  if (q.length < 2) return none;
  const all = loadIndex();
  const pick = (list: Indexed[], tier: 1 | 2 | 3) => ({ restaurants: list.map((x) => x.r), tier });

  const exact = all.filter((x) => x.names.includes(q));
  if (exact.length) return pick(exact, 1);

  const tokens = q.split(' ').filter((t) => !FILLER.has(t));
  if (tokens.length === 0) return none;
  const prefixed = (x: Indexed, t: string) => x.words.some((w) => w.startsWith(t));
  const byWords = all.filter((x) => tokens.every((t) => prefixed(x, t)) && tokens.some((t) => x.names.some((n) => n.includes(t))));
  if (byWords.length) return pick(byWords, 1);

  const contained = all.filter((x) => x.names.some((n) => n.length >= 5 && ` ${q} `.includes(` ${n} `)));
  if (contained.length) return pick(contained, 2);

  // Every word must still match, so one stray word ("zzqx nothing") finds nothing.
  const fuzzy = all.filter((x) =>
    tokens.every((t) => prefixed(x, t) || (t.length >= 5 && x.words.some((w) => w.length >= 5 && editDistanceAtMostOne(t, w))))
  );
  return fuzzy.length ? pick(fuzzy, 3) : none;
}

// ------------------------------------------------------------ live Nominatim

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
/** left,top,right,bottom — same area as the snapshot. */
const MUMBAI_VIEWBOX = '72.75,19.35,73.15,18.85';
const EATERY_TYPES = new Set(['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'food_court', 'ice_cream']);

const NominatimSchema = z.array(
  z.object({
    osm_type: z.string(),
    osm_id: z.number(),
    lat: z.string(),
    lon: z.string(),
    category: z.string().optional(),
    type: z.string(),
    name: z.string().optional(),
    address: z.record(z.string(), z.string()).optional(),
  })
);

const liveCache = new Map<string, { at: number; results: RestaurantRecord[] }>();
let lastLiveCallAt = 0;

/**
 * Asks OpenStreetMap's live search for eateries inside Mumbai. Nominatim allows at most
 * one request per second, so callers only use it when the snapshot has no match.
 */
export async function searchRestaurantsLive(query: string, timeoutMs: number, fetchImpl: typeof fetch = fetch): Promise<RestaurantRecord[]> {
  const key = foldName(query);
  const cached = liveCache.get(key);
  if (cached && Date.now() - cached.at < 24 * 3600_000) return cached.results;

  const wait = lastLiveCallAt + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastLiveCallAt = Date.now();

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    viewbox: MUMBAI_VIEWBOX,
    bounded: '1',
    addressdetails: '1',
    limit: '10',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OutingFit/1.0 (Mumbai outing planner)', 'Accept-Language': 'en' },
    });
    if (!res.ok) throw new Error(`Restaurant search returned HTTP ${res.status}`);
    const parsed = NominatimSchema.safeParse(await res.json());
    if (!parsed.success) throw new Error('Restaurant search response failed validation');
    const results = parsed.data
      .filter((p) => p.category === 'amenity' && EATERY_TYPES.has(p.type) && p.name)
      .map((p) => ({
        id: `${p.osm_type[0]}${p.osm_id}`,
        name: p.name!,
        type: p.type,
        locality: p.address?.suburb || p.address?.neighbourhood || p.address?.city_district || 'Mumbai',
        lat: Number(p.lat),
        lon: Number(p.lon),
      }));
    liveCache.set(key, { at: Date.now(), results });
    return results;
  } finally {
    clearTimeout(timer);
  }
}
