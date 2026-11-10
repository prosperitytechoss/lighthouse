import { eq } from "drizzle-orm";

import { db } from "../db/client";
import { appConfig } from "../db/schema";

const OCR_POPUPS = "ocrPopups";
let cache: { value: boolean; at: number } | null = null;

export async function ocrPopups(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const [row] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, OCR_POPUPS)).limit(1);
  const value = row?.value === true;
  cache = { value, at: Date.now() };
  return value;
}

export async function setOcrPopups(value: boolean, by: string | null): Promise<void> {
  await db
    .insert(appConfig)
    .values({ key: OCR_POPUPS, value, updatedBy: by, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appConfig.key, set: { value, updatedBy: by, updatedAt: new Date() } });
  cache = { value, at: Date.now() };
}

export async function configSummary() {
  const [row] = await db.select().from(appConfig).where(eq(appConfig.key, OCR_POPUPS)).limit(1);
  return { ocrPopups: row?.value === true, updatedBy: row?.updatedBy ?? null, updatedAt: row?.updatedAt ?? null };
}
