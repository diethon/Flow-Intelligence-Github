import cron, { ScheduledTask } from 'node-cron';
import { BriefService } from './brief.service';
import { NotificationService } from './notification.service';
import { Repository } from '../models/Repository';
import { GitHubConnection } from '../models/GitHubConnection';
import { User } from '../models/User';
import env from '../config/env';

export class SchedulerService {
  private cronJob: ScheduledTask | null = null;

  constructor(
    private briefService: BriefService,
    private notificationService: NotificationService
  ) { }

  /**
   * Start Weekly Brief Cron Job
   * Default schedule: '0 17 * * 5' (Every Friday at 17:00 / 5 PM)   
   */
  public startWeeklyBriefCron(scheduleExpression: string = '0 17 * * 5'): void {
    if (this.cronJob) {
      console.log('⚠️ [SchedulerService] Weekly Brief cron job is already running.');
      return;
    }

    console.log(`⏰ [SchedulerService] Starting Weekly Brief cron job with schedule: "${scheduleExpression}"`);

    this.cronJob = cron.schedule(scheduleExpression, async () => {
      console.log(`🚀 [SchedulerService] Cron triggered at ${new Date().toISOString()}. Processing Weekly AI Briefs...`);
      await this.runWeeklyBriefJob();
    });
  }

  /**
   * Stop Weekly Brief Cron Job
   */
  public stopWeeklyBriefCron(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('🛑 [SchedulerService] Weekly Brief cron job stopped.');
    }
  }

  /**
   * Manually trigger the Weekly Brief generation and notification process
   */
  public async runWeeklyBriefJob(): Promise<{ processed: number; successCount: number; errors: string[] }> {
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days prior

    const errors: string[] = [];
    let successCount = 0;

    try {
      const repositories = await Repository.find({}).lean();
      console.log(`📋 [SchedulerService] Found ${repositories.length} repository(ies) to process.`);

      if (repositories.length === 0) {
        console.log(`ℹ️ [SchedulerService] No repositories found in database.`);
        return { processed: 0, successCount: 0, errors: [] };
      }

      for (const repo of repositories) {
        const repoIdStr = (repo._id as any).toString();
        const repoName = repo.fullName || `${repo.owner}/${repo.name}`;

        try {
          console.log(`⚙️ [SchedulerService] Generating AI Brief for repository: ${repoName} (${repoIdStr})`);
          const brief = await this.briefService.generateBrief(repoIdStr, windowStart, windowEnd);

          // Strict Database Recipient Discovery:
          // Query Repository -> GitHubConnection -> User -> Email in MongoDB
          let recipients: string[] = [];
          if (repo.connectionId) {
            const connection = await GitHubConnection.findById(repo.connectionId).lean();
            if (connection && connection.userId) {
              const ownerUser = await User.findById(connection.userId).lean();
              if (ownerUser && ownerUser.email) {
                recipients.push(ownerUser.email);
                console.log(`👤 [SchedulerService] Found connected user email: ${ownerUser.email} in DB for repo ${repoName}`);
              }
            }
          }

          if (recipients.length > 0) {
            await this.notificationService.sendBriefEmail(recipients, brief, repoName);
          } else {
            console.warn(`⚠️ [SchedulerService] Repository ${repoName} has no connected owner email in database. Skipping email notification.`);
          }

          // Send Slack Notification if slackWebhookUrl is configured for this repository in DB
          if (repo.slackWebhookUrl) {
            await this.notificationService.sendBriefSlack(repo.slackWebhookUrl, brief, repoName);
          } else {
            console.log(`ℹ️ [SchedulerService] Repository ${repoName} has no slackWebhookUrl in database. Skipping Slack notification.`);
          }

          successCount++;
        } catch (err: any) {
          const errMsg = `Failed to process brief for ${repoName}: ${err.message}`;
          console.error(`❌ [SchedulerService] ${errMsg}`);
          errors.push(errMsg);
        }
      }

      console.log(`✅ [SchedulerService] Weekly Brief Job finished. Processed: ${repositories.length}, Success: ${successCount}, Errors: ${errors.length}`);
      return { processed: repositories.length, successCount, errors };
    } catch (error: any) {
      console.error(`❌ [SchedulerService] Error fetching repositories:`, error.message);
      return { processed: 0, successCount: 0, errors: [error.message] };
    }
  }
}
