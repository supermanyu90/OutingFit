/**
 * Turns a validated Open-Meteo forecast into the weather facts for one outing:
 * conditions at departure, during expected outdoor exposure, and at return,
 * plus window aggregates. Missing values stay null ("unavailable") — nothing is
 * interpolated or estimated.
 */

import { ForecastResponse, HourlyVar, HOURLY_VARS, PROVIDER_INFO } from './openMeteo.ts';
import { floorHour, nowInMumbai, resolveOutingWindow, OutingSchedule } from '../lib/time.ts';

export type Num = number | null;

export interface HourRow {
  time: string; // local Mumbai "YYYY-MM-DDTHH:00"
  temperatureC: Num;
  feelsLikeC: Num;
  humidityPct: Num;
  rainProbabilityPct: Num;
  precipitationMm: Num;
  uvIndex: Num;
  windKmh: Num;
  gustKmh: Num;
  cloudCoverPct: Num;
}

export interface WindowAggregate {
  from: string;
  to: string;
  hours: number;
  temperatureMaxC: Num;
  feelsLikeMaxC: Num;
  feelsLikeMinC: Num;
  humidityMaxPct: Num;
  rainProbabilityMaxPct: Num;
  precipitationTotalMm: Num;
  precipitationMaxHourlyMm: Num;
  uvIndexMaxHourly: Num;
  uvIndexMaxHourlyAt: string | null;
  windMaxKmh: Num;
  gustMaxKmh: Num;
  cloudCoverMeanPct: Num;
}

export interface OutdoorPeriod {
  start: string;
  end: string;
  source: 'user' | 'transitions';
}

export type WindowStatus = 'ok' | 'beyond_horizon' | 'in_past' | 'partially_covered';

export interface OutingWeather {
  status: WindowStatus;
  statusMessage?: string;
  window: { start: string; end: string; returnsNextDay: boolean; durationMinutes: number };
  horizon: { firstHour: string; lastHour: string; days: number };
  departure: HourRow | null;
  return: HourRow | null;
  outdoor: { period: OutdoorPeriod; aggregate: WindowAggregate | null } | null;
  whole: WindowAggregate | null;
  hourly: HourRow[];
  daily: { date: string; sunrise: string | null; sunset: string | null; uvIndexMaxDaily: Num } | null;
  /** Present only when the outing is today: the provider's latest 15-min model value. */
  current: (Omit<HourRow, 'time' | 'rainProbabilityPct'> & { validTime: string; intervalSeconds: number }) | null;
}

const FIELD_MAP: Record<HourlyVar, keyof Omit<HourRow, 'time'>> = {
  temperature_2m: 'temperatureC',
  apparent_temperature: 'feelsLikeC',
  relative_humidity_2m: 'humidityPct',
  precipitation_probability: 'rainProbabilityPct',
  precipitation: 'precipitationMm',
  uv_index: 'uvIndex',
  wind_speed_10m: 'windKmh',
  wind_gusts_10m: 'gustKmh',
  cloud_cover: 'cloudCoverPct',
};

function rowAt(f: ForecastResponse, i: number): HourRow {
  const row: any = { time: f.hourly.time[i] };
  for (const v of HOURLY_VARS) row[FIELD_MAP[v]] = f.hourly[v]?.[i] ?? null;
  return row as HourRow;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

function maxOf(rows: HourRow[], k: keyof Omit<HourRow, 'time'>): Num {
  const vals = rows.map((r) => r[k]).filter((x): x is number => x !== null);
  // If any hour is missing the field, the aggregate can't be trusted as a max.
  if (vals.length !== rows.length || vals.length === 0) return null;
  return r1(Math.max(...vals));
}
function minOf(rows: HourRow[], k: keyof Omit<HourRow, 'time'>): Num {
  const vals = rows.map((r) => r[k]).filter((x): x is number => x !== null);
  if (vals.length !== rows.length || vals.length === 0) return null;
  return r1(Math.min(...vals));
}

export function aggregate(rows: HourRow[]): WindowAggregate | null {
  if (rows.length === 0) return null;
  const precip = rows.map((r) => r.precipitationMm);
  const precipComplete = precip.every((x) => x !== null);
  const clouds = rows.map((r) => r.cloudCoverPct);
  const uvMax = maxOf(rows, 'uvIndex');
  const uvAt = uvMax === null ? null : rows.find((r) => r.uvIndex !== null && r1(r.uvIndex) === uvMax)?.time ?? null;
  return {
    from: rows[0].time,
    to: rows[rows.length - 1].time,
    hours: rows.length,
    temperatureMaxC: maxOf(rows, 'temperatureC'),
    feelsLikeMaxC: maxOf(rows, 'feelsLikeC'),
    feelsLikeMinC: minOf(rows, 'feelsLikeC'),
    humidityMaxPct: maxOf(rows, 'humidityPct'),
    rainProbabilityMaxPct: maxOf(rows, 'rainProbabilityPct'),
    precipitationTotalMm: precipComplete ? r1((precip as number[]).reduce((a, b) => a + b, 0)) : null,
    precipitationMaxHourlyMm: maxOf(rows, 'precipitationMm'),
    uvIndexMaxHourly: uvMax,
    uvIndexMaxHourlyAt: uvAt,
    windMaxKmh: maxOf(rows, 'windKmh'),
    gustMaxKmh: maxOf(rows, 'gustKmh'),
    cloudCoverMeanPct: clouds.every((x) => x !== null)
      ? Math.round((clouds as number[]).reduce((a, b) => a + b, 0) / clouds.length)
      : null,
  };
}

/**
 * Rows whose hour overlaps [startLocal, endLocal]. An outing 12:30–15:30 uses
 * the 12:00, 13:00, 14:00 and 15:00 rows (hourly values describe the hour).
 */
function rowsCovering(f: ForecastResponse, startLocal: string, endLocal: string): HourRow[] {
  const from = floorHour(startLocal);
  const to = endLocal.endsWith(':00') ? endLocal : floorHour(endLocal);
  const out: HourRow[] = [];
  for (let i = 0; i < f.hourly.time.length; i++) {
    const t = f.hourly.time[i];
    if (t >= from && t <= to) out.push(rowAt(f, i));
  }
  return out;
}

function rowFor(f: ForecastResponse, local: string): HourRow | null {
  const idx = f.hourly.time.indexOf(floorHour(local));
  return idx >= 0 ? rowAt(f, idx) : null;
}

export interface OutingWeatherInput extends OutingSchedule {
  /** Optional explicit outdoor period, local HH:mm on the outing date (end may roll to next day). */
  outdoorStart?: string;
  outdoorEnd?: string;
}

export function buildOutingWeather(f: ForecastResponse, input: OutingWeatherInput, now: Date = new Date()): OutingWeather {
  const window = resolveOutingWindow(input);
  const times = f.hourly.time;
  const horizon = { firstHour: times[0], lastHour: times[times.length - 1], days: PROVIDER_INFO.horizonDays };
  const nowLocal = nowInMumbai(now).localIso;

  const base: OutingWeather = {
    status: 'ok',
    window,
    horizon,
    departure: null,
    return: null,
    outdoor: null,
    whole: null,
    hourly: [],
    daily: null,
    current: null,
  };

  if (window.end < floorHour(nowLocal)) {
    return { ...base, status: 'in_past', statusMessage: 'This outing window is in the past.' };
  }
  if (floorHour(window.start) > horizon.lastHour) {
    return {
      ...base,
      status: 'beyond_horizon',
      statusMessage: `The forecast currently reaches ${horizon.lastHour.replace('T', ' ')} (Asia/Kolkata), about ${horizon.days} days ahead. Precise weather-based advice for this date is not yet available — check again closer to the day.`,
    };
  }

  const hourly = rowsCovering(f, window.start, window.end);
  const coveredToEnd = floorHour(window.end) <= horizon.lastHour;

  let outdoorPeriod: OutdoorPeriod;
  if (input.outdoorStart && input.outdoorEnd) {
    const od = resolveOutingWindow({ date: input.date, departure: input.outdoorStart, return: input.outdoorEnd });
    outdoorPeriod = { start: od.start, end: od.end, source: 'user' };
  } else {
    outdoorPeriod = { start: window.start, end: window.end, source: 'transitions' };
  }
  const outdoorRows =
    outdoorPeriod.source === 'user'
      ? rowsCovering(f, outdoorPeriod.start, outdoorPeriod.end)
      : [rowFor(f, window.start), rowFor(f, window.end)].filter((r): r is HourRow => r !== null);

  const date = input.date;
  const di = f.daily.time.indexOf(date);
  const daily =
    di >= 0
      ? {
          date,
          sunrise: f.daily.sunrise?.[di] ?? null,
          sunset: f.daily.sunset?.[di] ?? null,
          uvIndexMaxDaily: f.daily.uv_index_max?.[di] ?? null,
        }
      : null;

  let current: OutingWeather['current'] = null;
  if (f.current && date === nowInMumbai(now).date) {
    const c = f.current as Record<string, number | string | null>;
    const num = (k: string): Num => (typeof c[k] === 'number' ? (c[k] as number) : null);
    current = {
      validTime: String(c.time),
      intervalSeconds: Number(c.interval),
      temperatureC: num('temperature_2m'),
      feelsLikeC: num('apparent_temperature'),
      humidityPct: num('relative_humidity_2m'),
      precipitationMm: num('precipitation'),
      uvIndex: num('uv_index'),
      windKmh: num('wind_speed_10m'),
      gustKmh: num('wind_gusts_10m'),
      cloudCoverPct: num('cloud_cover'),
    };
  }

  return {
    ...base,
    status: coveredToEnd ? 'ok' : 'partially_covered',
    statusMessage: coveredToEnd
      ? undefined
      : `The forecast ends at ${horizon.lastHour.replace('T', ' ')}; the end of this outing is not covered.`,
    departure: rowFor(f, window.start),
    return: rowFor(f, window.end),
    outdoor: { period: outdoorPeriod, aggregate: aggregate(outdoorRows) },
    whole: aggregate(hourly),
    hourly,
    daily,
    current,
  };
}
