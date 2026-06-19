import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { connectDB } from "./config/database.js";
import metricsRouter   from "./routes/metricsRoutes.js";
import dashboardRouter  from "./routes/dashboardRoutes.js";
import riskRouter       from "./routes/riskRoutes.js";
import seedRouter       from "./routes/seedRoutes.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(helmet());

// In development, allow any localhost origin (handles port changes from Vite)
const corsOrigin =
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL || false
    : (origin: string | undefined, cb: (e: Error | null, allow?: boolean) => void) => {
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          cb(null, true);
        } else {
          cb(new Error(`CORS: origin ${origin} not allowed`));
        }
      };

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/metrics",   metricsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/risk",      riskRouter);
app.use("/api/seed",      seedRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Error]", err.message);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
  });
});

export default app;
