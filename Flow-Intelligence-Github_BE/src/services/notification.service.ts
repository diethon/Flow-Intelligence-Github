import nodemailer from 'nodemailer';
import axios from 'axios';
import env from '../config/env';

export interface BriefNotificationData {
  summary: string;
  confidence: string;
  limitations?: string[];
  items?: Array<{
    type: string;
    title: string;
    detail: string;
    severity?: string;
  }>;
  windowStart?: Date;
  windowEnd?: Date;
}

export class NotificationService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      console.log('📧 NotificationService: SMTP Mailer initialized successfully.');
    } else {
      console.log('⚠️ NotificationService: SMTP credentials (SMTP_USER / SMTP_PASS) not provided. Email dispatches will be logged to console in dev mode.');
    }
  }

  /**
   * Send Weekly Brief summary via Email
   */
  public async sendBriefEmail(recipients: string[], brief: BriefNotificationData, repoName: string): Promise<boolean> {
    if (!recipients || recipients.length === 0) {
      console.warn(`[NotificationService] No email recipients provided for repository: ${repoName}`);
      return false;
    }

    const htmlContent = this.generateBriefHtmlTemplate(brief, repoName);

    const mailOptions = {
      from: env.SMTP_FROM,
      to: recipients.join(', '),
      subject: `[Flow Intelligence] Weekly AI Brief - ${repoName}`,
      html: htmlContent,
    };

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ [NotificationService] Email sent successfully to ${recipients.join(', ')}: ${info.messageId}`);
        return true;
      } catch (error: any) {
        console.error(`❌ [NotificationService] Failed to send email via SMTP:`, error.message);
        return false;
      }
    } else {
      console.log(`--------------------------------------------------`);
      console.log(`📧 [SIMULATED EMAIL SENT] To: ${recipients.join(', ')}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Summary: ${brief.summary}`);
      console.log(`--------------------------------------------------`);
      return true;
    }
  }

  /**
   * Send Weekly Brief summary via Slack Webhook
   */
  public async sendBriefSlack(webhookUrl: string | undefined, brief: BriefNotificationData, repoName: string): Promise<boolean> {
    if (!webhookUrl) {
      console.log(`⚠️ [NotificationService] No Slack Webhook URL provided for repository ${repoName}. Skipping Slack notification.`);
      return false;
    }

    const slackPayload = this.generateBriefSlackPayload(brief, repoName);

    try {
      await axios.post(webhookUrl, slackPayload);
      console.log(`✅ [NotificationService] Slack message posted successfully for repository: ${repoName}`);
      return true;
    } catch (error: any) {
      console.error(`❌ [NotificationService] Failed to post message to Slack Webhook:`, error.message);
      return false;
    }
  }

  /**
   * Build HTML Template for Email (100% English)
   */
  private generateBriefHtmlTemplate(brief: BriefNotificationData, repoName: string): string {
    const itemsHtml = (brief.items || []).map(item => {
      const severityColor = item.severity === 'high' ? '#e53e3e' : item.severity === 'medium' ? '#dd6b20' : '#3182ce';
      const badgeText = (item.severity || 'info').toUpperCase();
      const typeText = item.type === 'risk_summary' ? '🚨 Risk' : '💡 Recommendation';

      return `
        <div style="margin-bottom: 12px; padding: 12px; border-left: 4px solid ${severityColor}; background-color: #f7fafc; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: #2d3748; font-size: 15px;">${typeText}: ${item.title}</strong>
            <span style="background-color: ${severityColor}; color: #ffffff; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: bold;">${badgeText}</span>
          </div>
          <p style="margin: 6px 0 0 0; color: #4a5568; font-size: 14px; line-height: 1.5;">${item.detail}</p>
        </div>
      `;
    }).join('');

    const limitationsHtml = (brief.limitations && brief.limitations.length > 0)
      ? `<div style="margin-top: 16px; font-size: 12px; color: #718096; background: #edf2f7; padding: 8px 12px; border-radius: 4px;">
          <strong>Limitations & Context:</strong> ${brief.limitations.join('; ')}
         </div>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #edf2f7; margin: 0; padding: 20px; }
          .container { max-width: 650px; background-color: #ffffff; margin: 0 auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%); color: #ffffff; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
          .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 24px; color: #2d3748; }
          .summary-box { background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
          .summary-box h3 { margin-top: 0; color: #2b6cb0; font-size: 16px; }
          .summary-box p { margin-bottom: 0; line-height: 1.6; color: #2c5282; font-size: 14px; }
          .footer { background-color: #f7fafc; padding: 16px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Flow Intelligence - Weekly AI Brief</h1>
            <p>Project Activity Executive Summary: <strong>${repoName}</strong></p>
          </div>
          <div class="content">
            <div class="summary-box">
              <h3>📌 Weekly AI Executive Summary</h3>
              <p>${brief.summary}</p>
              <div style="margin-top: 8px; font-size: 12px; color: #4a5568;">AI Confidence Level: <strong>${brief.confidence.toUpperCase()}</strong></div>
            </div>

            ${itemsHtml ? `<h3 style="color: #2d3748; font-size: 16px; margin-bottom: 12px;">🔍 Risks & Recommendations</h3>${itemsHtml}` : ''}
            ${limitationsHtml}
          </div>
          <div class="footer">
            <p>This report was automatically generated by Flow Intelligence AI Engine.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Build Slack Webhook JSON Payload (100% English)
   */
  private generateBriefSlackPayload(brief: BriefNotificationData, repoName: string): any {
    const itemsText = (brief.items || []).map(item => {
      const icon = item.type === 'risk_summary' ? '🚨' : '💡';
      return `${icon} *[${(item.severity || 'info').toUpperCase()}] ${item.title}*\n>${item.detail}`;
    }).join('\n\n');

    return {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📊 Weekly AI Brief: ${repoName}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📌 Executive Summary:*\n${brief.summary}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `*AI Confidence:* ${brief.confidence.toUpperCase()} | *Date:* ${new Date().toLocaleDateString('en-US')}`,
            },
          ],
        },
        ...(itemsText ? [
          { type: 'divider' },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🔍 Risks & Recommendations:*\n\n${itemsText}`,
            },
          },
        ] : []),
      ],
    };
  }
}
