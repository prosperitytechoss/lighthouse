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
    if (LighthouseRegistry.idForPackage(pkg) == "whatsapp") checkViewOnce(sbn, extras)
    val text = parts.joinToString(" ").trim()
    if (text.isNotEmpty()) {
      // DEV-ONLY raw-text trace to logcat. BuildConfig.DEBUG is false in release,
      // so this physically cannot ship. Never persisted, never sent.
      if (BuildConfig.DEBUG) Log.d("LH-capture", "$pkg: ${LogScrub.scrub(text)}")
      CaptureBuffer.add(pkg, text, "notification")
    }
  }

  private fun checkViewOnce(sbn: StatusBarNotification, extras: android.os.Bundle) {
    try {
      val chat = (extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE) ?: extras.getCharSequence(Notification.EXTRA_TITLE))?.toString() ?: return
      val now = System.currentTimeMillis()
      val messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
      if (messages != null && messages.isNotEmpty()) {
        for (m in messages) {
          val b = m as? android.os.Bundle ?: continue
          if (!ViewOnceWatch.isViewOnce(b.getCharSequence("text"))) continue
          val id = "${b.getLong("time")}|${b.getCharSequence("sender") ?: ""}"
          ViewOnceWatch.recordMessage(chat, id, now)?.let { ViewOnceWatch.emit(it, "notification") }
        }
      } else if (ViewOnceWatch.isViewOnce(extras.getCharSequence(Notification.EXTRA_TEXT))) {
        ViewOnceWatch.recordMessage(chat, "${sbn.key}|${sbn.postTime}", now)?.let { ViewOnceWatch.emit(it, "notification") }
      }
    } catch (_: Throwable) {
    }
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification?) {
    // no-op
  }
}
