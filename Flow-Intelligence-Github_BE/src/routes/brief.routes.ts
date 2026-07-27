import { Router } from "express";
import { BriefController } from "../controllers/brief.controller";
import { authenticate, optionalAuthenticate } from "../middlewares/authenticate";
import {
  canViewWeeklyBrief,
  requireRepositoryContributor,
  requireRepositoryLeader,
} from "../middlewares/repositoryAuthorization";

export const createBriefRoutes = (controller: BriefController): Router => {
  const router = Router({ mergeParams: true });

  router.get("/:id/briefs", optionalAuthenticate, canViewWeeklyBrief, controller.getBriefs);
  router.post("/:id/briefs/generate", authenticate, requireRepositoryLeader, controller.generateBrief);
  router.post("/:id/briefs/:briefId/retry", authenticate, requireRepositoryLeader, controller.retryBrief);
  router.patch("/:id/briefs/:briefId/publish", authenticate, requireRepositoryLeader, controller.publishBrief);
  router.post("/:id/briefs/send-notification", authenticate, requireRepositoryContributor, controller.sendBriefNotification);
  router.patch("/:id/notification-settings", authenticate, requireRepositoryLeader, controller.updateNotificationSettings);

  return router;
};
