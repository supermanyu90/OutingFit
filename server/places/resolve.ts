/**
 * Destination resolution: curated venue registry + GeoNames localities.
 *
 * Returns every plausible candidate. The caller must ask the user to choose
 * when more than one candidate is returned — weather is never fetched for an
 * unconfirmed guess.
 */

import { REPUTED_VENUES, VenueRecord } from '../data/mumbaiRegistry.ts';
import { foldName, geocodeMumbai, GeocodeCandidate } from '../weather/openMeteo.ts';
import { ResolvedDestination } from '../domain.ts';

export const REGISTRY_SOURCE = 'OutingFit curated venue registry (not independently verified)';

export interface DestinationCandidate {
  id: string;
  destination: ResolvedDestination;
  subtitle: string;
  source: 'registry' | 'geonames';
}

export interface ResolveResult {
  query: string;
  status: 'resolved' | 'ambiguous' | 'not_found';
  candidates: DestinationCandidate[];
  message: string;
  geocodingError?: string;
}

function registryMatches(query: string): VenueRecord[] {
  const q = foldName(query);
  if (!q) return [];
  const tokens = q.split(' ').filter((t) => t.length >= 3);
  const names = (v: VenueRecord) => [v.name, ...v.aliases].map(foldName);
  // Tier 1: the query is (part of) a venue name or alias — "bastian" hits both branches,
  // "bastian at the top" only the Dadar one.
  const direct = REPUTED_VENUES.filter((v) => names(v).some((n) => n.includes(q)));
  if (direct.length) return direct;
  // Tier 2: a longer sentence that contains a venue name or its first word.
  const contained = REPUTED_VENUES.filter((v) => {
    if (names(v).some((n) => n.length >= 4 && q.includes(n))) return true;
    const first = foldName(v.name).split(' ')[0];
    return first.length >= 4 && tokens.includes(first);
  });
  if (contained.length) return contained;
  // Tier 3: one-letter spelling variants from speech recognition or transliteration
  // ("Bastion" → "Bastian"). Still returns every match so the user confirms.
  return REPUTED_VENUES.filter((v) => {
    const words = new Set(names(v).flatMap((n) => n.split(' ')).filter((w) => w.length >= 5));
    return tokens.some((t) => t.length >= 5 && [...words].some((w) => editDistance(t, w) <= 1));
  });
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

  for (const v of registryMatches(q)) {
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
  const venues = candidates.filter((c) => c.source === 'registry');
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
        : `"${q}" was not found in the venue registry or as a Mumbai locality. Enter a nearby locality (e.g. Bandra, Colaba, Juhu).`,
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
    message: `"${q}" matches ${final.length} places. Please choose one before weather is fetched.`,
    geocodingError,
  };
}

export function venueById(id: string | undefined): VenueRecord | null {
  return id ? REPUTED_VENUES.find((v) => v.id === id) ?? null : null;
}
