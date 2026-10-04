/**
 * Asia/Kolkata time helpers.
 *
 * India Standard Time is a fixed UTC+05:30 offset with no daylight saving, so
 * plain offset arithmetic is exact. Open-Meteo is queried with
 * timezone=Asia/Kolkata, which makes its hourly timestamps local wall-clock
 * strings ("YYYY-MM-DDTHH:mm") that compare correctly as strings.
 */

export const MUMBAI_TZ = 'Asia/Kolkata';
const IST_OFFSET_MINUTES = 330;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(date);
}

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

/** Current wall-clock date and time in Mumbai. */
export function nowInMumbai(now: Date = new Date()): { date: string; time: string; localIso: string } {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  const iso = shifted.toISOString();
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return { date, time, localIso: `${date}T${time}` };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DDTHH:mm" local Mumbai wall-clock string. */
export function localIso(date: string, time: string): string {
  return `${date}T${time}`;
}

/** Convert a Mumbai local wall-clock string to a UTC ISO instant. */
export function mumbaiLocalToUtc(local: string): string {
  const d = new Date(`${local}:00Z`);
  return new Date(d.getTime() - IST_OFFSET_MINUTES * 60_000).toISOString();
}

/** Truncate a local "YYYY-MM-DDTHH:mm" to the start of its hour. */
export function floorHour(local: string): string {
  return `${local.slice(0, 13)}:00`;
}

/** Round a local "YYYY-MM-DDTHH:mm" up to the next whole hour (unchanged if already on the hour). */
export function ceilHour(local: string): string {
  if (local.endsWith(':00')) return local;
  const d = new Date(`${floorHour(local)}:00Z`);
  d.setUTCHours(d.getUTCHours() + 1);
  return d.toISOString().slice(0, 16);
}

export function minutesBetween(fromLocal: string, toLocal: string): number {
  return (new Date(`${toLocal}:00Z`).getTime() - new Date(`${fromLocal}:00Z`).getTime()) / 60_000;
}

export interface OutingSchedule {
  date: string;
  departure: string;
  return: string;
}

/**
 * Resolve an outing schedule to local start/end instants. A return time
 * earlier than (or equal to) departure is interpreted as the next day,
 * e.g. depart 21:00, return 00:30.
 */
export function resolveOutingWindow(s: OutingSchedule): {
  start: string;
  end: string;
  returnsNextDay: boolean;
  durationMinutes: number;
} {
  const start = localIso(s.date, s.departure);
  const returnsNextDay = s.return <= s.departure;
  const end = localIso(returnsNextDay ? addDays(s.date, 1) : s.date, s.return);
  return { start, end, returnsNextDay, durationMinutes: minutesBetween(start, end) };
}

/** "18:42" → "6:42 PM" for display. */
export function to12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}
