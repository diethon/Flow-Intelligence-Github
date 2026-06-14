import { Schema, model, Document, Types } from 'mongoose';

export type WarningCode =
  | 'missing_permissions'
  | 'incomplete_sync'
  | 'unavailable_checks'
  | 'invalid_dates'
  | 'missing_reviews'
  | 'below_minimum_group_size';

export interface IDataQualityWarning extends Document {
  repositoryId: Types.ObjectId;
  code: WarningCode;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  affectedCollection?: string;
  createdAt: Date;
}

const DataQualityWarningSchema = new Schema<IDataQualityWarning>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    code: {
      type: String,
      enum: [
        'missing_permissions',
        'incomplete_sync',
        'unavailable_checks',
        'invalid_dates',
        'missing_reviews',
        'below_minimum_group_size',
      ],
      required: true,
    },
    severity: { type: String, enum: ['critical', 'high', 'medium', 'low'], required: true },
    message: { type: String, required: true },
    affectedCollection: { type: String },
  },
  { timestamps: true }
);

DataQualityWarningSchema.index({ repositoryId: 1, severity: 1, createdAt: -1 });

export const DataQualityWarning = model<IDataQualityWarning>('DataQualityWarning', DataQualityWarningSchema);
