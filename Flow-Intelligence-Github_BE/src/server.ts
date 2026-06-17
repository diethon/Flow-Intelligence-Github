import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cron from 'node-cron';

import env from './config/env';
import { connectDatabase } from './config/database';
import { asyncHandler, AppError } from './utils';
import { GitHubConnectionService, GitHubApiService, SyncService, WebhookService, startSyncWorker } from './modules/github/services';
import { GitHubController } from './modules/github/controllers/github.controller';
import { createGitHubRoutes, createWebhookRoutes, createRepositoryRoutes } from './modules/github/routes/github.routes';
import { authRoutes } from './modules/auth';

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
app.use(morgan('dev'));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const githubApiService = new GitHubApiService({ token: 'placeholder_for_webhook' });
const connectionService = new GitHubConnectionService();
const syncService = new SyncService(githubApiService);
const webhookService = new WebhookService(githubApiService);

const githubController = new GitHubController(connectionService, syncService, githubApiService);

app.use('/api/auth', authRoutes);
app.use('/api/github', createGitHubRoutes(githubController));
app.use('/api/repositories', createRepositoryRoutes(githubController));
app.use('/api/webhooks', createWebhookRoutes(webhookService));

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

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

    await startSyncWorker();

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
