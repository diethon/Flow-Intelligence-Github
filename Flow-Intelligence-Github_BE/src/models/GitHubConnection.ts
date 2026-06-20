import mongoose, { Document, Schema } from "mongoose";

export type ConnectionStatus = "active" | "inactive" | "revoked" | "error";
export type ProviderType = "github_app" | "oauth" | "token" | "github";

export interface IGitHubConnection extends Document {
  userId: mongoose.Types.ObjectId;
  providerType: ProviderType;
  /** GitHub App installation ID (for github_app provider) */
  installationId: string | null;
  /** Encrypted GitHub token — never store raw token */
  tokenEncrypted: string | null;
  status: ConnectionStatus;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const gitHubConnectionSchema = new Schema<IGitHubConnection>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    providerType: {
      type: String,
      enum: ["github_app", "oauth", "token", "github"],
      required: true,
    },
    installationId: { type: String, default: null },
    tokenEncrypted: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "inactive", "revoked", "error"],
      default: "active",
    },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Query index per design doc
gitHubConnectionSchema.index({ userId: 1, status: 1 });

export const GitHubConnection = mongoose.models.GitHubConnection || mongoose.model<IGitHubConnection>(
  "GitHubConnection",
  gitHubConnectionSchema,
  "githubConnections"
);
