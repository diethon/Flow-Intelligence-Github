// Identity & Connection
export { User } from './User.js';
export type { IUser } from './User.js';

export { GitHubConnection } from './GitHubConnection.js';
export type { IGitHubConnection } from './GitHubConnection.js';

export { Repository } from './Repository.js';
export type { IRepository } from './Repository.js';

export { PrivacySettings } from './PrivacySettings.js';
export type { IPrivacySettings } from './PrivacySettings.js';

// Normalized GitHub Data
export { Contributor } from './Contributor.js';
export type { IContributor } from './Contributor.js';

export { PullRequest } from './PullRequest.js';
export type { IPullRequest } from './PullRequest.js';

export { Review } from './Review.js';
export type { IReview } from './Review.js';

export { ReviewRequest } from './ReviewRequest.js';
export type { IReviewRequest } from './ReviewRequest.js';

export { Issue } from './Issue.js';
export type { IIssue } from './Issue.js';

export { Commit } from './Commit.js';
export type { ICommit } from './Commit.js';

export { CheckRun } from './CheckRun.js';
export type { ICheckRun } from './CheckRun.js';

// Sync & Event Processing
export { SyncRun } from './SyncRun.js';
export type { ISyncRun } from './SyncRun.js';

export { SyncJob } from './SyncJob.js';
export type { ISyncJob, SyncJobType } from './SyncJob.js';

export { WebhookEvent } from './WebhookEvent.js';
export type { IWebhookEvent } from './WebhookEvent.js';

export { DataQualityWarning } from './DataQualityWarning.js';
export type { IDataQualityWarning, WarningCode } from './DataQualityWarning.js';

// Analytics
export { MetricSnapshot } from './MetricSnapshot.js';
export type { IMetricSnapshot } from './MetricSnapshot.js';

// Machine Learning
export { ModelVersion } from './ModelVersion.js';
export type { IModelVersion } from './ModelVersion.js';

export { PrDelayPrediction } from './PrDelayPrediction.js';
export type { IPrDelayPrediction } from './PrDelayPrediction.js';

// Risk Engine
export { FlowRule } from './FlowRule.js';
export type { IFlowRule, RuleCode } from './FlowRule.js';

export { RiskEvent } from './RiskEvent.js';
export type { IRiskEvent } from './RiskEvent.js';

export { Recommendation } from './Recommendation.js';
export type { IRecommendation } from './Recommendation.js';

// Evidence
export { EvidenceCard } from './EvidenceCard.js';
export type { IEvidenceCard } from './EvidenceCard.js';

// AI & Audit
export { AiBrief } from './AiBrief.js';
export type { IAiBrief } from './AiBrief.js';

export { AiPromptLog } from './AiPromptLog.js';
export type { IAiPromptLog } from './AiPromptLog.js';

export { AuditEvent } from './AuditEvent.js';
export type { IAuditEvent, AuditAction } from './AuditEvent.js';
