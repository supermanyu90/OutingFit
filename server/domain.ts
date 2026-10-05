/**
 * Shared request/response contracts for the outing recommendation pipeline.
 */

import { z } from 'zod';
import { isValidDate, isValidTime } from './lib/time.ts';

export const LANGUAGES = ['en', 'hi', 'mr'] as const;
export type Language = (typeof LANGUAGES)[number];

const hhmm = z.string().refine(isValidTime, 'must be HH:mm (24-hour)');

export const ResolvedDestinationSchema = z.object({
  kind: z.enum(['registry', 'restaurant', 'place']),
  /** Registry venue id (kind=registry) or OpenStreetMap id (kind=restaurant). */
  venueId: z.string().optional(),
  /** Display name, e.g. "Olive Bar & Kitchen", "Trishna" or "Juhu". */
  name: z.string().min(1).max(120),
  /** Forecast point: the restaurant itself (kind=restaurant), else a GeoNames locality centroid. */
  forecastPoint: z.object({
    label: z.string(),
    lat: z.number().min(18.5).max(19.6),
    lon: z.number().min(72.5).max(73.3),
  }),
});
export type ResolvedDestination = z.infer<typeof ResolvedDestinationSchema>;

export const OutingRequestSchema = z.object({
  destination: ResolvedDestinationSchema,
  date: z.string().refine(isValidDate, 'must be YYYY-MM-DD'),
  departure: hhmm,
  return: hhmm,
  outdoorExposure: z.enum(['minimal', 'moderate', 'extended']).default('minimal'),
  outdoorStart: hhmm.optional(),
  outdoorEnd: hhmm.optional(),
  transport: z.enum(['car', 'public_transport', 'walk']).default('car'),
  coveredDropOff: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  venueSetting: z.enum(['indoor', 'outdoor', 'mixed', 'unknown']).default('unknown'),
  /** AC is used only when the user says so or the venue condition is confirmed. */
  indoorAc: z.enum(['confirmed', 'user_expects', 'none', 'unknown']).default('unknown'),
  feelsColdInAc: z.boolean().default(false),
  occasion: z.string().max(120).default(''),
  formality: z.enum(['casual', 'smart_casual', 'formal', 'unknown']).default('unknown'),
  colourPreference: z.string().max(80).optional(),
  language: z.enum(LANGUAGES).default('en'),
  /** Test-only fault injection; always surfaced in the response. */
  fault: z.enum(['weather_down', 'gemma_down']).optional(),
  /** Test-only: use a labelled fixture forecast instead of the live provider. */
  weatherFixture: z.enum(['sunny_afternoon', 'humid_rainy_evening']).optional(),
});
export type OutingRequest = z.infer<typeof OutingRequestSchema>;
