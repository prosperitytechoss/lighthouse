package fund.fastforward.lighthouse.child

import java.util.concurrent.ConcurrentLinkedQueue

object SignalBuffer {
  private const val MAX = 200
  private val queue = ConcurrentLinkedQueue<SignalUploader.Signal>()

  fun add(signal: SignalUploader.Signal) {
    queue.add(signal)
    while (queue.size > MAX) queue.poll()
  }

  fun drain(): List<SignalUploader.Signal> {
    val out = ArrayList<SignalUploader.Signal>()
    while (true) out.add(queue.poll() ?: break)
    return out
  }
}
