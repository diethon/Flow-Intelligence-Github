import type { Request, Response } from 'express';
import { EvidenceCardService, evidenceCardService } from '../services/evidenceCard.service';
import {
  RiskEventInputSchema,
  PredictionInputSchema,
  EvidenceListQuerySchema,
} from '../dto/evidence.dto';
import { AppError } from '../utils/AppError';

const formatZodIssues = (issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) =>
  issues.map((i) => ({ field: i.path.join('.'), message: i.message }));

export class EvidenceController {
  constructor(private readonly service: EvidenceCardService = evidenceCardService) {}

  async listByRepository(req: Request, res: Response) {
    const repositoryId = req.params.id as string;
    const parsed = EvidenceListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('Invalid query', 400, 'VALIDATION_ERROR', {
        errors: formatZodIssues(parsed.error.issues),
      });
    }
    const result = await this.service.list(repositoryId, parsed.data);
    res.json(result);
  }

  async getById(req: Request, res: Response) {
    const result = await this.service.getById(req.params.id as string);
    res.json(result);
  }

  async generateFromRiskEvent(req: Request, res: Response) {
    const repositoryId = req.params.id as string;
    const parsed = RiskEventInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid risk event payload', 400, 'VALIDATION_ERROR', {
        errors: formatZodIssues(parsed.error.issues),
      });
    }
    const result = await this.service.generateFromRiskEvent(repositoryId, parsed.data);
    res.status(201).json(result);
  }

  async generateFromPrediction(req: Request, res: Response) {
    const repositoryId = req.params.id as string;
    const parsed = PredictionInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid prediction payload', 400, 'VALIDATION_ERROR', {
        errors: formatZodIssues(parsed.error.issues),
      });
    }
    const result = await this.service.generateFromPrediction(repositoryId, parsed.data);
    res.status(201).json(result);
  }
}
