import type { Geofence } from "@lighthouse/types";

/** Realistic Lagos coordinates. */
export const geofences: Geofence[] = [
  {
    id: "geo-home",
    name: "Home",
    lat: 6.5244,
    lng: 3.3792,
    radiusM: 150,
    alertOnArrive: true,
    alertOnLeave: true,
  },
  {
    id: "geo-school",
    name: "School",
    lat: 6.4531,
    lng: 3.3958,
    radiusM: 200,
    alertOnArrive: true,
    alertOnLeave: true,
  },
  {
    id: "geo-church",
    name: "Church",
    lat: 6.6018,
    lng: 3.3515,
    radiusM: 150,
    alertOnArrive: false,
    alertOnLeave: false,
  },
];
