import * as FileSystem from "expo-file-system/legacy";

import { BASE_URL } from "../api/client";

import { loadCachedLexicon, syncLexicon, type LexiconStorage, type SyncResult } from "./lexiconSync";
import { getDeviceToken } from "./session";

/**
 * RN file-backed lexicon cache (the injected storage for lexiconSync). Kept in a
 * separate file so lexiconSync stays pure/Node-testable — this is the only place
 * expo-file-system is imported.
 */
const DIR = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
const pathFor = (key: string) => `${DIR}${key.replace(/[^a-z0-9._-]/gi, "_")}.json`;

export const fileStorage: LexiconStorage = {
  async get(key) {
    try {
      const uri = pathFor(key);
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists ? await FileSystem.readAsStringAsync(uri) : null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      await FileSystem.writeAsStringAsync(pathFor(key), value);
    } catch {
      // Cache write is best-effort; a failure just means we re-fetch next time.
    }
  },
};

/** Restore the on-device cached lexicon into the classifier (call once at boot). */
export async function initLexicon(): Promise<number> {
  return loadCachedLexicon(fileStorage);
}

/**
 * Check for and apply a newer lexicon. Safe to call on refresh/resume/interval —
 * cheap version check first, only downloads when the server is ahead, and never
 * throws (classify() keeps working on the cached/bundled lexicon regardless).
 */
export async function refreshLexicon(): Promise<SyncResult | null> {
  const token = await getDeviceToken();
  if (!token) return null;
  return syncLexicon({ baseUrl: BASE_URL, token, storage: fileStorage });
}
