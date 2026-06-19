import mongoose, { Document, Schema } from "mongoose";

export type CheckConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | null;

export interface ICheckRun extends Document {
  repositoryId: mongoose.Types.ObjectId;
  pullRequestId: mongoose.Types.ObjectId | null;
  githubCheckId: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: CheckConclusion;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const checkRunSchema = new Schema<ICheckRun>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    pullRequestId: { type: Schema.Types.ObjectId, ref: "PullRequest", default: null },
    githubCheckId: { type: Number, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ["queued", "in_progress", "completed"], required: true },
    conclusion: {
      type: String,
      enum: ["success", "failure", "neutral", "cancelled", "skipped", "timed_out", "action_required", null],
      default: null,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique index per design doc
checkRunSchema.index({ githubCheckId: 1 }, { unique: true, sparse: true });
// Query indexes per design doc
checkRunSchema.index({ repositoryId: 1, completedAt: -1 });
checkRunSchema.index({ repositoryId: 1, conclusion: 1, completedAt: -1 });

export const CheckRun = mongoose.model<ICheckRun>("CheckRun", checkRunSchema, "checkRuns");
