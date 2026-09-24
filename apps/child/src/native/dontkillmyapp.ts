/**
 * DontKillMyApp integration — data-driven background-kill guidance.
 *
 * Aggressive OEMs (Transsion / Tecno / Infinix / itel, Xiaomi, Oppo, Vivo, …)
 * silently kill sideloaded background apps. We don't own that hardware, so rather
 * than hardcode menu paths we can't verify, we fetch the community-maintained
 * steps from the public DontKillMyApp API and render the "user_solution".
 *
 * API: https://dontkillmyapp.com/api/v2/{manufacturer}.json
 * Graceful by design: offline / unknown-vendor / parse-miss all return null, and
 * the UI shows the universal Settings-search fallback instead.
 */

export type DkmaGuide = { name: string; steps: string[] } | null;

const APP_NAME = "Lighthouse";
const TIMEOUT_MS = 7000;

// Per-session cache. A successful or "definitively not found" (404) result is
// cached; network errors are NOT cached, so a later visit can retry.
const cache = new Map<string, DkmaGuide>();

/** Lowercased first token of Build.MANUFACTURER → DKMA vendor slug (tecno, xiaomi…). */
function slug(manufacturer: string): string {
  return (manufacturer || "").trim().toLowerCase().split(/\s+/)[0] ?? "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

/** Strip tags, decode entities, substitute the app-name placeholder, collapse space. */
function clean(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\{\{?\s*app\s*\}?\}|\[app\]|%app%|\byour app\b/gi, APP_NAME)
    .replace(/\s+/g, " ")
    .trim();
}

/** DKMA `user_solution` is HTML; pull <li> items, else fall back to sentences. */
export function parseUserSolution(html: string): string[] {
  if (!html) return [];
  const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => clean(m[1] ?? ""))
    .filter((s) => s.length > 1);
  if (items.length) return items.slice(0, 6);
  return clean(html)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4)
    .slice(0, 6);
}

export async function fetchDkmaGuide(manufacturer: string): Promise<DkmaGuide> {
  const key = slug(manufacturer);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`https://dontkillmyapp.com/api/v2/${key}.json`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      cache.set(key, null); // 404 / vendor-not-found is definitive — cache it.
      return null;
    }
    const json = (await res.json()) as { name?: string; user_solution?: string };
    const steps = parseUserSolution(String(json.user_solution ?? ""));
    const guide: DkmaGuide = steps.length ? { name: String(json.name || manufacturer), steps } : null;
    cache.set(key, guide);
    return guide;
  } catch {
    return null; // offline / aborted — do NOT cache, allow retry next visit.
  }
}
