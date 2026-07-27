import { z } from 'zod';

const ObjectIdString = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ObjectId');

export const SeverityEnum = z.enum(['low', 'medium', 'high']);
export const ConfidenceEnum = z.enum(['low', 'medium', 'high']);

/**
 * Contract for a rule-based risk event (owned by Diểm Vi's module, not built yet).
 * Văn Sơn's Evidence Card service consumes this shape to generate cards.
 */
export const RiskEventInputSchema = z.object({
  ruleCode: z.string().min(1),
  severity: SeverityEnum,
  metricValue: z.number().optional(),
  thresholdValue: z.number().optional(),
  windowStart: z.coerce.date().optional(),
  windowEnd: z.coerce.date().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  suggestedAction: z.string().optional(),
  confidence: ConfidenceEnum.optional(),
  limitation: z.string().optional(),
  affectedEntityRefs: z
    .array(
      z.object({
        entityType: z.enum(['pull_request', 'issue', 'commit', 'check_run', 'review']),
        entityId: ObjectIdString,
      })
    )
    .default([]),
});

export type RiskEventInput = z.infer<typeof RiskEventInputSchema>;

/**
 * Contract for an ML PR-delay prediction (owned by Hoàng Việt's module, not built yet).
 */
export const PredictionInputSchema = z.object({
  pullRequestId: ObjectIdString,
  predictionId: ObjectIdString.optional(),
  probability: z.number().min(0).max(1),
  riskLabel: z.enum(['Low', 'Medium', 'High']),
  modelVersion: z.string().optional(),
  limitation: z.string().optional(),
});

export type PredictionInput = z.infer<typeof PredictionInputSchema>;

export const EvidenceListQuerySchema = z.object({
  severity: SeverityEnum.optional(),
  sourceType: z.enum(['risk_event', 'prediction']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type EvidenceListQuery = z.infer<typeof EvidenceListQuerySchema>;
