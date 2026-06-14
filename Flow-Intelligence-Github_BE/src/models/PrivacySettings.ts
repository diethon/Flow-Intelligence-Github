import { Schema, model, Document, Types } from 'mongoose';

export interface IPrivacySettings extends Document {
  repositoryId: Types.ObjectId;
  pseudonymize: boolean;
  minimumGroupSize: number;
}

const PrivacySettingsSchema = new Schema<IPrivacySettings>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    pseudonymize: { type: Boolean, required: true, default: false },
    minimumGroupSize: { type: Number, required: true, default: 3 },
  },
  { timestamps: true }
);

PrivacySettingsSchema.index({ repositoryId: 1 }, { unique: true });

export const PrivacySettings = model<IPrivacySettings>('PrivacySettings', PrivacySettingsSchema);
