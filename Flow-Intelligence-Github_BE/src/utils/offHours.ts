/**
 * Off-hours classification for Workload Risk / burnout signal.
 *
 * NOTE: timestamps are stored in UTC and classified in UTC (no timezone
 * normalization by design decision). Callers should surface this as a
 * limitation on any produced Evidence Card.
 */

/** Hour (inclusive) at/after which activity counts as "night". */
export const NIGHT_START_HOUR_UTC = 20;
/** Hour (exclusive) before which activity counts as "night". */
export const NIGHT_END_HOUR_UTC = 6;

/** Saturday (6) or Sunday (0) in UTC. */
export function isWeekendUTC(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** Late-night / early-morning activity in UTC: hour >= 20 or hour < 6. */
export function isNightUTC(d: Date): boolean {
  const h = d.getUTCHours();
  return h >= NIGHT_START_HOUR_UTC || h < NIGHT_END_HOUR_UTC;
}

export interface OffHoursFlags {
  weekend: boolean;
  night: boolean;
  /** true when the activity falls outside business hours (weekend OR night). */
  offHours: boolean;
}

/** Classify a timestamp as weekend / night / off-hours (all in UTC). */
export function classifyOffHours(d: Date): OffHoursFlags {
  const weekend = isWeekendUTC(d);
  const night = isNightUTC(d);
  return { weekend, night, offHours: weekend || night };
}
