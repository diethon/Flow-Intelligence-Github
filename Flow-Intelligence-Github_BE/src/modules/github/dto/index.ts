import { z } from 'zod';

export const ConnectRepositoryDtoSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
});

export type ConnectRepositoryDto = z.infer<typeof ConnectRepositoryDtoSchema>;

export const SyncRepositoryDtoSchema = z.object({
  type: z.enum(['initial', 'incremental']).optional().default('incremental'),
  jobTypes: z
    .array(
      z.enum([
        'sync_pull_requests',
        'sync_reviews',
        'sync_review_requests',
        'sync_commits',
        'sync_issues',
      ])
    )
    .optional()
    .default(['sync_pull_requests', 'sync_reviews', 'sync_review_requests']),
});

export type SyncRepositoryDto = z.infer<typeof SyncRepositoryDtoSchema>;

export const SyncStatusQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  type: z.enum(['initial', 'incremental', 'webhook']).optional(),
  status: z.enum(['running', 'success', 'partial', 'failed']).optional(),
});

export type SyncStatusQuery = z.infer<typeof SyncStatusQuerySchema>;

export const RepositoryIdParamSchema = z.object({
  id: z.string().min(24, 'Invalid repository id'),
});

export type RepositoryIdParam = z.infer<typeof RepositoryIdParamSchema>;

export const WebhookValidationResultSchema = z.object({
  valid: z.boolean(),
  event: z.string().optional(),
  action: z.string().optional(),
  deliveryId: z.string().optional(),
});

export type WebhookValidationResult = z.infer<typeof WebhookValidationResultSchema>;
