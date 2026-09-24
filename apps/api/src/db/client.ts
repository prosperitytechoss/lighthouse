import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../config/env";

import * as schema from "./schema";

// postgres.js connection pool. Fully env-driven (DATABASE_URL), so it points at
// the docker-compose Postgres or any other instance with no code changes.
const queryClient = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(queryClient, { schema });

/** Liveness check used by /health: a trivial round-trip to Postgres. */
export async function pingDb(): Promise<boolean> {
  await db.execute(sql`select 1`);
  return true;
}

/** Graceful shutdown — drain the pool. */
export async function closeDb(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}
