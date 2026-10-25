package fund.fastforward.lighthouse.child

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import java.io.File
import java.nio.LongBuffer
import org.json.JSONObject

object Keeper {
  const val NAME = "lighthouse-keeper"
  const val BUNDLED_VERSION = "0.1"
  const val DEFAULT_MIN_RISK = 0.8f

  val CATEGORIES = listOf(
    "Bullying", "Eating Disorders", "Gambling", "Graphic Content", "Grooming", "Hate Speech", "Privacy Threats",
    "Scams", "Self-Harm", "Sextortion", "Sexual Content", "Substance Use", "Violence",
  )
  private val SEVERITY = mapOf(3 to "high", 2 to "review", 1 to "low")

  data class Result(val category: String, val severity: String, val level: Int, val confidence: Float, val risk: Float, val ms: Long)

  private class Loaded(val session: OrtSession, val tokenizer: KeeperTokenizer, val version: String, val source: String, val minRisk: Float)

  @Volatile private var loaded: Loaded? = null
  @Volatile var lastMs: Long = -1
    private set
  @Volatile var checks: Long = 0
    private set
  @Volatile var hits: Long = 0
    private set

  fun isReady(): Boolean = loaded != null
  fun version(): String? = loaded?.version
  fun source(): String? = loaded?.source
  fun minRisk(): Float? = loaded?.minRisk

  @Synchronized
  fun init(ctx: Context) {
    if (loaded != null) return
    val active = KeeperUpdater.activeDir(ctx)
    if (active != null) {
      val l = loadDir(active)
      if (l != null) {
        loaded = l
        return
      }
      KeeperUpdater.clearActive(ctx)
    }
    loaded = loadBundled(ctx)
  }

  private fun loadBundled(ctx: Context): Loaded? = try {
    val onnx = ctx.assets.open("keeper.onnx").use { it.readBytes() }
    val spm = ctx.assets.open("keeper.spm").use { it.readBytes() }
    val meta = bundledMeta(ctx)
    load(onnx, spm, meta.optString("version", BUNDLED_VERSION), "bundled", minRisk(meta))
  } catch (_: Throwable) {
    null
  }

  private fun bundledMeta(ctx: Context): JSONObject = try {
    JSONObject(ctx.assets.open("keeper.json").bufferedReader().use { it.readText() })
  } catch (_: Throwable) {
    JSONObject()
  }

  fun bundledVersion(ctx: Context): String = bundledMeta(ctx).optString("version", BUNDLED_VERSION)

  private fun minRisk(meta: JSONObject): Float = meta.optDouble("minRisk", DEFAULT_MIN_RISK.toDouble()).toFloat()

  private fun loadDir(dir: File): Loaded? = try {
    val meta = try { JSONObject(File(dir, "keeper.json").readText()) } catch (_: Throwable) { JSONObject() }
    load(File(dir, "keeper.onnx").readBytes(), File(dir, "keeper.spm").readBytes(), dir.name, "downloaded", minRisk(meta))
  } catch (_: Throwable) {
    null
  }

  private fun load(onnx: ByteArray, spm: ByteArray, version: String, source: String, minRisk: Float): Loaded? = try {
    val opts = OrtSession.SessionOptions().apply {
      setIntraOpNumThreads(1)
      setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
    }
    val l = Loaded(OrtEnvironment.getEnvironment().createSession(onnx, opts), KeeperTokenizer(spm), version, source, minRisk)
    if (run(l, "hello, how was school today") == null) {
      l.session.close()
      null
    } else {
      l
    }
  } catch (_: Throwable) {
    null
  }

  @Synchronized
  fun swap(dir: File): Boolean {
    val l = loadDir(dir) ?: return false
    val old = loaded
    loaded = l
    try { old?.session?.close() } catch (_: Throwable) {}
    return true
  }

  @Synchronized
  fun useBundled(ctx: Context) {
    if (loaded?.source == "bundled") return
    val l = loadBundled(ctx) ?: return
    val old = loaded
    loaded = l
    try { old?.session?.close() } catch (_: Throwable) {}
  }

  private fun run(l: Loaded, text: String): Array<FloatArray>? {
    val ids = l.tokenizer.encode(text)
    if (ids.size < 2) return null
    val env = OrtEnvironment.getEnvironment()
    OnnxTensor.createTensor(env, LongBuffer.wrap(ids), longArrayOf(1, ids.size.toLong())).use { input ->
      l.session.run(mapOf(l.session.inputNames.first() to input)).use { out ->
        @Suppress("UNCHECKED_CAST")
        return (out[0].value as Array<Array<FloatArray>>)[0]
      }
    }
  }

  @Synchronized
  fun predict(text: String): Result? {
    val l = loaded ?: return null
    if (text.isBlank()) return null
    val t0 = System.nanoTime()
    val probs = try { run(l, text) } catch (_: Throwable) { null } ?: return null
    lastMs = (System.nanoTime() - t0) / 1_000_000
    checks++
    var best = -1
    var bestLevel = 0
    var bestP = 0f
    for (c in probs.indices) {
      val p = probs[c]
      var lv = 0
      for (k in 1..3) if (p[k] > p[lv]) lv = k
      if (lv > 0 && 1f - p[0] < l.minRisk) continue
      if (lv > bestLevel || (lv == bestLevel && lv > 0 && p[lv] > bestP)) {
        best = c
        bestLevel = lv
        bestP = p[lv]
      }
    }
    if (best < 0 || bestLevel == 0) return null
    hits++
    return Result(CATEGORIES[best], SEVERITY.getValue(bestLevel), bestLevel, bestP, 1f - probs[best][0], lastMs)
  }
}
