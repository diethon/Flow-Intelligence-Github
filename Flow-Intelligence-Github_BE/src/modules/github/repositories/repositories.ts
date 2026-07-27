import mongoose from 'mongoose';
import {
  RepositoryConnection,
  IRepositoryConnection,
  GitHubRepository,
  IGitHubRepository,
  WebhookEvent,
  IWebhookEvent,
  SyncRun,
  ISyncRun,
  SyncJob,
  ISyncJob,
  PullRequest,
  IPullRequest,
} from '../models';

export class GitHubRepositoryRepository {
  async findById(id: string) {
    return GitHubRepository.findById(id);
  }

  async findByFullName(fullName: string) {
    return GitHubRepository.findOne({ fullName });
  }

  async findMany(filter: Record<string, unknown>, sort?: Record<string, 1 | -1>, pagination?: { skip?: number; limit?: number }) {
    const data = await GitHubRepository.find(filter).sort(sort || {}).skip(pagination?.skip || 0).limit(pagination?.limit || 50);
    const total = await GitHubRepository.countDocuments(filter);
    return { data, total };
  }

  async create(data: Partial<IGitHubRepository>) {
    return GitHubRepository.create(data);
  }

  async update(id: string, update: Partial<IGitHubRepository>) {
    return GitHubRepository.findByIdAndUpdate(id, update, { new: true });
  }

  async delete(id: string) {
    return GitHubRepository.findByIdAndDelete(id);
  }
}

export class RepositoryConnectionRepository {
  async findOne(filter: Record<string, unknown>) {
    return RepositoryConnection.findOne(filter);
  }

  async findById(id: string) {
    return RepositoryConnection.findById(id);
  }

  async create(data: Partial<IRepositoryConnection>) {
    return RepositoryConnection.create(data);
  }

  async updateStatus(id: string, status: string) {
    return RepositoryConnection.findByIdAndUpdate(id, { status }, { new: true });
  }

  async update(id: string, data: Partial<IRepositoryConnection>) {
    return RepositoryConnection.findByIdAndUpdate(id, data, { new: true });
  }

  async findByUserId(userId: string) {
    return RepositoryConnection.find({ userId });
  }

  async delete(id: string) {
    return RepositoryConnection.findByIdAndDelete(id);
  }
}

export class WebhookEventRepository {
  async findMany(filter: Record<string, unknown>, sort?: Record<string, 1 | -1>, pagination?: { skip?: number; limit?: number }) {
    const data = await WebhookEvent.find(filter).sort(sort || {}).skip(pagination?.skip || 0).limit(pagination?.limit || 50);
    const total = await WebhookEvent.countDocuments(filter);
    return { data, total };
  }

  async count(filter: Record<string, unknown>) {
    return WebhookEvent.countDocuments(filter);
  }

  async create(data: Partial<IWebhookEvent>) {
    return WebhookEvent.create(data);
  }

  async findByDeliveryId(deliveryId: string) {
    return WebhookEvent.findOne({ deliveryId });
  }

  async findById(id: string) {
    return WebhookEvent.findById(id);
  }

  async markProcessed(id: string) {
    return WebhookEvent.findByIdAndUpdate(id, { processed: true, processedAt: new Date() }, { new: true });
  }

  async deleteMany(filter: Record<string, unknown>) {
    return WebhookEvent.deleteMany(filter);
  }

  async findByRepositoryId(repositoryId: string, pagination?: { skip?: number; limit?: number }) {
    const data = await WebhookEvent.find({ repositoryId }).sort({ createdAt: -1 }).skip(pagination?.skip || 0).limit(pagination?.limit || 50);
    const total = await WebhookEvent.countDocuments({ repositoryId });
    return { data, total };
  }
}

export class SyncRunRepository {
  async findLatestByRepository(repositoryId: string) {
    return SyncRun.findOne({ repositoryId: new mongoose.Types.ObjectId(repositoryId) }).sort({ createdAt: -1 });
  }

  async findMany(filter: Record<string, unknown>, sort?: Record<string, 1 | -1>, pagination?: { skip?: number; limit?: number }) {
    const data = await SyncRun.find(filter).sort(sort || { createdAt: -1 }).skip(pagination?.skip || 0).limit(pagination?.limit || 50);
    const total = await SyncRun.countDocuments(filter);
    return { data, total };
  }

  async create(data: Partial<ISyncRun>) {
    return SyncRun.create(data);
  }

  async findById(id: string) {
    return SyncRun.findById(id);
  }

  async updateStatus(id: string, status: string) {
    return SyncRun.findByIdAndUpdate(id, { status, finishedAt: new Date() }, { new: true });
  }

  async markError(id: string, errorMessage: string) {
    return SyncRun.findByIdAndUpdate(
      id,
      { status: 'error', errorMessage, finishedAt: new Date() },
      { new: true }
    );
  }

  async incrementRecordsProcessed(id: string) {
    return SyncRun.findByIdAndUpdate(id, { $inc: { recordsProcessed: 1 } }, { new: true });
  }
}

export class SyncJobRepository {
  async count(filter: Record<string, unknown>) {
    return SyncJob.countDocuments(filter);
  }

  async create(data: Partial<ISyncJob>) {
    return SyncJob.create(data);
  }

  async findById(id: string) {
    return SyncJob.findById(id);
  }

  async findMany(filter: Record<string, unknown>, sort?: Record<string, 1 | -1>, pagination?: { skip?: number; limit?: number }) {
    const data = await SyncJob.find(filter).sort(sort || { createdAt: -1 }).skip(pagination?.skip || 0).limit(pagination?.limit || 50);
    const total = await SyncJob.countDocuments(filter);
    return { data, total };
  }

  async updateStatus(id: string, status: string, extra: { itemsProcessed?: number; error?: string } = {}) {
    const update: Record<string, unknown> = { status };
    if (extra.itemsProcessed !== undefined) {
      update.itemsProcessed = extra.itemsProcessed;
    }
    if (extra.error) {
      update.error = extra.error;
    }
    return SyncJob.findByIdAndUpdate(id, update, { new: true });
  }
}

export class PullRequestRepository {
  async findMany(filter: Record<string, unknown>, sort?: Record<string, 1 | -1>, pagination?: { skip?: number; limit?: number }) {
    const data = await PullRequest.find(filter).sort(sort || { prCreatedAt: -1 }).skip(pagination?.skip || 0).limit(pagination?.limit || 50);
    const total = await PullRequest.countDocuments(filter);
    return { data, total };
  }

  async findById(id: string) {
    return PullRequest.findById(id);
  }

  async findByRepositoryId(repositoryId: string, pagination?: { skip?: number; limit?: number }) {
    const data = await PullRequest.find({ repositoryId }).sort({ prCreatedAt: -1 }).skip(pagination?.skip || 0).limit(pagination?.limit || 50);
    const total = await PullRequest.countDocuments({ repositoryId });
    return { data, total };
  }

  async count(filter: Record<string, unknown>) {
    return PullRequest.countDocuments(filter);
  }
}
