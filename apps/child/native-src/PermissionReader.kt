package fund.fastforward.lighthouse.child

import android.content.Context
import android.os.BatteryManager
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import java.security.MessageDigest

/**
 * Reads the live capture-permission state so the heartbeat can report it. Same
 * checks the permission wizard uses. A kid can leave the app running but flip
 * these off — the server uses this to fire a tamper alert.
 */
data class PermissionState(
  val accessibilityEnabled: Boolean,
  val notificationAccessEnabled: Boolean,
  val batteryOptimizationExempt: Boolean,
  // Device battery health — a dying phone means monitoring/location are about to
  // stop. -1 = unknown (don't report). Rides the heartbeat; no extra ping.
  val batteryLevel: Int,
  val batteryCharging: Boolean,
)

object PermissionReader {
  fun read(ctx: Context): PermissionState {
    val pkg = ctx.packageName

    val accessibility = AccessibilityState.running(ctx)

    val notificationAccess = NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(pkg)

    val batteryExempt =
      (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager)
        .isIgnoringBatteryOptimizations(pkg)

    val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
    val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) // 0-100, -1 unknown
    val charging = bm.isCharging

    return PermissionState(accessibility, notificationAccess, batteryExempt, level, charging)
  }
}

object PhoneId {
  fun get(ctx: Context): String? {
    val raw = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID)
    if (raw.isNullOrBlank()) return null
    val digest = MessageDigest.getInstance("SHA-256").digest("lighthouse:$raw".toByteArray())
    return digest.joinToString("") { "%02x".format(it) }
  }
}

object AccessibilityState {
  private const val BIND_GRACE_MS = 15_000L

  fun settingOn(ctx: Context): Boolean {
    val flat = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: ""
    return flat.split(':').any { it.contains(ctx.packageName) && it.contains("ContentAccessibilityService") }
  }

  fun running(ctx: Context): Boolean {
    if (!settingOn(ctx)) return false
    if (ContentAccessibilityService.connected) return true
    return SystemClock.elapsedRealtime() - Process.getStartElapsedRealtime() < BIND_GRACE_MS
  }

  fun stuck(ctx: Context): Boolean = settingOn(ctx) && !running(ctx)
}
