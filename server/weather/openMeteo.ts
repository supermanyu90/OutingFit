/**
 * Open-Meteo forecast + geocoding client.
 *
 * Provider facts (verified against https://open-meteo.com/en/docs, /en/terms,
 * /en/docs/geocoding-api on 2026-10-04):
 * - Hourly temperature_2m, apparent_temperature (°C), relative_humidity_2m (%),
 *   precipitation_probability (%), precipitation (mm), uv_index (index),
 *   wind_speed_10m, wind_gusts_10m (km/h), cloud_cover (%); daily sunrise,
 *   sunset (ISO8601 local), uv_index_max. "current" exposes the same variables
 *   at 15-minute intervals (model data, not a station observation).
 * - Forecast horizon: up to 16 days. Hourly resolution in India (15-minutely
 *   data is native only in Central Europe / North America).
 * - precipitation_probability comes from ensemble models at 0.25° (~27 km).
 * - Free tier: non-commercial use only, <10,000 calls/day, <5,000/hour,
 *   <600/minute. Data licensed CC BY 4.0 — attribution required.
 * - Geocoding is GeoNames-based: localities and admin areas, not venues/POIs.
 */

import { z } from 'zod';

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export const PROVIDER_INFO = {
  name: 'Open-Meteo',
  model: 'best_match (Open-Meteo automatic model selection)',
  docsUrl: 'https://open-meteo.com/en/docs',
  attribution: 'Weather data by Open-Meteo.com',
  attributionUrl: 'https://open-meteo.com/',
  licence: 'CC BY 4.0',
  geocodingAttribution: 'Location data based on GeoNames (via Open-Meteo Geocoding API)',
  resolutionNote:
    'Hourly forecast. Rain probability is derived from ensemble models at ~27 km resolution; other fields come from the best-match deterministic model for the grid cell.',
  usageLimits: 'Free tier: non-commercial use, <10,000 calls/day, <5,000/hour, <600/minute.',
  horizonDays: 16,
} as const;

export const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'uv_index',
  'wind_speed_10m',
  'wind_gusts_10m',
  'cloud_cover',
] as const;
export type HourlyVar = (typeof HOURLY_VARS)[number];

const CURRENT_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'uv_index',
  'wind_speed_10m',
  'wind_gusts_10m',
  'cloud_cover',
] as const;

const DAILY_VARS = ['sunrise', 'sunset', 'uv_index_max'] as const;

const nullableNumberArray = z.array(z.number().nullable());

const hourlyShape = Object.fromEntries(HOURLY_VARS.map((v) => [v, nullableNumberArray.optional()])) as Record<
  HourlyVar,
  z.ZodOptional<typeof nullableNumberArray>
>;

export const ForecastResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  timezone: z.literal('Asia/Kolkata'),
  utc_offset_seconds: z.literal(19800),
  current_units: z.record(z.string(), z.string()).optional(),
  current: z
    .object({ time: z.string(), interval: z.number() })
    .catchall(z.number().nullable())
    .optional(),
  hourly_units: z.record(z.string(), z.string()),
  hourly: z.object({ time: z.array(z.string()) }).extend(hourlyShape),
  daily: z.object({
    time: z.array(z.string()),
    sunrise: z.array(z.string().nullable()).optional(),
    sunset: z.array(z.string().nullable()).optional(),
    uv_index_max: nullableNumberArray.optional(),
  }),
});
export type ForecastResponse = z.infer<typeof ForecastResponseSchema>;

/** Physically plausible ranges; values outside are discarded (shown as unavailable), never clamped. */
export const PLAUSIBLE_RANGES: Record<HourlyVar | 'uv_index_max', [number, number]> = {
  temperature_2m: [-10, 55],
  apparent_temperature: [-20, 70],
  relative_humidity_2m: [0, 100],
  precipitation_probability: [0, 100],
  precipitation: [0, 500],
  uv_index: [0, 20],
  wind_speed_10m: [0, 300],
  wind_gusts_10m: [0, 400],
  cloud_cover: [0, 100],
  uv_index_max: [0, 20],
};

export const EXPECTED_UNITS: Partial<Record<HourlyVar, string>> = {
  temperature_2m: '°C',
  apparent_temperature: '°C',
  relative_humidity_2m: '%',
  precipitation_probability: '%',
  precipitation: 'mm',
  wind_speed_10m: 'km/h',
  wind_gusts_10m: 'km/h',
  cloud_cover: '%',
};

export interface ValidatedForecast {
  raw: ForecastResponse;
  warnings: string[];
}

/**
 * Validate structure, units and plausibility. Implausible values are replaced
 * with null and reported in warnings, so the UI shows "unavailable" rather than
 * a silently corrected number.
 */
export function validateForecast(json: unknown): ValidatedForecast {
  const parsed = ForecastResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new WeatherProviderError('invalid_response', `Forecast response failed schema validation: ${parsed.error.issues[0]?.message}`);
  }
  const raw = parsed.data;
  const warnings: string[] = [];
  const n = raw.hourly.time.length;
  if (n === 0) throw new WeatherProviderError('invalid_response', 'Forecast contains no hourly rows');

  for (const v of HOURLY_VARS) {
    const arr = raw.hourly[v];
    if (!arr) {
      warnings.push(`${v} missing from provider response`);
      continue;
    }
    if (arr.length !== n) {
      throw new WeatherProviderError('invalid_response', `hourly.${v} length ${arr.length} != time length ${n}`);
    }
    const expected = EXPECTED_UNITS[v];
    const got = raw.hourly_units[v];
    if (expected && got !== expected) {
      throw new WeatherProviderError('invalid_response', `Unexpected unit for ${v}: "${got}" (expected "${expected}")`);
    }
    const [lo, hi] = PLAUSIBLE_RANGES[v];
    let dropped = 0;
    for (let i = 0; i < n; i++) {
      const x = arr[i];
      if (x !== null && (x < lo || x > hi)) {
        arr[i] = null;
        dropped++;
      }
    }
    if (dropped) warnings.push(`${dropped} implausible ${v} value(s) discarded`);
  }
  const uvMax = raw.daily.uv_index_max;
  if (uvMax) {
    const [lo, hi] = PLAUSIBLE_RANGES.uv_index_max;
    for (let i = 0; i < uvMax.length; i++) {
      const x = uvMax[i];
      if (x !== null && (x < lo || x > hi)) uvMax[i] = null;
    }
  }
  return { raw, warnings };
}

export class WeatherProviderError extends Error {
  constructor(
    public readonly kind: 'timeout' | 'http' | 'network' | 'invalid_response' | 'simulated',
    message: string
  ) {
    super(message);
  }
}

export function buildForecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: HOURLY_VARS.join(','),
    current: CURRENT_VARS.join(','),
    daily: DAILY_VARS.join(','),
    timezone: 'Asia/Kolkata',
    forecast_days: String(PROVIDER_INFO.horizonDays),
    wind_speed_unit: 'kmh',
    temperature_unit: 'celsius',
    precipitation_unit: 'mm',
  });
  return `${OPEN_METEO_FORECAST_URL}?${params}`;
}

// ---------------------------------------------------------------------------
// Fetch with timeout + short-lived cache that can serve explicitly-stale data
// ---------------------------------------------------------------------------

export interface ForecastFetchResult {
  forecast: ValidatedForecast;
  retrievedAt: string;
  fromCache: boolean;
  cacheAgeSeconds: number;
  stale: boolean;
  staleReason?: string;
}

interface CacheEntry {
  forecast: ValidatedForecast;
  retrievedAtMs: number;
}

const cache = new Map<string, CacheEntry>();

export const CACHE_TTL_SECONDS = Number(process.env.WEATHER_CACHE_TTL_SECONDS || 600);
/** Stale forecasts older than this are not served at all. */
export const STALE_MAX_SECONDS = Number(process.env.WEATHER_STALE_MAX_SECONDS || 3 * 3600);

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

export function clearForecastCache(): void {
  cache.clear();
}

export async function getForecast(
  lat: number,
  lon: number,
  opts: { timeoutMs: number; simulateFailure?: boolean; fetchImpl?: typeof fetch; nowMs?: number }
): Promise<ForecastFetchResult> {
  const key = cacheKey(lat, lon);
  const now = opts.nowMs ?? Date.now();
  const hit = cache.get(key);
  const ageOf = (e: CacheEntry) => Math.round((now - e.retrievedAtMs) / 1000);

  if (hit && !opts.simulateFailure && ageOf(hit) <= CACHE_TTL_SECONDS) {
    return {
      forecast: hit.forecast,
      retrievedAt: new Date(hit.retrievedAtMs).toISOString(),
      fromCache: true,
      cacheAgeSeconds: ageOf(hit),
      stale: false,
    };
  }

  try {
    if (opts.simulateFailure) {
      throw new WeatherProviderError('simulated', 'Simulated weather provider outage (test scenario)');
    }
    const json = await fetchJsonWithTimeout(buildForecastUrl(lat, lon), opts.timeoutMs, opts.fetchImpl);
    const forecast = validateForecast(json);
    cache.set(key, { forecast, retrievedAtMs: now });
    return { forecast, retrievedAt: new Date(now).toISOString(), fromCache: false, cacheAgeSeconds: 0, stale: false };
  } catch (err) {
    const e = toProviderError(err);
    if (hit && ageOf(hit) <= STALE_MAX_SECONDS) {
      return {
        forecast: hit.forecast,
        retrievedAt: new Date(hit.retrievedAtMs).toISOString(),
        fromCache: true,
        cacheAgeSeconds: ageOf(hit),
        stale: true,
        staleReason: e.message,
      };
    }
    throw e;
  }
}

/** Test hook: seed the cache with a forecast retrieved at a given time. */
export function seedForecastCache(lat: number, lon: number, forecast: ValidatedForecast, retrievedAtMs: number): void {
  cache.set(cacheKey(lat, lon), { forecast, retrievedAtMs });
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new WeatherProviderError('http', `Open-Meteo HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function toProviderError(err: unknown): WeatherProviderError {
  if (err instanceof WeatherProviderError) return err;
  const e = err as Error;
  if (e?.name === 'AbortError') return new WeatherProviderError('timeout', 'Open-Meteo request timed out');
  return new WeatherProviderError('network', `Open-Meteo request failed: ${e?.message || String(err)}`);
}

// ---------------------------------------------------------------------------
// Geocoding (GeoNames via Open-Meteo), restricted to Greater Mumbai
// ---------------------------------------------------------------------------

export const MUMBAI_CENTRE = { lat: 19.0, lon: 72.85 };
export const MUMBAI_RADIUS_KM = Number(process.env.MUMBAI_RADIUS_KM || 45);
const DEDUPE_KM = 5;

export interface GeocodeCandidate {
  name: string;
  admin1?: string;
  admin2?: string;
  featureCode?: string;
  lat: number;
  lon: number;
  distanceFromCentreKm: number;
}

const GeocodeResponseSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        admin1: z.string().optional(),
        admin2: z.string().optional(),
        feature_code: z.string().optional(),
        country_code: z.string().optional(),
      })
    )
    .optional(),
});

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function foldName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const geocodeCache = new Map<string, { at: number; results: GeocodeCandidate[] }>();

/**
 * Geocode a Mumbai locality. Results are filtered to Maharashtra within
 * MUMBAI_RADIUS_KM of the city centre AND to names that actually match the
 * query (GeoNames fuzzy prefix matching otherwise returns e.g. "Dāvrapāda" for
 * "Dadar"). Points closer than DEDUPE_KM to an earlier result are
 * de-duplicated: at forecast-model resolution (~9–27 km) they are the same place.
 */
export async function geocodeMumbai(query: string, timeoutMs: number): Promise<GeocodeCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = foldName(q);
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.at < 24 * 3600_000) return cached.results;

  const params = new URLSearchParams({ name: q, count: '10', countryCode: 'IN', language: 'en', format: 'json' });
  const json = await fetchJsonWithTimeout(`${OPEN_METEO_GEOCODING_URL}?${params}`, timeoutMs);
  const parsed = GeocodeResponseSchema.safeParse(json);
  if (!parsed.success) throw new WeatherProviderError('invalid_response', 'Geocoding response failed validation');

  const folded = foldName(q);
  const out: GeocodeCandidate[] = [];
  for (const r of parsed.data.results || []) {
    if (r.admin1 !== 'Maharashtra') continue;
    const dist = haversineKm(MUMBAI_CENTRE, { lat: r.latitude, lon: r.longitude });
    if (dist > MUMBAI_RADIUS_KM) continue;
    const name = foldName(r.name);
    if (!(name.startsWith(folded) || folded.startsWith(name))) continue;
    const c: GeocodeCandidate = {
      name: r.name,
      admin1: r.admin1,
      admin2: r.admin2,
      featureCode: r.feature_code,
      lat: r.latitude,
      lon: r.longitude,
      distanceFromCentreKm: Math.round(dist * 10) / 10,
    };
    if (out.some((o) => haversineKm(o, c) < DEDUPE_KM)) continue;
    out.push(c);
  }
  geocodeCache.set(key, { at: Date.now(), results: out });
  return out;
}
