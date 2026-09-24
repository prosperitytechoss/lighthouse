import { Router } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db/client";
import { feedback } from "../db/schema";
import { requireDevice } from "../lib/auth-middleware";
import { ah, allowRequest } from "../lib/http";
import { logger } from "../lib/logger";
import { emailService } from "../services/email";

/**
 * POST /feedback — in-app feedback from the child device (bug, wrong flag,
 * idea). Logged loudly and relayed to the admin inbox; never to the parent.
 * The email must never block the app: send failures are logged, not surfaced.
 */
export const feedbackRouter = Router();

const FeedbackBody = z.object({
  type: z.enum(["bug", "wrong_flag", "idea"]),
  message: z.string().trim().min(1).max(2000),
});

feedbackRouter.post(
  "/",
  requireDevice,
  ah(async (req, res) => {
    if (!(await allowRequest(`feedback:${req.deviceId!}`, 5, 3600))) {
      return res.status(429).json({ ok: false, error: "Too much feedback too fast. Try again in an hour." });
    }
    const body = FeedbackBody.parse(req.body ?? {});
    const appVersion = req.header("x-app-version") ?? null;

    // Persist first — the DB row is the record; the email is just a relay.
    await db.insert(feedback).values({
      deviceId: req.deviceId!,
      accountId: req.accountId!,
      type: body.type,
      message: body.message,
      appVersion,
    });

    logger.info(
      `[feedback] ${body.type} from device ${req.deviceId} (app ${appVersion ?? "?"}): ${body.message}`,
    );

    const adminEmail = env.ADMIN_EMAILS.split(",")
      .map((e) => e.trim())
      .filter(Boolean)[0];
    if (adminEmail) {
      try {
        await emailService.sendFeedback(adminEmail, {
          type: body.type,
          message: body.message,
          deviceId: req.deviceId!,
          appVersion,
        });
      } catch (err) {
        logger.error(`[feedback] email relay failed: ${err instanceof Error ? err.message : err}`);
      }
    } else {
      logger.error("[feedback] ADMIN_EMAILS is empty — feedback logged above but NOT emailed to anyone");
    }
    return res.json({ ok: true });
  }),
);
