package fund.fastforward.lighthouse.child

import java.security.MessageDigest

object ViewOnceWatch {
  const val CATEGORY = "Disappearing Messages"
  const val SEVERITY = "review"
  const val THRESHOLD = 3
  private const val WINDOW_MS = 24 * 60 * 60 * 1000L
  private const val MAX_IDS = 2000
  private val LABEL = Regex("\\bview[ -]?once\\b", RegexOption.IGNORE_CASE)

  private val times = HashMap<String, ArrayDeque<Long>>()
  private val alertedAt = HashMap<String, Long>()
  private val counted = LinkedHashSet<String>()
  private val visible = HashMap<String, Pair<Int, Long>>()

  fun isViewOnce(text: CharSequence?): Boolean = text != null && LABEL.containsMatchIn(text)

  private fun key(chat: String): String =
    MessageDigest.getInstance("SHA-256").digest(chat.trim().lowercase().toByteArray()).take(8).joinToString("") { "%02x".format(it) }

  private fun prune(k: String, now: Long): ArrayDeque<Long> {
    val q = times.getOrPut(k) { ArrayDeque() }
    while (q.isNotEmpty() && now - q.first() > WINDOW_MS) q.removeFirst()
    return q
  }

  private fun seenOnScreen(k: String, now: Long): Int {
    val v = visible[k] ?: return 0
    return if (now - v.second < WINDOW_MS) v.first else 0
  }

  private fun shouldAlert(k: String, count: Int, now: Long): Int? {
    if (count < THRESHOLD) return null
    val last = alertedAt[k]
    if (last != null && now - last < WINDOW_MS) return null
    alertedAt[k] = now
    return count
  }

  @Synchronized
  fun recordMessage(chat: String, messageId: String, now: Long): Int? {
    val k = key(chat)
    if (!counted.add("$k|$messageId")) return null
    while (counted.size > MAX_IDS) counted.remove(counted.first())
    val q = prune(k, now)
    q.addLast(now)
    return shouldAlert(k, maxOf(q.size, seenOnScreen(k, now)), now)
  }

  @Synchronized
  fun recordVisible(chat: String, count: Int, now: Long): Int? {
    if (count <= 0) return null
    val k = key(chat)
    visible[k] = Pair(maxOf(seenOnScreen(k, now), count), now)
    return shouldAlert(k, maxOf(prune(k, now).size, seenOnScreen(k, now)), now)
  }

  fun emit(count: Int, channel: String) {
    val meta = org.json.JSONObject()
      .put("engine", LighthouseClassifier.ENGINE)
      .put("decidedBy", "view-once")
      .put("count", count)
    SignalBuffer.add(SignalUploader.Signal(CATEGORY, SEVERITY, "whatsapp", SignalUploader.nowIso(), channel, meta))
  }
}
