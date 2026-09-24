import type { Incident } from "@lighthouse/types";

import { PLATFORM_PACKAGE } from "./platforms";

const CLF = "clf-2026.05.1";

/**
 * Eight sample incidents, one per category, with realistic Lagos / WhatsApp /
 * TikTok contexts. `flaggedText` is a short internal descriptor only — in the real
 * product nothing leaves the device; these strings exist purely to exercise the UI
 * and are never shown to the parent ("signals, not content").
 */
export const incidents: Incident[] = [
  {
    id: "inc-001",
    deviceId: "device-family-ipad",
    sourcePackage: PLATFORM_PACKAGE.TikTok,
    category: "Graphic Content",
    severity: "high",
    confidence: 0.94,
    ts: "2026-04-29T19:42:00+01:00",
    flaggedText: "graphic injury clip surfaced in For You feed",
    classifierVersion: CLF,
  },
  {
    id: "inc-002",
    deviceId: "device-family-ipad",
    sourcePackage: PLATFORM_PACKAGE.TikTok,
    category: "Self-Harm",
    severity: "high",
    confidence: 0.9,
    ts: "2026-05-02T11:18:00+01:00",
    flaggedText: "self-harm themed audio trend",
    classifierVersion: CLF,
  },
  {
    id: "inc-003",
    deviceId: "device-tobi-phone",
    sourcePackage: PLATFORM_PACKAGE.WhatsApp,
    category: "Hate Speech",
    severity: "review",
    confidence: 0.71,
    ts: "2026-05-01T15:05:00+01:00",
    flaggedText: "slur forwarded in class group chat",
    classifierVersion: CLF,
  },
  {
    id: "inc-004",
    deviceId: "device-tobi-phone",
    sourcePackage: PLATFORM_PACKAGE.Instagram,
    category: "Violence",
    severity: "review",
    confidence: 0.68,
    ts: "2026-04-30T20:11:00+01:00",
    flaggedText: "fight reel reshared to story",
    classifierVersion: CLF,
  },
  {
    id: "inc-005",
    deviceId: "device-family-ipad",
    sourcePackage: PLATFORM_PACKAGE.Chrome,
    category: "Sexual Content",
    severity: "high",
    confidence: 0.88,
    ts: "2026-05-03T21:30:00+01:00",
    flaggedText: "adult site reached via redirect ad",
    classifierVersion: CLF,
  },
  {
    id: "inc-006",
    deviceId: "device-tobi-phone",
    sourcePackage: PLATFORM_PACKAGE.TikTok,
    category: "Substance Use",
    severity: "low",
    confidence: 0.55,
    ts: "2026-04-28T17:22:00+01:00",
    flaggedText: "vaping promo creator",
    classifierVersion: CLF,
  },
  {
    id: "inc-007",
    deviceId: "device-amara-chromebook",
    sourcePackage: PLATFORM_PACKAGE.Roblox,
    category: "Gambling",
    severity: "low",
    confidence: 0.49,
    ts: "2026-05-01T16:40:00+01:00",
    flaggedText: "loot-box style mini-game",
    classifierVersion: CLF,
  },
  {
    id: "inc-008",
    deviceId: "device-amara-chromebook",
    sourcePackage: PLATFORM_PACKAGE.Instagram,
    category: "Eating Disorders",
    severity: "review",
    confidence: 0.63,
    ts: "2026-05-02T13:12:00+01:00",
    flaggedText: "restrictive-diet 'thinspo' post",
    classifierVersion: CLF,
  },
];
