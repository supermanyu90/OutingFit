/**
 * Free text / voice transcript → structured outing fields, using Gemma.
 * Handles English, Hindi, Marathi and mixed-language input. Anything the model
 * is unsure about is flagged for user confirmation; the server adds
 * deterministic checks for known-ambiguous words (Hindi "कल" = yesterday or
 * tomorrow, "परसों" / Marathi "परवा" = two days before or after).
 */

import { z } from 'zod';
import { GemmaClient, GemmaCallResult, extractJson } from './gemmaClient.ts';
import { addDays, isValidDate, isValidTime, nowInMumbai } from '../lib/time.ts';

const Nullable = <T extends z.ZodTypeAny>(t: T) => t.nullable().optional().transform((v) => v ?? null);

const ParsedSchema = z.object({
  destinationText: Nullable(z.string()),
  destinationLatin: Nullable(z.string()),
  dateExpression: Nullable(z.string()),
  date: Nullable(z.string()),
  dateAmbiguous: z.boolean().optional().default(false),
  departure: Nullable(z.string()),
  return: Nullable(z.string()),
  timesAmbiguous: z.boolean().optional().default(false),
  outdoorExposure: Nullable(z.enum(['minimal', 'moderate', 'extended'])),
  transport: Nullable(z.enum(['car', 'public_transport', 'walk'])),
  coveredDropOff: Nullable(z.enum(['yes', 'no', 'unknown'])),
  venueSetting: Nullable(z.enum(['indoor', 'outdoor', 'mixed', 'unknown'])),
  indoorAc: Nullable(z.enum(['confirmed', 'user_expects', 'none', 'unknown'])),
  feelsColdInAc: Nullable(z.boolean()),
  occasion: Nullable(z.string()),
  formality: Nullable(z.enum(['casual', 'smart_casual', 'formal', 'unknown'])),
  colourPreference: Nullable(z.string()),
  detectedLanguages: z.array(z.string()).optional().default([]),
});
export type ParsedRequest = z.infer<typeof ParsedSchema>;

export interface Confirmation {
  field: 'destination' | 'date' | 'departure' | 'return';
  reason: string;
}

export interface ParseResult {
  parsed: ParsedRequest | null;
  confirmations: Confirmation[];
  missing: Array<'destination' | 'date' | 'departure' | 'return'>;
  gemma: Omit<GemmaCallResult, 'text'> | null;
  error?: string;
}

const SYSTEM = `You extract outing details for a Mumbai outfit-planning app. The user may write or speak English, Hindi, Marathi, or a mix (including romanised Hindi/Marathi).
Return ONLY one JSON object with these keys (use null when not stated — never guess):
destinationText (as the user said it), destinationLatin (the place name in Latin letters, e.g. "बास्टियन" → "Bastian"),
dateExpression (the user's own words for the day), date (YYYY-MM-DD in Asia/Kolkata, resolved from TODAY given below), dateAmbiguous (true if the day word could mean more than one date),
departure and return (24-hour HH:mm; Mumbai local time), timesAmbiguous (true if AM/PM is unclear, e.g. "7 o'clock" with no morning/evening cue),
outdoorExposure ("minimal" = just car-to-door, "moderate" = some walking up to ~30 min, "extended" = longer outdoors),
transport ("car" includes taxi/cab/auto, "public_transport" = train/bus/metro, "walk"),
coveredDropOff ("yes"/"no"/"unknown"), venueSetting ("indoor"/"outdoor"/"mixed"/"unknown"),
indoorAc ("user_expects" if the user says the place is air-conditioned, "none" if they say it is not, else null),
feelsColdInAc (true if the user says they feel cold in AC), occasion (short phrase), formality ("casual"/"smart_casual"/"formal"), colourPreference,
detectedLanguages (ISO codes like "en","hi","mr").
Rules: Hindi "कल"/"kal" can mean yesterday or tomorrow — set dateAmbiguous true. "परसों"/"parso" and Marathi "परवा"/"parva" are also ambiguous. Marathi "उद्या"/"udya" means tomorrow. "शाम"/"संध्याकाळी" = evening, "रात"/"रात्री" = night, "दोपहर"/"दुपारी" = afternoon, "सुबह"/"सकाळी" = morning.`;

const str = { type: ['string', 'null'] };
const PARSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    destinationText: str,
    destinationLatin: str,
    dateExpression: str,
    date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    dateAmbiguous: { type: 'boolean' },
    departure: { type: ['string', 'null'], description: '24-hour HH:mm' },
    return: { type: ['string', 'null'], description: '24-hour HH:mm' },
    timesAmbiguous: { type: 'boolean' },
    outdoorExposure: { enum: ['minimal', 'moderate', 'extended', null] },
    transport: { enum: ['car', 'public_transport', 'walk', null] },
    coveredDropOff: { enum: ['yes', 'no', 'unknown', null] },
    venueSetting: { enum: ['indoor', 'outdoor', 'mixed', 'unknown', null] },
    indoorAc: { enum: ['confirmed', 'user_expects', 'none', 'unknown', null] },
    feelsColdInAc: { type: ['boolean', 'null'] },
    occasion: str,
    formality: { enum: ['casual', 'smart_casual', 'formal', 'unknown', null] },
    colourPreference: str,
    detectedLanguages: { type: 'array', items: { type: 'string' } },
  },
  required: ['destinationText', 'destinationLatin', 'dateExpression', 'date', 'dateAmbiguous', 'departure', 'return', 'timesAmbiguous', 'feelsColdInAc'],
};

const AMBIGUOUS_DAY_WORDS = /(^|[^\p{L}])(कल|kal|परसों|parson|parso|परवा|parva)(?=[^\p{L}]|$)/iu;

export async function parseOutingText(gemma: GemmaClient, text: string, now: Date = new Date()): Promise<ParseResult> {
  const today = nowInMumbai(now);
  const user = `TODAY in Mumbai is ${today.date} (${new Date(`${today.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}), current time ${today.time}.
Tomorrow is ${addDays(today.date, 1)}.
User said:
"""${text.slice(0, 2000)}"""`;

  let res: GemmaCallResult;
  try {
    res = await gemma.generate(SYSTEM, user, { temperature: 0, jsonSchema: PARSE_JSON_SCHEMA });
  } catch (err: any) {
    return { parsed: null, confirmations: [], missing: [], gemma: null, error: err.message };
  }
  const { text: raw, ...meta } = res;
  let parsed: ParsedRequest;
  try {
    const p = ParsedSchema.safeParse(extractJson(raw));
    if (!p.success) throw new Error(p.error.issues[0]?.message);
    parsed = p.data;
  } catch (err: any) {
    return { parsed: null, confirmations: [], missing: [], gemma: meta, error: `Could not read Gemma's extraction: ${err.message}` };
  }

  // Sanitise formats rather than trusting them.
  if (parsed.date && !isValidDate(parsed.date)) parsed.date = null;
  if (parsed.departure && !isValidTime(parsed.departure)) parsed.departure = null;
  if (parsed.return && !isValidTime(parsed.return)) parsed.return = null;

  const confirmations: Confirmation[] = [];
  if (AMBIGUOUS_DAY_WORDS.test(text) || parsed.dateAmbiguous) {
    confirmations.push({
      field: 'date',
      reason: `"${parsed.dateExpression || 'the day you mentioned'}" can refer to more than one date. Please confirm the date.`,
    });
  }
  if (parsed.date && parsed.date < today.date) {
    confirmations.push({ field: 'date', reason: `${parsed.date} is in the past. Please confirm the date.` });
  }
  if (parsed.timesAmbiguous) {
    confirmations.push({ field: 'departure', reason: 'Morning or evening was unclear. Please confirm the times.' });
  }
  const missing: ParseResult['missing'] = [];
  if (!parsed.destinationText && !parsed.destinationLatin) missing.push('destination');
  if (!parsed.date) missing.push('date');
  if (!parsed.departure) missing.push('departure');
  if (!parsed.return) missing.push('return');

  return { parsed, confirmations, missing, gemma: meta };
}
