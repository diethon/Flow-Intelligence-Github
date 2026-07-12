import { Router } from "express";
import { DataQualityController } from "../controllers/dataQuality.controller";
import { authenticate } from "../middlewares/authenticate";

export const createDataQualityRoutes = (controller: DataQualityController): Router => {
  const router = Router({ mergeParams: true });
  
  // Base route will be mounted at /api/repositories
  // so the full path will be: /api/repositories/:id/data-quality
  router.get("/:id/data-quality", authenticate, controller.getQuality);

  return router;
};
