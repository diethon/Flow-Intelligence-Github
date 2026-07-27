import { AppError } from '../../../utils/AppError';

import { calculateUC10Metrics, persistUC10Snapshots } from '../../../services/metricsEngine.js';
import { evaluateRiskRules } from '../../../services/riskRuleEngine.js';

export interface MetricsPayload {
  repositoryId: string;
  syncRunId: string;
  metrics: {
    totalPRs: number;
    openPRs: number;
    closedPRs: number;
    mergedPRs: number;
    avgReviewTime?: number;
    totalReviews: number;
  };
}

export interface PredictionPayload {
  repositoryId: string;
  modelType: 'review_time' | 'merge_probability';
  data: Record<string, unknown>;
}

export interface RiskPayload {
  repositoryId: string;
  riskFactors: Array<{
    factor: string;
    score: number;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface EvidenceCardPayload {
  repositoryId: string;
  cardType: 'pr_insights' | 'review_analytics' | 'team_performance';
  data: Record<string, unknown>;
}

export class NotificationService {
  private metricsEndpoint: string;
  private predictionEndpoint: string;
  private riskEndpoint: string;
  private evidenceEndpoint: string | null;

  constructor() {
    this.metricsEndpoint = process.env.METRICS_SERVICE_URL || 'http://localhost:3001/api/metrics';
    this.predictionEndpoint = process.env.PREDICTION_SERVICE_URL || 'http://localhost:3002/api/predictions';
    this.riskEndpoint = process.env.RISK_SERVICE_URL || 'http://localhost:3003/api/risk';
    this.evidenceEndpoint = process.env.EVIDENCE_SERVICE_URL?.trim() || null;
  }

  async onSyncComplete(
    repositoryId: string,
    syncRunId: string,
    data: {
      pullRequestsCount: number;
      reviewsCount: number;
      reviewRequestsCount: number;
    }
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.notifyMetricsService(repositoryId, syncRunId, data),
      this.notifyPredictionService(repositoryId, data),
      this.notifyRiskService(repositoryId, data),
      this.notifyEvidenceService(repositoryId, 'pr_insights', data),
    ]);

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`[NotificationService] ${failures.length} notifications failed`);
      failures.forEach((f, i) => {
        if (f.status === 'rejected') {
          console.error(`[NotificationService] Failure ${i}:`, f.reason);
        }
      });
    } else {
      console.log(`[NotificationService] All notifications sent for sync ${syncRunId}`);
    }
  }

  async notifyMetricsService(
    repositoryId: string,
    syncRunId: string,
    data: {
      pullRequestsCount: number;
      reviewsCount: number;
      reviewRequestsCount: number;
    }
  ): Promise<void> {
    try {
      // Calculate and persist UC10 metrics synchronously or asynchronously
      const metrics = await calculateUC10Metrics(repositoryId, 7);
      await persistUC10Snapshots(metrics);

      console.log(`[NotificationService] Metrics calculated and persisted locally for ${repositoryId}`);
    } catch (error) {
      console.error(`[NotificationService] Failed to calculate metrics locally:`, error);
      throw error;
    }
  }

  async notifyPredictionService(
    repositoryId: string,
    data: {
      pullRequestsCount: number;
      reviewsCount: number;
      reviewRequestsCount: number;
    }
  ): Promise<void> {
    try {
      const payload: PredictionPayload = {
        repositoryId,
        modelType: 'review_time',
        data: {
          totalPullRequests: data.pullRequestsCount,
          totalReviews: data.reviewsCount,
          pendingReviewRequests: data.reviewRequestsCount,
        },
      };

      const response = await fetch(`${this.predictionEndpoint}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new AppError(`Prediction service responded with ${response.status}`, response.status, 'PREDICTION_ERROR');
      }

      console.log(`[NotificationService] Prediction triggered for ${repositoryId}`);
    } catch (error) {
      console.error(`[NotificationService] Failed to notify prediction:`, error);
      throw error;
    }
  }

  async notifyRiskService(
    repositoryId: string,
    data: {
      pullRequestsCount: number;
      reviewsCount: number;
      reviewRequestsCount: number;
    }
  ): Promise<void> {
    try {
      // Evaluate risk rules locally (UC13)
      await evaluateRiskRules(repositoryId, 7);
      
      console.log(`[NotificationService] Risk assessment executed locally for ${repositoryId}`);
    } catch (error) {
      console.error(`[NotificationService] Failed to execute risk assessment locally:`, error);
      throw error;
    }
  }

  async notifyEvidenceService(
    repositoryId: string,
    cardType: EvidenceCardPayload['cardType'],
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.evidenceEndpoint) {
      console.info(
        `[NotificationService] External evidence notification skipped for ${repositoryId}: EVIDENCE_SERVICE_URL is not configured.`
      );
      return;
    }

    try {
      const payload: EvidenceCardPayload = {
        repositoryId,
        cardType,
        data,
      };

      const response = await fetch(`${this.evidenceEndpoint}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new AppError(`Evidence service responded with ${response.status}`, response.status, 'EVIDENCE_ERROR');
      }

      console.log(`[NotificationService] Evidence card (${cardType}) generated for ${repositoryId}`);
    } catch (error) {
      console.error(`[NotificationService] Failed to notify evidence service:`, error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
