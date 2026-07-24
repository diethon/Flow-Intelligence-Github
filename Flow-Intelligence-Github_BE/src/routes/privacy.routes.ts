import { Router } from "express";
import { PrivacyController } from "../controllers/privacy.controller";
import { authenticate } from "../middlewares/authenticate";

export const createPrivacyRoutes = (controller: PrivacyController): Router => {
  const router = Router({ mergeParams: true });
  
  router.get("/:id/privacy", authenticate, controller.getSettings);
  router.put("/:id/privacy", authenticate, controller.updateSettings);
  router.delete("/:id/privacy/data", authenticate, controller.deleteData);

  return router;
};
