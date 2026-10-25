package fund.fastforward.lighthouse.child

import android.content.Context
import android.net.ConnectivityManager
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import org.json.JSONObject

object KeeperUpdater {
  private const val ROOT = "keeper"
  private const val ACTIVE = "active.txt"
  private val FILES = listOf("keeper.onnx", "keeper.spm")

  @Volatile var status: String = "idle"
    private set
  @Volatile var serverVersion: String? = null
    private set

  private fun root(ctx: Context) = File(ctx.filesDir, ROOT)

  fun activeDir(ctx: Context): File? = try {
    val v = File(root(ctx), ACTIVE).readText().trim()
    val dir = File(root(ctx), v)
    if (v.isNotEmpty() && FILES.all { File(dir, it).isFile }) dir else null
  } catch (_: Throwable) {
    null
  }

  fun clearActive(ctx: Context) {
    try { File(root(ctx), ACTIVE).delete() } catch (_: Throwable) {}
  }

  private fun setActive(ctx: Context, version: String) {
    root(ctx).mkdirs()
    val tmp = File(root(ctx), "$ACTIVE.tmp")
    tmp.writeText(version)
    tmp.renameTo(File(root(ctx), ACTIVE))
  }

  private fun sha256(f: File): String {
    val md = MessageDigest.getInstance("SHA-256")
    f.inputStream().use { input ->
      val buf = ByteArray(64 * 1024)
      while (true) {
        val n = input.read(buf)
        if (n < 0) break
        md.update(buf, 0, n)
      }
    }
    return md.digest().joinToString("") { "%02x".format(it) }
  }

  private fun unmetered(ctx: Context): Boolean = try {
    val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    cm.activeNetwork != null && !cm.isActiveNetworkMetered
  } catch (_: Throwable) {
    false
  }

  private fun open(baseUrl: String, path: String, token: String): HttpURLConnection =
    (URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
      requestMethod = "GET"
      connectTimeout = 10_000
      readTimeout = 60_000
      setRequestProperty("Authorization", "Bearer $token")
    }

  private fun download(baseUrl: String, path: String, token: String, dst: File): Boolean {
    var conn: HttpURLConnection? = null
    return try {
      conn = open(baseUrl, path, token)
      if (conn.responseCode !in 200..299) return false
      conn.inputStream.use { input -> dst.outputStream().use { input.copyTo(it) } }
      true
    } catch (_: Throwable) {
      false
    } finally {
      conn?.disconnect()
    }
  }

  private fun current(baseUrl: String, token: String): JSONObject? {
    var conn: HttpURLConnection? = null
    return try {
      conn = open(baseUrl, "/keeper/current", token)
      if (conn.responseCode in 200..299) JSONObject(conn.inputStream.bufferedReader().use { it.readText() }) else null
    } catch (_: Throwable) {
      null
    } finally {
      conn?.disconnect()
    }
  }

  private fun matches(dir: File, hashes: Map<String, String>): Boolean =
    FILES.all { File(dir, it).isFile && sha256(File(dir, it)) == hashes[it] }

  private fun prune(ctx: Context, keep: Set<String>) {
    root(ctx).listFiles()?.forEach { f -> if (f.isDirectory && f.name !in keep) f.deleteRecursively() }
  }

  @Volatile private var lastCheck = 0L

  fun maybeSync(ctx: Context, baseUrl: String, token: String) {
    val now = System.currentTimeMillis()
    val every = if (status == "current" || status == "none published") 30 * 60_000L else 5 * 60_000L
    if (now - lastCheck < every) return
    lastCheck = now
    sync(ctx, baseUrl, token)
  }

  @Synchronized
  fun sync(ctx: Context, baseUrl: String, token: String) {
    try {
      val cur = current(baseUrl, token) ?: run { status = "offline"; return }
      val version = cur.optString("version", "")
      if (cur.isNull("version") || version.isEmpty()) { status = "none published"; return }
      serverVersion = version
      if (!Regex("^[0-9A-Za-z._-]{1,32}$").matches(version)) { status = "bad version"; return }
      if (version == Keeper.version()) { status = "current"; return }
      if (version == Keeper.bundledVersion(ctx)) {
        Keeper.useBundled(ctx)
        clearActive(ctx)
        prune(ctx, emptySet())
        status = "current"
        return
      }
      val hashes = mapOf("keeper.onnx" to cur.optString("onnxSha256"), "keeper.spm" to cur.optString("spmSha256"))
      val dir = File(root(ctx), version)
      if (!matches(dir, hashes)) {
        if (!unmetered(ctx)) { status = "waiting for wifi"; return }
        val tmp = File(root(ctx), "$version.part")
        tmp.deleteRecursively()
        tmp.mkdirs()
        for (f in FILES) {
          if (!download(baseUrl, "/keeper/files/$version/$f", token, File(tmp, f))) { tmp.deleteRecursively(); status = "download failed"; return }
          if (sha256(File(tmp, f)) != hashes[f]) { tmp.deleteRecursively(); status = "hash mismatch"; return }
        }
        if (cur.has("minRisk")) File(tmp, "keeper.json").writeText(JSONObject().put("version", version).put("minRisk", cur.getDouble("minRisk")).toString())
        dir.deleteRecursively()
        if (!tmp.renameTo(dir)) { tmp.deleteRecursively(); status = "save failed"; return }
      }
      val previous = Keeper.version()
      if (!Keeper.swap(dir)) { dir.deleteRecursively(); status = "model failed to load"; return }
      setActive(ctx, version)
      prune(ctx, setOfNotNull(version, previous))
      status = "current"
    } catch (_: Throwable) {
      status = "error"
    }
  }
}
