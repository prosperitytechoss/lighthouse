package fund.fastforward.lighthouse.child

import java.util.concurrent.ConcurrentLinkedQueue
import org.json.JSONObject

object PopupReports {
  data class Shown(val category: String, val severity: String, val app: String, val channel: String, val keeperVersion: String?)

  private const val MAX = 50
  private val queue = ConcurrentLinkedQueue<JSONObject>()

  fun wrong(s: Shown) {
    val o = JSONObject()
      .put("category", s.category)
      .put("severity", s.severity)
      .put("app", s.app)
      .put("channel", s.channel)
      .put("engine", LighthouseClassifier.ENGINE)
      .put("occurredAt", SignalUploader.nowIso())
    s.keeperVersion?.let { o.put("keeperVersion", it) }
    queue.add(o)
    while (queue.size > MAX) queue.poll()
  }

  fun drain(): List<JSONObject> {
    val out = ArrayList<JSONObject>()
    while (true) out.add(queue.poll() ?: break)
    return out
  }

  fun putBack(items: List<JSONObject>) {
    items.forEach { queue.add(it) }
    while (queue.size > MAX) queue.poll()
  }
}
