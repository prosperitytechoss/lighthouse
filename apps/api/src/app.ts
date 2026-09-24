import express, { type Express } from "express";

import { env } from "./config/env";
import { errorHandler } from "./lib/error-handler";
import { requestLogger } from "./lib/logger";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { datasetRouter } from "./routes/dataset";
import { devicesRouter } from "./routes/devices";
import { feedbackRouter } from "./routes/feedback";
import { healthRouter } from "./routes/health";
import { lexiconRouter } from "./routes/lexicon";
import { locationsRouter } from "./routes/locations";
import { pairingRouter } from "./routes/pairing";
import { registerRouter } from "./routes/register";
import { signalsRouter } from "./routes/signals";

/** Builds the Express app. Kept separate from server bootstrap for testability. */
export function createApp(): Express {
  const app = express();

  // Behind Render's proxy: honour X-Forwarded-Proto so req.protocol is https.
  // Needed for building correct absolute links (email confirmation).
  app.set("trust proxy", 1);

  // CORS for the Lexicon Admin dashboard (a separate web origin). Token auth is
  // via the Authorization header (not cookies), so a simple allow-list suffices.
  const adminOrigins = new Set([env.ADMIN_APP_URL, "http://localhost:5173", "http://127.0.0.1:5173"]);
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin && adminOrigins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      res.header("Access-Control-Allow-Headers", "authorization,content-type");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json());
  app.use(requestLogger);

  app.use(healthRouter);
  app.use("/auth", authRouter);
  app.use("/pairing", pairingRouter);
  app.use("/register", registerRouter);
  app.use("/devices", devicesRouter);
  app.use("/signals", signalsRouter);
  app.use("/feedback", feedbackRouter);
  app.use("/locations", locationsRouter);
  app.use("/admin", adminRouter);
  app.use("/lexicon", lexiconRouter);
  app.use("/dataset", datasetRouter);

  // 404 for anything unmatched.
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  // Centralized error handler — must be last.
  app.use(errorHandler);

  return app;
}
