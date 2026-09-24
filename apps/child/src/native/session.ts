import * as SecureStore from "expo-secure-store";

// The child's device token (issued by /pairing/claim) lives in hardware-backed
// secure storage. Its presence is what marks this device as "linked".
const KEY = "lighthouse.child.deviceToken";
// "Setup wizard finished" flag. Granting accessibility / notification-listener /
// overlay makes Android restart the app mid-wizard, so we persist progress: a
// paired-but-unfinished device resumes into Setup instead of being lost.
const SETUP_KEY = "lighthouse.child.setupDone";

const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

export async function getDeviceToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function setDeviceToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token, OPTS);
}

export async function clearDeviceToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
  await SecureStore.deleteItemAsync(SETUP_KEY);
}

export async function getSetupDone(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SETUP_KEY)) === "1";
}

export async function setSetupDone(): Promise<void> {
  await SecureStore.setItemAsync(SETUP_KEY, "1", OPTS);
}

// A stable per-install identifier. It is deliberately NOT cleared on unlink, so
// re-pairing the same physical device updates its existing record on the server
// instead of creating a duplicate. Generated once, then persisted.
const INSTALL_KEY = "lighthouse.child.installId";

function makeUuid(): string {
  // RFC4122-ish v4. Not cryptographic, but plenty unique as an install id.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getInstallId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(INSTALL_KEY);
  if (existing) return existing;
  const id = makeUuid();
  await SecureStore.setItemAsync(INSTALL_KEY, id, OPTS);
  return id;
}
