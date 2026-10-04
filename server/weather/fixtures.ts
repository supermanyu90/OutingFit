/**
 * Labelled fixture forecasts for reproducible test scenarios. They use the
 * exact Open-Meteo response shape and go through the same validation and
 * decision path as live data, but every response that uses them is marked
 * "FIXTURE — not live weather".
 */

import { HOURLY_VARS } from './openMeteo.ts';
import { addDays } from '../lib/time.ts';

export type FixtureName = 'sunny_afternoon' | 'humid_rainy_evening';

export const FIXTURE_LABELS: Record<FixtureName, string> = {
  sunny_afternoon: 'FIXTURE: clear, hot afternoon (UV peaks at 9) — not live weather',
  humid_rainy_evening: 'FIXTURE: humid, rainy evening with gusts — not live weather',
};

type Profile = (hour: number) => Record<(typeof HOURLY_VARS)[number], number>;

const profiles: Record<FixtureName, Profile> = {
  sunny_afternoon: (h) => {
    const uvCurve = [0, 0, 0, 0, 0, 0, 0, 0.2, 1, 2.5, 4.5, 6.5, 8.2, 9, 8.4, 6.8, 4.6, 2.4, 0.6, 0, 0, 0, 0, 0];
    const day = h >= 11 && h <= 17;
    return {
      temperature_2m: day ? 34 : 28,
      apparent_temperature: day ? 39 : 31,
      relative_humidity_2m: day ? 52 : 70,
      precipitation_probability: 5,
      precipitation: 0,
      uv_index: uvCurve[h],
      wind_speed_10m: 13,
      wind_gusts_10m: 27,
      cloud_cover: 10,
    };
  },
  humid_rainy_evening: (h) => {
    const evening = h >= 17 && h <= 23;
    return {
      temperature_2m: evening ? 27 : 29,
      apparent_temperature: evening ? 33 : 34,
      relative_humidity_2m: evening ? 91 : 80,
      precipitation_probability: evening ? 85 : 40,
      precipitation: evening ? (h === 19 || h === 20 ? 6.2 : 2.4) : 0.2,
      uv_index: h >= 9 && h <= 15 ? 2 : 0,
      wind_speed_10m: evening ? 24 : 16,
      wind_gusts_10m: evening ? 46 : 30,
      cloud_cover: evening ? 98 : 75,
    };
  },
};

/** A 16-day Open-Meteo-shaped response starting at `startDate`, repeating the profile daily. */
export function buildFixtureForecast(name: FixtureName, startDate: string, lat: number, lon: number): unknown {
  const days = 16;
  const time: string[] = [];
  const hourly: Record<string, number[]> = Object.fromEntries(HOURLY_VARS.map((v) => [v, []]));
  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    for (let h = 0; h < 24; h++) {
      time.push(`${date}T${String(h).padStart(2, '0')}:00`);
      const row = profiles[name](h);
      for (const v of HOURLY_VARS) hourly[v].push(row[v]);
    }
  }
  const dailyDates = Array.from({ length: days }, (_, d) => addDays(startDate, d));
  return {
    latitude: lat,
    longitude: lon,
    elevation: 10,
    timezone: 'Asia/Kolkata',
    utc_offset_seconds: 19800,
    hourly_units: {
      time: 'iso8601',
      temperature_2m: '°C',
      apparent_temperature: '°C',
      relative_humidity_2m: '%',
      precipitation_probability: '%',
      precipitation: 'mm',
      uv_index: '',
      wind_speed_10m: 'km/h',
      wind_gusts_10m: 'km/h',
      cloud_cover: '%',
    },
    hourly: { time, ...hourly },
    daily: {
      time: dailyDates,
      sunrise: dailyDates.map((d) => `${d}T06:30`),
      sunset: dailyDates.map((d) => `${d}T18:15`),
      uv_index_max: dailyDates.map(() => (name === 'sunny_afternoon' ? 9 : 2)),
    },
  };
}
