import mongoose, { Document, Schema } from "mongoose";

export interface IPrivacySettings extends Document {
  repositoryId: mongoose.Types.ObjectId;
  /** Mask contributor names with pseudonyms in UI and AI prompts */
  pseudonymizeContributors: boolean;
  /** Minimum group size before showing per-contributor breakdowns */
  minimumGroupSize: number;
  /** Whether to exclude raw comment bodies from AI prompts */
  excludeRawComments: boolean;
  /** Whether to exclude raw source code diffs from AI prompts */
  excludeRawCode: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const privacySettingsSchema = new Schema<IPrivacySettings>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, unique: true },
    pseudonymizeContributors: { type: Boolean, default: false },
    minimumGroupSize: { type: Number, default: 3 },
    excludeRawComments: { type: Boolean, default: true },
    excludeRawCode: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PrivacySettings = mongoose.model<IPrivacySettings>(
  "PrivacySettings",
  privacySettingsSchema,
  "privacySettings"
);
