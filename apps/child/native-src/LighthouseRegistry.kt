package fund.fastforward.lighthouse.child

/**
 * Monitored-app registry (native mirror of MONITORED_APPS in @lighthouse/types).
 * Maps an Android package to the canonical registry id used in signals. The
 * background loop is all-native, so capture filtering + id mapping must exist in
 * Kotlin too. (Temporary duplication of the JS registry — the single source of
 * truth stays in @lighthouse/types; keep these in sync until a shared codegen.)
 */
object LighthouseRegistry {
  private val PACKAGE_TO_ID: Map<String, String> = mapOf(
    "com.zhiliaoapp.musically" to "tiktok",
    "com.instagram.android" to "instagram",
    "com.android.chrome" to "chrome",
    "com.snapchat.android" to "snapchat",
    "com.roblox.client" to "roblox",
    "com.whatsapp" to "whatsapp",
    "com.whatsapp.w4b" to "whatsapp",
    "com.twitter.android" to "x",
    "com.facebook.katana" to "facebook",
    "com.facebook.lite" to "facebook",
    "com.zhiliaoapp.musically.go" to "tiktok",
    "com.instagram.lite" to "instagram",
    "com.google.android.apps.messaging" to "messages",
    "com.samsung.android.messaging" to "messages",
    "com.android.mms" to "messages",
  )

  /**
   * Parent-set per-app monitoring filter (MONITORED_APPS ids). `null` = all
   * enabled (default / current behavior). When set, only these ids are captured.
   * @Volatile so the capture thread sees the latest write from the JS bridge.
   */
  @Volatile
  private var enabledIds: Set<String>? = null

  fun setEnabledIds(ids: Set<String>?) {
    enabledIds = ids
  }

  /**
   * Canonical id for a package, or null if not monitored — either it isn't in the
   * registry OR the parent toggled it off. Single filter point: both the capture
   * services and the monitor loop route through here.
   */
  fun idForPackage(pkg: String): String? {
    val id = PACKAGE_TO_ID[pkg] ?: return null
    val enabled = enabledIds
    return if (enabled == null || enabled.contains(id)) id else null
  }
}
