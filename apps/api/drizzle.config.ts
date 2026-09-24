import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit reads this directly (its own TS loader), so it pulls DATABASE_URL
// straight from the environment rather than the zod-validated config module.
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required for drizzle-kit (set it in .env)");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
