import "dotenv/config";
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import env from './config/env';
import { connectDatabase } from './config/database';
import { AppError } from './utils';
import { GitHubConnectionService, GitHubApiService, SyncService, WebhookService, startSyncWorker } from './modules/github/services';
import { GitHubController } from './modules/github/controllers/github.controller';
import { createGitHubRoutes, createWebhookRoutes, createRepositoryRoutes } from './modules/github/routes/github.routes';
import { authRoutes } from './modules/auth';
import { ImportController } from './controllers/import.controller';
import { createImportRoutes } from './routes/import.routes';
import { EvidenceController } from './controllers/evidence.controller';
import { createRepositoryEvidenceRoutes, createEvidenceCardRoutes } from './routes/evidence.routes';
import { WorkloadBurnoutController } from './controllers/workloadBurnout.controller';
import { createWorkloadBurnoutRoutes } from './routes/workloadBurnout.routes';

import { DataQualityService } from './services/dataQuality.service';
import { DataQualityController } from './controllers/dataQuality.controller';
import { createDataQualityRoutes } from './routes/dataQuality.routes';

import { PrivacyService } from './services/privacy.service';
import { PrivacyController } from './controllers/privacy.controller';
import { createPrivacyRoutes } from './routes/privacy.routes';

import { NotificationService } from './services/notification.service';
import { SchedulerService } from './services/scheduler.service';
import { AiPayloadBuilderService } from './services/aiPayloadBuilder.service';
import { BriefService } from './services/brief.service';
import { BriefController } from './controllers/brief.controller';
import { createBriefRoutes } from './routes/brief.routes';

import metricsRouter from "./routes/metricsRoutes.js";
import dashboardRouter from "./routes/dashboardRoutes.js";
import riskRouter from "./routes/riskRoutes.js";
import { createPredictionRouter } from './routes/prediction.routes.js';
import { seedRulebook } from "./seeds/seedRulebook.js";
import chatRouter from "./routes/chatRoutes.js";

const app: Express = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }));
app.use(morgan('dev'));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const githubApiService = new GitHubApiService({ token: 'placeholder_for_webhook' });
const connectionService = new GitHubConnectionService();
const syncService = new SyncService(githubApiService);
const webhookService = new WebhookService(githubApiService);

const githubController = new GitHubController(connectionService, syncService, githubApiService);
const importController = new ImportController();
const evidenceController = new EvidenceController();
const workloadBurnoutController = new WorkloadBurnoutController();

const dataQualityService = new DataQualityService();
const dataQualityController = new DataQualityController(dataQualityService);

const privacyService = new PrivacyService();
const privacyController = new PrivacyController();

const notificationService = new NotificationService();
const aiPayloadBuilderService = new AiPayloadBuilderService(privacyService);
const briefService = new BriefService(aiPayloadBuilderService);
const briefController = new BriefController(briefService, notificationService);
const schedulerService = new SchedulerService(briefService, notificationService);

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/github', createGitHubRoutes(githubController));
app.use('/api/repositories', createRepositoryRoutes(githubController));
app.use('/api/repositories', createImportRoutes(importController));
app.use('/api/repositories', createRepositoryEvidenceRoutes(evidenceController));
app.use('/api/repositories', createWorkloadBurnoutRoutes(workloadBurnoutController));
app.use('/api/evidence-cards', createEvidenceCardRoutes(evidenceController));

app.use('/api/repositories', createDataQualityRoutes(dataQualityController));
app.use('/api/repositories', createPrivacyRoutes(privacyController));
app.use('/api/repositories', createBriefRoutes(briefController));
app.use('/api/repositories', createPredictionRouter());
app.use('/api/webhooks', createWebhookRoutes(webhookService));

app.use("/api/metrics", metricsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/risk", riskRouter);
app.use("/api/chat", chatRouter);

// Manual notification trigger endpoint (for testing/admin)
app.post("/api/notifications/trigger-weekly", async (_req: Request, res: Response) => {
  const result = await schedulerService.runWeeklyBriefJob();
  res.json({
    success: true,
    message: "Weekly AI Brief notification job triggered manually.",
    result,
  });
});

// Unhandled route fallback
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handling middleware
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', error);
  const statusCode = (error as { statusCode?: number }).statusCode || 500;
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    try {
      await seedRulebook();
    } catch (seedErr) {
      console.warn("Automatic rulebook seeding failed, continuing anyway:", seedErr);
    }

    await startSyncWorker();
    schedulerService.startWeeklyBriefCron();

    app.listen(env.PORT, env.HOST, () => {
      console.log(`Server running on http://${env.HOST}:${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

export default app;
