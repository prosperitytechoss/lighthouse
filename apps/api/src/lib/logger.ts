import type { NextFunction, Request, Response } from "express";

type Level = "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: unknown): void {
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (meta === undefined) sink(line);
  else sink(line, meta);
}

export const logger = {
  info: (message: string, meta?: unknown) => emit("info", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  error: (message: string, meta?: unknown) => emit("error", message, meta),
};

/** Logs each request once it finishes, with status code and duration. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
}
