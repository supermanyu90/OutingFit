/**
 * Outing form state + the ElevenLabs agent's client tools.
 *
 * Shared by the browser (the agent calls these as client tools while the user
 * watches the form fill in) and the Node voice test harness. All advice comes
 * from the OutingFit backend; the tools only return backend results so the
 * agent has nothing to improvise from.
 */

import type { OutingResult } from '../server/pipeline.ts';
import type { ResolveResult, DestinationCandidate } from '../server/places/resolve.ts';
import type { ResolvedDestination, Language } from '../server/domain.ts';

export type Exposure = 'minimal' | 'moderate' | 'extended';

export interface OutingForm {
  language: Language;
  destinationQuery: string;
  destination: ResolvedDestination | null;
  destinationStatus: 'empty' | 'resolving' | 'resolved' | 'ambiguous' | 'not_found';
  destinationMessage: string;
  candidates: DestinationCandidate[];
  date: string;
  departure: string;
  return: string;
  /** Dates/times from voice or free text must be confirmed by the user before fetching weather. */
  scheduleConfirmed: boolean;
  scheduleNotes: string[];
  outdoorExposure: Exposure;
  outdoorStart: string;
  outdoorEnd: string;
  transport: 'car' | 'public_transport' | 'walk';
  coveredDropOff: 'yes' | 'no' | 'unknown';
  venueSetting: 'indoor' | 'outdoor' | 'mixed' | 'unknown';
  indoorAc: 'confirmed' | 'user_expects' | 'none' | 'unknown';
  feelsColdInAc: boolean;
  occasion: string;
  formality: 'casual' | 'smart_casual' | 'formal' | 'unknown';
  colourPreference: string;
  fault?: 'weather_down' | 'gemma_down';
  weatherFixture?: 'sunny_afternoon' | 'humid_rainy_evening';
}

export function emptyForm(language: Language = 'en'): OutingForm {
  return {
    language,
    destinationQuery: '',
    destination: null,
    destinationStatus: 'empty',
    destinationMessage: '',
    candidates: [],
    date: '',
    departure: '',
    return: '',
    scheduleConfirmed: false,
    scheduleNotes: [],
    outdoorExposure: 'minimal',
    outdoorStart: '',
    outdoorEnd: '',
    transport: 'car',
    coveredDropOff: 'unknown',
    venueSetting: 'unknown',
    indoorAc: 'unknown',
    feelsColdInAc: false,
    occasion: '',
    formality: 'unknown',
    colourPreference: '',
  };
}

export function readiness(f: OutingForm): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (f.destinationStatus === 'ambiguous') missing.push('destination: choose one of the matching places');
  else if (!f.destination) missing.push('destination');
  if (!f.date) missing.push('date');
  if (!f.departure) missing.push('departure time');
  if (!f.return) missing.push('expected return time');
  if (f.date && f.departure && f.return && !f.scheduleConfirmed) missing.push('confirmation of date and times');
  return { ready: missing.length === 0, missing };
}

/** Explicit instruction for the voice agent, so it doesn't stall between steps. */
function nextStep(f: OutingForm, ready: boolean, missing: string[]): string {
  if (ready) return 'If this result contains advice.spoken_summary, read it aloud word for word now. Otherwise call get_outing_advice.';
  if (f.destinationStatus === 'ambiguous') return 'Read destination_options to the user and call choose_destination with their choice.';
  if (f.destinationStatus === 'not_found') return 'Ask the user for a nearby Mumbai locality, then call set_outing_details.';
  if (missing.includes('confirmation of date and times')) return 'Read the date, departure and return times back to the user; when they agree, call confirm_details.';
  return `Ask the user for: ${missing.join(', ')}.`;
}

export function toOutingRequest(f: OutingForm) {
  return {
    destination: f.destination,
    date: f.date,
    departure: f.departure,
    return: f.return,
    outdoorExposure: f.outdoorExposure,
    ...(f.outdoorStart && f.outdoorEnd ? { outdoorStart: f.outdoorStart, outdoorEnd: f.outdoorEnd } : {}),
    transport: f.transport,
    coveredDropOff: f.coveredDropOff,
    venueSetting: f.venueSetting,
    indoorAc: f.indoorAc,
    feelsColdInAc: f.feelsColdInAc,
    occasion: f.occasion,
    formality: f.formality,
    ...(f.colourPreference ? { colourPreference: f.colourPreference } : {}),
    language: f.language,
    ...(f.fault ? { fault: f.fault } : {}),
    ...(f.weatherFixture ? { weatherFixture: f.weatherFixture } : {}),
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts "7:30 PM", "19:30", "7 pm" → "19:30"; returns null if unparseable. */
export function normaliseTime(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (TIME_RE.test(s)) return s;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const enumOr = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

export interface SessionEvents {
  onChange?: (form: OutingForm) => void;
  onResult?: (result: OutingResult) => void;
  onError?: (message: string) => void;
}

export class OutingSession {
  form: OutingForm;
  lastResult: OutingResult | null = null;
  lastSpokenSummary: string | null = null;

  constructor(
    private apiBase: string,
    language: Language,
    private events: SessionEvents = {},
    private fetchImpl: typeof fetch = (...a) => fetch(...a)
  ) {
    this.form = emptyForm(language);
  }

  update(patch: Partial<OutingForm>) {
    this.form = { ...this.form, ...patch };
    this.events.onChange?.(this.form);
  }

  async resolve(query: string): Promise<ResolveResult | null> {
    const q = query.trim();
    if (q.length < 2) return null;
    this.update({ destinationQuery: q, destination: null, destinationStatus: 'resolving', candidates: [], destinationMessage: '' });
    try {
      const res = await this.fetchImpl(`${this.apiBase}/api/v2/destinations/resolve?q=${encodeURIComponent(q)}`);
      const r = (await res.json()) as ResolveResult & { error?: string };
      if (!res.ok) throw new Error(r.error || `HTTP ${res.status}`);
      this.update({
        destinationStatus: r.status,
        candidates: r.candidates,
        destination: r.status === 'resolved' ? r.candidates[0].destination : null,
        destinationMessage: r.message,
      });
      return r;
    } catch (err: any) {
      this.update({ destinationStatus: 'not_found', destinationMessage: `Lookup failed: ${err.message}` });
      return null;
    }
  }

  chooseCandidate(id: string) {
    const c = this.form.candidates.find((x) => x.id === id);
    if (!c) return false;
    this.update({ destination: c.destination, destinationStatus: 'resolved', destinationMessage: `Selected ${c.destination.name}.` });
    return true;
  }

  private snapshot(extra: Record<string, unknown> = {}) {
    const f = this.form;
    const { ready, missing } = readiness(f);
    return JSON.stringify({
      destination_status: f.destinationStatus,
      destination: f.destination?.name ?? null,
      destination_options:
        f.destinationStatus === 'ambiguous' ? f.candidates.map((c, i) => `${i + 1}. ${c.destination.name} — ${c.subtitle}`) : undefined,
      date: f.date || null,
      departure_time: f.departure || null,
      return_time: f.return || null,
      schedule_confirmed: f.scheduleConfirmed,
      outdoor_exposure: f.outdoorExposure,
      transport: f.transport,
      covered_drop_off: f.coveredDropOff,
      feels_cold_in_ac: f.feelsColdInAc,
      occasion: f.occasion || null,
      ready_for_advice: ready,
      missing,
      next_step: nextStep(f, ready, missing),
      ...extra,
    });
  }

  // ------------------------------------------------------------ agent tools

  /** Tool: set_outing_details */
  async setOutingDetails(p: Record<string, unknown>): Promise<string> {
    const notes: string[] = [];
    const patch: Partial<OutingForm> = {};
    let scheduleChanged = false;

    if (typeof p.date === 'string') {
      if (DATE_RE.test(p.date)) {
        patch.date = p.date;
        scheduleChanged = true;
      } else notes.push(`date "${p.date}" ignored: use YYYY-MM-DD`);
    }
    for (const [key, field] of [
      ['departure_time', 'departure'],
      ['return_time', 'return'],
      ['outdoor_start', 'outdoorStart'],
      ['outdoor_end', 'outdoorEnd'],
    ] as const) {
      if (p[key] === undefined || p[key] === null || p[key] === '') continue;
      const t = normaliseTime(p[key]);
      if (t) {
        (patch as any)[field] = t;
        if (field === 'departure' || field === 'return') scheduleChanged = true;
      } else notes.push(`${key} "${String(p[key])}" ignored: use 24-hour HH:mm`);
    }
    const ex = enumOr(p.outdoor_exposure, ['minimal', 'moderate', 'extended'] as const);
    if (ex) patch.outdoorExposure = ex;
    const tr = enumOr(p.transport, ['car', 'public_transport', 'walk'] as const);
    if (tr) patch.transport = tr;
    const cd = enumOr(p.covered_drop_off, ['yes', 'no', 'unknown'] as const);
    if (cd) patch.coveredDropOff = cd;
    const vs = enumOr(p.venue_setting, ['indoor', 'outdoor', 'mixed', 'unknown'] as const);
    if (vs) patch.venueSetting = vs;
    const ac = enumOr(p.indoor_ac, ['user_expects', 'none', 'unknown'] as const);
    if (ac) patch.indoorAc = ac;
    if (typeof p.feels_cold_in_ac === 'boolean') patch.feelsColdInAc = p.feels_cold_in_ac;
    if (p.feels_cold_in_ac === 'true' || p.feels_cold_in_ac === 'false') patch.feelsColdInAc = p.feels_cold_in_ac === 'true';
    if (typeof p.occasion === 'string') patch.occasion = p.occasion.slice(0, 120);
    const fm = enumOr(p.formality, ['casual', 'smart_casual', 'formal'] as const);
    if (fm) patch.formality = fm;
    if (typeof p.colour_preference === 'string') patch.colourPreference = p.colour_preference.slice(0, 80);
    if (scheduleChanged) patch.scheduleConfirmed = false;
    this.update(patch);

    if (typeof p.destination === 'string' && p.destination.trim() && p.destination.trim() !== this.form.destinationQuery) {
      await this.resolve(p.destination);
    }
    return this.snapshot(notes.length ? { notes } : {});
  }

  /** Tool: choose_destination — choice is an option number or (part of) a name. */
  async chooseDestination(p: Record<string, unknown>): Promise<string> {
    const choice = String(p.choice ?? '').trim();
    const opts = this.form.candidates;
    let picked: DestinationCandidate | undefined;
    const n = Number(choice);
    if (Number.isInteger(n) && n >= 1 && n <= opts.length) picked = opts[n - 1];
    if (!picked) {
      const lc = choice.toLowerCase();
      const matches = opts.filter((c) => `${c.destination.name} ${c.subtitle}`.toLowerCase().includes(lc));
      if (matches.length === 1) picked = matches[0];
    }
    if (!picked) return this.snapshot({ error: `Could not match "${choice}" to exactly one option; ask the user again.` });
    this.chooseCandidate(picked.id);
    return this.adviceIfReady();
  }

  /** Tool: confirm_details — call only after reading the date and times back and hearing the user agree. */
  async confirmDetails(): Promise<string> {
    const f = this.form;
    if (!f.date || !f.departure || !f.return) return this.snapshot({ error: 'Date, departure and return time are needed before confirming.' });
    this.update({ scheduleConfirmed: true, scheduleNotes: [] });
    return this.adviceIfReady();
  }

  /**
   * Once everything is confirmed, fetch the advice in the same tool call. The
   * agent LLM was observed announcing "getting your advice" and then never
   * calling get_outing_advice, so the chain no longer depends on it.
   */
  private async adviceIfReady(): Promise<string> {
    if (!readiness(this.form).ready) return this.snapshot();
    const advice = JSON.parse(await this.getOutingAdvice());
    return this.snapshot({ advice });
  }

  /** Tool: get_outing_advice — returns the backend's validated spoken summary (or why there is none). */
  async getOutingAdvice(): Promise<string> {
    const { ready, missing } = readiness(this.form);
    if (!ready) return JSON.stringify({ status: 'not_ready', missing });
    try {
      const res = await this.fetchImpl(`${this.apiBase}/api/v2/outing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toOutingRequest(this.form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error + (data.details ? `: ${data.details.join('; ')}` : ''));
      const result = data as OutingResult;
      this.lastResult = result;
      this.lastSpokenSummary = result.spoken.text;
      this.events.onResult?.(result);
      return JSON.stringify({
        status: result.spoken.text ? 'ok' : 'no_spoken_summary',
        spoken_summary: result.spoken.text,
        weather_status: result.weather.dataStatus,
        weather_notice: result.weather.notice ?? null,
        instruction: result.spoken.text
          ? 'Say spoken_summary to the user exactly as written, then tell them the full cards are on screen. Do not add weather or advice.'
          : 'Tell the user personalised advice could not be generated right now and that the on-screen cards show the rule-based items.',
      });
    } catch (err: any) {
      this.events.onError?.(err.message);
      return JSON.stringify({ status: 'error', message: err.message });
    }
  }

  clientTools() {
    return {
      set_outing_details: (p: Record<string, unknown>) => this.setOutingDetails(p),
      choose_destination: (p: Record<string, unknown>) => this.chooseDestination(p),
      confirm_details: () => this.confirmDetails(),
      get_outing_advice: () => this.getOutingAdvice(),
    };
  }
}

/**
 * How much of the backend summary the agent actually said: share of the
 * summary's character bigrams present in the agent's utterance (0–1).
 *
 * Measured on the advice words only. Digits, units and Latin-script names are
 * removed from the summary first, because a voice agent legitimately says
 * "33.7°C" as "तैंतीस दशमलव सात डिग्री" and writes "Bastian" as "बैस्टियन".
 * Recall (not symmetric similarity) is used because the agent may append
 * "the full cards are on screen".
 */
export function spokenAgreement(spoken: string, summary: string): number {
  const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const devanagari = /[\u0900-\u097F]/.test(summary);
  const adviceOnly = (s: string) =>
    norm(
      s
        .replace(/[0-9०-९]+(?:[.,][0-9०-९]+)?\s*(?:°\s*c|%|mm|km\/h)?/gi, ' ')
        // In Hindi/Marathi summaries, Latin words are names/brands the agent may transliterate.
        .replace(devanagari ? /[A-Za-z][A-Za-z'’\-]*/g : /$^/g, ' ')
    );
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      if (g.includes(' ') && g.trim().length < 2) continue;
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const said = grams(norm(spoken));
  const want = grams(adviceOnly(summary));
  let hit = 0;
  let total = 0;
  for (const [g, n] of want) {
    hit += Math.min(n, said.get(g) || 0);
    total += n;
  }
  return total === 0 ? 0 : hit / total;
}
