package fund.fastforward.lighthouse.child

import android.content.Context
import org.json.JSONObject

data class Classification(val category: String, val severity: String, val tier: String = "keeper", val confidence: Float? = null, val risk: Float? = null, val ms: Long? = null, val matched: String? = null)

object LighthouseClassifier {
  const val ENGINE = "child-0.6.0"

  fun init(ctx: Context) {
    Keeper.init(ctx)
  }

  fun classify(text: String): Classification? {
    val r = Keeper.predict(text) ?: return null
    return Classification(r.category, r.severity, "keeper", r.confidence, r.risk, r.ms, fingerprint(text))
  }

  private fun fingerprint(text: String): String {
    val norm = text.lowercase().replace(Regex("\\s+"), " ").trim()
    val digest = java.security.MessageDigest.getInstance("SHA-256").digest(norm.toByteArray())
    return digest.take(8).joinToString("") { "%02x".format(it) }
  }

  fun baseMeta(cls: Classification): JSONObject {
    val m = JSONObject()
      .put("engine", ENGINE)
      .put("decidedBy", cls.tier)
      .put("model", Keeper.NAME)
      .put("modelVersion", Keeper.version() ?: "none")
    cls.confidence?.let { m.put("confidence", Math.round(it * 1000) / 1000.0) }
    cls.risk?.let { m.put("risk", Math.round(it * 1000) / 1000.0) }
    cls.ms?.let { m.put("keeperMs", it) }
    return m
  }

  private fun rank(sev: String): Int = when (sev) { "high" -> 3; "review" -> 2; else -> 1 }

  fun shouldBlock(result: Classification?, threshold: String): Boolean {
    if (result == null) return false
    val minRank = when (threshold) { "all" -> 1; "moderate" -> 2; else -> 3 }
    return rank(result.severity) >= minRank
  }
}
