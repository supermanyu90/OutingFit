/**
 * Explicit, deterministic decision layer.
 *
 * Every Wear / Carry / Check item is produced here from retrieved weather
 * values, stated preferences, or venue facts, and carries the evidence that
 * triggered it. Gemma later personalises and explains these items but cannot
 * add, remove or re-prioritise them.
 */

import { OutingRequest } from '../domain.ts';
import { OutingWeather, WindowAggregate } from '../weather/outingWindow.ts';
import { DecisionConfig } from './config.ts';

export type Card = 'wear' | 'carry' | 'check';
export type Priority = 'essential' | 'recommended' | 'optional' | 'info';

export type Evidence =
  | {
      kind: 'weather';
      field: WeatherField;
      value: number;
      unit: string;
      scope: 'departure' | 'return' | 'outdoor' | 'window' | 'daily';
      at?: string;
      threshold?: number;
      comparator?: '>=' | '<';
    }
  | { kind: 'weather_time'; field: 'sunset' | 'sunrise'; value: string }
  | { kind: 'preference'; field: string; value: string }
  | { kind: 'venue'; field: string; value: string; source: string; confirmed: boolean }
  | { kind: 'status'; field: string; value: string };

export type WeatherField =
  | 'feels_like_max'
  | 'temperature_max'
  | 'humidity_max'
  | 'uv_index_max_hourly'
  | 'uv_index_max_daily'
  | 'rain_probability_max'
  | 'precipitation_total'
  | 'precipitation_max_hourly'
  | 'gust_max'
  | 'wind_max';

export interface Decision {
  id: string;
  card: Card;
  priority: Priority;
  /** Baseline English label; Gemma localises it. */
  label: string;
  evidence: Evidence[];
  /** Factual caveat shown verbatim (e.g. what makes a product's UV claim verifiable). */
  productNote?: string;
  /** True for physical items someone might buy; enables the "Already own this?" control. */
  ownable: boolean;
}

export interface VenueFacts {
  name: string;
  dressCode?: string;
  source: string;
  /** Registry facts are curated but unconfirmed; they never override user input. */
  confirmed: boolean;
}

export interface WaterloggingStatus {
  status: 'unknown' | 'reports_available';
  message: string;
  reports: Array<{ location: string; description: string; source: string; reportedAt: string; ageMinutes: number; isDemo: boolean }>;
}

export interface DecisionInput {
  request: OutingRequest;
  weather: OutingWeather | null;
  weatherUsable: boolean;
  weatherProblem?: string;
  venue: VenueFacts | null;
  waterlogging: WaterloggingStatus;
}

export interface DecisionResult {
  decisions: Decision[];
  exposure: { level: OutingRequest['outdoorExposure']; sheltered: boolean; description: string };
}

const SUNGLASSES_NOTE =
  'Only lenses labelled UV400 or certified to ISO 12312-1 have verified UV protection; tinted lenses without that label may not block UV.';
const CLOTHING_UV_NOTE =
  'Ordinary clothing is not UV-rated. Tightly woven fabric gives more shade, but only garments with a UPF label have tested UV protection.';
const SUNSCREEN_NOTE = 'Use a broad-spectrum sunscreen labelled SPF 30 or higher.';

function w(
  field: WeatherField,
  value: number | null,
  unit: string,
  scope: Extract<Evidence, { kind: 'weather' }>['scope'],
  threshold?: number,
  at?: string
): Evidence[] {
  if (value === null) return [];
  return [{ kind: 'weather', field, value, unit, scope, threshold, comparator: threshold !== undefined ? '>=' : undefined, at }];
}

export function runDecisionLayer(input: DecisionInput, cfg: DecisionConfig): DecisionResult {
  const { request: r, weather, weatherUsable, venue, waterlogging } = input;
  const out: Decision[] = [];
  const add = (d: Decision) => out.push(d);

  const sheltered = r.transport === 'car' && r.coveredDropOff === 'yes' && r.outdoorExposure === 'minimal';
  const exposureDescription = sheltered
    ? 'Car with confirmed covered drop-off and minimal time outdoors'
    : r.outdoorExposure === 'minimal'
      ? `Short outdoor transitions (up to ~${cfg.exposure.minimalMinutes} min)${r.coveredDropOff === 'unknown' ? '; drop-off cover not confirmed' : r.coveredDropOff === 'no' ? '; uncovered drop-off' : ''}`
      : r.outdoorExposure === 'moderate'
        ? `Some time outdoors (~${cfg.exposure.minimalMinutes}–${cfg.exposure.moderateMinutes} min)`
        : `Substantial time outdoors (over ~${cfg.exposure.moderateMinutes} min)`;
  const substantial = r.outdoorExposure !== 'minimal';

  const exposurePref: Evidence = { kind: 'preference', field: 'outdoor_exposure', value: r.outdoorExposure };
  const transportPref: Evidence = { kind: 'preference', field: 'transport', value: r.transport };
  const dropOffPref: Evidence = { kind: 'preference', field: 'covered_drop_off', value: r.coveredDropOff };

  // ------------------------------------------------------------------ weather
  if (weatherUsable && weather?.whole) {
    const whole: WindowAggregate = weather.whole;
    const outdoorAgg = weather.outdoor?.aggregate ?? whole;
    const outdoorScope = weather.outdoor?.period.source === 'user' ? 'outdoor' : 'window';

    // Heat & humidity → fabric, fit, layers
    const feels = whole.feelsLikeMaxC;
    const hum = whole.humidityMaxPct;
    const warm = feels !== null && feels >= cfg.heat.feelsLikeWarmC;
    const humid = hum !== null && hum >= cfg.heat.humidityHighPct;
    if (warm || humid) {
      add({
        id: 'wear.breathable_fabric',
        card: 'wear',
        priority: sheltered ? 'optional' : 'recommended',
        label: 'Light, breathable natural or moisture-wicking fabric (cotton, linen, or a performance blend)',
        evidence: [
          ...w('feels_like_max', feels, '°C', 'window', warm ? cfg.heat.feelsLikeWarmC : undefined),
          ...w('humidity_max', hum, '%', 'window', humid ? cfg.heat.humidityHighPct : undefined),
        ],
        ownable: false,
      });
    }
    if ((feels !== null && feels >= cfg.heat.feelsLikeHotC) || (warm && humid)) {
      add({
        id: 'wear.loose_fit',
        card: 'wear',
        priority: sheltered ? 'optional' : 'recommended',
        label: 'Loose, single-layer fit that lets air move; skip outdoor layers',
        evidence: [
          ...w('feels_like_max', feels, '°C', 'window', feels !== null && feels >= cfg.heat.feelsLikeHotC ? cfg.heat.feelsLikeHotC : cfg.heat.feelsLikeWarmC),
          ...w('humidity_max', hum, '%', 'window', humid ? cfg.heat.humidityHighPct : undefined),
        ],
        ownable: false,
      });
    }
    if (feels !== null && feels >= cfg.heat.feelsLikeHotC && substantial) {
      add({
        id: 'carry.water',
        card: 'carry',
        priority: 'recommended',
        label: 'Water bottle',
        evidence: [...w('feels_like_max', feels, '°C', 'window', cfg.heat.feelsLikeHotC), exposurePref],
        ownable: true,
      });
    }

    // UV & exposure → coverage, sunglasses, hat, sunscreen
    const uv = outdoorAgg.uvIndexMaxHourly;
    const uvAt = outdoorAgg.uvIndexMaxHourlyAt ?? undefined;
    if (uv !== null && !sheltered && uv >= cfg.uv.protectFrom) {
      const uvEv = w('uv_index_max_hourly', uv, '', outdoorScope, cfg.uv.protectFrom, uvAt);
      if (substantial && uv >= cfg.uv.high) {
        add({
          id: 'wear.sun_coverage',
          card: 'wear',
          priority: uv >= cfg.uv.veryHigh && r.outdoorExposure === 'extended' ? 'essential' : 'recommended',
          label: 'Light, loosely woven long sleeves or a breathable cover-up for the time outdoors',
          evidence: [...w('uv_index_max_hourly', uv, '', outdoorScope, cfg.uv.high, uvAt), exposurePref],
          productNote: CLOTHING_UV_NOTE,
          ownable: false,
        });
        add({
          id: 'carry.hat',
          card: 'carry',
          priority: r.outdoorExposure === 'extended' ? 'recommended' : 'optional',
          label: 'Wide-brimmed hat or cap',
          evidence: [...w('uv_index_max_hourly', uv, '', outdoorScope, cfg.uv.high, uvAt), exposurePref],
          ownable: true,
        });
      }
      add({
        id: 'carry.sunglasses',
        card: 'carry',
        priority: substantial && uv >= cfg.uv.high ? 'recommended' : 'optional',
        label: 'Sunglasses (check the UV label)',
        evidence: [...uvEv, exposurePref],
        productNote: SUNGLASSES_NOTE,
        ownable: true,
      });
      if (substantial) {
        add({
          id: 'carry.sunscreen',
          card: 'carry',
          priority: uv >= cfg.uv.veryHigh && r.outdoorExposure === 'extended' ? 'essential' : 'recommended',
          label: 'Sunscreen for exposed skin',
          evidence: [...uvEv, exposurePref],
          productNote: SUNSCREEN_NOTE,
          ownable: true,
        });
      }
    }

    // Rain, wind & walking → rain protection
    const pMax = whole.rainProbabilityMaxPct;
    const pTot = whole.precipitationTotalMm;
    const pHr = whole.precipitationMaxHourlyMm;
    const gust = whole.gustMaxKmh;
    const rainPossible =
      (pMax !== null && pMax >= cfg.rain.probabilityPossiblePct) || (pTot !== null && pTot >= cfg.rain.amountMeaningfulMm);
    const rainLikely =
      (pMax !== null && pMax >= cfg.rain.probabilityLikelyPct) || (pHr !== null && pHr >= cfg.rain.hourlyHeavyMm);
    const rainEv = [
      ...w('rain_probability_max', pMax, '%', 'window', pMax !== null && pMax >= cfg.rain.probabilityPossiblePct ? (rainLikely && pMax >= cfg.rain.probabilityLikelyPct ? cfg.rain.probabilityLikelyPct : cfg.rain.probabilityPossiblePct) : undefined),
      ...w('precipitation_total', pTot, 'mm', 'window', pTot !== null && pTot >= cfg.rain.amountMeaningfulMm ? cfg.rain.amountMeaningfulMm : undefined),
    ];
    if (rainPossible) {
      add({
        id: 'carry.umbrella',
        card: 'carry',
        priority: sheltered ? 'optional' : rainLikely ? 'essential' : 'recommended',
        label: sheltered ? 'Compact umbrella, just in case' : 'Compact umbrella',
        evidence: [...rainEv, transportPref, dropOffPref, exposurePref],
        ownable: true,
      });
      if (gust !== null && gust >= cfg.wind.gustUmbrellaDifficultKmh && !sheltered) {
        add({
          id: 'carry.rain_jacket',
          card: 'carry',
          priority: substantial ? 'recommended' : 'optional',
          label: 'Light hooded rain jacket (gusts make umbrellas hard to use)',
          evidence: [...w('gust_max', gust, 'km/h', 'window', cfg.wind.gustUmbrellaDifficultKmh), ...rainEv.slice(0, 1), exposurePref],
          ownable: true,
        });
      }
    }
    if (rainLikely && !sheltered) {
      add({
        id: 'wear.wet_weather_footwear',
        card: 'wear',
        priority: 'recommended',
        label: 'Closed, grippy footwear that tolerates water; avoid suede and smooth leather soles',
        evidence: [...rainEv, ...w('precipitation_max_hourly', pHr, 'mm', 'window', pHr !== null && pHr >= cfg.rain.hourlyHeavyMm ? cfg.rain.hourlyHeavyMm : undefined), exposurePref],
        ownable: false,
      });
      add({
        id: 'wear.quick_dry',
        card: 'wear',
        priority: 'optional',
        label: 'Quick-drying fabric and hems that stay clear of the ground',
        evidence: rainEv,
        ownable: false,
      });
    }

    // Sunset relative to return
    const sunset = weather.daily?.sunset;
    if (sunset && weather.window.end > sunset && weather.window.start < sunset) {
      add({
        id: 'check.after_sunset',
        card: 'check',
        priority: 'info',
        label: 'Part of the outing is after sunset; sun protection is only relevant before then',
        evidence: [{ kind: 'weather_time', field: 'sunset', value: sunset.slice(11, 16) }],
        ownable: false,
      });
    }

    if (substantial && pMax !== null && pMax < cfg.rain.probabilityPossiblePct && uv !== null && uv < cfg.uv.protectFrom && !warm) {
      // Explicit "nothing needed" helps users avoid unnecessary purchases.
      add({
        id: 'check.no_weather_gear',
        card: 'check',
        priority: 'info',
        label: 'No rain or sun gear needed for this window',
        evidence: [
          ...w('rain_probability_max', pMax, '%', 'window'),
          ...w('uv_index_max_hourly', uv, '', outdoorScope),
        ],
        ownable: false,
      });
    }
  } else {
    add({
      id: 'check.weather_unavailable',
      card: 'check',
      priority: 'essential',
      label: 'Weather-based advice is not available for this outing',
      evidence: [{ kind: 'status', field: 'weather', value: input.weatherProblem || 'unavailable' }],
      ownable: false,
    });
  }

  // ------------------------------------------------------- indoor AC (prefs)
  if (r.feelsColdInAc) {
    const acKnown = r.indoorAc === 'confirmed' || r.indoorAc === 'user_expects';
    if (acKnown) {
      add({
        id: 'wear.ac_layer',
        card: 'wear',
        priority: 'recommended',
        label: 'Light layer (shawl, cardigan or overshirt) to put on indoors',
        evidence: [
          { kind: 'preference', field: 'feels_cold_in_ac', value: 'yes' },
          { kind: 'preference', field: 'indoor_ac', value: r.indoorAc },
        ],
        productNote: cfg.ac.coolIndoorNote,
        ownable: true,
      });
    } else if (r.indoorAc === 'unknown') {
      add({
        id: 'wear.ac_layer',
        card: 'wear',
        priority: 'optional',
        label: 'Light layer you can carry in case the venue is air-conditioned',
        evidence: [
          { kind: 'preference', field: 'feels_cold_in_ac', value: 'yes' },
          { kind: 'preference', field: 'indoor_ac', value: 'unknown' },
        ],
        productNote: cfg.ac.coolIndoorNote,
        ownable: true,
      });
      add({
        id: 'check.indoor_ac',
        card: 'check',
        priority: 'recommended',
        label: 'Ask the venue whether seating is air-conditioned',
        evidence: [{ kind: 'preference', field: 'indoor_ac', value: 'unknown' }],
        ownable: false,
      });
    }
  }

  // ------------------------------------------------------ formality & colour
  const formalityEvidence: Evidence[] = [];
  if (r.occasion) formalityEvidence.push({ kind: 'preference', field: 'occasion', value: r.occasion });
  if (r.formality !== 'unknown') formalityEvidence.push({ kind: 'preference', field: 'formality', value: r.formality });
  if (venue?.dressCode) {
    formalityEvidence.push({ kind: 'venue', field: 'dress_code', value: venue.dressCode, source: venue.source, confirmed: venue.confirmed });
  }
  if (formalityEvidence.length) {
    add({
      id: 'wear.formality',
      card: 'wear',
      priority: 'info',
      label: 'Match the formality of the occasion and venue',
      evidence: formalityEvidence,
      ownable: false,
    });
  }
  if (r.colourPreference) {
    add({
      id: 'wear.colour',
      card: 'wear',
      priority: 'optional',
      label: 'Colour (secondary to comfort)',
      evidence: [{ kind: 'preference', field: 'colour_preference', value: r.colourPreference }],
      ownable: false,
    });
  }

  // ------------------------------------------------------------------ checks
  if (r.transport === 'car' && r.coveredDropOff === 'unknown') {
    add({
      id: 'check.drop_off_cover',
      card: 'check',
      priority: 'recommended',
      label: 'Check whether the car can drop you under cover at the entrance',
      evidence: [dropOffPref, transportPref],
      ownable: false,
    });
  }
  if (venue?.dressCode && !venue.confirmed && (r.formality === 'formal' || r.formality === 'smart_casual')) {
    add({
      id: 'check.dress_code',
      card: 'check',
      priority: 'recommended',
      label: 'Confirm the dress code with the venue',
      evidence: [{ kind: 'venue', field: 'dress_code', value: venue.dressCode, source: venue.source, confirmed: false }],
      ownable: false,
    });
  }
  add({
    id: 'check.waterlogging',
    card: 'check',
    priority: waterlogging.status === 'reports_available' ? 'recommended' : 'info',
    label:
      waterlogging.status === 'reports_available'
        ? 'Review the waterlogging reports below before choosing a route'
        : 'Local waterlogging status unknown',
    evidence: [{ kind: 'status', field: 'waterlogging', value: waterlogging.status }],
    ownable: false,
  });

  return { decisions: out, exposure: { level: r.outdoorExposure, sheltered, description: exposureDescription } };
}
