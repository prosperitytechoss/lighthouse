package fund.fastforward.lighthouse.child

import java.util.concurrent.ConcurrentLinkedQueue

/**
 * In-process capture buffer shared by the notification + accessibility services
 * and the foreground monitor service (Stage B).
 *
 * Native services append filtered (monitored-app-only) text; the foreground
 * service drains it, classifies ON-DEVICE, and uploads only {category, severity,
 * app, time}. Raw text lives only in this bounded in-memory queue until drained.
 *
 * Filtering is via LighthouseRegistry (native), so capture works even after a
 * process restart with no JS running — no JS-pushed package set needed.
 */
object CaptureBuffer {
  private const val MAX = 500
  data class Item(val pkg: String, val text: String, val channel: String)

  private val queue = ConcurrentLinkedQueue<Item>()

  fun isMonitored(pkg: String): Boolean = LighthouseRegistry.idForPackage(pkg) != null

  fun add(pkg: String, text: String, channel: String = "text") {
    if (text.isBlank() || !isMonitored(pkg)) return
    queue.add(Item(pkg, text, channel))
    while (queue.size > MAX) queue.poll()
  }

  fun drain(): List<Item> {
    val out = ArrayList<Item>()
    while (true) {
      val item = queue.poll() ?: break
      out.add(item)
    }
    return out
  }
}
