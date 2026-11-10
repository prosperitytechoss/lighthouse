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
    if (OverlayManager.isShown() && leftBlockedApp(ev, pkg)) {
      OverlayManager.dismiss(applicationContext)
      blockedPkg = ""
    }
    if (!CaptureBuffer.isMonitored(pkg)) return

    // Debounce per package to limit volume + battery.
    val now = System.currentTimeMillis()
    main.removeCallbacks(trailingRead)
    if (pkg == lastPkg && now - lastAt < DEBOUNCE_MS) {
      main.postDelayed(trailingRead, DEBOUNCE_MS)
      return
    }
    lastPkg = pkg
    lastAt = now
    readScreen(pkg)
  }

  private val main = android.os.Handler(android.os.Looper.getMainLooper())

  private val trailingRead = Runnable {
    val pkg = lastPkg
    if (pkg.isNotEmpty() && CaptureBuffer.isMonitored(pkg) && rootInActiveWindow?.packageName?.toString() == pkg) {
      lastAt = System.currentTimeMillis()
      readScreen(pkg)
    }
  }

  private fun readScreen(pkg: String) {
    val root = rootInActiveWindow ?: return
    if (LighthouseRegistry.idForPackage(pkg) == "whatsapp") checkViewOnce(root)
    val parts = ArrayList<String>()
    collectText(root, parts, intArrayOf(0))
    val hits = LighthouseClassifier.classifyAll(parts)
    val best = LighthouseClassifier.best(hits) ?: return
    val blockable = if (OverlayManager.isEnabled()) hits.filter { LighthouseClassifier.shouldBlock(it.second, OverlayManager.threshold()) } else emptyList()
    val trigger = PopupGate.pick(pkg, blockable, System.currentTimeMillis())
    val pause = trigger != null &&
      OverlayManager.canShow(applicationContext) &&
      PauseMemory.claim(applicationContext, pkg, trigger.second, "text")
    val (text, cls) = if (pause && trigger != null) trigger else best
    if (BuildConfig.DEBUG) Log.d("LH-capture", "$pkg: ${LogScrub.scrub(text)}")
    CaptureBuffer.add(pkg, text, "text", pause)
    if (pause) block(pkg, cls, "text")
  }

  private val passThroughPkgs: Set<String> by lazy {
    val ime = (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
      .enabledInputMethodList.map { it.packageName }
    setOf("android", "com.android.systemui", "com.miui.securitycenter", "com.miui.powerkeeper", "com.xiaomi.xmsf") + ime
  }

  private val homePkgs: Set<String> by lazy {
    val home = android.content.Intent(android.content.Intent.ACTION_MAIN).addCategory(android.content.Intent.CATEGORY_HOME)
    packageManager.queryIntentActivities(home, 0).map { it.activityInfo.packageName }.toSet()
  }

  private fun leftBlockedApp(ev: AccessibilityEvent, pkg: String): Boolean {
    if (ev.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return false
    if (pkg == blockedPkg || pkg in passThroughPkgs) return false
    return pkg in homePkgs || packageManager.getLaunchIntentForPackage(pkg) != null
  }

  fun block(pkg: String, cls: Classification, channel: String) {
    blockedPkg = pkg
    val app = LighthouseRegistry.idForPackage(pkg)
    val what = app?.let { PopupReports.Shown(cls.category, cls.severity, it, channel, if (channel == "image") null else Keeper.version()) }
    OverlayManager.show(applicationContext, what) { performGlobalAction(GLOBAL_ACTION_HOME) }
  }

  private fun checkViewOnce(root: AccessibilityNodeInfo) {
    try {
      val title = root.findAccessibilityNodeInfosByViewId("com.whatsapp:id/conversation_contact_name").firstOrNull()?.text
        ?: root.findAccessibilityNodeInfosByViewId("com.whatsapp.w4b:id/conversation_contact_name").firstOrNull()?.text
        ?: return
      var count = 0
      fun walk(n: AccessibilityNodeInfo?, depth: Int) {
        if (n == null || depth > 40) return
        if (ViewOnceWatch.isViewOnce(n.text) || ViewOnceWatch.isViewOnce(n.contentDescription)) count++
        for (i in 0 until n.childCount) walk(n.getChild(i), depth + 1)
      }
      walk(root, 0)
      ViewOnceWatch.recordVisible(title.toString(), count, System.currentTimeMillis())?.let { ViewOnceWatch.emit(it, "text") }
    } catch (_: Throwable) {
    }
  }

  private fun collectText(node: AccessibilityNodeInfo?, parts: MutableList<String>, total: IntArray) {
    if (node == null || total[0] >= MAX_CHARS) return
    if (node.isEditable) return
    node.text?.let {
      if (it.isNotBlank()) {
        parts.add(it.toString())
        total[0] += it.length
      }
    }
    for (i in 0 until node.childCount) {
      if (total[0] >= MAX_CHARS) break
      collectText(node.getChild(i), parts, total)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    connected = true
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
    connected = false
    main.removeCallbacks(trailingRead)
    VisionEngine.stop()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    connected = false
    VisionEngine.stop()
    super.onDestroy()
  }

  companion object {
    @Volatile var connected = false

    // Lower debounce → the protective overlay reacts quickly (was 1500ms, felt slow).
    private const val DEBOUNCE_MS = 450L
    private const val MAX_CHARS = 4000
  }
}
