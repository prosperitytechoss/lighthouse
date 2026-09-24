package fund.fastforward.lighthouse.child

import android.content.Context
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Keep-alive worker — the Doze-aware half of keep-alive.
 *
 * WorkManager periodic work runs during Doze maintenance windows, so this fires
 * even when the device is idle overnight (unlike an in-service timer, which Doze
 * suspends). Each run does two things:
 *   1. Watchdog — (re)start LighthouseMonitorService if it was killed.
 *   2. Heartbeat — POST /devices/heartbeat so a quiet-but-alive device keeps its
 *      last_seen_at fresh and never trips the server's silence alert.
 *
 * ~15-min periodic floor: this is the slow BACKSTOP. The foreground service + boot
 * receiver are the fast paths. The battery-optimization whitelist (requested by the
 * permission wizard) is what removes Doze deferral entirely on a given device.
 */
class KeepAliveWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
  override fun doWork(): Result {
    val ctx = applicationContext
    val token = BackgroundConfig.token(ctx)
    val baseUrl = BackgroundConfig.baseUrl(ctx)
    if (token == null || baseUrl == null) return Result.success() // not paired — nothing to do

    // 1. Watchdog: ensure the monitor service is up (no-op if already running).
    LighthouseMonitorService.start(ctx)
    // 2. Heartbeat (Doze-safe — runs in the maintenance window), with permission state.
    val ok = SignalUploader.heartbeat(ctx, baseUrl, token, PermissionReader.read(ctx))
    if (BuildConfig.DEBUG) Log.d("LH-service", "keepalive worker: heartbeat=$ok")
    return Result.success()
  }

  companion object {
    private const val NAME = "lh-keepalive"

    fun schedule(ctx: Context) {
      val req = PeriodicWorkRequestBuilder<KeepAliveWorker>(15, TimeUnit.MINUTES).build()
      WorkManager.getInstance(ctx)
        .enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP, req)
    }

    fun cancel(ctx: Context) {
      WorkManager.getInstance(ctx).cancelUniqueWork(NAME)
    }
  }
}
