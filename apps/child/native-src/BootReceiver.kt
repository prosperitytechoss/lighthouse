package fund.fastforward.lighthouse.child

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Restarts the monitor service after a device reboot — hands-off, no JS.
 *
 * The capture services (notification listener + accessibility) are system-bound,
 * so the OS rebinds them on boot if still enabled and CaptureBuffer refills on its
 * own. This receiver only needs to restart the drain/classify/upload service, and
 * only if we have paired creds persisted (otherwise do nothing).
 *
 * A specialUse foreground service is an allowed exemption for starting from
 * BOOT_COMPLETED on Android 14+ (unlike dataSync), so this start is legal.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action
    if (action != Intent.ACTION_BOOT_COMPLETED && action != "android.intent.action.QUICKBOOT_POWERON") {
      return
    }
    val ctx = context.applicationContext
    val token = BackgroundConfig.token(ctx)
    val baseUrl = BackgroundConfig.baseUrl(ctx)
    if (token != null && baseUrl != null) {
      if (BuildConfig.DEBUG) Log.d("LH-service", "boot: resuming monitor service")
      LighthouseMonitorService.start(ctx)
    } else if (BuildConfig.DEBUG) {
      Log.d("LH-service", "boot: not paired, nothing to resume")
    }
  }
}
