/**
 * Decision-layer thresholds. All recommendation triggers live here so they can
 * be reviewed and tuned without touching rule code. Override any value with the
 * DECISION_CONFIG_JSON env var (a partial JSON object, deep-merged).
 *
 * Sources for the default values:
 * - UV categories: WHO Global Solar UV Index (3–5 moderate, 6–7 high,
 *   8–10 very high, 11+ extreme); sun protection advised from UV 3.
 * - Wind: Beaufort force 6 (39–49 km/h) — "umbrellas used with difficulty".
 * - Heat/humidity: product judgement for Mumbai comfort; not a medical standard.
 */

export interface DecisionConfig {
  heat: { feelsLikeWarmC: number; feelsLikeHotC: number; humidityHighPct: number };
  uv: { protectFrom: number; high: number; veryHigh: number };
  rain: { probabilityPossiblePct: number; probabilityLikelyPct: number; amountMeaningfulMm: number; hourlyHeavyMm: number };
  wind: { gustUmbrellaDifficultKmh: number };
  exposure: { minimalMinutes: number; moderateMinutes: number };
  ac: { coolIndoorNote: string };
}

export const DEFAULT_DECISION_CONFIG: DecisionConfig = {
  heat: { feelsLikeWarmC: 30, feelsLikeHotC: 36, humidityHighPct: 70 },
  uv: { protectFrom: 3, high: 6, veryHigh: 8 },
  rain: { probabilityPossiblePct: 30, probabilityLikelyPct: 60, amountMeaningfulMm: 0.5, hourlyHeavyMm: 4 },
  wind: { gustUmbrellaDifficultKmh: 39 },
  exposure: { minimalMinutes: 5, moderateMinutes: 30 },
  ac: { coolIndoorNote: 'Indoor temperature is not measured; this follows your stated preference.' },
};

function deepMerge<T>(base: T, patch: any): T {
  if (!patch || typeof patch !== 'object') return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge((base as any)[k], v) : v;
  }
  return out;
}

export function loadDecisionConfig(): DecisionConfig {
  const raw = process.env.DECISION_CONFIG_JSON;
  if (!raw) return DEFAULT_DECISION_CONFIG;
  try {
    return deepMerge(DEFAULT_DECISION_CONFIG, JSON.parse(raw));
  } catch {
    console.warn('DECISION_CONFIG_JSON is not valid JSON; using defaults');
    return DEFAULT_DECISION_CONFIG;
  }
}
