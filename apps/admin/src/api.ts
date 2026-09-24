// Thin API client for the Lexicon Admin dashboard. Token in localStorage; every
// call carries the admin bearer. Base URL is env-configurable (prod points at the
// deployed API); defaults to the local checkpoint instance.
export const API_BASE = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000";

const TOKEN_KEY = "lh.admin.token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

// ── types ──
export type Term = {
  id: string;
  text: string;
  language: "en" | "pidgin" | "yoruba" | "hausa" | "igbo";
  category: string;
  severity: "high" | "review" | "low";
  status: "live" | "candidate" | "rejected";
  source: "human" | "gemini";
  note?: string | null;
  modelTag?: string | null;
  addedBy?: string | null;
};
export type LexStatus = {
  version: number;
  liveCount: number;
  candidates: number;
  rejected: number;
  pendingChanges: boolean;
  lastPublishedAt: string | null;
};
export type EvalResult = {
  version: number;
  total: number;
  accuracy: number;
  safeFalsePositiveRate: number;
  hardNegativePassRate: number;
  categoryAccuracy: number;
  codeswitchDetection: number;
  dataset?: {
    total: number;
    accuracy: number;
    safeFalsePositiveRate: number;
    categoryAccuracy: number;
  };
};

export type Overview = {
  stats: { totalDevices: number; reporting: number; totalSignals: number; signals7d: number };
  byDay: { date: string; count: number }[];
  byCategory: Record<string, number>;
  byChannel?: Record<string, number>;
  devices: {
    id: string;
    name: string;
    assignee: string | null;
    account: string | null;
    role: string;
    batteryLevel: number | null;
    batteryCharging: boolean | null;
    lastSeenAt: string | null;
    visionSupported?: boolean | null;
    visionTier?: "fast" | "mid" | "slow" | null;
    visionFrames?: number | null;
    visionLastFrameAt?: string | null;
    visionIntervalMs?: number | null;
    engineStats?: Record<string, string | number | boolean> | null;
    health: "active" | "monitoring_off" | "not_reporting";
    signals: number;
  }[];
};

// ── auth ──
export const devLogin = (email: string) => req<{ token: string; email: string }>("/admin/dev-login", { method: "POST", body: JSON.stringify({ email }) });
export const requestMagicLink = (email: string) => req<{ ok: true; devMagicUrl?: string }>("/admin/login", { method: "POST", body: JSON.stringify({ email }) });
export const exchangeMagic = (token: string) => req<{ token: string; email: string }>("/admin/callback", { method: "POST", body: JSON.stringify({ token }) });
export const me = () => req<{ email: string }>("/admin/me");
export const logout = () => req("/admin/logout", { method: "POST" });
export const getOverview = () => req<Overview>("/admin/overview");

// ── lexicon ──
export const listTerms = (q: Record<string, string> = {}) =>
  req<{ terms: Term[]; count: number }>(`/lexicon/terms?${new URLSearchParams(q)}`);
export const addTerm = (t: Partial<Term>) => req<{ term: Term }>("/lexicon/terms", { method: "POST", body: JSON.stringify(t) });
export const patchTerm = (id: string, patch: Partial<Term>) => req<{ term: Term }>(`/lexicon/terms/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const deleteTerm = (id: string) => req(`/lexicon/terms/${id}`, { method: "DELETE" });
export const lexStatus = () => req<LexStatus>("/lexicon/status");
export const publish = () => req<{ version: number; liveCount: number }>("/lexicon/publish", { method: "POST", body: "{}" });
export const generate = (category: string, language: string, count: number) =>
  req<{ source: string; generated: number; added: number }>("/lexicon/generate", { method: "POST", body: JSON.stringify({ category, language, count }) });
export const runEval = () => req<EvalResult>("/lexicon/eval");

// ── dataset ──
export type ExampleKind = "positive" | "hard_negative" | "safe";
export type ExampleStatus = "candidate" | "approved" | "rejected";
export type DatasetExample = {
  id: string;
  text: string;
  language: Term["language"];
  category: string | null;
  severity: Term["severity"] | null;
  kind: ExampleKind;
  source: string;
  status: ExampleStatus;
  split: "train" | "eval";
  note?: string | null;
  modelTag?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
};
export type DatasetStats = {
  total: number;
  byStatus: Record<ExampleStatus, number>;
  byCategory: Record<string, number>;
  byLanguage: Record<string, number>;
  bySource: Record<string, number>;
  lastHarvestAt: string | null;
  approvedUntrained?: number;
  inModel?: number;
  byModelTag?: Record<string, number>;
};
export type DatasetSource = {
  id: string;
  key: string;
  kind: "hf" | "gemini";
  enabled: boolean;
  cursor: number;
  totalPulled: number;
  lastRunAt: string | null;
};
export type ExamplePatch = {
  status?: ExampleStatus;
  category?: string | null;
  severity?: Term["severity"] | null;
  kind?: ExampleKind;
  split?: "train" | "eval";
  note?: string | null;
};
export type NewExample = {
  text: string;
  language: string;
  category: string | null;
  severity: Term["severity"] | null;
  kind: ExampleKind;
};

const clean = (q: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => !!e[1]));

export const datasetStats = () => req<DatasetStats>("/dataset/stats");
export const listExamples = (q: Record<string, string | undefined> = {}) =>
  req<{ examples: DatasetExample[]; count: number }>(`/dataset/examples?${clean(q)}`);
export const patchExample = (id: string, patch: ExamplePatch) =>
  req<{ ok: true; example: DatasetExample }>(`/dataset/examples/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const createExample = (e: NewExample) =>
  req<{ ok?: true; example: DatasetExample }>("/dataset/examples", { method: "POST", body: JSON.stringify(e) });
export const listSources = () => req<{ sources: DatasetSource[] }>("/dataset/sources");
export const patchSource = (id: string, enabled: boolean) =>
  req<{ ok: true }>(`/dataset/sources/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) });

export async function downloadExport(split: "train" | "eval" = "train", tag?: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/dataset/export?${clean({ split, status: "approved", tag })}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lighthouse-${split}.jsonl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── jobs ──
export type JobName = "dataset_harvest" | "lexicon_generate";
export type JobRun = {
  id: string;
  job: JobName;
  status: "running" | "ok" | "error";
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
  error: string | null;
  triggeredBy: string | null;
};
export type JobsInfo = {
  runs: JobRun[];
  schedule: { enabled?: boolean; harvestIntervalMinutes: number; nextHarvestAt: string | null };
};
export const listJobs = () => req<JobsInfo>("/admin/jobs");
export const runJob = (job: JobName) => req<{ ok: true; run: JobRun }>(`/admin/jobs/${job}/run`, { method: "POST", body: "{}" });

export const CATEGORIES = ["Violence", "Sexual Content", "Self-Harm", "Eating Disorders", "Substance Use", "Hate Speech", "Gambling", "Graphic Content"];
export const LANGUAGES = ["en", "pidgin", "yoruba", "hausa", "igbo"];
export const LANG_LABEL: Record<string, string> = { en: "English", pidgin: "Pidgin", yoruba: "Yorùbá", hausa: "Hausa", igbo: "Igbo" };
export const SEVERITIES = ["high", "review", "low"];

export type AdminEvent = {
  id: string;
  deviceId: string;
  deviceName: string;
  channel: string;
  source: string;
  occurredAt: string;
  createdAt: string;
  category: string | null;
  severity: "high" | "review" | "low" | null;
  app: string | null;
  meta: Record<string, string | number | boolean>;
};
export type DeviceDetail = {
  id: string;
  name: string | null;
  assignee: string | null;
  deviceInfo: { model?: string; manufacturer?: string; os?: string } | null;
  pairedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  accessibilityEnabled: boolean | null;
  notificationAccessEnabled: boolean | null;
  batteryOptimizationExempt: boolean | null;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  monitoredApps: string[] | null;
  overlayEnabled: boolean;
  visionEnabled: boolean | null;
  visionSupported: boolean | null;
  visionTier: string | null;
  visionIntervalMs: number | null;
  visionFrames: number | null;
  visionLastFrameAt: string | null;
  engineStats: Record<string, string | number | boolean> | null;
  email: string | null;
  emailVerified: boolean | null;
  alertThreshold: string | null;
  emailAlertsEnabled: boolean | null;
};
export const getDevice = (id: string) => req<{ device: DeviceDetail; events: AdminEvent[] }>(`/admin/devices/${id}`);
export const listEvents = (limit = 100) => req<{ events: AdminEvent[] }>(`/admin/events?limit=${limit}`);
