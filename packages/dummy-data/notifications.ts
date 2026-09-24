import type { NotificationCard } from "@lighthouse/types";

export const notifications: NotificationCard[] = [
  {
    id: "notif-request-1",
    type: "request",
    body: "Tobi is asking for +15 min on Family iPad",
    deviceId: "device-family-ipad",
    actions: [
      { label: "Deny", variant: "ghost" },
      { label: "Approve", variant: "primary" },
    ],
  },
  {
    id: "notif-warning-1",
    type: "warning",
    body: "No signals from Tobi's phone in 38 hours — Lighthouse may have been disabled.",
    deviceId: "device-tobi-phone",
  },
  {
    id: "notif-toast-1",
    type: "toast",
    body: "Family iPad paired — used by Tobi & Amara · just now",
    deviceId: "device-family-ipad",
  },
];
