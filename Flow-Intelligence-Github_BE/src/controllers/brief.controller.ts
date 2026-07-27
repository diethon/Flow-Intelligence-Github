import { Request, Response } from "express";
import { BriefService } from "../services/brief.service";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";

import { NotificationService } from "../services/notification.service";
import { Repository } from "../models/Repository";
import { User } from "../models/User";
import env from "../config/env";
import type { AuthorizedRepositoryRequest } from "../middlewares/repositoryAuthorization";

export class BriefController {
  constructor(
    private briefService: BriefService,
    private notificationService?: NotificationService
  ) { }


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

    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const userId = (req as AuthorizedRepositoryRequest).userId;
    const brief = await this.briefService.generateBrief(id, start, end, userId);

    let emailSent = false;
    let slackSent = false;

    if (!this.notificationService) {
      console.error(`[BriefNotification] Notification service is unavailable for repository ${id}.`);
    } else {
      const requestedRecipients = Array.isArray(recipients)
        ? recipients.filter((email): email is string => typeof email === "string" && email.trim().length > 0)
        : [];
      const requestingUser = userId ? await User.findById(userId).select("email").lean() : null;
      const emailList = [
        ...new Set(
          (requestedRecipients.length > 0
            ? requestedRecipients
            : requestingUser?.email
              ? [requestingUser.email]
              : []
          ).map(email => email.trim().toLowerCase())
        ),
      ];

      if (emailList.length === 0) {
        console.error(
          `[BriefNotification] Email was not sent for repository ${id}: no recipient email was provided and the requesting user has no email.`
        );
      } else {
        console.info(
          `[BriefNotification] Sending weekly brief ${brief._id} for repository ${id} to ${emailList.length} recipient(s).`
        );
        emailSent = await this.notificationService.sendBriefEmail(emailList, brief, repoName);
        if (!emailSent) {
          console.error(
            `[BriefNotification] Email delivery failed for brief ${brief._id} in repository ${id}. Check the preceding SMTP log for details.`
          );
        }
      }

      const targetSlackWebhook = slackWebhookUrl || repo.slackWebhookUrl;
      if (targetSlackWebhook) {
        slackSent = await this.notificationService.sendBriefSlack(targetSlackWebhook, brief, repoName);
        if (!slackSent) {
          console.error(`[BriefNotification] Slack delivery failed for brief ${brief._id} in repository ${id}.`);
        }
      } else {
        console.info(`[BriefNotification] Slack delivery skipped for repository ${id}: no webhook configured.`);
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
