import mongoose from "mongoose";
import { FlowRule, IFlowRule } from "../../../models/FlowRule.js";
import { Recommendation, IRecommendation } from "../../../models/Recommendation.js";
import { RiskEvent, IRiskEvent } from "../../../models/RiskEvent.js";
import { PullRequest, IPullRequest } from "../../../models/PullRequest.js";
import { Review, IReview } from "../../../models/Review.js";
import { CheckRun, ICheckRun } from "../../../models/CheckRun.js";

export interface IFlowRuleRepository {
  findActive(): Promise<IFlowRule[]>;
  findByRuleCode(ruleCode: string): Promise<IFlowRule | null>;
}

export interface IRecommendationRepository {
  findByRuleCode(ruleCode: string): Promise<IRecommendation[]>;
}

export interface IRiskEventRepository {
  findLatestActive(repositoryId: string, ruleCode: string): Promise<IRiskEvent | null>;
  findLatest(repositoryId: string, ruleCode: string): Promise<IRiskEvent | null>;
  create(data: Partial<IRiskEvent>): Promise<IRiskEvent>;
  update(id: string, data: Partial<IRiskEvent>): Promise<IRiskEvent | null>;
  findManyByRepository(repositoryId: string, windowStart: Date): Promise<IRiskEvent[]>;
}

export interface IPullRequestRepository {
  findOpenPRs(repositoryId: string): Promise<IPullRequest[]>;
  findPRsInWindow(repositoryId: string, start: Date, end: Date): Promise<IPullRequest[]>;
  countAll(repositoryId: string): Promise<number>;
}

export interface IReviewRepository {
  findPRReviews(pullRequestId: string, afterDate: Date): Promise<IReview[]>;
  findReviewsInWindow(repositoryId: string, start: Date, end: Date): Promise<IReview[]>;
}

export interface ICheckRunRepository {
  findCheckRunsInWindow(repositoryId: string, start: Date, end: Date): Promise<ICheckRun[]>;
}

export class FlowRuleRepository implements IFlowRuleRepository {
  async findActive(): Promise<IFlowRule[]> {
    return FlowRule.find({ isActive: true }).lean();
  }

  async findByRuleCode(ruleCode: string): Promise<IFlowRule | null> {
    return FlowRule.findOne({ ruleCode: ruleCode as any }).lean();
  }
}

export class RecommendationRepository implements IRecommendationRepository {
  async findByRuleCode(ruleCode: string): Promise<IRecommendation[]> {
    return Recommendation.find({ ruleCode: ruleCode as any }).lean();
  }
}

export class RiskEventRepository implements IRiskEventRepository {
  async findLatestActive(repositoryId: string, ruleCode: string): Promise<IRiskEvent | null> {
    return RiskEvent.findOne({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      ruleCode: ruleCode as any,
      status: "active",
    }).sort({ createdAt: -1 });
  }

  async findLatest(repositoryId: string, ruleCode: string): Promise<IRiskEvent | null> {
    return RiskEvent.findOne({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      ruleCode: ruleCode as any,
    }).sort({ createdAt: -1 });
  }

  async create(data: Partial<IRiskEvent>): Promise<IRiskEvent> {
    return RiskEvent.create(data);
  }

  async update(id: string, data: Partial<IRiskEvent>): Promise<IRiskEvent | null> {
    return RiskEvent.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async findManyByRepository(repositoryId: string, windowStart: Date): Promise<IRiskEvent[]> {
    return RiskEvent.find({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
    }).sort({ createdAt: -1 }).lean();
  }
}

export class PullRequestRepository implements IPullRequestRepository {
  async findOpenPRs(repositoryId: string): Promise<IPullRequest[]> {
    return PullRequest.find({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      state: "open",
      isDraft: false,
    }).lean();
  }

  async findPRsInWindow(repositoryId: string, start: Date, end: Date): Promise<IPullRequest[]> {
    return PullRequest.find({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { mergedAt: { $gte: start, $lte: end } },
      ],
    }).lean();
  }

  async countAll(repositoryId: string): Promise<number> {
    return PullRequest.countDocuments({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
    });
  }
}

export class ReviewRepository implements IReviewRepository {
  async findPRReviews(pullRequestId: string, afterDate: Date): Promise<IReview[]> {
    return Review.find({
      pullRequestId: new mongoose.Types.ObjectId(pullRequestId),
      submittedAt: { $gte: afterDate },
    }).sort({ submittedAt: 1 }).lean();
  }

  async findReviewsInWindow(repositoryId: string, start: Date, end: Date): Promise<IReview[]> {
    return Review.find({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      submittedAt: { $gte: start, $lte: end },
    }).lean();
  }
}

export class CheckRunRepository implements ICheckRunRepository {
  async findCheckRunsInWindow(repositoryId: string, start: Date, end: Date): Promise<ICheckRun[]> {
    return CheckRun.find({
      repositoryId: new mongoose.Types.ObjectId(repositoryId),
      completedAt: { $gte: start, $lte: end },
      status: "completed",
    }).lean();
  }
}
