import mongoose, { Document, Schema } from "mongoose";

export type IssueState = "open" | "closed";

export interface IIssue extends Document {
  repositoryId: mongoose.Types.ObjectId;
  githubIssueId: number;
  number: number;
  title: string;
  state: IssueState;
  authorId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  closedAt: Date | null;
  updatedAt: Date;
}

const issueSchema = new Schema<IIssue>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    githubIssueId: { type: Number, required: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    state: { type: String, enum: ["open", "closed"], required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "Contributor", default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Unique per repo
issueSchema.index({ repositoryId: 1, number: 1 }, { unique: true });
// Query index per design doc
issueSchema.index({ repositoryId: 1, state: 1, createdAt: -1 });

export const Issue = mongoose.model<IIssue>("Issue", issueSchema, "issues");
