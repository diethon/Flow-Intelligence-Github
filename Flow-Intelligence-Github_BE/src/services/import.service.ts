import mongoose from 'mongoose';
import { GitHubRepository } from '../modules/github/models/index.js';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../types';
import { NormalizationService, normalizationService, UpsertOutcome } from './normalization.service';
import {
  ImportPayload,
  ImportResult,
  ImportRowError,
  ImportEntityType,
  IMPORT_ENTITY_TYPES,
  ENTITY_ROW_SCHEMA,
  coerceCsvRow,
} from '../dto/import.dto';
import { parseCsv } from '../utils/csv';

const emptyResult = (): ImportResult => ({
  totalRows: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  byEntity: {},
  errors: [],
});

/**
 * UC-20 / E2-S6: validate a JSON import payload per-row/per-field and upsert
 * valid rows into normalized collections. Invalid rows are reported with their
 * row index and field; valid rows in the same file are still imported.
 * Idempotent: importing the same file twice updates rather than duplicates.
 */
export class ImportService {
  constructor(private readonly normalization: NormalizationService = normalizationService) {}

  private async assertRepositoryExists(repositoryId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(repositoryId)) {
      throw new AppError('Invalid repository id', 400, 'INVALID_REPOSITORY_ID', { repositoryId });
    }
    const repo = await GitHubRepository.findById(repositoryId);
    if (!repo) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', { repositoryId });
    }
  }

  private async upsertRow(
    repositoryId: string,
    entityType: ImportEntityType,
    row: unknown
  ): Promise<UpsertOutcome> {
    switch (entityType) {
      case 'contributors':
        return this.normalization.upsertContributor(repositoryId, row as never);
      case 'issues':
        return this.normalization.upsertIssue(repositoryId, row as never);
      case 'commits':
        return this.normalization.upsertCommit(repositoryId, row as never);
      case 'checkRuns':
        return this.normalization.upsertCheckRun(repositoryId, row as never);
    }
  }

  /**
   * Validate + upsert a batch of raw rows for one entity type, accumulating
   * counts and per-row/per-field errors into `result`. Shared by the JSON and
   * CSV import paths so both enforce identical validation and idempotency.
   */
  private async processRows(
    repositoryId: string,
    entityType: ImportEntityType,
    rows: unknown[],
    result: ImportResult
  ): Promise<void> {
    const schema = ENTITY_ROW_SCHEMA[entityType];
    const bucket = result.byEntity[entityType] || { inserted: 0, updated: 0, skipped: 0, errors: 0 };

    for (let index = 0; index < rows.length; index++) {
      result.totalRows++;
      const parsed = schema.safeParse(rows[index]);

      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const rowError: ImportRowError = {
            entityType,
            index,
            field: issue.path.join('.') || undefined,
            message: issue.message,
          };
          result.errors.push(rowError);
        }
        bucket.errors++;
        bucket.skipped++;
        result.skipped++;
        continue;
      }

      try {
        const outcome = await this.upsertRow(repositoryId, entityType, parsed.data);
        if (outcome === 'inserted') {
          bucket.inserted++;
          result.inserted++;
        } else {
          bucket.updated++;
          result.updated++;
        }
      } catch (error) {
        bucket.errors++;
        bucket.skipped++;
        result.skipped++;
        result.errors.push({
          entityType,
          index,
          message: error instanceof Error ? error.message : 'Upsert failed',
        });
      }
    }

    result.byEntity[entityType] = bucket;
  }

  private finalize(result: ImportResult): ApiResponse<ImportResult> {
    const hasErrors = result.errors.length > 0;
    return {
      success: true,
      message: hasErrors
        ? `Import completed with ${result.errors.length} row error(s)`
        : 'Import completed successfully',
      data: result,
    };
  }

  async importJson(repositoryId: string, payload: ImportPayload): Promise<ApiResponse<ImportResult>> {
    await this.assertRepositoryExists(repositoryId);

    const result = emptyResult();
    for (const entityType of IMPORT_ENTITY_TYPES) {
      const rows = payload[entityType];
      if (!rows || rows.length === 0) continue;
      await this.processRows(repositoryId, entityType, rows, result);
    }

    return this.finalize(result);
  }

  /**
   * UC-20: import a single entity type from CSV text. CSV cells are coerced to
   * the entity's field types before reusing the same per-row validation and
   * idempotent upsert as JSON import.
   */
  async importCsv(
    repositoryId: string,
    entityType: ImportEntityType,
    csvText: string
  ): Promise<ApiResponse<ImportResult>> {
    await this.assertRepositoryExists(repositoryId);

    const rawRows = parseCsv(csvText);
    const rows = rawRows.map((r) => coerceCsvRow(entityType, r));

    const result = emptyResult();
    await this.processRows(repositoryId, entityType, rows, result);

    return this.finalize(result);
  }
}

export const importService = new ImportService();
