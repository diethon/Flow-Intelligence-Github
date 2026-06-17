import mongoose, { Schema, Model, Types } from 'mongoose';

export interface IRepositoryConnection extends mongoose.Document {
  _id: Types.ObjectId;
  userId: string;
  providerType: 'github';
  installationId?: string;
  tokenEncrypted: string;
  status: 'active' | 'inactive' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface IGitHubRepository extends mongoose.Document {
  _id: Types.ObjectId;
  connectionId: Types.ObjectId;
  githubRepoId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISyncRun extends mongoose.Document {
  _id: Types.ObjectId;
  repositoryId: Types.ObjectId;
  type: 'initial' | 'incremental' | 'webhook';
  status: 'running' | 'success' | 'partial' | 'failed';
  startedAt: Date;
  finishedAt?: Date;
  recordsProcessed: number;
  warnings?: string[];
  errorMessage?: string;
  createdAt: Date;
}

export interface ISyncJob extends mongoose.Document {
  _id: Types.ObjectId;
  repositoryId: Types.ObjectId;
  jobType: 'sync_pull_requests' | 'sync_reviews' | 'sync_review_requests' | 'sync_commits' | 'sync_issues';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  runAfter: Date;
  attempts: number;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWebhookEvent extends mongoose.Document {
  _id: Types.ObjectId;
  repositoryId: Types.ObjectId;
  githubDeliveryId: string;
  eventType: string;
  action?: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  processedAt?: Date;
}

const RepositoryConnectionSchema = new Schema<IRepositoryConnection>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    providerType: {
      type: String,
      enum: ['github'],
      required: true,
      default: 'github',
    },
    installationId: {
      type: String,
      sparse: true,
    },
    tokenEncrypted: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'error'],
      required: true,
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

RepositoryConnectionSchema.index({ userId: 1, providerType: 1, status: 1 });

const GitHubRepositorySchema = new Schema<IGitHubRepository>(
  {
    connectionId: {
      type: Schema.Types.ObjectId,
      ref: 'RepositoryConnection',
      required: true,
      index: true,
    },
    githubRepoId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    owner: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    defaultBranch: {
      type: String,
      required: true,
    },
    isPrivate: {
      type: Boolean,
      required: true,
      default: false,
    },
    lastSyncedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

GitHubRepositorySchema.index({ connectionId: 1, isPrivate: 1 });
GitHubRepositorySchema.index({ fullName: 1, connectionId: 1 });

const SyncRunSchema = new Schema<ISyncRun>(
  {
    repositoryId: {
      type: Schema.Types.ObjectId,
      ref: 'GitHubRepository',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['initial', 'incremental', 'webhook'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['running', 'success', 'partial', 'failed'],
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    finishedAt: {
      type: Date,
      index: true,
    },
    recordsProcessed: {
      type: Number,
      required: true,
      default: 0,
    },
    warnings: [
      {
        type: String,
      },
    ],
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

SyncRunSchema.index({ repositoryId: 1, startedAt: -1 });
SyncRunSchema.index({ status: 1, startedAt: -1 });

const SyncJobSchema = new Schema<ISyncJob>(
  {
    repositoryId: {
      type: Schema.Types.ObjectId,
      ref: 'GitHubRepository',
      required: true,
      index: true,
    },
    jobType: {
      type: String,
      enum: ['sync_pull_requests', 'sync_reviews', 'sync_review_requests', 'sync_commits', 'sync_issues'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      required: true,
      index: true,
    },
    runAfter: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      required: true,
      default: 0,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

SyncJobSchema.index({ repositoryId: 1, status: 1, runAfter: 1 });
SyncJobSchema.index({ status: 1, runAfter: 1 });

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    repositoryId: {
      type: Schema.Types.ObjectId,
      ref: 'GitHubRepository',
      required: true,
      index: true,
    },
    githubDeliveryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    processedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

WebhookEventSchema.index({ repositoryId: 1, eventType: 1, receivedAt: -1 });
WebhookEventSchema.index({ processedAt: 1 });

export const RepositoryConnectionModel: Model<IRepositoryConnection> =
  mongoose.models.RepositoryConnection || mongoose.model<IRepositoryConnection>('RepositoryConnection', RepositoryConnectionSchema);

export const GitHubRepositoryModel: Model<IGitHubRepository> =
  mongoose.models.GitHubRepository || mongoose.model<IGitHubRepository>('GitHubRepository', GitHubRepositorySchema);

export const SyncRunModel: Model<ISyncRun> =
  mongoose.models.SyncRun || mongoose.model<ISyncRun>('SyncRun', SyncRunSchema);

export const SyncJobModel: Model<ISyncJob> =
  mongoose.models.SyncJob || mongoose.model<ISyncJob>('SyncJob', SyncJobSchema);

export const WebhookEventModel: Model<IWebhookEvent> =
  mongoose.models.WebhookEvent || mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);

export default {
  RepositoryConnectionModel,
  GitHubRepositoryModel,
  SyncRunModel,
  SyncJobModel,
  WebhookEventModel,
};
