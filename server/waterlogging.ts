/**
 * Waterlogging status — deliberately separate from rainfall forecasts.
 *
 * A rain forecast cannot establish road flooding or safe access, so it is never
 * converted into a waterlogging claim. OutingFit has no integrated live
 * municipal waterlogging feed (none with a documented public API was found), so
 * the live answer is always "Local waterlogging status unknown". Reports only
 * appear in labelled demo scenarios, with source, location and age shown.
 */

import { WaterloggingStatus } from './decision/engine.ts';

export const WATERLOGGING_UNKNOWN = 'Local waterlogging status unknown';

export function liveWaterloggingStatus(): WaterloggingStatus {
  return {
    status: 'unknown',
    message: `${WATERLOGGING_UNKNOWN}. OutingFit has no live waterlogging feed; the rain forecast alone cannot tell whether roads are flooded or passable.`,
    reports: [],
  };
}

/** Demo report for the humid-rainy-evening test scenario. Always flagged isDemo. */
export function demoWaterloggingStatus(nearLabel: string, now: Date = new Date()): WaterloggingStatus {
  const reportedAt = new Date(now.getTime() - 50 * 60_000);
  return {
    status: 'reports_available',
    message: 'DEMO DATA — example of how a sourced waterlogging report is displayed. Not a real report.',
    reports: [
      {
        location: `Low-lying underpass near ${nearLabel} (example)`,
        description: 'Example report: water on the carriageway, slow traffic.',
        source: 'DEMO fixture (no live feed connected)',
        reportedAt: reportedAt.toISOString(),
        ageMinutes: 50,
        isDemo: true,
      },
    ],
  };
}
