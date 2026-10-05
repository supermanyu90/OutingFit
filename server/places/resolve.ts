/**
 * Destination resolution: curated venue registry + every OpenStreetMap restaurant
 * in Mumbai + GeoNames localities, with Google Maps (SerpApi) as the last resort
 * for restaurants none of those know.
 *
 * Returns every plausible candidate. The caller must ask the user to choose
 * when more than one candidate is returned — weather is never fetched for an
 * unconfirmed guess.
 */

import { REPUTED_VENUES, VenueRecord } from '../data/mumbaiRegistry.ts';
import { foldName, geocodeMumbai, GeocodeCandidate } from '../weather/openMeteo.ts';
import { OSM_ATTRIBUTION, RestaurantRecord, searchRestaurants, searchRestaurantsLive } from './restaurants.ts';
import { GOOGLE_ATTRIBUTION, searchRestaurantsGoogle } from './googleMaps.ts';
import { ResolvedDestination } from '../domain.ts';

export const REGISTRY_SOURCE = 'OutingFit curated venue registry (not independently verified)';
/** More branches than this and the user is asked to add the area instead of scrolling a list. */
export const MAX_RESTAURANT_CANDIDATES = 8;

export interface DestinationCandidate {
  id: string;
  destination: ResolvedDestination;
  subtitle: string;
  source: 'registry' | 'osm' | 'google' | 'geonames';
}

export interface ResolveResult {
  query: string;
  status: 'resolved' | 'ambiguous' | 'not_found';
  candidates: DestinationCandidate[];
  message: string;
  geocodingError?: string;
}

/** Match strength: 1 = name or alias, 2 = name inside a sentence, 3 = spelling slip. */
type MatchTier = 1 | 2 | 3;

function registryMatches(query: string): { venues: VenueRecord[]; tier: MatchTier } {
  const q = foldName(query);
  if (!q) return { venues: [], tier: 3 };
  const tokens = q.split(' ').filter((t) => t.length >= 3);
  const names = (v: VenueRecord) => [v.name, ...v.aliases].map(foldName);
  // Tier 1: the query is (part of) a venue name or alias — "bastian" hits both branches,
  // "bastian at the top" only the Dadar one.
  const direct = REPUTED_VENUES.filter((v) => names(v).some((n) => n.includes(q)));
  if (direct.length) return { venues: direct, tier: 1 };
  // Tier 2: a longer sentence that contains a venue name or its first word.
  const contained = REPUTED_VENUES.filter((v) => {
    if (names(v).some((n) => n.length >= 4 && q.includes(n))) return true;
    const first = foldName(v.name).split(' ')[0];
    return first.length >= 4 && tokens.includes(first);
  });
  if (contained.length) return { venues: contained, tier: 2 };
  // Tier 3: one-letter spelling variants from speech recognition or transliteration
  // ("Bastion" → "Bastian"). Still returns every match so the user confirms.
  const fuzzy = REPUTED_VENUES.filter((v) => {
    const words = new Set(names(v).flatMap((n) => n.split(' ')).filter((w) => w.length >= 5));
    return tokens.some((t) => t.length >= 5 && [...words].some((w) => editDistance(t, w) <= 1));
  });
  return { venues: fuzzy, tier: 3 };
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

async function forecastPointForVenue(v: VenueRecord, timeoutMs: number): Promise<ResolvedDestination['forecastPoint'] | null> {
  if (!v.forecastLocality) return null;
  const geo = await geocodeMumbai(v.forecastLocality, timeoutMs);
  const g = geo[0];
  return g ? { label: `${g.name}, Mumbai (GeoNames locality)`, lat: g.lat, lon: g.lon } : null;
}

function restaurantCandidate(r: RestaurantRecord): DestinationCandidate {
  const kind = r.cuisine?.length ? r.cuisine.slice(0, 2).join(', ') : r.type.replace(/_/g, ' ');
  const google = r.id.startsWith('g:');
  return {
    id: google ? `google:${r.id.slice(2)}` : `osm:${r.id}`,
    destination: {
      kind: 'restaurant',
      venueId: r.id,
      name: r.name,
      forecastPoint: { label: `${r.name}, ${r.locality} (${google ? 'Google Maps' : 'OpenStreetMap'})`, lat: r.lat, lon: r.lon },
    },
    subtitle: `${r.locality} · ${kind} · ${google ? GOOGLE_ATTRIBUTION : OSM_ATTRIBUTION}`,
    source: google ? 'google' : 'osm',
  };
}

/** Best restaurants first: names that start with the query, then sit-down places. */
function rankRestaurants(q: string, list: RestaurantRecord[]): RestaurantRecord[] {
  const fq = foldName(q);
  const typeRank = (t: string) => ['restaurant', 'bar', 'pub', 'cafe'].indexOf(t) >>> 0;
  return [...list].sort(
    (a, b) => Number(!foldName(a.name).startsWith(fq)) - Number(!foldName(b.name).startsWith(fq)) || typeRank(a.type) - typeRank(b.type)
  );
}

function placeCandidate(g: GeocodeCandidate): DestinationCandidate {
  return {
    id: `geo:${g.lat.toFixed(4)},${g.lon.toFixed(4)}`,
    destination: {
      kind: 'place',
      name: g.name,
      forecastPoint: { label: `${g.name}, Mumbai (GeoNames locality)`, lat: g.lat, lon: g.lon },
    },
    subtitle: `${g.admin2 || 'Mumbai'} · ${g.lat.toFixed(3)}, ${g.lon.toFixed(3)}`,
    source: 'geonames',
  };
}

export async function resolveDestination(query: string, timeoutMs: number): Promise<ResolveResult> {
  const q = query.trim().slice(0, 120);
  const candidates: DestinationCandidate[] = [];
  let geocodingError: string | undefined;

  const registry = registryMatches(q);
  const snapshot = searchRestaurants(q);
  // Only the strongest kind of match counts: "starbucks bandra" naming a Starbucks
  // outranks curated venues that merely mention Bandra.
  const bestTier = Math.min(registry.venues.length ? registry.tier : 9, snapshot.restaurants.length ? snapshot.tier : 9);
  for (const v of registry.tier === bestTier ? registry.venues : []) {
    try {
      const point = await forecastPointForVenue(v, timeoutMs);
      if (!point) continue;
      candidates.push({
        id: `venue:${v.id}`,
        destination: { kind: 'registry', venueId: v.id, name: v.name, forecastPoint: point },
        subtitle: `${v.neighborhood} · forecast point: ${point.label.split(',')[0]}`,
        source: 'registry',
      });
    } catch (err: any) {
      geocodingError = err.message;
    }
  }

  // Every restaurant in the OSM snapshot; ask OSM live only when the snapshot has none.
  const matchedVenues = candidates.map((c) => venueById(c.destination.venueId)).filter((v): v is VenueRecord => v !== null);
  // A curated venue already covers its own OSM entry and carries richer facts. Aliases alone
  // ("olive") are too loose, so they count only when the OSM entry is in the same area.
  const coveredByRegistry = (r: RestaurantRecord) =>
    matchedVenues.some(
      (v) =>
        foldName(v.name) === foldName(r.name) ||
        (v.aliases.some((a) => foldName(a) === foldName(r.name)) && foldName(v.neighborhood).includes(foldName(r.locality).split(' ')[0]))
    );
  let restaurants = snapshot.tier === bestTier ? snapshot.restaurants : [];
  if (restaurants.length === 0 && candidates.length === 0) {
    try {
      restaurants = await searchRestaurantsLive(q, timeoutMs);
    } catch (err: any) {
      geocodingError = err.message;
    }
  }
  restaurants = rankRestaurants(q, restaurants.filter((r) => !coveredByRegistry(r)));
  let restaurantTotal = restaurants.length;
  for (const r of restaurants.slice(0, MAX_RESTAURANT_CANDIDATES)) candidates.push(restaurantCandidate(r));

  try {
    for (const g of await geocodeMumbai(q, timeoutMs)) {
      if (!candidates.some((c) => Math.abs(c.destination.forecastPoint.lat - g.lat) < 1e-4 && c.source === 'geonames')) {
        candidates.push(placeCandidate(g));
      }
    }
  } catch (err: any) {
    geocodingError = err.message;
  }

  // A locality hit that is only the forecast point of a single matched venue adds no ambiguity.
  // Google Maps is paid per search: ask it only when nothing else knows the name,
  // and never for a plain locality ("Vile Parle").
  if (candidates.length === 0) {
    try {
      const google = rankRestaurants(q, await searchRestaurantsGoogle(q, timeoutMs));
      restaurantTotal = google.length;
      for (const r of google.slice(0, MAX_RESTAURANT_CANDIDATES)) candidates.push(restaurantCandidate(r));
    } catch (err: any) {
      geocodingError = err.message;
    }
  }

  const venues = candidates.filter((c) => c.source === 'registry' || c.source === 'osm' || c.source === 'google');
  const places = candidates.filter((c) => c.source === 'geonames');
  // An exact locality name ("Juhu") means the locality — not venues located there or
  // prefix matches like "Juhu Island". With no exact locality, venues take priority.
  const exactPlaces = places.filter((p) => foldName(p.destination.name) === foldName(q));
  const final = exactPlaces.length > 0 ? exactPlaces : venues.length > 0 ? venues : candidates;

  if (final.length === 0) {
    return {
      query: q,
      status: 'not_found',
      candidates: [],
      message: geocodingError
        ? `Could not look up "${q}" (${geocodingError}). Try again or enter a nearby Mumbai locality.`
        : `"${q}" was not found among Mumbai restaurants or localities. Check the spelling, or enter a nearby locality (e.g. Bandra, Colaba, Juhu).`,
      geocodingError,
    };
  }
  if (final.length === 1) {
    return { query: q, status: 'resolved', candidates: final, message: `Resolved to ${final[0].destination.name}.`, geocodingError };
  }
  return {
    query: q,
    status: 'ambiguous',
    candidates: final,
    message:
      final === venues && restaurantTotal > MAX_RESTAURANT_CANDIDATES
        ? `"${q}" matches ${restaurantTotal} Mumbai restaurants; showing the first ${MAX_RESTAURANT_CANDIDATES}. Add the area (e.g. "${q} Bandra") to narrow it down, or choose one.`
        : `"${q}" matches ${final.length} places. Please choose one before weather is fetched.`,
    geocodingError,
  };
}

export function venueById(id: string | undefined): VenueRecord | null {
  return id ? REPUTED_VENUES.find((v) => v.id === id) ?? null : null;
}
