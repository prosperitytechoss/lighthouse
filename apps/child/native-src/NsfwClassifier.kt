package fund.fastforward.lighthouse.child

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import java.nio.FloatBuffer
import kotlin.math.exp
import kotlin.math.max

object NsfwClassifier {
  const val SIZE = 224
  const val NAME = "mobilenetv4-small-nsfw"
  private const val ASSET = "nsfw.onnx"

  data class Result(val drawings: Float, val hentai: Float, val neutral: Float, val porn: Float, val sexy: Float) {
    val explicit: Float get() = porn + hentai

    fun merge(o: Result): Result = Result(
      max(drawings, o.drawings), max(hentai, o.hentai), minOf(neutral, o.neutral), max(porn, o.porn), max(sexy, o.sexy),
    )
  }

  @Volatile private var session: OrtSession? = null
  private var env: OrtEnvironment? = null
  private var inputName = ""

  fun isReady(): Boolean = session != null

  fun init(ctx: Context) {
    if (session != null) return
    try {
      val bytes = ctx.assets.open(ASSET).use { it.readBytes() }
      val e = OrtEnvironment.getEnvironment()
      val opts = OrtSession.SessionOptions().apply {
        setIntraOpNumThreads(2)
        setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
      }
      val s = e.createSession(bytes, opts)
      inputName = s.inputNames.first()
      env = e
      session = s
    } catch (_: Throwable) {
      session = null
    }
  }

  fun close() {
    try {
      session?.close()
    } catch (_: Throwable) {
    }
    session = null
  }

  fun classify(frame: Bitmap, crops: Int): Result? {
    val s = session ?: return null
    val e = env ?: return null
    var merged: Result? = null
    for (crop in squareCrops(frame, crops)) {
      val r = run(s, e, crop)
      if (crop !== frame) crop.recycle()
      if (r != null) merged = merged?.merge(r) ?: r
    }
    return merged
  }

  private fun squareCrops(frame: Bitmap, crops: Int): List<Bitmap> {
    val w = frame.width
    val h = frame.height
    val side = minOf(w, h)
    val n = if (h <= w) 1 else crops.coerceIn(1, 3)
    val out = ArrayList<Bitmap>(n)
    for (i in 0 until n) {
      val y = if (n == 1) (h - side) / 2 else ((h - side).toLong() * i / (n - 1)).toInt()
      val square = Bitmap.createBitmap(frame, 0, y, side, side)
      val scaled = Bitmap.createScaledBitmap(square, SIZE, SIZE, true)
      if (scaled !== square) square.recycle()
      out.add(scaled)
    }
    return out
  }

  private fun run(s: OrtSession, e: OrtEnvironment, bmp: Bitmap): Result? {
    return try {
      val px = IntArray(SIZE * SIZE)
      bmp.getPixels(px, 0, SIZE, 0, 0, SIZE, SIZE)
      val plane = SIZE * SIZE
      val data = FloatArray(3 * plane)
      for (i in 0 until plane) {
        val p = px[i]
        data[i] = ((p shr 16) and 0xFF) / 255f
        data[plane + i] = ((p shr 8) and 0xFF) / 255f
        data[2 * plane + i] = (p and 0xFF) / 255f
      }
      OnnxTensor.createTensor(e, FloatBuffer.wrap(data), longArrayOf(3, SIZE.toLong(), SIZE.toLong())).use { t ->
        s.run(mapOf(inputName to t)).use { out ->
          @Suppress("UNCHECKED_CAST")
          val logits = (out[0].value as Array<FloatArray>)[0]
          val p = softmax(logits)
          Result(p[0], p[1], p[2], p[3], p[4])
        }
      }
    } catch (_: Throwable) {
      null
    }
  }

  private fun softmax(x: FloatArray): FloatArray {
    val m = x.maxOrNull() ?: 0f
    val ex = FloatArray(x.size) { exp((x[it] - m).toDouble()).toFloat() }
    val sum = ex.sum()
    return FloatArray(x.size) { ex[it] / sum }
  }

  fun toClassification(r: Result): Classification? = when {
    r.neutral >= 0.40f -> null
    r.explicit >= 0.85f -> Classification("Sexual Content", "high")
    r.explicit >= 0.65f -> Classification("Sexual Content", "review")
    r.sexy >= 0.85f -> Classification("Sexual Content", "low")
    else -> null
  }
}
