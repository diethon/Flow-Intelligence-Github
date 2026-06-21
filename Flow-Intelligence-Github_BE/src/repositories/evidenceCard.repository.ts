import mongoose from 'mongoose';
import { EvidenceCard, IEvidenceCard } from '../models/evidenceCard.model';

export interface EvidenceCardFilter {
  repositoryId: string;
  severity?: 'low' | 'medium' | 'high';
  sourceType?: 'risk_event' | 'prediction';
}

export class EvidenceCardRepository {
  async create(data: Partial<IEvidenceCard>) {
    return EvidenceCard.create(data);
  }

  async findById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return EvidenceCard.findById(id);
  }

  async findMany(filter: EvidenceCardFilter, pagination: { page: number; limit: number }) {
    const query: Record<string, unknown> = {
      repositoryId: new mongoose.Types.ObjectId(filter.repositoryId),
    };
    if (filter.severity) query.severity = filter.severity;
    if (filter.sourceType) query.sourceType = filter.sourceType;

    const skip = (pagination.page - 1) * pagination.limit;
    const [data, total] = await Promise.all([
      EvidenceCard.find(query).sort({ createdAt: -1 }).skip(skip).limit(pagination.limit),
      EvidenceCard.countDocuments(query),
    ]);
    return { data, total };
  }
}
