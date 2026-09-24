/**
 * Minimal API client for the child app — currently just pairing claim.
 * Dev addressing: emulator → 10.0.2.2, physical device → machine LAN IP.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000";

if (__DEV__) {
  console.log(`[api] base URL = ${BASE_URL}`);
}

const NETWORK_ERROR = 0;

// Every request aborts after 15s so the UI can never hang on a dead or
// cold-starting server (a stuck "LINKING THIS PHONE" is worse than an error).
const TIMEOUT_MS = 15_000;
function timeoutSignal(): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

const dlog = (...a: unknown[]) => __DEV__ && console.log("[api]", ...a);

async function post<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  dlog(`→ POST ${path}`);
  const t = timeoutSignal();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: t.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
    t.done();
    dlog(`← ${res.status} ${path}`);
    if (res.ok) return { ok: true, status: res.status, data };
    return { ok: false, status: res.status, error: data?.error ?? "Request failed" };
  } catch (err) {
    dlog(`✗ network ${path} (${BASE_URL}) —`, err instanceof Error ? err.message : err);
    return { ok: false, status: NETWORK_ERROR, error: "network" };
  }
}

async function postAuthed<T>(
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<ApiResult<T>> {
  dlog(`→ POST ${path}`);
  const t = timeoutSignal();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: t.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
    t.done();
    dlog(`← ${res.status} ${path}`);
    if (res.ok) return { ok: true, status: res.status, data };
    return { ok: false, status: res.status, error: data?.error ?? "Request failed" };
  } catch (err) {
    dlog(`✗ network ${path} (${BASE_URL}) —`, err instanceof Error ? err.message : err);
    return { ok: false, status: NETWORK_ERROR, error: "network" };
  }
}

async function get<T>(path: string, token: string): Promise<ApiResult<T>> {
  dlog(`→ GET ${path}`);
  const t = timeoutSignal();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: t.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
    t.done();
    dlog(`← ${res.status} ${path}`);
    if (res.ok) return { ok: true, status: res.status, data };
    return { ok: false, status: res.status, error: data?.error ?? "Request failed" };
  } catch (err) {
    dlog(`✗ network ${path} (${BASE_URL}) —`, err instanceof Error ? err.message : err);
    return { ok: false, status: NETWORK_ERROR, error: "network" };
  }
}

export type ClaimResponse = {
  ok: true;
  deviceToken: string;
  deviceId: string;
  account: { email: string | null };
};

export type RegisterResponse = {
  ok: true;
  deviceToken: string;
  deviceId: string;
  needsConfirmation: boolean;
  emailSent: boolean;
  account: { email: string };
};

export type MeResponse = {
  ok: true;
  device: { id: string; name: string | null; role: string };
  account: { email: string | null };
  /** Parent-set per-app capture filter (MONITORED_APPS ids). Pushed to native. */
  monitoredApps: string[];
  /** Parent-set protective-overlay (blocking) on/off. Pushed to the native gate. */
  overlayEnabled: boolean;
  /** Account severity threshold — drives the overlay block severity (+ alerts). */
  alertThreshold: "severe" | "moderate" | "all";
  /** Email-alert master switch (parent-set in child settings). */
  emailAlertsEnabled: boolean;
  /** Parent's WhatsApp number (E.164) — powers the Weekly "talk to a parent" dial. */
  parentPhone: string | null;
};

export type SettingsPatch = {
  monitoredApps?: string[];
  overlayEnabled?: boolean;
  alertThreshold?: "severe" | "moderate" | "all";
  emailAlertsEnabled?: boolean;
  /**
   * Required when turning emailAlertsEnabled OFF: first POST /devices/settings/otp
   * (emails the parent a code), then include it here. Otherwise the server
   * replies 403 { error: "otp_required" | "otp_invalid" }.
   */
  otp?: string;
};

export type SettingsResponse = {
  ok: true;
  monitoredApps: string[];
  overlayEnabled: boolean;
  alertThreshold: "severe" | "moderate" | "all";
  emailAlertsEnabled: boolean;
};

export const pairingApi = {
  baseUrl: BASE_URL,
  claim: (
    pairingToken: string,
    deviceInfo: { model?: string; manufacturer?: string; os?: string },
    installId: string,
  ) => post<ClaimResponse>("/pairing/claim", { pairingToken, deviceInfo, installId }),
  /** Self-service pairing: parent enters email + WhatsApp on the child device. */
  register: (
    email: string,
    whatsapp: string | undefined,
    deviceInfo: { model?: string; manufacturer?: string; os?: string },
    installId: string,
    deviceName?: string,
  ) =>
    post<RegisterResponse>("/register", {
      email,
      ...(whatsapp ? { whatsapp } : {}),
      deviceInfo,
      installId,
      ...(deviceName ? { deviceName } : {}),
    }),
  /** Validate the stored device token (child boot gate). 401 = revoked/unlinked. */
  me: (deviceToken: string) => get<MeResponse>("/devices/me", deviceToken),
  /** Update parent-controlled settings from the in-child settings screen. */
  updateSettings: (deviceToken: string, patch: SettingsPatch) =>
    postAuthed<SettingsResponse>("/devices/settings", patch, deviceToken),
  /** Email the parent the 6-digit code that authorizes turning email alerts off. */
  requestSettingsOtp: (deviceToken: string) =>
    postAuthed<{ ok: true }>("/devices/settings/otp", {}, deviceToken),
  /** This device's last-7-days picture for the kid-facing Weekly screen. */
  weekly: (deviceToken: string) => get<WeeklyResponse>("/devices/weekly", deviceToken),
};

export type FeedbackType = "bug" | "wrong_flag" | "idea";

export const feedbackApi = {
  /** Report a bug / wrong flag / idea from the child device (board 30). */
  send: (deviceToken: string, type: FeedbackType, message: string) =>
    postAuthed<{ ok: true }>("/feedback", { type, message }, deviceToken),
};

/** Per-day / per-app worst severity for the child's week. "none" = quiet. */
export type WeeklyWorst = "none" | "low" | "review" | "high";

export type WeeklyResponse = {
  ok: true;
  since: string;
  /** days[0] = 7 days ago … days[6] = today. */
  days: WeeklyWorst[];
  apps: Record<string, WeeklyWorst>;
  total: number;
  high: number;
};

export type SignalInput = {
  category: string;
  severity: string;
  app: string;
  occurredAt: string;
};

/** Origin of a signal batch. 'synthetic' = DEV producer; 'real' = Stage B engine. */
export type SignalSource = "synthetic" | "real";

export const signalsApi = {
  /** Report a batch of signals (device-authed). Content is encrypted server-side. */
  report: (deviceToken: string, batch: SignalInput[], source: SignalSource = "synthetic") =>
    postAuthed<{ ok: true; count: number }>("/signals", { signals: batch, source }, deviceToken),
};
