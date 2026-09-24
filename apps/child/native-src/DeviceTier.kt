package fund.fastforward.lighthouse.child

import android.app.ActivityManager
import android.content.Context
import android.os.Build

enum class DeviceTier(val label: String, val intervalMs: Long, val ocrWidth: Int, val imageCrops: Int) {
  FAST("fast", 15_000L, 1080, 3),
  MID("mid", 30_000L, 720, 2),
  SLOW("slow", 60_000L, 540, 1);

  fun slower(): DeviceTier = values().getOrElse(ordinal + 1) { SLOW }

  fun faster(): DeviceTier = values().getOrElse(ordinal - 1) { FAST }

  companion object {
    fun detect(ctx: Context): DeviceTier {
      val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val mi = ActivityManager.MemoryInfo()
      am.getMemoryInfo(mi)
      val gb = mi.totalMem / 1_073_741_824.0
      val cores = Runtime.getRuntime().availableProcessors()
      return when {
        am.isLowRamDevice || gb < 2.5 || Build.VERSION.SDK_INT < 31 -> SLOW
        gb < 4.5 || cores <= 4 -> MID
        else -> FAST
      }
    }
  }
}
