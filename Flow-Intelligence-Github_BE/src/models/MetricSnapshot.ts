import { Schema, model, Document, Types } from 'mongoose';

export interface IMetricSnapshot extends Document {
  repositoryId: Types.ObjectId;
  metricKey: string;
  value: number;
  windowStart: Date;
  windowEnd: Date;
  computedAt: Date;
  metadata?: Record<string, unknown>;
}

const MetricSnapshotSchema = new Schema<IMetricSnapshot>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    metricKey: { type: String, required: true },
    value: { type: Number, required: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    computedAt: { type: Date, required: true, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

MetricSnapshotSchema.index(
  { repositoryId: 1, windowStart: 1, windowEnd: 1, metricKey: 1 },
  { unique: true }
);
MetricSnapshotSchema.index({ repositoryId: 1, metricKey: 1, computedAt: -1 });

export const MetricSnapshot = model<IMetricSnapshot>('MetricSnapshot', MetricSnapshotSchema);
