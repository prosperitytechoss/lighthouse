package fund.fastforward.lighthouse.child

import android.content.Context
import android.os.BatteryManager
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat

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

    val accessibility = run {
      val flat = Settings.Secure.getString(
        ctx.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      ) ?: ""
      flat.split(':').any { it.contains(pkg) && it.contains("ContentAccessibilityService") }
    }

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
