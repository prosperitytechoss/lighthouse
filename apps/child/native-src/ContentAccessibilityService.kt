package fund.fastforward.lighthouse.child

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Real on-screen text capture (Stage B, Track 1). Reads visible text from
 * MONITORED apps only (gated by foreground package against the registry set),
 * debounced to limit volume + battery, and buffers it for on-device
 * classification by JS. Nothing is stored to disk or sent off-device here.
 *
 * UNVERIFIED until a real Tecno: runtime firing, backgrounding, battery impact,
 * and OEM-skin behaviour.
 */
class ContentAccessibilityService : AccessibilityService() {
  private var lastPkg = ""
  private var lastAt = 0L
  private var blockedPkg = ""

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val ev = event ?: return
    val pkg = ev.packageName?.toString() ?: return
    // Ignore our own windows (incl. the overlay itself), else it self-dismisses.
    if (pkg == packageName) return
    if (ev.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) VisionEngine.onForegroundApp(pkg)
    // Auto-clear the protective overlay once the child leaves the blocked app — so
    // it never lingers over the launcher or another app. No trap.
    if (OverlayManager.isShown() && pkg != blockedPkg) {
      OverlayManager.dismiss(applicationContext)
      blockedPkg = ""
    }
    if (!CaptureBuffer.isMonitored(pkg)) return

    // Debounce per package to limit volume + battery.
    val now = System.currentTimeMillis()
    if (pkg == lastPkg && now - lastAt < DEBOUNCE_MS) return
    lastPkg = pkg
    lastAt = now

    val root = rootInActiveWindow ?: return
    val sb = StringBuilder()
    collectText(root, sb)
    val text = sb.toString().trim()
    if (text.isNotEmpty()) {
      // DEV-ONLY raw-text trace to logcat. BuildConfig.DEBUG is false in release,
      // so this physically cannot ship. Never persisted, never sent.
      if (BuildConfig.DEBUG) Log.d("LH-capture", "$pkg: ${LogScrub.scrub(text)}")
      CaptureBuffer.add(pkg, text, "text")

      // Real-time protective block — brain-agnostic: rides on classify() + the
      // shouldBlock rule, which now follows the PARENT'S SEVERITY THRESHOLD (same as
      // alerts): severe→high, moderate→high+review, all→everything. Gated on the
      // parent's overlay toggle AND the overlay permission.
      if (OverlayManager.isEnabled() &&
        LighthouseClassifier.shouldBlock(LighthouseClassifier.classify(text), OverlayManager.threshold())
      ) {
        block(pkg)
      }
    }
  }

  fun block(pkg: String) {
    blockedPkg = pkg
    OverlayManager.show(applicationContext) { performGlobalAction(GLOBAL_ACTION_HOME) }
  }

  private fun collectText(node: AccessibilityNodeInfo?, sb: StringBuilder) {
    if (node == null || sb.length >= MAX_CHARS) return
    node.text?.let { if (it.isNotBlank()) sb.append(it).append(' ') }
    for (i in 0 until node.childCount) {
      if (sb.length >= MAX_CHARS) break
      collectText(node.getChild(i), sb)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    val ctx = applicationContext
    try {
      OverlayManager.setEnabled(BackgroundConfig.blockingEnabled(ctx))
      OverlayManager.setThreshold(BackgroundConfig.blockThreshold(ctx))
      LighthouseRegistry.setEnabledIds(BackgroundConfig.monitoredApps(ctx))
    } catch (_: Throwable) {
    }
    Thread {
      try {
        LighthouseClassifier.init(ctx)
      } catch (_: Throwable) {
      }
    }.start()
    try {
      VisionEngine.start(this)
    } catch (_: Throwable) {
    }
  }

  override fun onInterrupt() {
    // no-op
  }

  override fun onUnbind(intent: android.content.Intent?): Boolean {
    VisionEngine.stop()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    VisionEngine.stop()
    super.onDestroy()
  }

  companion object {
    // Lower debounce → the protective overlay reacts quickly (was 1500ms, felt slow).
    private const val DEBOUNCE_MS = 450L
    private const val MAX_CHARS = 2000
  }
}
