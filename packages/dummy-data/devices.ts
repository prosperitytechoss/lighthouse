import type { Device } from "@lighthouse/types";

import { amara, tobi } from "./people";

export const devices: Device[] = [
  {
    id: "device-family-ipad",
    name: "Family iPad",
    model: "Apple iPad Air",
    batteryPct: 64,
    usedBy: [tobi, amara],
    lastSeenAt: "2026-05-04T18:58:00+01:00",
    signalsThisWeek: 18,
    status: "active",
  },
  {
    id: "device-tobi-phone",
    name: "Tobi's phone",
    model: "Samsung Galaxy A55",
    batteryPct: 78,
    usedBy: [tobi],
    lastSeenAt: "2026-05-04T18:38:00+01:00",
    signalsThisWeek: 12,
    status: "active",
  },
  {
    id: "device-amara-chromebook",
    name: "Amara's Chromebook",
    model: "Lenovo IdeaPad",
    batteryPct: 18,
    usedBy: [amara],
    lastSeenAt: "2026-05-04T18:00:00+01:00",
    signalsThisWeek: 4,
    status: "active",
  },
];
