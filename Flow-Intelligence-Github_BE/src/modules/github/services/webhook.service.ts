import crypto from 'crypto';
import { WebhookEventRepository, GitHubRepositoryRepository, SyncJobRepository } from '../repositories';
import { GitHubApiService } from './githubApi.service';
import { AppError } from '../../../utils/AppError';
import { ApiResponse, GitHubWebhookEventType, JobType } from '../../../types';
import mongoose from 'mongoose';

const webhookEventRepo = new WebhookEventRepository();
const githubRepoRepo = new GitHubRepositoryRepository();
const syncJobRepo = new SyncJobRepository();

export interface GitHubWebhookRequest {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  signature?: string;
}

export interface ProcessWebhookResult {
  accepted: boolean;
  processed: boolean;
  error?: string;
}

export class WebhookService {
  constructor(private readonly githubApiService: GitHubApiService) {}

  async receiveWebhook(request: GitHubWebhookRequest): Promise<ProcessWebhookResult> {
    const eventType = request.event;
    const action = (request.payload as { action?: string }).action;

    const matchingRepositories = await this.findRepositoriesByDeliveryScope(request.payload);

    if (matchingRepositories.length === 0) {
      return {
        accepted: true,
        processed: false,
        error: 'No matching repository found for delivery',
      };
    }

    const processedResults = await Promise.all(
      matchingRepositories.map((repository) =>
        this.processForRepository({
          repositoryId: repository._id.toString(),
          eventType: eventType as GitHubWebhookEventType,
          action,
          payload: request.payload,
          deliveryId: request.id,
        })
      )
    );

    const processed = processedResults.some((result) => result.processed);

    return {
      accepted: true,
      processed,
      error: processed ? undefined : 'Event accepted but no actionable processing occurred',
    };
  }

  async getWebhookStatus(repositoryId: string): Promise<ApiResponse<{ status: Record<string, unknown> }>> {
    const repository = await githubRepoRepo.findById(repositoryId);
    if (!repository) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', {
        repositoryId,
        retryable: false,
      });
    }

    const recentEvents = await webhookEventRepo.findMany(
      { repositoryId },
      { sortBy: 'receivedAt', sortOrder: 'desc' },
      { page: 1, limit: 20 }
    );

    const unprocessedCount = await webhookEventRepo.count({
      repositoryId,
      processedAt: { $exists: false },
    });

    const lastEvent = recentEvents.data[0] || null;

    return {
      success: true,
      data: {
        status: {
          repositoryId,
          connected: true,
          lastEventReceivedAt: lastEvent?.receivedAt || null,
          lastEventType: lastEvent?.eventType || null,
          lastEventAction: lastEvent?.action || null,
          recentEvents: recentEvents.data.map((event) => ({
            id: event._id.toString(),
            githubDeliveryId: event.githubDeliveryId,
            eventType: event.eventType,
            action: event.action,
            receivedAt: event.receivedAt,
            processedAt: event.processedAt,
          })),
          unprocessedCount,
          health: unprocessedCount > 50 ? 'degraded' : 'healthy',
        },
      },
    };
  }

  async getWebhookEvents(
    repositoryId: string,
    pagination = { page: 1, limit: 20 }
  ): Promise<ApiResponse<{ events: unknown[] }>> {
    const repository = await githubRepoRepo.findById(repositoryId);
    if (!repository) {
      throw new AppError('Repository not found', 404, 'REPOSITORY_NOT_FOUND', {
        repositoryId,
        retryable: false,
      });
    }

    const { data, total } = await webhookEventRepo.findByRepositoryId(repositoryId, pagination);

    return {
      success: true,
      data: {
        events: data.map((event) => ({
          id: event._id.toString(),
          repositoryId: event.repositoryId.toString(),
          githubDeliveryId: event.githubDeliveryId,
          eventType: event.eventType,
          action: event.action,
          payload: event.payload,
          receivedAt: event.receivedAt,
          processedAt: event.processedAt,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        })),
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async retryWebhook(eventId: string): Promise<ApiResponse<{ retried: boolean }>> {
    const event = await webhookEventRepo.findById(eventId);
    if (!event) {
      throw new AppError('Webhook event not found', 404, 'WEBHOOK_EVENT_NOT_FOUND', {
        webhookEventId: eventId,
        retryable: false,
      });
    }

    await webhookEventRepo.markProcessed(eventId);

    const payload = event.payload as { action?: string };

    const result = await this.processForRepository({
      repositoryId: event.repositoryId.toString(),
      eventType: event.eventType as GitHubWebhookEventType,
      action: payload.action || event.action,
      payload: event.payload,
      deliveryId: event.githubDeliveryId,
    });

    return {
      success: true,
      data: {
        retried: true,
      },
      message: result.processed ? 'Webhook reprocessed successfully' : 'Webhook reprocessed with no actionable changes',
    };
  }

  private async processForRepository(options: {
    repositoryId: string;
    eventType: GitHubWebhookEventType;
    action?: string;
    payload: Record<string, unknown>;
    deliveryId: string;
  }): Promise<ProcessWebhookResult> {
    const { repositoryId, eventType, action, payload, deliveryId } = options;

    const existingEvent = await webhookEventRepo.findByDeliveryId(deliveryId);
    if (existingEvent) {
      return {
        accepted: true,
        processed: true,
        error: undefined,
      };
    }

    await webhookEventRepo.create({
      repositoryId,
      githubDeliveryId: deliveryId,
      eventType,
      action,
      payload,
      receivedAt: new Date(),
    });

    if (this.shouldTriggerSync(eventType, action)) {
      const jobTypes = this.mapEventToJobTypes(eventType);
      const runAfter = new Date();

      if (jobTypes.length > 0) {
        await syncJobRepo.create({
          repositoryId,
          jobType: jobTypes[0],
          status: 'pending',
          runAfter,
          attempts: 0,
          payload: {
            repositoryId,
            eventType,
            action,
            deliveryId,
            triggeredAt: new Date().toISOString(),
          },
        });
      }
    }

    return {
      accepted: true,
      processed: true,
    };
  }

  private shouldTriggerSync(eventType: string, action?: string): boolean {
    const syncTriggeringEvents: Record<string, string[]> = {
      pull_request: ['opened', 'synchronize', 'closed', 'reopened', 'ready_for_review', 'converted_to_draft'],
      pull_request_review: ['submitted', 'edited', 'dismissed'],
      push: [],
    };

    const allowedActions = syncTriggeringEvents[eventType];
    if (!allowedActions) return false;
    if (allowedActions.length === 0) return true;
    if (!action) return false;

    return allowedActions.includes(action);
  }

  private mapEventToJobTypes(eventType: string): JobType[] {
    const mapping: Record<string, JobType[]> = {
      pull_request: ['sync_pull_requests', 'sync_reviews', 'sync_review_requests'],
      pull_request_review: ['sync_reviews'],
      push: ['sync_pull_requests'],
    };

    return mapping[eventType] || [];
  }

  private async findRepositoriesByDeliveryScope(payload: Record<string, unknown>): Promise<
    { _id: string }[]
  > {
    const repository = (payload as { repository?: { full_name?: string; name?: string; owner?: { login?: string } } }).repository;
    if (!repository) {
      return [];
    }

    const fullName = repository.full_name;
    const owner = repository.owner?.login;
    const name = repository.name;

    let matched: { _id: string }[] = [];

    if (fullName) {
      const byFullName = await githubRepoRepo.findByFullName(fullName);
      if (byFullName) {
        matched = [{ _id: byFullName._id.toString() }];
      }
    }

    if (matched.length === 0 && owner && name) {
      const results = await githubRepoRepo.findMany({
        owner,
        name,
      });
      matched = results.data.map((record) => ({ _id: record._id.toString() }));
    }

    return matched;
  }
}
