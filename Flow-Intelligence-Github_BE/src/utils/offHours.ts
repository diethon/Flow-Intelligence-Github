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

/**
 * Bot / automation identities we must exclude from the burnout signal — a bot
 * committing at night is cron, not a person working off-hours, and it otherwise
 * dominates the off-hours counts.
 *
 * GitHub appends "[bot]" to real bot accounts (dependabot[bot], renovate[bot]…);
 * automation that commits with a plain git user.name (no GitHub account) is
 * caught by the known-login list (e.g. GitHub Actions' default "actions-user").
 */
const KNOWN_BOT_LOGINS = new Set([
  "actions-user",
  "github-actions",
  "web-flow", // GitHub's committer for merges made via the web UI
  "dependabot",
  "renovate",
  "renovate-bot",
  "mergify",
  "codecov",
  "greenkeeper",
  "snyk-bot",
  "imgbot",
  "allcontributors",
]);

/** True when a commit/review author login belongs to a bot or automation. */
export function isBotIdentity(login?: string | null): boolean {
  if (!login) return false;
  const l = login.toLowerCase().trim();
  return l.includes("[bot]") || KNOWN_BOT_LOGINS.has(l);
}

export interface CoAuthor {
  name: string;
  /** Lower-cased email, used as a stable identity key. */
  email: string;
}

// Git trailer: "Co-authored-by: Real Name <email@host>" (one per line, case-insensitive).
const CO_AUTHOR_RE = /^\s*co-authored-by:\s*(.+?)\s*<([^>]+)>\s*$/gim;

/**
 * Extract the human(s) credited in a commit message's `Co-authored-by:` trailers.
 * This is how a bot commit (cherry-pick / squash by "actions-user") still points
 * at the real author — GitHub's commit API exposes no workflow-trigger identity,
 * so the message trailer is the only reliable human behind an automation commit.
 * Bot co-authors are dropped.
 */
export function extractCoAuthors(message?: string | null): CoAuthor[] {
  if (!message) return [];
  const out: CoAuthor[] = [];
  const seen = new Set<string>();
  for (const m of message.matchAll(CO_AUTHOR_RE)) {
    const name = m[1].trim();
    const email = m[2].trim().toLowerCase();
    const key = email || name.toLowerCase();
    if (!name || isBotIdentity(name) || seen.has(key)) continue;
    seen.add(key);
    out.push({ name, email });
  }
  return out;
}
