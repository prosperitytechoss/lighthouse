import { type SignalInput, type SignalSource, signalsApi } from "../api/client";

import { getDeviceToken } from "./session";

/**
 * Signal reporter — the single producer seam.
 *
 * Captured/synthesized signals are enqueued in memory and flushed to the API in
 * batches. On a network failure the batch stays queued and is retried (on the
 * next enqueue or the periodic timer), so transient offline windows don't drop
 * signals.
 *
 * Each item carries its `source` ('synthetic' from the DEV producer, 'real' from
 * the Stage B engine). Flush groups by source so each POST is homogeneous. In
 * Stage B the real engine calls enqueueSignals(..., 'real'); nothing else changes.
 */

const MAX_BATCH = 100;
const RETRY_MS = 15_000;

type QueuedSignal = SignalInput & { source: SignalSource };

let queue: QueuedSignal[] = [];
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, RETRY_MS);
}

const strip = ({ source: _source, ...signal }: QueuedSignal): SignalInput => signal;

/** Attempt to send everything queued. Keeps items on failure for a later retry. */
export async function flush(): Promise<void> {
  if (flushing || queue.length === 0) return;
  const token = await getDeviceToken();
  if (!token) return; // not paired — nothing to report against

  flushing = true;
  try {
    while (queue.length > 0) {
      // Take a homogeneous (same-source) batch from the front, preserving order.
      const source = queue[0]!.source;
      const batch: QueuedSignal[] = [];
      for (const item of queue) {
        if (batch.length >= MAX_BATCH || item.source !== source) break;
        batch.push(item);
      }
      const res = await signalsApi.report(token, batch.map(strip), source);
      if (__DEV__) {
        console.log(
          res.ok
            ? `[LH reporter] POST /signals (${source} x${batch.length}) <- ${res.status} ok, count=${res.data.count}`
            : `[LH reporter] POST /signals (${source} x${batch.length}) <- ${res.status} ${res.error}`,
        );
      }
      if (!res.ok) {
        scheduleRetry();
        break;
      }
      queue = queue.slice(batch.length);
    }
  } finally {
    flushing = false;
  }
}

/** Enqueue signals (tagged with their source) and kick a flush. */
export function enqueueSignals(signals: SignalInput[], source: SignalSource = "synthetic"): void {
  if (signals.length === 0) return;
  queue.push(...signals.map((s) => ({ ...s, source })));
  void flush();
}
