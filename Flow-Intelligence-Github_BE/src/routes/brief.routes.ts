import { Router } from "express";
import { BriefController } from "../controllers/brief.controller";
import { authenticate } from "../middlewares/authenticate";

export const createBriefRoutes = (controller: BriefController): Router => {
  const router = Router({ mergeParams: true });
  
  router.get("/:id/briefs", authenticate, controller.getBriefs);
  router.post("/:id/briefs/generate", authenticate, controller.generateBrief);
  router.post("/:id/briefs/send-notification", authenticate, controller.sendBriefNotification);
  router.patch("/:id/notification-settings", authenticate, controller.updateNotificationSettings);

  return router;
};
