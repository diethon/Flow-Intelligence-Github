import type { Request, Response } from 'express';
import { ImportService, importService } from '../services/import.service';
import { ImportPayloadSchema, IMPORT_ENTITY_TYPES, ImportEntityType } from '../dto/import.dto';
import { AppError } from '../utils/AppError';

export class ImportController {
  constructor(private readonly service: ImportService = importService) {}

  async importJson(req: Request, res: Response) {
    const repositoryId = req.params.id as string;

    const parsed = ImportPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid import payload', 400, 'VALIDATION_ERROR', {
        errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }

    const providedKeys = Object.keys(parsed.data).filter(
      (k) => parsed.data[k as keyof typeof parsed.data] !== undefined
    );
    if (providedKeys.length === 0) {
      throw new AppError(
        'Import payload must contain at least one of: contributors, issues, commits, checkRuns',
        400,
        'EMPTY_IMPORT'
      );
    }

    const result = await this.service.importJson(repositoryId, parsed.data);
    res.status(200).json(result);
  }

  async importCsv(req: Request, res: Response) {
    const repositoryId = req.params.id as string;
    const entity = req.query.entity as string;

    if (!entity || !IMPORT_ENTITY_TYPES.includes(entity as ImportEntityType)) {
      throw new AppError(
        `Query param "entity" must be one of: ${IMPORT_ENTITY_TYPES.join(', ')}`,
        400,
        'INVALID_ENTITY_TYPE'
      );
    }

    if (typeof req.body !== 'string' || req.body.trim() === '') {
      throw new AppError(
        'CSV body is empty. Send raw CSV with Content-Type: text/csv',
        400,
        'EMPTY_IMPORT'
      );
    }

    const result = await this.service.importCsv(repositoryId, entity as ImportEntityType, req.body);
    res.status(200).json(result);
  }
}
