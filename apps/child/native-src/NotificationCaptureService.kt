package fund.fastforward.lighthouse.child

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Real notification capture (Stage B, Track 1). Reads posted notifications from
 * MONITORED apps only (filtered via the registry-provided set in CaptureBuffer),
 * pulls their title/text, and buffers it for on-device classification by JS.
 * Nothing is stored to disk or sent off-device here.
 *
 * UNVERIFIED until a real Tecno: whether this fires at runtime, survives
 * backgrounding / battery optimisation, and behaves across OEM skins.
 */
class NotificationCaptureService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val pkg = sbn?.packageName ?: return
    if (!CaptureBuffer.isMonitored(pkg)) return
    val extras = sbn.notification?.extras ?: return
    val parts = listOfNotNull(
      extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
      extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
    )
    val text = parts.joinToString(" ").trim()
    if (text.isNotEmpty()) {
      // DEV-ONLY raw-text trace to logcat. BuildConfig.DEBUG is false in release,
      // so this physically cannot ship. Never persisted, never sent.
      if (BuildConfig.DEBUG) Log.d("LH-capture", "$pkg: ${LogScrub.scrub(text)}")
      CaptureBuffer.add(pkg, text, "notification")
    }
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification?) {
    // no-op
  }
}
