package fund.fastforward.lighthouse.child

import android.content.Context
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.exp
import kotlin.math.sqrt

data class Prediction(val category: String, val severity: String, val confidence: Float)

object TextModel {
  const val NAME = "lh-textmodel-v1"
  private const val ASSET = "textmodel.bin"
  private const val MAX_CP = 300
  private const val FNV_OFFSET = -0x7EE3623B
  private const val FNV_PRIME = 0x01000193
  private const val P_WORD = 1
  private const val P_BIGRAM = 2
  private const val P_CHAR = 3
  private const val SPACE = 32
  const val NULL_THRESHOLD = 0.5f
  const val HYBRID_THRESHOLD = 0.85f

  private class Head(val n: Int, val scale: FloatArray, val w: ByteArray, val wOff: Int, val bias: FloatArray)
  private class Model(
    val buckets: Int,
    val categories: List<String>,
    val severities: List<String>,
    val cat: Head,
    val sev: Head,
    val safeIdx: Int,
  )

  @Volatile private var model: Model? = null

  private val counts = IntArray(1 shl 17)
  private var touched = IntArray(4096)
  private var nTouched = 0
  private var norm = IntArray(2 * MAX_CP + 4)
  private var starts = IntArray(MAX_CP + 2)
  private var ends = IntArray(MAX_CP + 2)

  fun init(ctx: Context) {
    try {
      val bytes = ctx.assets.open(ASSET).use { it.readBytes() }
      model = parse(bytes)
    } catch (_: Exception) {
      model = null
    }
  }

  fun load(bytes: ByteArray): Boolean {
    return try {
      model = parse(bytes)
      true
    } catch (_: Exception) {
      false
    }
  }

  fun isReady(): Boolean = model != null

  private fun parse(bytes: ByteArray): Model {
    val bb = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    if (bytes.size < 12 || bytes[0] != 'L'.code.toByte() || bytes[1] != 'H'.code.toByte() || bytes[2] != 'T'.code.toByte() || bytes[3] != 'M'.code.toByte()) {
      throw IllegalArgumentException("bad magic")
    }
    val version = bb.getShort(4).toInt() and 0xFFFF
    if (version != 1) throw IllegalArgumentException("unsupported version $version")
    val buckets = bb.getInt(6)
    if (buckets <= 0 || buckets and (buckets - 1) != 0 || buckets > (1 shl 20)) throw IllegalArgumentException("bad buckets")
    val nClasses = bytes[10].toInt() and 0xFF
    val nSev = bytes[11].toInt() and 0xFF
    var off = 12
    val names = ArrayList<String>(nClasses + nSev)
    repeat(nClasses + nSev) {
      val len = bytes[off].toInt() and 0xFF
      names.add(String(bytes, off + 1, len, Charsets.UTF_8))
      off += 1 + len
    }
    val categories = names.subList(0, nClasses).toList()
    val severities = names.subList(nClasses, nClasses + nSev).toList()

    fun readHead(n: Int): Head {
      val scale = FloatArray(n) { bb.getFloat(off + 4 * it) }
      off += 4 * n
      val wOff = off
      off += buckets * n
      val bias = FloatArray(n) { bb.getFloat(off + 4 * it) }
      off += 4 * n
      return Head(n, scale, bytes, wOff, bias)
    }
    val cat = readHead(nClasses)
    val sev = readHead(nSev)
    if (off > bytes.size) throw IllegalArgumentException("truncated")
    if (buckets != counts.size) throw IllegalArgumentException("bucket count mismatch")
    return Model(buckets, categories, severities, cat, sev, categories.indexOf("SAFE"))
  }

  private fun fnvByte(h: Int, b: Int): Int = (h xor b) * FNV_PRIME

  private fun fnvCp(h0: Int, cp: Int): Int {
    var h = h0
    if (cp < 0x80) return fnvByte(h, cp)
    if (cp < 0x800) {
      h = fnvByte(h, 0xC0 or (cp shr 6))
      return fnvByte(h, 0x80 or (cp and 0x3F))
    }
    if (cp < 0x10000) {
      h = fnvByte(h, 0xE0 or (cp shr 12))
      h = fnvByte(h, 0x80 or ((cp shr 6) and 0x3F))
      return fnvByte(h, 0x80 or (cp and 0x3F))
    }
    h = fnvByte(h, 0xF0 or (cp shr 18))
    h = fnvByte(h, 0x80 or ((cp shr 12) and 0x3F))
    h = fnvByte(h, 0x80 or ((cp shr 6) and 0x3F))
    return fnvByte(h, 0x80 or (cp and 0x3F))
  }

  private fun isTokenCp(cp: Int): Boolean {
    if (cp < 0x80) return (cp in 0x61..0x7A) || (cp in 0x30..0x39) || (cp in 0x41..0x5A)
    if (Character.isLetter(cp)) return true
    return when (Character.getType(cp).toByte()) {
      Character.DECIMAL_DIGIT_NUMBER, Character.LETTER_NUMBER, Character.OTHER_NUMBER, Character.NON_SPACING_MARK -> true
      else -> false
    }
  }

  private fun isEmojiCp(cp: Int): Boolean = (cp in 0x1F000..0x1FAFF) || (cp in 0x2600..0x27BF)

  private fun bump(b: Int) {
    if (counts[b] == 0) {
      if (nTouched == touched.size) touched = touched.copyOf(touched.size * 2)
      touched[nTouched++] = b
    }
    counts[b]++
  }

  private fun featurize(text: String, mask: Int): Int {
    val lower = text.lowercase()
    var len = 1
    norm[0] = SPACE
    var nTok = 0
    var inTok = false
    var i = 0
    var seen = 0
    while (i < lower.length && seen < MAX_CP) {
      val cp = lower.codePointAt(i)
      i += Character.charCount(cp)
      seen++
      if (isTokenCp(cp)) {
        if (!inTok) {
          starts[nTok] = len
          inTok = true
        }
        norm[len++] = cp
      } else {
        if (inTok) {
          ends[nTok++] = len
          norm[len++] = SPACE
          inTok = false
        }
        if (isEmojiCp(cp)) {
          starts[nTok] = len
          norm[len++] = cp
          ends[nTok++] = len
          norm[len++] = SPACE
        }
      }
    }
    if (inTok) {
      ends[nTok++] = len
      norm[len++] = SPACE
    }
    if (nTok == 0) return 0
    for (t in 0 until nTok) {
      var h = fnvByte(FNV_OFFSET, P_WORD)
      for (k in starts[t] until ends[t]) h = fnvCp(h, norm[k])
      bump(h and mask)
    }
    for (t in 0 until nTok - 1) {
      var h = fnvByte(FNV_OFFSET, P_BIGRAM)
      for (k in starts[t] until ends[t + 1]) h = fnvCp(h, norm[k])
      bump(h and mask)
    }
    val seed = fnvByte(FNV_OFFSET, P_CHAR)
    for (s in 0 until len) {
      var h = seed
      var k = 0
      while (k < 5 && s + k < len) {
        h = fnvCp(h, norm[s + k])
        if (k >= 2) bump(h and mask)
        k++
      }
    }
    return nTouched
  }

  private fun runHead(head: Head, inv: Float, out: FloatArray) {
    val n = head.n
    for (c in 0 until n) out[c] = 0f
    val w = head.w
    for (j in 0 until nTouched) {
      val b = touched[j]
      val v = counts[b] * inv
      val base = head.wOff + b * n
      for (c in 0 until n) out[c] += v * w[base + c]
    }
    for (c in 0 until n) out[c] = out[c] * head.scale[c] + head.bias[c]
  }

  private fun softmax(z: FloatArray, n: Int): Int {
    var m = Float.NEGATIVE_INFINITY
    for (c in 0 until n) if (z[c] > m) m = z[c]
    var s = 0f
    for (c in 0 until n) {
      z[c] = exp((z[c] - m).toDouble()).toFloat()
      s += z[c]
    }
    var best = 0
    for (c in 0 until n) {
      z[c] /= s
      if (z[c] > z[best]) best = c
    }
    return best
  }

  private val catOut = FloatArray(16)
  private val sevOut = FloatArray(16)

  @Synchronized
  fun predict(text: String): Prediction? {
    val m = model ?: return null
    if (text.isEmpty()) return null
    try {
      nTouched = 0
      featurize(text, m.buckets - 1)
      if (nTouched == 0) return null
      var ss = 0L
      for (j in 0 until nTouched) {
        val v = counts[touched[j]].toLong()
        ss += v * v
      }
      val inv = (1.0 / sqrt(ss.toDouble())).toFloat()
      runHead(m.cat, inv, catOut)
      runHead(m.sev, inv, sevOut)
      val ci = softmax(catOut, m.cat.n)
      val si = softmax(sevOut, m.sev.n)
      val conf = catOut[ci]
      if (ci == m.safeIdx || conf < NULL_THRESHOLD) return null
      return Prediction(m.categories[ci], m.severities[si], conf)
    } catch (_: Exception) {
      return null
    } finally {
      for (j in 0 until nTouched) counts[touched[j]] = 0
      nTouched = 0
    }
  }
}
