package fund.fastforward.lighthouse.child

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.KeyStore

/**
 * Persists the background loop's config (device token + API base URL) in
 * EncryptedSharedPreferences, so the foreground service can keep sending even
 * after a process restart with no JS running. JS pushes this in (same pattern as
 * the rest of the bridge); we never read expo-secure-store from Kotlin.
 *
 * The encrypted file is tied to a master key in AndroidKeyStore. After a backup
 * restore, a reinstall on some OEMs, or a Keystore reset, the file no longer
 * matches the key and every read throws (AEADBadTagException). Recovery: wipe the
 * file and the key, start fresh. JS re-pushes the token on every app open, so a
 * paired phone heals itself on the next launch.
 */
object BackgroundConfig {
  private const val FILE = "lh_bg_config"
  private const val KEY_TOKEN = "deviceToken"
  private const val KEY_BASE = "baseUrl"
  // Per-app monitoring filter. Absent key = all enabled (default). Stored as a
  // StringSet of MONITORED_APPS ids; empty set = none enabled.
  private const val KEY_APPS = "monitoredApps"
  // Protective-overlay (blocking) on/off. Absent = true (default on).
  private const val KEY_BLOCKING = "blockingEnabled"
  // Severity threshold driving the overlay block: severe|moderate|all. Absent = severe.
  private const val KEY_THRESHOLD = "blockThreshold"
  private const val KEY_VISION = "visionEnabled"
  private const val MASTER_KEY_ALIAS = "_androidx_security_master_key_"

  @Volatile private var cached: SharedPreferences? = null

  private fun open(ctx: Context): SharedPreferences {
    val masterKey = MasterKey.Builder(ctx)
      .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
      .build()
    return EncryptedSharedPreferences.create(
      ctx,
      FILE,
      masterKey,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
  }

  private fun reset(ctx: Context) {
    try {
      ctx.deleteSharedPreferences(FILE)
    } catch (_: Throwable) {
    }
    try {
      val ks = KeyStore.getInstance("AndroidKeyStore")
      ks.load(null)
      if (ks.containsAlias(MASTER_KEY_ALIAS)) ks.deleteEntry(MASTER_KEY_ALIAS)
    } catch (_: Throwable) {
    }
  }

  @Synchronized
  private fun prefs(ctx: Context): SharedPreferences {
    cached?.let { return it }
    val app = ctx.applicationContext
    val p = try {
      open(app)
    } catch (e: Throwable) {
      Log.w("LH-config", "encrypted prefs unreadable, resetting: ${e.javaClass.simpleName}")
      reset(app)
      try {
        open(app)
      } catch (e2: Throwable) {
        Log.w("LH-config", "encrypted prefs unavailable, using in-memory: ${e2.javaClass.simpleName}")
        MemoryPrefs()
      }
    }
    cached = p
    return p
  }

  private fun edit(ctx: Context, block: (SharedPreferences.Editor) -> Unit) {
    try {
      val e = prefs(ctx).edit()
      block(e)
      e.apply()
    } catch (e: Throwable) {
      Log.w("LH-config", "write failed, resetting: ${e.javaClass.simpleName}")
      cached = null
      reset(ctx.applicationContext)
      try {
        val e2 = prefs(ctx).edit()
        block(e2)
        e2.apply()
      } catch (_: Throwable) {
      }
    }
  }

  private fun <T> read(ctx: Context, fallback: T, block: (SharedPreferences) -> T): T =
    try {
      block(prefs(ctx))
    } catch (e: Throwable) {
      Log.w("LH-config", "read failed, resetting: ${e.javaClass.simpleName}")
      cached = null
      reset(ctx.applicationContext)
      fallback
    }

  fun save(ctx: Context, token: String, baseUrl: String) {
    edit(ctx) { it.putString(KEY_TOKEN, token).putString(KEY_BASE, baseUrl) }
  }

  fun clear(ctx: Context) {
    edit(ctx) { it.clear() }
  }

  fun token(ctx: Context): String? = read(ctx, null) { it.getString(KEY_TOKEN, null) }

  fun baseUrl(ctx: Context): String? = read(ctx, null) { it.getString(KEY_BASE, null) }

  /** Persist the parent's per-app monitoring choice (ids). null = clear → all enabled. */
  fun saveMonitoredApps(ctx: Context, ids: Set<String>?) {
    edit(ctx) { if (ids == null) it.remove(KEY_APPS) else it.putStringSet(KEY_APPS, ids) }
  }

  /** Read the persisted filter, or null if never set (= all enabled). */
  fun monitoredApps(ctx: Context): Set<String>? =
    read(ctx, null) { if (it.contains(KEY_APPS)) it.getStringSet(KEY_APPS, emptySet()) else null }

  /** Persist the protective-overlay (blocking) on/off. */
  fun saveBlockingEnabled(ctx: Context, enabled: Boolean) {
    edit(ctx) { it.putBoolean(KEY_BLOCKING, enabled) }
  }

  /** Read the blocking flag (default true = on). */
  fun blockingEnabled(ctx: Context): Boolean = read(ctx, true) { it.getBoolean(KEY_BLOCKING, true) }

  /** Persist the overlay block severity threshold (severe|moderate|all). */
  fun saveBlockThreshold(ctx: Context, threshold: String) {
    edit(ctx) { it.putString(KEY_THRESHOLD, threshold) }
  }

  fun saveVisionEnabled(ctx: Context, enabled: Boolean) {
    edit(ctx) { it.putBoolean(KEY_VISION, enabled) }
  }

  fun visionEnabled(ctx: Context): Boolean = read(ctx, true) { it.getBoolean(KEY_VISION, true) }

  /** Read the block threshold (default "severe" = high only). */
  fun blockThreshold(ctx: Context): String =
    read(ctx, "severe") { it.getString(KEY_THRESHOLD, "severe") ?: "severe" }

  private class MemoryPrefs : SharedPreferences {
    private val map = HashMap<String, Any?>()

    override fun getAll(): MutableMap<String, *> = HashMap(map)
    override fun getString(key: String?, defValue: String?): String? = map[key] as? String ?: defValue
    @Suppress("UNCHECKED_CAST")
    override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? =
      (map[key] as? Set<String>)?.toMutableSet() ?: defValues
    override fun getInt(key: String?, defValue: Int): Int = map[key] as? Int ?: defValue
    override fun getLong(key: String?, defValue: Long): Long = map[key] as? Long ?: defValue
    override fun getFloat(key: String?, defValue: Float): Float = map[key] as? Float ?: defValue
    override fun getBoolean(key: String?, defValue: Boolean): Boolean = map[key] as? Boolean ?: defValue
    override fun contains(key: String?): Boolean = map.containsKey(key)
    override fun edit(): SharedPreferences.Editor = Editor()
    override fun registerOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) {}
    override fun unregisterOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) {}

    private inner class Editor : SharedPreferences.Editor {
      private val pending = HashMap<String, Any?>()
      private var clearAll = false

      override fun putString(key: String?, value: String?) = apply { pending[key ?: return this] = value }
      override fun putStringSet(key: String?, values: MutableSet<String>?) = apply { pending[key ?: return this] = values?.toSet() }
      override fun putInt(key: String?, value: Int) = apply { pending[key ?: return this] = value }
      override fun putLong(key: String?, value: Long) = apply { pending[key ?: return this] = value }
      override fun putFloat(key: String?, value: Float) = apply { pending[key ?: return this] = value }
      override fun putBoolean(key: String?, value: Boolean) = apply { pending[key ?: return this] = value }
      override fun remove(key: String?) = apply { pending[key ?: return this] = null }
      override fun clear() = apply { clearAll = true }
      override fun commit(): Boolean {
        apply()
        return true
      }
      override fun apply() {
        synchronized(map) {
          if (clearAll) map.clear()
          for ((k, v) in pending) if (v == null) map.remove(k) else map[k] = v
        }
      }
    }
  }
}
