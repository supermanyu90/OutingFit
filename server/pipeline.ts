/**
 * Outing recommendation pipeline:
 *   confirmed destination → forecast for the outing window → decision layer →
 *   Gemma personalisation (validated) → cards + spoken summary.
 */

import { OutingRequest } from './domain.ts';
import { Decision, Evidence, Priority, runDecisionLayer, VenueFacts, WaterloggingStatus } from './decision/engine.ts';
import { loadDecisionConfig } from './decision/config.ts';
import { getForecast, PROVIDER_INFO, validateForecast, ValidatedForecast } from './weather/openMeteo.ts';
import { buildOutingWeather, OutingWeather } from './weather/outingWindow.ts';
import { buildFixtureForecast, FIXTURE_LABELS } from './weather/fixtures.ts';
import { GemmaClient } from './gemma/gemmaClient.ts';
import { personalizeWithGemma, PersonalizeResult } from './gemma/personalize.ts';
import { REGISTRY_SOURCE, venueById } from './places/resolve.ts';
import { demoWaterloggingStatus, liveWaterloggingStatus } from './waterlogging.ts';
import { nowInMumbai } from './lib/time.ts';
import { selectWardrobe, WardrobeResult } from './wardrobe/select.ts';

export type WeatherDataStatus = 'live' | 'cached' | 'stale' | 'unavailable' | 'fixture';

export interface WeatherSection {
  dataStatus: WeatherDataStatus;
  usable: boolean;
  notice?: string;
  provider: typeof PROVIDER_INFO;
  location: { label: string; requestedLat: number; requestedLon: number; gridLat?: number; gridLon?: number; elevationM?: number };
  retrievedAt?: string;
  cacheAgeSeconds?: number;
  warnings: string[];
  outing: OutingWeather | null;
  fixtureLabel?: string;
}

export interface CardItem {
  id: string;
  priority: Priority;
  title: string;
  explanation: string | null;
  baseline: string;
  evidence: Evidence[];
  productNote?: string;
  ownable: boolean;
  textSource: 'gemma' | 'rules';
}

export interface OutingResult {
  request: OutingRequest;
  generatedAt: string;
  destination: OutingRequest['destination'];
  venueFacts: VenueFacts | null;
  weather: WeatherSection;
  waterlogging: WaterloggingStatus;
  exposure: { level: string; sheltered: boolean; description: string };
  cards: { wear: CardItem[]; carry: CardItem[]; check: CardItem[] };
  outfitSummary: string | null;
  /** Concrete outfit ideas across garment families, derived from the same decisions. */
  wardrobe: WardrobeResult;
  spoken: { text: string | null; language: OutingRequest['language']; unavailableReason?: string };
  gemma: {
    used: boolean;
    runtime?: string;
    model?: string;
    latencyMs?: number;
    validation: PersonalizeResult['validation'];
    attempts: PersonalizeResult['attempts'];
    error?: string;
  };
  decisions: Decision[];
  testFlags: string[];
  timingsMs: Record<string, number>;
}

export interface PipelineDeps {
  gemma: GemmaClient;
  weatherTimeoutMs: number;
  now?: () => Date;
}

export async function runOutingPipeline(req: OutingRequest, deps: PipelineDeps): Promise<OutingResult> {
  const now = deps.now?.() ?? new Date();
  const timings: Record<string, number> = {};
  const testFlags: string[] = [];
  if (req.fault) testFlags.push(`TEST: simulated ${req.fault === 'weather_down' ? 'weather provider outage' : 'Gemma outage'}`);
  if (req.weatherFixture) testFlags.push(FIXTURE_LABELS[req.weatherFixture]);

  const fp = req.destination.forecastPoint;
  const weather: WeatherSection = {
    dataStatus: 'unavailable',
    usable: false,
    provider: PROVIDER_INFO,
    location: { label: fp.label, requestedLat: fp.lat, requestedLon: fp.lon },
    warnings: [],
    outing: null,
  };

  // ---------------------------------------------------------------- weather
  const t0 = Date.now();
  let forecast: ValidatedForecast | null = null;
  try {
    if (req.weatherFixture) {
      forecast = validateForecast(buildFixtureForecast(req.weatherFixture, nowInMumbai(now).date, fp.lat, fp.lon));
      weather.dataStatus = 'fixture';
      weather.fixtureLabel = FIXTURE_LABELS[req.weatherFixture];
      weather.retrievedAt = now.toISOString();
    } else {
      const res = await getForecast(fp.lat, fp.lon, { timeoutMs: deps.weatherTimeoutMs, simulateFailure: req.fault === 'weather_down' });
      forecast = res.forecast;
      weather.retrievedAt = res.retrievedAt;
      weather.cacheAgeSeconds = res.cacheAgeSeconds;
      weather.dataStatus = res.stale ? 'stale' : res.fromCache ? 'cached' : 'live';
      if (res.stale) {
        weather.notice = `Live forecast unavailable (${res.staleReason}). Showing the forecast retrieved ${Math.round(res.cacheAgeSeconds / 60)} min ago — not live.`;
      }
    }
  } catch (err: any) {
    weather.dataStatus = 'unavailable';
    weather.notice = `Weather unavailable: ${err.message}. No cached forecast is recent enough to use, so no weather-based advice is given.`;
  }
  timings.weather = Date.now() - t0;

  if (forecast) {
    weather.warnings = forecast.warnings;
    weather.location.gridLat = forecast.raw.latitude;
    weather.location.gridLon = forecast.raw.longitude;
    weather.location.elevationM = forecast.raw.elevation;
    const outing = buildOutingWeather(forecast.raw, req, now);
    weather.outing = outing;
    weather.usable = outing.status === 'ok' || outing.status === 'partially_covered';
    if (!weather.usable) weather.notice = outing.statusMessage;
    else if (outing.status === 'partially_covered') weather.notice = outing.statusMessage;
  }

  // ------------------------------------------------------------ venue facts
  const venue = req.destination.kind === 'registry' ? venueById(req.destination.venueId) : null;
  const venueFacts: VenueFacts | null = venue
    ? {
        name: venue.name,
        dressCode: venue.dressCode && !/not confirmed/i.test(venue.dressCode) ? venue.dressCode : undefined,
        source: REGISTRY_SOURCE,
        confirmed: false,
      }
    : null;

  const waterlogging =
    req.weatherFixture === 'humid_rainy_evening' ? demoWaterloggingStatus(fp.label.split(',')[0], now) : liveWaterloggingStatus();

  // ---------------------------------------------------------- decision layer
  const cfg = loadDecisionConfig();
  const { decisions, exposure } = runDecisionLayer(
    {
      request: req,
      weather: weather.outing,
      weatherUsable: weather.usable,
      weatherProblem: weather.usable ? undefined : weather.notice,
      venue: venueFacts,
      waterlogging,
    },
    cfg
  );

  // -------------------------------------------------------------- Gemma step
  const t1 = Date.now();
  const weatherNote = !weather.usable
    ? `No usable forecast: ${weather.notice}`
    : weather.dataStatus === 'stale'
      ? 'Forecast is stale (not live); mention that it may be out of date.'
      : weather.dataStatus === 'fixture'
        ? 'Weather comes from a labelled test fixture.'
        : 'Live forecast for the outing window.';
  const personal = await personalizeWithGemma(
    deps.gemma,
    { request: req, weather: weather.usable ? weather.outing : null, weatherNote, decisions, exposureDescription: exposure.description },
    { simulateFailure: req.fault === 'gemma_down' }
  );
  timings.gemma = Date.now() - t1;

  const byId = new Map(personal.output?.items.map((i) => [i.id, i]) ?? []);
  const toCard = (d: Decision): CardItem => {
    const g = byId.get(d.id);
    return {
      id: d.id,
      priority: d.priority,
      title: g?.title ?? d.label,
      explanation: g?.explanation ?? null,
      baseline: d.label,
      evidence: d.evidence,
      productNote: d.productNote,
      ownable: d.ownable,
      textSource: g ? 'gemma' : 'rules',
    };
  };
  const order: Record<Priority, number> = { essential: 0, recommended: 1, optional: 2, info: 3 };
  const cards = { wear: [] as CardItem[], carry: [] as CardItem[], check: [] as CardItem[] };
  for (const d of [...decisions].sort((a, b) => order[a.priority] - order[b.priority])) cards[d.card].push(toCard(d));

  return {
    request: req,
    generatedAt: now.toISOString(),
    destination: req.destination,
    venueFacts,
    weather,
    waterlogging,
    exposure,
    cards,
    outfitSummary: personal.output?.outfitSummary ?? null,
    wardrobe: selectWardrobe(req, decisions, venueFacts),
    spoken: {
      text: personal.output?.spokenSummary ?? null,
      language: req.language,
      unavailableReason: personal.output
        ? undefined
        : `Gemma did not produce a validated summary (${personal.error}). Cards show the rule engine's items in English.`,
    },
    gemma: {
      used: !!personal.output,
      runtime: personal.gemma?.runtime,
      model: personal.gemma?.model,
      latencyMs: personal.gemma?.latencyMs,
      validation: personal.validation,
      attempts: personal.attempts,
      error: personal.error,
    },
    decisions,
    testFlags,
    timingsMs: timings,
  };
}
