package fund.fastforward.lighthouse.child

import android.graphics.Bitmap
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.TimeUnit

object OcrEngine {
  @Volatile private var recognizer: TextRecognizer? = null

  fun init() {
    if (recognizer == null) {
      recognizer = try {
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      } catch (_: Throwable) {
        null
      }
    }
  }

  fun isReady(): Boolean = recognizer != null

  fun recognize(bitmap: Bitmap): String {
    val r = recognizer ?: return ""
    return try {
      Tasks.await(r.process(InputImage.fromBitmap(bitmap, 0)), 12, TimeUnit.SECONDS).text
    } catch (_: Throwable) {
      ""
    }
  }

  fun close() {
    try {
      recognizer?.close()
    } catch (_: Throwable) {
    }
    recognizer = null
  }
}
