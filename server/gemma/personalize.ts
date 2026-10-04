/**
 * Gemma personalisation step: localises and explains the decision layer's
 * items in the user's language and writes a short spoken summary. Output is
 * validated (schema, item coverage, language, numeric grounding) and retried
 * once with the validation errors before being rejected.
 */

import { z } from 'zod';
import { Decision, Evidence } from '../decision/engine.ts';
import { Language, OutingRequest } from '../domain.ts';
import { OutingWeather } from '../weather/outingWindow.ts';
import { GemmaCallResult, GemmaClient, GemmaUnavailableError, extractJson } from './gemmaClient.ts';
import { AllowedNumbers, devanagariShare, ungroundedNumbers } from './grounding.ts';

export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', hi: 'Hindi (Devanagari script)', mr: 'Marathi (Devanagari script)' };

const PersonalizedSchema = z.object({
  items: z.array(z.object({ id: z.string(), title: z.string().min(1).max(160), explanation: z.string().min(1).max(500) })),
  outfitSummary: z.string().min(1).max(500),
  spokenSummary: z.string().min(1).max(700),
  spokenCovers: z.array(z.string()),
});
export type PersonalizedOutput = z.infer<typeof PersonalizedSchema>;

export interface PersonalizeResult {
  output: PersonalizedOutput | null;
  gemma: Omit<GemmaCallResult, 'text'> | null;
  validation: { passed: boolean; errors: string[]; retried: boolean };
  error?: string;
  attempts: GemmaCallResult['attempts'];
}

const FIELD_LABELS: Record<string, string> = {
  feels_like_max: 'highest feels-like temperature',
  temperature_max: 'highest temperature',
  humidity_max: 'highest relative humidity',
  uv_index_max_hourly: 'highest hourly UV index',
  uv_index_max_daily: 'daily maximum UV index',
  rain_probability_max: 'highest rain probability',
  precipitation_total: 'total forecast precipitation',
  precipitation_max_hourly: 'heaviest hourly precipitation',
  gust_max: 'strongest wind gust',
  wind_max: 'strongest wind',
};

export function describeEvidence(e: Evidence): string {
  switch (e.kind) {
    case 'weather': {
      const scope = e.scope === 'outdoor' ? 'during your outdoor time' : e.scope === 'window' ? 'during the outing' : `at ${e.scope}`;
      const at = e.at ? ` (at ${e.at.slice(11, 16)})` : '';
      const thr = e.threshold !== undefined ? ` — rule threshold ${e.comparator} ${e.threshold}${e.unit}` : '';
      return `${FIELD_LABELS[e.field] ?? e.field} ${scope}: ${e.value}${e.unit}${at}${thr}`;
    }
    case 'weather_time':
      return `${e.field}: ${e.value}`;
    case 'preference':
      return `user said ${e.field.replace(/_/g, ' ')} = ${e.value}`;
    case 'venue':
      return `venue ${e.field.replace(/_/g, ' ')}: "${e.value}" (${e.confirmed ? 'confirmed' : 'unconfirmed, from ' + e.source})`;
    case 'status':
      return `${e.field} status: ${e.value}`;
  }
}

const SYSTEM = `You are OutingFit's clothing and comfort explainer for outings in Mumbai, running on Gemma.
You receive a fixed list of recommendation items chosen by a rule engine, each with the evidence that triggered it.
Your job: write a short title and a one- or two-sentence explanation for EACH item, in the requested language, personalised to the occasion and stated preferences.

Hard rules:
- Output ONLY one JSON object, no prose, matching: {"items":[{"id","title","explanation"}],"outfitSummary","spokenSummary","spokenCovers":[ids]}.
- Include every item id exactly once. Do not add, drop, merge or re-prioritise items.
- Each explanation must name the specific evidence it rests on (a weather value, a time, or the user's stated preference).
- Use only facts given. Never invent weather, venue details (parking, AC, dress code), alternatives, brands or prices.
- Write numbers with digits exactly as given (e.g. 34°C, 72%, UV 7). Do not round differently or add new numbers.
- Do not claim ordinary clothing or sunglasses give UV protection; the product notes say what is verifiable.
- Do not push purchases: for items like umbrellas or sunglasses, say to bring one they already have.
- Colour is secondary: mention it only if a colour item is present.
- "outfitSummary": 1–2 sentences combining the wear items into an outfit idea.
- "spokenSummary": at most 60 words, natural to say aloud, in the requested language. Cover every essential and recommended item, and nothing that is not in the list.
- "spokenCovers": the ids your spokenSummary mentions.
- Hindi and Marathi must be written in Devanagari script; keep proper nouns (venue names) as given.`;

export function buildAllowedNumbers(req: OutingRequest, weather: OutingWeather | null, decisions: Decision[]): AllowedNumbers {
  const a = new AllowedNumbers();
  a.addTime(req.departure).addTime(req.return).addTime(req.outdoorStart).addTime(req.outdoorEnd);
  for (const part of req.date.split('-')) a.add(Number(part));
  for (const d of decisions) {
    for (const e of d.evidence) {
      if (e.kind === 'weather') {
        a.add(e.value).add(e.threshold);
        a.addTime(e.at?.slice(11, 16));
      } else if (e.kind === 'weather_time') a.addTime(e.value);
      else if (e.kind === 'venue' || e.kind === 'preference') a.addAllNumbersIn(e.value);
    }
    a.addAllNumbersIn(d.productNote).addAllNumbersIn(d.label);
  }
  if (weather) {
    for (const row of [weather.departure, weather.return]) {
      if (!row) continue;
      for (const v of Object.values(row)) if (typeof v === 'number') a.add(v);
    }
    for (const agg of [weather.whole, weather.outdoor?.aggregate]) {
      if (!agg) continue;
      for (const v of Object.values(agg)) if (typeof v === 'number') a.add(v);
    }
    a.addTime(weather.daily?.sunset?.slice(11, 16)).addTime(weather.daily?.sunrise?.slice(11, 16));
  }
  a.addAllNumbersIn(req.destination.name).addAllNumbersIn(req.occasion);
  return a;
}

export function validatePersonalized(
  out: unknown,
  decisions: Decision[],
  language: Language,
  allowed: AllowedNumbers
): { ok: true; value: PersonalizedOutput } | { ok: false; errors: string[] } {
  const parsed = PersonalizedSchema.safeParse(out);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) };
  const v = parsed.data;
  const errors: string[] = [];

  const want = new Set(decisions.map((d) => d.id));
  const seen = new Set<string>();
  for (const it of v.items) {
    if (!want.has(it.id)) errors.push(`unknown item id "${it.id}"`);
    if (seen.has(it.id)) errors.push(`duplicate item id "${it.id}"`);
    seen.add(it.id);
  }
  for (const id of want) if (!seen.has(id)) errors.push(`missing item id "${id}"`);

  const mustSpeak = decisions.filter((d) => d.priority === 'essential' || d.priority === 'recommended').map((d) => d.id);
  for (const id of mustSpeak) if (!v.spokenCovers.includes(id)) errors.push(`spokenSummary must cover "${id}"`);
  for (const id of v.spokenCovers) if (!want.has(id)) errors.push(`spokenCovers lists unknown id "${id}"`);

  const texts: Array<[string, string]> = [
    ['outfitSummary', v.outfitSummary],
    ['spokenSummary', v.spokenSummary],
    ...v.items.flatMap((it) => [
      [`${it.id}.title`, it.title] as [string, string],
      [`${it.id}.explanation`, it.explanation] as [string, string],
    ]),
  ];
  for (const [where, text] of texts) {
    if (/^[\s.…-]*$/.test(text) || text.includes('…')) errors.push(`${where} still contains the "…" placeholder`);
    if (/[\u0980-\u0DFF]/.test(text)) errors.push(`${where} contains characters from another Indic script (not Devanagari)`);
    const bad = ungroundedNumbers(text, allowed);
    if (bad.length) errors.push(`${where} contains numbers not in the input data: ${bad.join(', ')}`);
  }

  const words = v.spokenSummary.trim().split(/\s+/).length;
  if (words > 75) errors.push(`spokenSummary has ${words} words (max 60)`);
  if (language !== 'en') {
    for (const [where, text] of [['spokenSummary', v.spokenSummary], ['outfitSummary', v.outfitSummary]] as const) {
      if (devanagariShare(text) < 0.6) errors.push(`${where} is not mainly in Devanagari script`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: v };
}

export async function personalizeWithGemma(
  gemma: GemmaClient,
  ctx: {
    request: OutingRequest;
    weather: OutingWeather | null;
    weatherNote: string;
    decisions: Decision[];
    exposureDescription: string;
  },
  opts: { simulateFailure?: boolean } = {}
): Promise<PersonalizeResult> {
  const { request: r, decisions } = ctx;
  const allowed = buildAllowedNumbers(r, ctx.weather, decisions);
  const payload = {
    language: LANGUAGE_NAMES[r.language],
    outing: {
      destination: r.destination.name,
      date: r.date,
      departure: r.departure,
      return: r.return,
      timezone: 'Asia/Kolkata',
      transport: r.transport,
      exposure: ctx.exposureDescription,
      occasion: r.occasion || 'not stated',
      formality: r.formality,
      colourPreference: r.colourPreference || 'none stated',
    },
    weatherNote: ctx.weatherNote,
    items: decisions.map((d) => ({
      id: d.id,
      card: d.card,
      priority: d.priority,
      baseline: d.label,
      evidence: d.evidence.map(describeEvidence),
      productNote: d.productNote,
    })),
  };

  const attempts: GemmaCallResult['attempts'] = [];
  let lastErrors: string[] = [];
  let lastMeta: Omit<GemmaCallResult, 'text'> | null = null;

  const mustSpeak = decisions.filter((d) => d.priority === 'essential' || d.priority === 'recommended').map((d) => d.id);
  const skeleton = {
    items: decisions.map((d) => ({ id: d.id, title: '…', explanation: '…' })),
    outfitSummary: '…',
    spokenSummary: '…',
    spokenCovers: mustSpeak,
  };
  const jsonSchema = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string', enum: decisions.map((d) => d.id) }, title: { type: 'string' }, explanation: { type: 'string' } },
          required: ['id', 'title', 'explanation'],
        },
      },
      outfitSummary: { type: 'string' },
      spokenSummary: { type: 'string' },
      spokenCovers: { type: 'array', items: { type: 'string' } },
    },
    required: ['items', 'outfitSummary', 'spokenSummary', 'spokenCovers'],
  };
  const task = `Outing data:\n${JSON.stringify(payload, null, 2)}\n\nReturn JSON in exactly this shape, replacing every "…" with real text in ${LANGUAGE_NAMES[r.language]} (titles are short, 2–6 words):\n${JSON.stringify(skeleton, null, 2)}`;

  for (let pass = 0; pass < 2; pass++) {
    const user =
      pass === 0 ? task : `Your previous JSON was rejected for these reasons:\n- ${lastErrors.join('\n- ')}\nFix them.\n\n${task}`;
    let res: GemmaCallResult;
    try {
      res = await gemma.generate(SYSTEM, user, { simulateFailure: opts.simulateFailure, jsonSchema });
    } catch (err) {
      const e = err as GemmaUnavailableError;
      attempts.push(...(e.attempts || []));
      return {
        output: null,
        gemma: lastMeta,
        validation: { passed: false, errors: lastErrors, retried: pass > 0 },
        error: e.message,
        attempts,
      };
    }
    attempts.push(...res.attempts);
    const { text: _t, ...meta } = res;
    lastMeta = meta;
    let json: unknown;
    try {
      json = extractJson(res.text);
    } catch (err: any) {
      lastErrors = [`Output was not valid JSON: ${err.message}`];
      continue;
    }
    const v = validatePersonalized(json, decisions, r.language, allowed);
    if (v.ok) return { output: v.value, gemma: meta, validation: { passed: true, errors: [], retried: pass > 0 }, attempts };
    lastErrors = v.errors;
  }
  return {
    output: null,
    gemma: lastMeta,
    validation: { passed: false, errors: lastErrors, retried: true },
    error: 'Gemma output failed validation twice',
    attempts,
  };
}
