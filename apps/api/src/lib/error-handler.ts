import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { isProd } from "../config/env";

import { logger } from "./logger";

/**
 * Centralized error handler. Must be registered last. Logs the error and returns
 * a JSON envelope; the stack is only exposed outside production.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction, // Express requires the 4-arg signature to treat this as an error handler.
): void {
  if (res.headersSent) return;

  // Invalid request body/params → 400 with field details.
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: "Invalid request",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error("Unhandled request error", err);

  res.status(500).json({
    error: "Internal Server Error",
    message,
    ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
}
