package fund.fastforward.lighthouse.child

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log

/**
 * Foreground service that owns the whole background loop:
 *   drain CaptureBuffer -> classify (native) -> POST /signals.
 *
 * This is the fix for the JS-timer-pause problem: it runs continuously while the
 * child app is backgrounded or swiped away. The notification/accessibility
 * capture services keep filling CaptureBuffer; this drains + classifies + uploads
 * regardless of whether any JS is alive. Config (token + base URL) comes from
 * BackgroundConfig (encrypted prefs, pushed by JS once when paired).
 *
 * Battery: backs off when the buffer is empty / screen is off — no tight 24/7 loop.
 */
class LighthouseMonitorService : Service() {
  @Volatile private var running = false
  private var worker: Thread? = null
  private val pending = ArrayList<SignalUploader.Signal>()
  private var lastHeartbeat = 0L

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    try {
      startForeground(NOTIF_ID, buildNotification())
    } catch (_: Throwable) {
      stopSelf()
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!running) {
      running = true
      worker = Thread {
        warm()
        loop()
      }.also { it.start() }
    }
    return START_STICKY
  }

  private fun warm() {
    val ctx = applicationContext
    try {
      LighthouseRegistry.setEnabledIds(BackgroundConfig.monitoredApps(ctx))
      OverlayManager.setEnabled(BackgroundConfig.blockingEnabled(ctx))
      OverlayManager.setThreshold(BackgroundConfig.blockThreshold(ctx))
      LighthouseClassifier.init(ctx)
    } catch (_: Throwable) {
    }
  }

  private fun loop() {
    val ctx = applicationContext
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    while (running) {
      try {
        val token = BackgroundConfig.token(ctx)
        val baseUrl = BackgroundConfig.baseUrl(ctx)
        if (token != null && baseUrl != null) {
          // 1. drain native capture buffer → classify on-device
          for (item in CaptureBuffer.drain()) {
            val app = LighthouseRegistry.idForPackage(item.pkg) ?: continue
            val cls = LighthouseClassifier.classify(item.text) ?: continue
            val meta = LighthouseClassifier.baseMeta(cls)
              .put("chars", item.text.length)
              .put("paused", OverlayManager.isEnabled() && LighthouseClassifier.shouldBlock(cls, OverlayManager.threshold()))
            pending.add(SignalUploader.Signal(cls.category, cls.severity, app, SignalUploader.nowIso(), item.channel, meta))
            if (BuildConfig.DEBUG) Log.d("LH-service", "classified ${cls.category}/${cls.severity} from $app via ${item.channel}")
          }
          pending.addAll(SignalBuffer.drain())
          // 2. upload a batch; keep items on failure for the next pass (retry)
          if (pending.isNotEmpty()) {
            val batch = ArrayList(pending.take(MAX_BATCH))
            val ok = SignalUploader.upload(baseUrl, token, batch)
            if (BuildConfig.DEBUG) Log.d("LH-service", "upload ${batch.size} -> $ok")
            if (ok) repeat(batch.size) { if (pending.isNotEmpty()) pending.removeAt(0) }
          }
          // 3. opportunistic heartbeat during active use (instant freshness when
          //    the screen's on; WorkManager covers idle/Doze). A signal upload also
          //    bumps last_seen, so only ping if we haven't recently.
          val now = System.currentTimeMillis()
          if (now - lastHeartbeat > HEARTBEAT_MS) {
            if (SignalUploader.heartbeat(ctx, baseUrl, token, PermissionReader.read(ctx))) lastHeartbeat = now
            // Same cadence: pull a newer published lexicon if one exists (cheap
            // version check first). Classifier keeps its cached copy on failure.
            SignalUploader.syncLexicon(ctx, baseUrl, token)
          }
        }
      } catch (e: Exception) {
        if (BuildConfig.DEBUG) Log.d("LH-service", "loop error: ${e.message}")
      }
      val sleepMs = when {
        pending.isNotEmpty() -> ACTIVE_MS
        !pm.isInteractive -> IDLE_SCREEN_OFF_MS
        else -> IDLE_MS
      }
      try {
        Thread.sleep(sleepMs)
      } catch (e: InterruptedException) {
        break
      }
    }
  }

  override fun onDestroy() {
    running = false
    worker?.interrupt()
    super.onDestroy()
  }

  private fun buildNotification(): Notification {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL, "Lighthouse protection", NotificationManager.IMPORTANCE_LOW)
      channel.setShowBadge(false)
      nm.createNotificationChannel(channel)
    }
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(this, CHANNEL)
      } else {
        @Suppress("DEPRECATION") Notification.Builder(this)
      }
    return builder
      .setContentTitle("Lighthouse is protecting this device")
      .setContentText("Watching for unsafe content. Nothing you do is recorded.")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .build()
  }

  companion object {
    private const val NOTIF_ID = 4711
    private const val CHANNEL = "lighthouse_protection"
    private const val MAX_BATCH = 100
    private const val ACTIVE_MS = 3_000L
    private const val IDLE_MS = 10_000L
    private const val IDLE_SCREEN_OFF_MS = 30_000L
    // Doubles as the background settings-sync cadence (heartbeat carries the
    // parent's monitored-apps / overlay / threshold). 2 min while actively
    // running so parent changes apply without opening the child app.
    private const val HEARTBEAT_MS = 2 * 60 * 1000L

    fun start(ctx: Context) {
      val intent = Intent(ctx, LighthouseMonitorService::class.java)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ctx.startForegroundService(intent)
        } else {
          ctx.startService(intent)
        }
      } catch (_: Throwable) {
        return
      }
      // Schedule the Doze-aware backstop (heartbeat + watchdog).
      KeepAliveWorker.schedule(ctx)
    }

    fun stop(ctx: Context) {
      ctx.stopService(Intent(ctx, LighthouseMonitorService::class.java))
    }
  }
}
