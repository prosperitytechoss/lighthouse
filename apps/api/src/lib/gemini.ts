import { env, isProd } from "../config/env";

import { type Category, type Language } from "./lexicon-defaults";
import { logger } from "./logger";

/**
 * Gemini candidate generation. HARD RULE (enforced at the route): whatever comes
 * back is status=candidate, source=gemini — NEVER live. Gemini is known-weak at
 * Nigerian-language harmful slang (our spike proved it), so these are UNVERIFIED
 * suggestions for a human to review, not truth.
 *
 * Uses the REST API (no SDK dependency). The model name is env-driven
 * (GEMINI_MODEL) and NOT pinned in code; a wrong/rotated name surfaces as the real
 * API error to the admin rather than a silent failure.
 */
export type Candidate = { text: string; severity: "high" | "review" | "low"; note?: string };

const CATEGORY_HINT: Record<Category, string> = {
  Violence: "threats to hurt/kill, weapon intent, planning fights",
  "Sexual Content": "explicit sexual talk, requests for nudes, propositions",
  "Self-Harm": "wanting to die, suicide, cutting, hopelessness",
  "Eating Disorders": "pro-ana/pro-mia, deliberate starving/purging, thinspo",
  "Substance Use": "buying/using drugs, getting high/drunk",
  "Hate Speech": "slurs, dehumanizing a group",
  Gambling: "betting/staking money, parlays, casino, betting brands",
  "Graphic Content": "gore, beheading, shock/graphic-death media",
};
const LANG_LABEL: Record<Language, string> = {
  en: "English",
  pidgin: "Nigerian Pidgin",
  yoruba: "Yoruba",
  hausa: "Hausa",
  igbo: "Igbo",
};

function buildPrompt(category: Category, language: Language, count: number, avoid: string[]): string {
  return [
    `You are helping build a safety word-list for a child-protection app used in Nigeria.`,
    `List up to ${count} short words or phrases in ${LANG_LABEL[language]} that a child might`,
    `send or receive that indicate: ${category} (${CATEGORY_HINT[category]}).`,
    `Real, current slang preferred. Short (1-5 words), lowercase, no diacritics.`,
    avoid.length ? `Do NOT repeat any of these existing terms: ${avoid.slice(0, 80).join(", ")}.` : ``,
    `Return ONLY a JSON array of objects: [{"text": "...", "severity": "high|review|low"}].`,
    `severity: high = explicit/dangerous, review = concerning, low = mild.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Generic Gemini JSON call: sends `prompt`, expects a JSON body back and parses
 * it as T. Throws with the API's message on failure.
 */
export async function geminiJson<T = unknown>(prompt: string, temperature = 0.9): Promise<T> {
  if (!env.GEMINI_API_KEY) throw new Error("Gemini is not configured (GEMINI_API_KEY missing).");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API ${res.status} (model "${env.GEMINI_MODEL}"): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed || "null") as T;
  } catch {
    const repaired = trimmed.replace(/,\s*([\]}])/g, "$1").replace(/[\u0000-\u001f]+/g, " ");
    return JSON.parse(repaired) as T;
  }
}

export const geminiEnabled = () => Boolean(env.GEMINI_API_KEY);

async function callGemini(prompt: string): Promise<Candidate[]> {
  const parsed = await geminiJson<Candidate[]>(prompt);
  return (Array.isArray(parsed) ? parsed : []).filter((c) => c && typeof c.text === "string");
}

/** DEV stub used when no GEMINI_API_KEY is set, so the review→publish loop is
 * demonstrable now. Clearly fake + marked; never runs in production. */
function devStub(category: Category, language: Language, count: number): Candidate[] {
  const sev: Candidate["severity"][] = ["high", "review", "low"];
  return Array.from({ length: Math.min(count, 3) }, (_, i) => ({
    text: `sample ${language} ${category.toLowerCase()} term ${i + 1}`,
    severity: sev[i % 3]!,
    note: "[dev stub] GEMINI_API_KEY not set — placeholder to exercise the review flow",
  }));
}

export async function generateCandidates(
  category: Category,
  language: Language,
  count: number,
  avoid: string[],
): Promise<{ candidates: Candidate[]; source: "gemini" | "dev-stub" }> {
  if (env.GEMINI_API_KEY) {
    const candidates = await callGemini(buildPrompt(category, language, count, avoid));
    return { candidates, source: "gemini" };
  }
  if (!isProd) {
    logger.warn("[gemini] no GEMINI_API_KEY — returning dev-stub candidates");
    return { candidates: devStub(category, language, count), source: "dev-stub" };
  }
  throw new Error("Gemini is not configured (GEMINI_API_KEY missing).");
}
