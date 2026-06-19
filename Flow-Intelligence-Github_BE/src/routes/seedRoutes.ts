import { Router, type Request, type Response } from "express";
import { seedFakeData } from "../seeds/seedFakeData.js";
import { seedRulebook } from "../seeds/seedRulebook.js";

const router = Router();

const isDev = process.env.NODE_ENV !== "production";

function guardProd(res: Response): boolean {
  if (!isDev) {
    res.status(403).json({ error: "Seeding not allowed in production" });
    return true;
  }
  return false;
}

/**
 * POST /api/seed
 * Seeds all demo data: 2 fake repos + rulebook.
 * Returns repositoryId of the first repo (primary demo repo).
 */
router.post("/", async (_req: Request, res: Response) => {
  if (guardProd(res)) return;
  try {
    const [fakeResult] = await Promise.all([
      seedFakeData(),
      seedRulebook(),
    ]);
    res.json({
      success: true,
      repositoryId: fakeResult.repositoryId,
      message: fakeResult.message,
    });
  } catch (err) {
    res.status(500).json({ error: "Seed failed", detail: String(err) });
  }
});

/**
 * POST /api/seed/rulebook
 * Seeds only the Flow Risk Rulebook (R1–R5) and recommendations.
 */
router.post("/rulebook", async (_req: Request, res: Response) => {
  if (guardProd(res)) return;
  try {
    await seedRulebook();
    res.json({ success: true, message: "Rulebook R1–R5 and recommendations seeded" });
  } catch (err) {
    res.status(500).json({ error: "Rulebook seed failed", detail: String(err) });
  }
});

export default router;
