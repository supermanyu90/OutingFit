/**
 * Grounding checks for model text: every number Gemma writes must come from
 * the structured inputs (weather values, times, thresholds, product labels).
 * This is what lets the spoken summary and cards be trusted not to invent
 * weather or venue details.
 */

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

export function normaliseDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

/** Numbers appearing in text; "6:42" yields 6 and 42, "33.5" yields 33.5. */
export function extractNumbers(text: string): number[] {
  const t = normaliseDigits(text);
  const out: number[] = [];
  for (const m of t.matchAll(/\d+(?:\.\d+)?/g)) out.push(Number(m[0]));
  return out;
}

export class AllowedNumbers {
  private values = new Set<string>();

  add(n: number | null | undefined): this {
    if (n === null || n === undefined || !Number.isFinite(n)) return this;
    this.values.add(String(n));
    this.values.add(String(Math.round(n)));
    this.values.add(String(Math.round(n * 10) / 10));
    this.values.add(String(Math.floor(n)));
    return this;
  }

  /** Adds "HH:mm" plus 12-hour forms, so "18:30" also allows "6:30". */
  addTime(hhmm: string | null | undefined): this {
    if (!hhmm) return this;
    const m = hhmm.match(/(\d{1,2}):(\d{2})/);
    if (!m) return this;
    const h = Number(m[1]);
    const min = Number(m[2]);
    this.add(h).add(min).add(h % 12 === 0 ? 12 : h % 12);
    return this;
  }

  addAllNumbersIn(text: string | null | undefined): this {
    if (!text) return this;
    for (const n of extractNumbers(text)) this.add(n);
    return this;
  }

  has(n: number): boolean {
    return this.values.has(String(n)) || this.values.has(String(Math.round(n * 10) / 10));
  }
}

export function ungroundedNumbers(text: string, allowed: AllowedNumbers): number[] {
  return extractNumbers(text).filter((n) => !allowed.has(n));
}

/** Share of letters that are Devanagari (for Hindi/Marathi output checks). */
export function devanagariShare(text: string): number {
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length === 0) return 0;
  const deva = letters.filter((c) => /[ऀ-ॿ]/.test(c)).length;
  return deva / letters.length;
}
