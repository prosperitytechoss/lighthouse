import { createApp } from "./app";
import { env, isProd } from "./config/env";
import { closeDb } from "./db/client";
import { startSchedulers } from "./lib/jobs";
import { logger } from "./lib/logger";
import { closeRedis, connectRedis } from "./lib/redis";

// A dropped Redis/Postgres socket rejects its in-flight promises; any rejection
// not tied to a request handler would otherwise kill the process (Node treats
// unhandled rejections as fatal). Log and keep serving — the clients reconnect
// on their own. True uncaught exceptions still exit (Render restarts us).
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection (continuing)", reason);
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception — exiting", err);
  process.exit(1);
});

async function main(): Promise<void> {
  // Open Redis up front so a bad REDIS_URL fails loudly at boot.
  await connectRedis();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  // Background jobs: silent-device detection + weekly digest. Production only
  // unless RUN_SCHEDULERS=true: a dev API on a laptop once emailed a parent a
  // contradictory weekly from its local database.
  if (isProd || env.RUN_SCHEDULERS === "true") {
    startSchedulers();
  } else {
    logger.info("[jobs] schedulers OFF (not production; set RUN_SCHEDULERS=true to enable)");
  }

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(() => {
      void Promise.allSettled([closeDb(), closeRedis()]).then(() => {
        logger.info("Closed HTTP server, Postgres, and Redis. Goodbye.");
        process.exit(0);
      });
    });

    // Safety net: never hang forever.
    setTimeout(() => {
      logger.error("Forced exit after shutdown timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("Fatal startup error", err);
  process.exit(1);
});
