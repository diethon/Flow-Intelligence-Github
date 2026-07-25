import { Router } from "express";
import { PrivacyController } from "../controllers/privacy.controller";
import { authenticate } from "../middlewares/authenticate";
import { requireRepositoryLeader } from "../middlewares/repositoryAuthorization";

export const createPrivacyRoutes = (controller: PrivacyController): Router => {
  const router = Router({ mergeParams: true });
  
  router.get("/:id/privacy", authenticate, requireRepositoryLeader, controller.getSettings);
  router.put("/:id/privacy", authenticate, requireRepositoryLeader, controller.updateSettings);
  router.delete("/:id/privacy/data", authenticate, requireRepositoryLeader, controller.deleteData);

  return router;
};
