package fund.fastforward.lighthouse.child

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Permission-wizard bridge. Opens the exact system settings page for each grant
 * and reports whether it's currently enabled. No data collection lives here —
 * the two services it checks for are stubs (Phase 5/7).
 */
class LighthousePermissionsModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = "LighthouseNative"

  private val pkg: String
    get() = ctx.packageName

  @ReactMethod
  fun isGranted(kind: String, promise: Promise) {
    try {
      promise.resolve(check(kind))
    } catch (e: Exception) {
      promise.reject("LH_PERM_ERR", e)
    }
  }

  private fun check(kind: String): Boolean = when (kind) {
    "notificationListener" ->
      NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(pkg)

    "accessibility" -> {
      val flat = Settings.Secure.getString(
        ctx.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      ) ?: ""
      flat.split(':').any { it.contains(pkg) && it.contains("ContentAccessibilityService") }
    }

    "usageAccess" -> {
      val ops = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), pkg)
      } else {
        @Suppress("DEPRECATION")
        ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), pkg)
      }
      mode == AppOpsManager.MODE_ALLOWED
    }

    "overlay" -> Settings.canDrawOverlays(ctx)

    "battery" ->
      (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(pkg)

    // TODO(Phase 8 — real location): the wizard currently passes on FINE
    // location alone (see permissions.ts hasFineLocation + Setup.tsx verify).
    // When geofencing goes live, gate the location step on THIS check too so
    // "Allow all the time" (background) is required, not just while-in-use.
    "backgroundLocation" ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ctx.checkSelfPermission(android.Manifest.permission.ACCESS_BACKGROUND_LOCATION) ==
          PackageManager.PERMISSION_GRANTED
      } else {
        true
      }

    else -> false
  }

  @ReactMethod
  fun openSettings(kind: String, promise: Promise) {
    val specific = ArrayList<Intent>()
    when (kind) {
      "notificationListener" -> {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          val listener = ComponentName(pkg, "$pkg.NotificationCaptureService").flattenToString()
          specific += Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
            .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, listener)
        }
        specific += Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        specific += Intent("android.settings.NOTIFICATION_LISTENER_SETTINGS")
      }
      "accessibility" -> {
        val service = ComponentName(pkg, "$pkg.ContentAccessibilityService").flattenToString()
        val args = Bundle().apply { putString(":settings:fragment_args_key", service) }
        specific += Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
          .putExtra(":settings:fragment_args_key", service)
          .putExtra(":settings:show_fragment_args", args)
        specific += Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
      }
      "usageAccess" -> {
        specific += Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:$pkg"))
        specific += Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      }
      "overlay" -> {
        specific += Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$pkg"))
        specific += Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
      }
      "battery" -> {
        specific += Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$pkg"))
        specific += Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      }
      "settings" -> specific += Intent(Settings.ACTION_SETTINGS)
      else -> specific += Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
    }
    val generic = listOf(
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")),
      Intent(Settings.ACTION_SETTINGS),
    )
    for (intent in specific) if (launch(intent)) return promise.resolve(true)
    for (intent in generic) if (launch(intent)) return promise.resolve(false)
    promise.resolve(false)
  }

  private fun launch(intent: Intent): Boolean =
    try {
      ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    } catch (_: Exception) {
      false
    }

  /** Build.MANUFACTURER / BRAND / MODEL, so JS can choose OEM-specific copy. */
  @ReactMethod
  fun deviceInfo(promise: Promise) {
    val map = Arguments.createMap()
    map.putString("manufacturer", Build.MANUFACTURER ?: "")
    map.putString("brand", Build.BRAND ?: "")
    map.putString("model", Build.MODEL ?: "")
    promise.resolve(map)
  }

  /**
   * Open the OEM autostart / auto-launch manager so the parent can whitelist the
   * app from being background-killed. Tries the curated per-OEM component list
   * (ported from judemanutd/AutoStarter) and only launches one that actually
   * resolves on this device. Resolves true if a manager opened, false otherwise
   * (JS then falls back to Settings search / DontKillMyApp steps).
   */
  @ReactMethod
  fun openAutostart(promise: Promise) {
    val keys = listOf(Build.MANUFACTURER.lowercase(), Build.BRAND.lowercase())
    val candidates = keys.flatMap { AUTOSTART_INTENTS[it] ?: emptyList() }
    for ((p, c) in candidates) {
      try {
        val intent = Intent()
          .setComponent(ComponentName(p, c))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        // Launch directly rather than gating on resolveActivity(): on Android 11+
        // package-visibility hides these components from resolve, but an explicit
        // startActivity still works (and throws synchronously if truly absent).
        ctx.startActivity(intent)
        promise.resolve(true)
        return
      } catch (_: Exception) {
        // ActivityNotFound / Security — try the next candidate.
      }
    }
    promise.resolve(false)
  }

  // ── Stage B background loop (Track 1) ───────────────────────────────────────
  // The foreground service owns capture→classify→send natively. JS only pushes
  // the config it can't read (device token + API base URL) and starts/stops the
  // service. Capture filtering + classification are fully native.

  /** Persist the background loop's config (encrypted). Pushed by JS when paired. */
  @ReactMethod
  fun setBackgroundConfig(token: String, baseUrl: String) {
    BackgroundConfig.save(ctx, token, baseUrl)
  }

  /**
   * Set the parent's per-app monitoring filter (MONITORED_APPS ids). Persists it
   * (survives a JS-less restart) and applies it live to the capture filter, so a
   * toggled-off app stops being captured immediately. JS pushes this on each
   * /devices/me poll.
   */
  @ReactMethod
  fun setMonitoredApps(ids: com.facebook.react.bridge.ReadableArray) {
    val set = HashSet<String>()
    for (i in 0 until ids.size()) ids.getString(i)?.let { set.add(it) }
    BackgroundConfig.saveMonitoredApps(ctx, set)
    LighthouseRegistry.setEnabledIds(set)
  }

  /**
   * Set the protective-overlay (blocking) gate. Persists it and applies live, so a
   * parent turning blocking off stops overlays immediately (high hits still flag).
   * JS pushes this on each /devices/me poll.
   */
  @ReactMethod
  fun setBlockingEnabled(enabled: Boolean) {
    BackgroundConfig.saveBlockingEnabled(ctx, enabled)
    OverlayManager.setEnabled(enabled)
  }

  /**
   * Set the severity threshold that decides which hits draw the overlay
   * (severe|moderate|all) — mirrors the alert threshold. Persists + applies live.
   */
  @ReactMethod
  fun setBlockThreshold(threshold: String) {
    BackgroundConfig.saveBlockThreshold(ctx, threshold)
    OverlayManager.setThreshold(threshold)
  }

  @ReactMethod
  fun setVisionEnabled(enabled: Boolean) {
    BackgroundConfig.saveVisionEnabled(ctx, enabled)
    VisionEngine.setEnabled(enabled)
  }

  @ReactMethod
  fun visionStatus(promise: Promise) {
    val s = VisionEngine.status()
    val map = Arguments.createMap()
    map.putBoolean("supported", s.supported)
    map.putBoolean("running", s.running)
    map.putBoolean("enabled", s.enabled)
    map.putString("tier", s.tier)
    map.putDouble("intervalMs", s.intervalMs.toDouble())
    map.putBoolean("ocrReady", s.ocrReady)
    map.putBoolean("imageReady", s.imageReady)
    map.putDouble("framesChecked", s.framesChecked.toDouble())
    map.putDouble("framesSkipped", s.framesSkipped.toDouble())
    map.putDouble("textHits", s.textHits.toDouble())
    map.putDouble("imageHits", s.imageHits.toDouble())
    map.putDouble("lastFrameAt", s.lastFrameAt.toDouble())
    map.putDouble("lastOcrMs", s.lastOcrMs.toDouble())
    map.putDouble("lastImageMs", s.lastImageMs.toDouble())
    map.putDouble("lastTotalMs", s.lastTotalMs.toDouble())
    promise.resolve(map)
  }

  /** Start the always-on foreground monitor service. */
  @ReactMethod
  fun startMonitoring() {
    LighthouseMonitorService.start(ctx)
  }

  /** Stop the service + keep-alive worker and clear persisted config (on unpair). */
  @ReactMethod
  fun stopMonitoring() {
    LighthouseMonitorService.stop(ctx)
    KeepAliveWorker.cancel(ctx)
    BackgroundConfig.clear(ctx)
  }

  companion object {
    // Curated autostart-manager intents per OEM (judemanutd/AutoStarter). NOT a
    // guess at menu paths — these are community-maintained ComponentNames, and we
    // only launch one that resolveActivity() confirms exists on the device.
    // Transsion (Tecno/Infinix/itel) has no reliable public intent, so it is
    // intentionally absent: those fall through to the JS DontKillMyApp + search.
    private val AUTOSTART_INTENTS: Map<String, List<Pair<String, String>>> = mapOf(
      "xiaomi" to listOf(
        "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
      ),
      "redmi" to listOf(
        "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
      ),
      "poco" to listOf(
        "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
      ),
      "letv" to listOf(
        "com.letv.android.letvsafe" to "com.letv.android.letvsafe.AutobootManageActivity",
      ),
      "honor" to listOf(
        "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
      ),
      "huawei" to listOf(
        "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
      ),
      "oppo" to listOf(
        "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
        "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
        "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
      ),
      "vivo" to listOf(
        "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity",
        "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
        "com.iqoo.secure" to "com.iqoo.secure.safeguard.PurviewTabActivity",
      ),
      "nokia" to listOf(
        "com.evenwell.powersaving.g3" to
          "com.evenwell.powersaving.g3.exception.PowerSaverExceptionActivity",
      ),
      "samsung" to listOf(
        "com.samsung.android.lool" to "com.samsung.android.sm.ui.battery.BatteryActivity",
        "com.samsung.android.sm" to "com.samsung.android.sm.ui.battery.BatteryActivity",
      ),
      "oneplus" to listOf(
        "com.oneplus.security" to "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity",
      ),
      "asus" to listOf(
        "com.asus.mobilemanager" to "com.asus.mobilemanager.autostart.AutoStartActivity",
        "com.asus.mobilemanager" to "com.asus.mobilemanager.entry.FunctionActivity",
      ),
    )
  }
}
