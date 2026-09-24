import { activeLexiconVersion, setActiveLexicon } from "./classify";

/**
 * Remote lexicon sync (Lexicon Admin). The child holds a bundled default; on
 * refresh/resume it asks the server for the version, and only downloads the full
 * lexicon when the server's is newer. The classifier reads the cached lexicon and
 * works fully offline between syncs. classify()'s contract is untouched.
 *
 * Pure + storage-injected so it's testable in Node (see ml/guard-eval/ts/
 * prove_sync.ts). The RN wiring passes a file-backed storage (lexiconStorage.ts).
 */
export type LexiconStorage = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

export const LEXICON_CACHE_KEY = "lighthouse.lexicon.cache";

export type SyncResult =
  | { status: "updated"; version: number } // newer version downloaded + activated
  | { status: "current"; version: number } // already latest, nothing to do
  | { status: "offline"; version: number }; // fetch failed → kept cached/bundled

/** Load a previously-cached lexicon into the classifier at startup. */
export async function loadCachedLexicon(storage: LexiconStorage): Promise<number> {
  try {
    const raw = await storage.get(LEXICON_CACHE_KEY);
    if (raw) {
      const lex = JSON.parse(raw);
      if (lex && typeof lex.version === "number" && lex.categories) setActiveLexicon(lex);
    }
  } catch {
    // Corrupt cache — ignore; the bundled default stays active.
  }
  return activeLexiconVersion();
}

/**
 * Version-check, then conditionally download. NEVER throws: any network/parse
 * failure returns { status: "offline" } and leaves the classifier on its cached
 * (or bundled) lexicon, so classify() never breaks because a sync failed.
 */
export async function syncLexicon(opts: {
  baseUrl: string;
  token: string;
  storage: LexiconStorage;
  fetchImpl?: typeof fetch;
}): Promise<SyncResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const headers = { authorization: `Bearer ${opts.token}` };
  const local = activeLexiconVersion();
  try {
    const vr = await doFetch(`${opts.baseUrl}/lexicon/version`, { headers });
    if (!vr.ok) return { status: "offline", version: local };
    const { version } = (await vr.json()) as { version: number };
    if (typeof version !== "number" || version <= local) return { status: "current", version: local };

    const lr = await doFetch(`${opts.baseUrl}/lexicon`, { headers });
    if (!lr.ok) return { status: "offline", version: local };
    const payload = (await lr.json()) as { version?: number; categories?: unknown };
    if (!payload || typeof payload.version !== "number" || !payload.categories) {
      return { status: "offline", version: local }; // shape guard — don't trust junk
    }

    await opts.storage.set(LEXICON_CACHE_KEY, JSON.stringify(payload));
    setActiveLexicon(payload as never);
    return { status: "updated", version: payload.version };
  } catch {
    return { status: "offline", version: local };
  }
}
