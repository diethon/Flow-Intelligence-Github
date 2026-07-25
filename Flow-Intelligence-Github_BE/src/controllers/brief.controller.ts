import { Request, Response } from "express";
import { BriefService } from "../services/brief.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";

import { NotificationService } from "../services/notification.service";
import { Repository } from "../models/Repository";
import { GitHubConnection } from "../models/GitHubConnection";
import { User } from "../models/User";
import env from "../config/env";
import type { AuthorizedRepositoryRequest } from "../middlewares/repositoryAuthorization";

export class BriefController {
  constructor(
    private briefService: BriefService,
    private notificationService?: NotificationService
  ) {}

  public generateBrief = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    const { windowStart, windowEnd } = req.body;
    
    const start = windowStart ? new Date(windowStart) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = windowEnd ? new Date(windowEnd) : new Date();

    const userId = (req as AuthorizedRepositoryRequest).userId;
    const brief = await this.briefService.generateBrief(id, start, end, userId);

    res.json({
      success: true,
      data: brief,
    });
  });

  public getBriefs = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    const authorization = (req as AuthorizedRepositoryRequest).repositoryAuthorization;
    const briefs = await this.briefService.getBriefs(id, Boolean(authorization?.canManage));

    res.json({
      success: true,
      data: briefs,
    });
  });

  public publishBrief = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const briefId = req.params.briefId as string;
    const userId = (req as AuthorizedRepositoryRequest).userId;
    if (!id || !briefId || !userId) {
      throw new AppError("Weekly Brief not found", 404, "BRIEF_NOT_FOUND");
    }

    const brief = await this.briefService.publishBrief(id, briefId, userId);
    res.json({ success: true, data: brief });
  });

  public retryBrief = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const briefId = req.params.briefId as string;
    const userId = (req as AuthorizedRepositoryRequest).userId;
    if (!id || !briefId || !userId) {
      throw new AppError("Weekly Brief not found", 404, "BRIEF_NOT_FOUND");
    }

    const brief = await this.briefService.retryBrief(id, briefId, userId);
    res.json({ success: true, data: brief });
  });

  public sendBriefNotification = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    const repo = await Repository.findById(id).lean();
    if (!repo) {
      throw new AppError("Repository not found", 404, "NOT_FOUND");
    }

    const { recipients, slackWebhookUrl } = req.body;
    const repoName = repo.fullName || `${repo.owner}/${repo.name}`;

    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = new Date();

    const userId = (req as AuthorizedRepositoryRequest).userId;
    const brief = await this.briefService.generateBrief(id, start, end, userId);

    let emailSent = false;
    let slackSent = false;

    if (this.notificationService) {
      let emailList: string[] = recipients && Array.isArray(recipients) && recipients.length > 0 ? recipients : [];
      
      if (emailList.length === 0 && repo.connectionId) {
        const connection = await GitHubConnection.findById(repo.connectionId).lean();
        if (connection && connection.userId) {
          const ownerUser = await User.findById(connection.userId).lean();
          if (ownerUser && ownerUser.email) {
            emailList.push(ownerUser.email);
          }
        }
      }

      if (emailList.length > 0) {
        emailSent = await this.notificationService.sendBriefEmail(emailList, brief, repoName);
      }

      const targetSlackWebhook = slackWebhookUrl || repo.slackWebhookUrl;
      if (targetSlackWebhook) {
        slackSent = await this.notificationService.sendBriefSlack(targetSlackWebhook, brief, repoName);
      }
    }

    res.json({
      success: true,
      message: "Notification process completed.",
      data: {
        brief,
        notifications: {
          emailSent,
          slackSent,
        },
      },
    });
  });

  public updateNotificationSettings = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Repository ID is required", 400, "BAD_REQUEST");
    }

    const { slackWebhookUrl, scheduleEnabled, scheduleDay, scheduleTime } = req.body;

    const updatePayload: Record<string, any> = {};
    if (slackWebhookUrl !== undefined) updatePayload.slackWebhookUrl = slackWebhookUrl || null;
    if (scheduleEnabled !== undefined) updatePayload.scheduleEnabled = Boolean(scheduleEnabled);
    if (scheduleDay !== undefined) updatePayload.scheduleDay = scheduleDay;
    if (scheduleTime !== undefined) updatePayload.scheduleTime = scheduleTime;

    const repo = await Repository.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true }
    );

    if (!repo) {
      throw new AppError("Repository not found", 404, "NOT_FOUND");
    }

    res.json({
      success: true,
      message: "Notification settings updated successfully.",
      data: repo,
    });
  });
}
