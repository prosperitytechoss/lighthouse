package fund.fastforward.lighthouse.child

object PopupGate {
  const val SURE_RISK = 0.99f
  private const val WINDOW_MS = 10 * 60 * 1000L
  private const val MAX_KEYS = 200
  private val seen = HashMap<String, LinkedHashMap<String, Long>>()

  @Synchronized
  fun pick(pkg: String, hits: List<Pair<String, Classification>>, now: Long): Pair<String, Classification>? {
    seen.values.forEach { m -> m.entries.removeAll { now - it.value > WINDOW_MS } }
    seen.entries.removeAll { it.value.isEmpty() }
    var pick: Pair<String, Classification>? = null
    for (h in hits) {
      val c = h.second
      val sure = (c.risk ?: 0f) >= SURE_RISK
      var pattern = false
      val fp = c.matched
      if (fp != null && seen.size < MAX_KEYS) {
        val m = seen.getOrPut("$pkg|${c.category}") { LinkedHashMap() }
        m[fp] = now
        pattern = m.size >= 2
      }
      if (!sure && !pattern) continue
      val b = pick?.second
      if (b == null || LighthouseClassifier.rank(c.severity) > LighthouseClassifier.rank(b.severity) ||
        (LighthouseClassifier.rank(c.severity) == LighthouseClassifier.rank(b.severity) && (c.risk ?: 0f) > (b.risk ?: 0f))) pick = h
    }
    return pick
  }
}
