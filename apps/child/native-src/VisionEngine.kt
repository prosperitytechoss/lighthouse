package fund.fastforward.lighthouse.child

import android.accessibilityservice.AccessibilityService
import android.app.KeyguardManager
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.view.Display
import java.lang.ref.WeakReference
import java.util.concurrent.Executor

object VisionEngine {
  data class Status(
    val supported: Boolean,
    val running: Boolean,
    val enabled: Boolean,
    val tier: String,
    val intervalMs: Long,
    val ocrReady: Boolean,
    val imageReady: Boolean,
    val framesChecked: Long,
    val framesSkipped: Long,
    val textHits: Long,
    val imageHits: Long,
    val lastFrameAt: Long,
    val lastOcrMs: Long,
    val lastImageMs: Long,
    val lastTotalMs: Long,
  )

  private const val DEDUPE_MS = 2 * 60 * 1000L
  private const val IDLE_MS = 5_000L
  private const val LOW_BATTERY = 15
  private const val FLAT_VARIANCE = 40L

  private var serviceRef: WeakReference<ContentAccessibilityService>? = null
  private var thread: HandlerThread? = null
  private var handler: Handler? = null
  @Volatile private var running = false
  @Volatile private var currentPkg = ""
  @Volatile private var baseTier = DeviceTier.SLOW
  @Volatile private var tier = DeviceTier.SLOW
  private var emaMs = 0.0
  private var lastThumbHash = 0L
  private var flatFrame = false
  private val recent = HashMap<String, Long>()

  @Volatile private var framesChecked = 0L
  @Volatile private var framesSkipped = 0L
  @Volatile private var textHits = 0L
  @Volatile private var imageHits = 0L
  @Volatile private var lastFrameAt = 0L
  @Volatile private var lastOcrMs = 0L
  @Volatile private var lastImageMs = 0L
  @Volatile private var lastTotalMs = 0L
  @Volatile private var enabledFlag = true

  val supported: Boolean get() = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R

  private val tick = Runnable { runTick() }

  @Synchronized
  fun start(service: ContentAccessibilityService) {
    if (!supported || running) return
    val ctx = service.applicationContext
    serviceRef = WeakReference(service)
    baseTier = DeviceTier.detect(ctx)
    tier = baseTier
    enabledFlag = BackgroundConfig.visionEnabled(ctx)
    val t = HandlerThread("lh-vision").also { it.start() }
    val h = Handler(t.looper)
    thread = t
    handler = h
    running = true
    h.post {
      OcrEngine.init()
      NsfwClassifier.init(ctx)
      if (BuildConfig.DEBUG) Log.d("LH-vision", "start tier=${tier.label} ocr=${OcrEngine.isReady()} image=${NsfwClassifier.isReady()}")
      schedule(tier.intervalMs)
    }
  }

  @Synchronized
  fun stop() {
    running = false
    handler?.removeCallbacksAndMessages(null)
    thread?.quitSafely()
    thread = null
    handler = null
    serviceRef = null
    OcrEngine.close()
    NsfwClassifier.close()
  }

  fun onForegroundApp(pkg: String) {
    currentPkg = pkg
  }

  fun setEnabled(enabled: Boolean) {
    enabledFlag = enabled
  }

  fun status(): Status = Status(
    supported, running, enabledFlag, tier.label, tier.intervalMs, OcrEngine.isReady(), NsfwClassifier.isReady(),
    framesChecked, framesSkipped, textHits, imageHits, lastFrameAt, lastOcrMs, lastImageMs, lastTotalMs,
  )

  private fun schedule(ms: Long) {
    if (!running) return
    handler?.removeCallbacks(tick)
    handler?.postDelayed(tick, debugInterval() ?: ms)
  }

  private fun debugInterval(): Long? {
    if (!BuildConfig.DEBUG) return null
    return try {
      val p = Runtime.getRuntime().exec(arrayOf("getprop", "debug.lh.vision_ms"))
      p.inputStream.bufferedReader().readText().trim().toLongOrNull()?.takeIf { it >= 2000 }
    } catch (_: Throwable) {
      null
    }
  }

  private fun runTick() {
    if (!running) return
    val service = serviceRef?.get() ?: return
    val ctx = service.applicationContext
    val app = LighthouseRegistry.idForPackage(currentPkg)
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    val km = ctx.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    val hot = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && pm.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE
    if (!enabledFlag || app == null || !pm.isInteractive || km.isKeyguardLocked || hot || OverlayManager.isShown()) {
      schedule(IDLE_MS)
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    val started = SystemClock.elapsedRealtime()
    val executor = Executor { r -> handler?.post(r) ?: r.run() }
    try {
      service.takeScreenshot(
        Display.DEFAULT_DISPLAY,
        executor,
        object : AccessibilityService.TakeScreenshotCallback {
          override fun onSuccess(result: AccessibilityService.ScreenshotResult) {
            var frame: Bitmap? = null
            try {
              val hb = result.hardwareBuffer
              val hw = Bitmap.wrapHardwareBuffer(hb, result.colorSpace)
              hb.close()
              frame = hw?.copy(Bitmap.Config.ARGB_8888, false)
              hw?.recycle()
              val f = frame
              if (f != null) process(f, app, started)
            } catch (e: Throwable) {
              if (BuildConfig.DEBUG) Log.d("LH-vision", "frame error: ${e.message}")
            } finally {
              frame?.recycle()
              schedule(nextInterval(ctx))
            }
          }

          override fun onFailure(errorCode: Int) {
            if (BuildConfig.DEBUG) Log.d("LH-vision", "screenshot failed: $errorCode")
            schedule(tier.intervalMs)
          }
        },
      )
    } catch (e: Throwable) {
      schedule(tier.intervalMs)
    }
  }

  private fun process(frame: Bitmap, app: String, started: Long) {
    val hash = thumbHash(frame)
    if (hash == lastThumbHash && !flatFrame) {
      framesSkipped++
      return
    }
    lastThumbHash = hash
    framesChecked++
    lastFrameAt = System.currentTimeMillis()

    val t0 = SystemClock.elapsedRealtime()
    val ocrBmp = scaleToWidth(frame, tier.ocrWidth)
    val text = OcrEngine.recognize(ocrBmp)
    if (ocrBmp !== frame) ocrBmp.recycle()
    lastOcrMs = SystemClock.elapsedRealtime() - t0
    if (text.isNotBlank()) {
      if (BuildConfig.DEBUG) Log.d("LH-vision", "ocr ${text.length} chars in ${lastOcrMs}ms: ${LogScrub.scrub(text.take(160))}")
      LighthouseClassifier.classify(text)?.let {
        val meta = LighthouseClassifier.baseMeta(it)
          .put("ocr", "mlkit-text-v2")
          .put("ocrMs", lastOcrMs)
          .put("chars", text.length)
          .put("frameTier", tier.label)
          .put("intervalMs", tier.intervalMs)
        emit(app, it, "ocr", meta)
      }
    }

    val t1 = SystemClock.elapsedRealtime()
    val img = if (flatFrame) null else NsfwClassifier.classify(frame, tier.imageCrops)
    lastImageMs = SystemClock.elapsedRealtime() - t1
    if (img != null) {
      if (BuildConfig.DEBUG) Log.d("LH-vision", "image porn=%.2f hentai=%.2f sexy=%.2f neutral=%.2f in %dms".format(img.porn, img.hentai, img.sexy, img.neutral, lastImageMs))
      NsfwClassifier.toClassification(img)?.let {
        val meta = org.json.JSONObject()
          .put("engine", LighthouseClassifier.ENGINE)
          .put("decidedBy", "image")
          .put("model", NsfwClassifier.NAME)
          .put("porn", r3(img.porn)).put("hentai", r3(img.hentai)).put("sexy", r3(img.sexy)).put("neutral", r3(img.neutral))
          .put("imageMs", lastImageMs)
          .put("crops", tier.imageCrops)
          .put("frameTier", tier.label)
          .put("intervalMs", tier.intervalMs)
        emit(app, it, "image", meta)
      }
    }

    lastTotalMs = SystemClock.elapsedRealtime() - started
    emaMs = if (emaMs == 0.0) lastTotalMs.toDouble() else emaMs * 0.7 + lastTotalMs * 0.3
  }

  private fun r3(v: Float): Double = Math.round(v * 1000) / 1000.0

  private fun emit(app: String, cls: Classification, channel: String, meta: org.json.JSONObject) {
    val key = "$app|${cls.category}|$channel"
    val now = System.currentTimeMillis()
    val last = recent[key]
    if (last == null || now - last > DEDUPE_MS) {
      recent[key] = now
      meta.put("paused", OverlayManager.isEnabled() && LighthouseClassifier.shouldBlock(cls, OverlayManager.threshold()))
      SignalBuffer.add(SignalUploader.Signal(cls.category, cls.severity, app, SignalUploader.nowIso(), channel, meta))
      if (channel == "ocr") textHits++ else imageHits++
      if (BuildConfig.DEBUG) Log.d("LH-vision", "$channel hit ${cls.category}/${cls.severity} in $app")
    }
    if (OverlayManager.isEnabled() && LighthouseClassifier.shouldBlock(cls, OverlayManager.threshold())) {
      serviceRef?.get()?.block(currentPkg)
    }
  }

  private fun nextInterval(ctx: Context): Long {
    val ratio = if (tier.intervalMs > 0) emaMs / tier.intervalMs else 0.0
    if (ratio > 0.35 && tier != DeviceTier.SLOW) tier = tier.slower()
    else if (ratio < 0.08 && tier.ordinal > baseTier.ordinal) tier = tier.faster()
    val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    if (level in 0..LOW_BATTERY && !bm.isCharging) return DeviceTier.SLOW.intervalMs
    return tier.intervalMs
  }

  private fun scaleToWidth(frame: Bitmap, width: Int): Bitmap {
    if (frame.width <= width) return frame
    val h = (frame.height.toLong() * width / frame.width).toInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(frame, width, h, true)
  }

  private fun thumbHash(frame: Bitmap): Long {
    val n = 8
    val gray = IntArray(n * n)
    val sx = frame.width / n
    val sy = frame.height / n
    var sum = 0L
    for (y in 0 until n) for (x in 0 until n) {
      val p = frame.getPixel(x * sx + sx / 2, y * sy + sy / 2)
      val g = (Color.red(p) * 299 + Color.green(p) * 587 + Color.blue(p) * 114) / 1000
      gray[y * n + x] = g
      sum += g
    }
    val avg = sum / (n * n)
    var bits = 0L
    var varSum = 0L
    for (i in gray.indices) {
      if (gray[i] > avg) bits = bits or (1L shl i)
      val d = gray[i] - avg
      varSum += d * d
    }
    flatFrame = varSum / (n * n) < FLAT_VARIANCE
    return bits
  }
}
