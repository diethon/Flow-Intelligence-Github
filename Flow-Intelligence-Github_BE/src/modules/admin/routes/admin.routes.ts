import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';

export const createAdminRoutes = (controller: AdminController): Router => {
  const router = Router();

  // Users Management
  router.get('/users', (req, res, next) => controller.getUsers(req, res, next));
  router.put('/users/:id/role', (req, res, next) => controller.updateUserRole(req, res, next));
  router.delete('/users/:id', (req, res, next) => controller.deleteUser(req, res, next));
  router.get('/users/:id/repositories', (req, res, next) => controller.getUserRepositories(req, res, next));

  // System statistics
  router.get('/stats', (req, res, next) => controller.getSystemStats(req, res, next));

  // Global Repositories Management
  router.get('/repositories', (req, res, next) => controller.getRepositories(req, res, next));
  router.post('/repositories/:id/sync', (req, res, next) => controller.forceSyncRepository(req, res, next));
  router.delete('/repositories/:id', (req, res, next) => controller.disconnectRepository(req, res, next));

  return router;
};
