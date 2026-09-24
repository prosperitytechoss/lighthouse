package fund.fastforward.lighthouse.child

import android.content.Context
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import org.json.JSONArray
import org.json.JSONObject

/**
 * POSTs signals to the API, matching the JS reporter's exact request shape:
 *   POST {baseUrl}/signals   Authorization: Bearer <deviceToken>
 *   { "source": "real", "signals": [ { category, severity, app, occurredAt } ] }
 * Only {category, severity, app, time} is sent — never the captured text.
 */
object SignalUploader {
  data class Signal(val category: String, val severity: String, val app: String, val occurredAt: String, val channel: String = "text", val meta: JSONObject? = null)

  private val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
  }

  fun nowIso(): String = iso.format(Date())

  /**
   * POST {baseUrl}/devices/heartbeat — idle keep-alive so a quiet device stays
   * "fresh", carrying the live capture-permission state so the server can detect
   * tamper (alive but monitoring disabled).
   */
  fun heartbeat(ctx: Context, baseUrl: String, token: String, perm: PermissionState): Boolean {
    var conn: HttpURLConnection? = null
    return try {
      val url = URL(baseUrl.trimEnd('/') + "/devices/heartbeat")
      conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 10_000
        readTimeout = 15_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
      }
      val obj = JSONObject()
        .put("accessibilityEnabled", perm.accessibilityEnabled)
        .put("notificationAccessEnabled", perm.notificationAccessEnabled)
        .put("batteryOptimizationExempt", perm.batteryOptimizationExempt)
      val vs = VisionEngine.status()
      obj.put("visionSupported", vs.supported)
      if (vs.running) {
        obj.put("visionTier", vs.tier)
        obj.put("visionIntervalMs", vs.intervalMs)
        obj.put("visionFrames", vs.framesChecked)
        if (vs.lastFrameAt > 0) obj.put("visionLastFrameAt", iso.format(Date(vs.lastFrameAt)))
      }
      obj.put(
        "engine",
        JSONObject()
          .put("engine", LighthouseClassifier.ENGINE)
          .put("lexiconVersion", LighthouseClassifier.version())
          .put("textModel", TextModel.NAME)
          .put("textModelReady", TextModel.isReady())
          .put("ocr", "mlkit-text-v2")
          .put("ocrReady", vs.ocrReady)
          .put("imageModel", NsfwClassifier.NAME)
          .put("imageReady", vs.imageReady)
          .put("visionEnabled", vs.enabled)
          .put("framesChecked", vs.framesChecked)
          .put("framesSkipped", vs.framesSkipped)
          .put("textHits", vs.textHits)
          .put("imageHits", vs.imageHits)
          .put("lastOcrMs", vs.lastOcrMs)
          .put("lastImageMs", vs.lastImageMs)
          .put("lastTotalMs", vs.lastTotalMs),
      )
      if (perm.batteryLevel in 0..100) {
        obj.put("batteryLevel", perm.batteryLevel)
        obj.put("batteryCharging", perm.batteryCharging)
      }
      OutputStreamWriter(conn.outputStream).use { it.write(obj.toString()) }
      val ok = conn.responseCode in 200..299
      // Apply the parent's live settings carried in the response — this is how
      // monitored-apps / overlay / threshold changes reach the child while it's
      // backgrounded (the JS /devices/me poll is paused then).
      if (ok) applySettings(ctx, conn.inputStream.bufferedReader().use { it.readText() })
      ok
    } catch (e: Exception) {
      false
    } finally {
      conn?.disconnect()
    }
  }

  /** Apply + persist the settings from a heartbeat response (best-effort). */
  private fun applySettings(ctx: Context, resp: String) {
    try {
      val json = JSONObject(resp)
      if (json.has("monitoredApps")) {
        val arr = json.getJSONArray("monitoredApps")
        val set = HashSet<String>()
        for (i in 0 until arr.length()) set.add(arr.getString(i))
        LighthouseRegistry.setEnabledIds(set)
        BackgroundConfig.saveMonitoredApps(ctx, set)
      }
      if (json.has("overlayEnabled")) {
        val b = json.getBoolean("overlayEnabled")
        OverlayManager.setEnabled(b)
        BackgroundConfig.saveBlockingEnabled(ctx, b)
      }
      if (json.has("visionEnabled")) {
        val v = json.getBoolean("visionEnabled")
        BackgroundConfig.saveVisionEnabled(ctx, v)
        VisionEngine.setEnabled(v)
      }
      if (json.has("alertThreshold")) {
        val t = json.getString("alertThreshold")
        OverlayManager.setThreshold(t)
        BackgroundConfig.saveBlockThreshold(ctx, t)
      }
    } catch (_: Exception) {
      // malformed/older server response → ignore, keep current settings
    }
  }

  /**
   * Lexicon sync (mirror of lexiconSync.ts). Cheap version check first; only
   * downloads the full lexicon when the server's published version is newer, then
   * caches it on-device and activates it. Never throws — on any failure the
   * classifier keeps its cached/bundled lexicon.
   */
  fun syncLexicon(ctx: Context, baseUrl: String, token: String): Boolean {
    return try {
      val local = LighthouseClassifier.version()
      val vBody = getJson(baseUrl, "/lexicon/version", token) ?: return false
      val serverVersion = JSONObject(vBody).optInt("version", -1)
      if (serverVersion <= local) return true // already current
      val body = getJson(baseUrl, "/lexicon", token) ?: return false
      val obj = JSONObject(body)
      if (!obj.has("version") || !obj.has("categories")) return false // shape guard
      LighthouseClassifier.saveAndActivate(ctx, body)
      true
    } catch (e: Exception) {
      false
    }
  }

  /** GET {baseUrl}{path} with the device bearer; returns the body or null on any error. */
  private fun getJson(baseUrl: String, path: String, token: String): String? {
    var conn: HttpURLConnection? = null
    return try {
      conn = (URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 10_000
        readTimeout = 15_000
        setRequestProperty("Authorization", "Bearer $token")
      }
      if (conn.responseCode in 200..299) conn.inputStream.bufferedReader().use { it.readText() } else null
    } catch (e: Exception) {
      null
    } finally {
      conn?.disconnect()
    }
  }

  /** Returns true on a 2xx response; false on any error (caller keeps + retries). */
  fun upload(baseUrl: String, token: String, signals: List<Signal>): Boolean {
    if (signals.isEmpty()) return true
    var conn: HttpURLConnection? = null
    return try {
      val url = URL(baseUrl.trimEnd('/') + "/signals")
      conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 10_000
        readTimeout = 15_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
      }
      val arr = JSONArray()
      for (s in signals) {
        arr.put(
          JSONObject()
            .put("category", s.category)
            .put("severity", s.severity)
            .put("app", s.app)
            .put("occurredAt", s.occurredAt)
            .put("channel", s.channel)
            .put("meta", s.meta ?: JSONObject()),
        )
      }
      val body = JSONObject().put("source", "real").put("signals", arr).toString()
      OutputStreamWriter(conn.outputStream).use { it.write(body) }
      conn.responseCode in 200..299
    } catch (e: Exception) {
      false
    } finally {
      conn?.disconnect()
    }
  }
}
