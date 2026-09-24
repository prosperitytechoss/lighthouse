import type { PersonTag } from "@lighthouse/types";

export const tobi: PersonTag = { id: "person-tobi", name: "Tobi", age: 13 };
export const amara: PersonTag = { id: "person-amara", name: "Amara", age: 10 };
export const shared: PersonTag = { id: "person-shared", name: "Shared", isShared: true };

export const people: PersonTag[] = [tobi, amara];
