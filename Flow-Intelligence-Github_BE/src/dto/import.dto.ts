import { z } from 'zod';

const ObjectIdString = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ObjectId');

/** Normalized entity DTOs — the shape of each row in an import file. */
export const ContributorImportSchema = z.object({
  githubUserId: z.number().int(),
  login: z.string().min(1),
  displayNameMasked: z.string().optional(),
  avatarUrlHash: z.string().optional(),
  type: z.enum(['User', 'Bot']).optional(),
});

export const IssueImportSchema = z.object({
  githubIssueId: z.number().int(),
  number: z.number().int(),
  title: z.string().min(1),
  state: z.enum(['open', 'closed']),
  authorGithubId: z.number().int(),
  authorLogin: z.string().min(1),
  labels: z.array(z.string()).optional().default([]),
  assignees: z.array(z.string()).optional().default([]),
  issueCreatedAt: z.coerce.date(),
  issueUpdatedAt: z.coerce.date(),
  issueClosedAt: z.coerce.date().optional(),
  issueUrl: z.string().url(),
});

export const CommitImportSchema = z.object({
  githubSha: z.string().min(7),
  authorGithubId: z.number().int().optional(),
  authorLogin: z.string().optional(),
  message: z.string().optional(),
  committedAt: z.coerce.date(),
  pullRequestId: ObjectIdString.optional(),
});

export const CheckRunImportSchema = z.object({
  githubCheckId: z.number().int(),
  name: z.string().min(1),
  status: z.enum(['queued', 'in_progress', 'completed']),
  conclusion: z
    .enum(['success', 'failure', 'neutral', 'cancelled', 'timed_out', 'action_required', 'stale', 'skipped'])
    .optional(),
  headSha: z.string().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  detailsUrl: z.string().url().optional(),
  pullRequestId: ObjectIdString.optional(),
});

export type ContributorImport = z.infer<typeof ContributorImportSchema>;
export type IssueImport = z.infer<typeof IssueImportSchema>;
export type CommitImport = z.infer<typeof CommitImportSchema>;
export type CheckRunImport = z.infer<typeof CheckRunImportSchema>;

/** Supported entity types for sample import. */
export const IMPORT_ENTITY_TYPES = ['contributors', 'issues', 'commits', 'checkRuns'] as const;
export type ImportEntityType = (typeof IMPORT_ENTITY_TYPES)[number];

export const ENTITY_ROW_SCHEMA: Record<ImportEntityType, z.ZodTypeAny> = {
  contributors: ContributorImportSchema,
  issues: IssueImportSchema,
  commits: CommitImportSchema,
  checkRuns: CheckRunImportSchema,
};

/**
 * Per-entity field typing for CSV import. CSV cells are always strings, so
 * numeric/array fields are coerced before Zod validation. Array cells use `;`
 * as the in-cell separator (e.g. labels = "bug;ui"). Date strings are left as
 * strings — the row schemas coerce them via z.coerce.date().
 */
const CSV_FIELD_TYPES: Record<ImportEntityType, { numbers: string[]; arrays: string[] }> = {
  contributors: { numbers: ['githubUserId'], arrays: [] },
  issues: { numbers: ['githubIssueId', 'number', 'authorGithubId'], arrays: ['labels', 'assignees'] },
  commits: { numbers: ['authorGithubId'], arrays: [] },
  checkRuns: { numbers: ['githubCheckId'], arrays: [] },
};

/**
 * Coerce a raw CSV row (all-string values) into the shape expected by the
 * entity row schema. Empty cells become `undefined` so optional fields are
 * skipped; numeric fields parse to Number (NaN if invalid → schema rejects).
 */
export function coerceCsvRow(entityType: ImportEntityType, row: Record<string, string>): Record<string, unknown> {
  const spec = CSV_FIELD_TYPES[entityType];
  const out: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(row)) {
    if (spec.arrays.includes(key)) {
      out[key] = raw ? raw.split(';').map((s) => s.trim()).filter(Boolean) : [];
    } else if (raw === '') {
      out[key] = undefined;
    } else if (spec.numbers.includes(key)) {
      out[key] = Number(raw);
    } else {
      out[key] = raw;
    }
  }

  return out;
}

/**
 * Top-level import payload. Each key is optional; only provided entity arrays
 * are validated and upserted. Unknown keys are reported as errors.
 */
export const ImportPayloadSchema = z.object({
  contributors: z.array(z.unknown()).optional(),
  issues: z.array(z.unknown()).optional(),
  commits: z.array(z.unknown()).optional(),
  checkRuns: z.array(z.unknown()).optional(),
});

export type ImportPayload = z.infer<typeof ImportPayloadSchema>;

export interface ImportRowError {
  entityType: ImportEntityType;
  index: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  byEntity: Record<string, { inserted: number; updated: number; skipped: number; errors: number }>;
  errors: ImportRowError[];
}
