import mongoose, { Schema, Model, Types } from 'mongoose';



/**
 * Central barrel export for all Mongoose models.
 * Import from here instead of individual files:
 *   import { PullRequest, Review, RiskEvent } from "../models/index.js";
 */

// ── Identity & Connection ──────────────────────────────────────────────────
export { User } from "./User.js";
export type { IUser, UserRole } from "./User.js";

export { GitHubConnection } from "./GitHubConnection.js";
export type { IGitHubConnection, ConnectionStatus, ProviderType } from "./GitHubConnection.js";

export { Repository } from "./Repository.js";
export type { IRepository } from "./Repository.js";

export { PrivacySettings } from "./PrivacySettings.js";
export type { IPrivacySettings } from "./PrivacySettings.js";

// ── Normalized GitHub Data ─────────────────────────────────────────────────
export { Contributor } from "./Contributor.js";
export type { IContributor } from "./Contributor.js";

export { PullRequest } from "./PullRequest.js";
export type { IPullRequest } from "./PullRequest.js";

export { Review } from "./Review.js";
export type { IReview } from "./Review.js";

export { ReviewRequest } from "./ReviewRequest.js";
export type { IReviewRequest } from "./ReviewRequest.js";

export { Issue } from "./Issue.js";
export type { IIssue } from "./Issue.js";

export { Commit } from "./Commit.js";
export type { ICommit } from "./Commit.js";

export { CheckRun } from "./CheckRun.js";
export type { ICheckRun, CheckConclusion } from "./CheckRun.js";

// ── Sync & Event Processing ────────────────────────────────────────────────
export { SyncRun } from "./SyncRun.js";
export type { ISyncRun, SyncRunStatus, SyncRunType } from "./SyncRun.js";

export { SyncJob } from "./SyncJob.js";
export type { ISyncJob, SyncJobType, SyncJobStatus } from "./SyncJob.js";

export { WebhookEvent } from "./WebhookEvent.js";
export type { IWebhookEvent, WebhookEventType, WebhookEventStatus } from "./WebhookEvent.js";

export { DataQualityWarning } from "./DataQualityWarning.js";
export type { IDataQualityWarning, DataQualityCode, DataQualitySeverity } from "./DataQualityWarning.js";

// ── Analytics ─────────────────────────────────────────────────────────────
export { MetricSnapshot } from "./MetricSnapshot.js";
export type { IMetricSnapshot, MetricKey } from "./MetricSnapshot.js";

export { ModelVersion } from "./ModelVersion.js";
export type { IModelVersion, ModelStatus } from "./ModelVersion.js";

export { PrDelayPrediction } from "./PrDelayPrediction.js";
export type { IPrDelayPrediction, RiskLabel } from "./PrDelayPrediction.js";

export { FlowRule } from "./FlowRule.js";
export type { IFlowRule, RuleCode, RuleSeverityLevel, EvidenceType } from "./FlowRule.js";

export { RiskEvent } from "./RiskEvent.js";
export type { IRiskEvent, RiskEventStatus, RiskSeverity } from "./RiskEvent.js";

export { EvidenceCard } from "./EvidenceCard.js";
export type { IEvidenceCard, IEvidenceItem, EvidenceCardSeverity, EvidenceCardConfidence, EvidenceCardSourceType } from "./EvidenceCard.js";

export { Recommendation } from "./Recommendation.js";
export type { IRecommendation } from "./Recommendation.js";

// ── AI & Audit ─────────────────────────────────────────────────────────────
export { AiBrief } from "./AiBrief.js";
export type { IAiBrief, IBriefItem, AiBriefStatus, AiBriefConfidence } from "./AiBrief.js";

export { AiPromptLog } from "./AiPromptLog.js";
export type { IAiPromptLog } from "./AiPromptLog.js";

export { AuditEvent } from "./AuditEvent.js";
export type { IAuditEvent, AuditAction } from "./AuditEvent.js";
