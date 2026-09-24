/**
 * Phase 2 checkpoint — proves the publish → sync → classify loop end-to-end
 * against a live local API, exercising the REAL child modules (classify.ts +
 * lexiconSync.ts). Not a device, but the exact code paths the device runs.
 *
 *   API must be running (see report). Then:  npx tsx ml/guard-eval/ts/prove_sync.ts
 */
import { activeLexiconVersion, classify, setActiveLexicon } from "../../../apps/child/src/native/classify";
import { loadCachedLexicon, syncLexicon, type LexiconStorage } from "../../../apps/child/src/native/lexiconSync";
import bundled from "../../../apps/child/src/native/lexicon.json";

const BASE = process.env.LEX_API ?? "http://localhost:4100";
const ADMIN = process.env.ADMIN_EMAIL ?? "admin@example.com";
// A distinctive term guaranteed NOT to be in the bundled lexicon.
const TERM = "zamzabet";
const MSG = `abeg load your ${TERM} account sharp sharp`;

const mem = new Map<string, string>();
const storage: LexiconStorage = {
  get: async (k) => mem.get(k) ?? null,
  set: async (k, v) => void mem.set(k, v),
};

const j = (o: unknown) => JSON.stringify(o);
async function post(path: string, token: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: j(body),
  });
  return r.json() as Promise<any>;
}

async function main() {
  console.log(`API=${BASE}  admin=${ADMIN}  term="${TERM}"`);

  // 0. admin session (dev bypass) + publish the new term as a live, human term.
  const login = await post("/admin/dev-login", "", { email: ADMIN });
  const token = login.token as string;
  if (!token) throw new Error(`dev-login failed: ${j(login)}`);
  await post("/lexicon/terms", token, { text: TERM, language: "pidgin", category: "Gambling", severity: "review", status: "live" });
  const pub = await post("/lexicon/publish", token, {});
  console.log(`published server version ${pub.version}`);

  // 1. FRESH INSTALL — classifier on the bundled lexicon, hasn't synced.
  setActiveLexicon(bundled as never); // simulate a clean boot
  console.log(`\n[A] fresh install: active version = ${activeLexiconVersion()} (bundled)`);
  const before = classify(MSG);
  console.log(`    classify("${MSG}") = ${j(before)}   ${before ? "❌ should be SAFE" : "✅ SAFE"}`);

  // 2. REFRESH — sync pulls the newer version, caches it, activates it.
  const s1 = await syncLexicon({ baseUrl: BASE, token, storage });
  console.log(`\n[B] after sync: ${j(s1)}  active version = ${activeLexiconVersion()}`);
  const after = classify(MSG);
  const ok = after?.category === "Gambling";
  console.log(`    classify("${MSG}") = ${j(after)}   ${ok ? "✅ now flagged from the synced term" : "❌ not flagged"}`);
  console.log(`    cached on device? ${mem.has("lighthouse.lexicon.cache") ? "✅ yes" : "❌ no"}`);

  // 3. NO-OP — second sync sees same version, doesn't re-download.
  const s2 = await syncLexicon({ baseUrl: BASE, token, storage });
  console.log(`\n[C] second sync: ${j(s2)}   ${s2.status === "current" ? "✅ skipped re-download" : "❌"}`);

  // 4. OFFLINE — a failing fetch must NOT break classify (fall back to cached).
  const s3 = await syncLexicon({ baseUrl: "http://127.0.0.1:1", token, storage });
  const stillWorks = classify(MSG)?.category === "Gambling";
  console.log(`\n[D] offline sync: ${j(s3)}  classify still works? ${stillWorks ? "✅ yes (cached)" : "❌"}`);

  // 5. RESTART — new boot resets to bundled, then loadCachedLexicon restores it.
  setActiveLexicon(bundled as never);
  console.log(`\n[E] simulated restart: reset to bundled (v${activeLexiconVersion()})`);
  const v = await loadCachedLexicon(storage);
  const restored = classify(MSG)?.category === "Gambling";
  console.log(`    loadCachedLexicon → v${v}; classify uses cache? ${restored ? "✅ yes" : "❌"}`);

  const allPass = !before && ok && s2.status === "current" && stillWorks && restored;
  console.log(`\n${allPass ? "✅ LOOP PROVEN end-to-end" : "❌ LOOP FAILED"}`);
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
