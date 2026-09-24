package fund.fastforward.lighthouse.child

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Protective overlay (Part 2 of scoped blocking). When the block rule fires
 * (severity meets the parent's threshold — LighthouseClassifier.shouldBlock), draw a
 * calm, kid-appropriate cover over the offending content with a clear way out.
 *
 * Safety:
 *  - GATED on SYSTEM_ALERT_WINDOW (canDrawOverlays) — no-op without it, never a
 *    silent half-state.
 *  - NON-FOCUSABLE window, so the system BACK/HOME keys always work → the child is
 *    never trapped; the "Go back" button is the obvious exit.
 *  - Single instance (re-show while up = no-op); the AccessibilityService dismisses
 *    it the moment the child leaves the blocked app.
 *
 * Copy is DRAFT. Built programmatically (no layout XML) to keep
 * it inside the plugin-copied native set.
 */
object OverlayManager {
  // Calm, honest, not scary — mirrors the approved Paper block screen (board 22).
  private const val LABEL = "Let's skip this one."
  private const val TITLE = "Lighthouse paused this before it loaded."
  private const val BODY =
    "You didn't do anything wrong. You can head back, or keep going if you're okay."
  private const val BUTTON = "GO BACK"
  private const val CONTINUE = "Continue anyway"
  private const val FOOTER = "Your parent sees the category, never the content."

  // After "Continue anyway", don't re-cover the same screen for a short window,
  // so the child can actually read it instead of the overlay popping straight
  // back. The parent is still emailed regardless (server-side).
  private const val SUPPRESS_MS = 60_000L

  @Volatile
  private var suppressUntil = 0L

  @Volatile
  private var shown = false

  /** Parent-set gate (BackgroundConfig + /devices/me). Default on. When false,
   *  high-severity hits still flag but never draw the overlay. */
  @Volatile
  private var enabled = true

  /** Parent severity threshold (severe|moderate|all) — which hits block. Default severe. */
  @Volatile
  private var blockThreshold = "severe"
  private var view: View? = null
  private val main = Handler(Looper.getMainLooper())

  fun isShown(): Boolean = shown

  fun isEnabled(): Boolean = enabled

  fun setEnabled(value: Boolean) {
    enabled = value
  }

  fun threshold(): String = blockThreshold

  fun setThreshold(value: String) {
    blockThreshold = value
  }

  /** Show the overlay. `onExit` runs when the child taps "Go back" (e.g. go HOME). */
  fun show(ctx: Context, onExit: () -> Unit) {
    if (!Settings.canDrawOverlays(ctx)) return // gated: never draw without permission
    if (System.currentTimeMillis() < suppressUntil) return // recently dismissed via "Continue"
    main.post {
      if (shown) return@post
      val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      val type =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
          WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
      val lp =
        WindowManager.LayoutParams(
          WindowManager.LayoutParams.MATCH_PARENT,
          WindowManager.LayoutParams.MATCH_PARENT,
          type,
          // NOT_FOCUSABLE so BACK/HOME still reach the system (no trap); the view
          // still receives touches (covers + intercepts the offending content).
          WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
          PixelFormat.OPAQUE,
        )
      val root = buildView(
        ctx,
        onGoBack = {
          // Leave the content FIRST (go Home), THEN remove the overlay a beat later —
          // otherwise the overlay disappears before navigation and the content flashes.
          onExit()
          main.postDelayed({ hideInternal(wm) }, 350)
        },
        onContinue = {
          // Dismiss and let the child read; suppress re-covering the same screen briefly.
          suppressUntil = System.currentTimeMillis() + SUPPRESS_MS
          hideInternal(wm)
        },
      )
      try {
        wm.addView(root, lp)
        view = root
        shown = true
      } catch (_: Exception) {
        // best-effort — never crash the capture service over the overlay
      }
    }
  }

  /** Remove the overlay (e.g. the child navigated away from the blocked app). */
  fun dismiss(ctx: Context) {
    main.post {
      val wm = ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      hideInternal(wm)
    }
  }

  private fun hideInternal(wm: WindowManager) {
    val v = view ?: return
    try {
      wm.removeView(v)
    } catch (_: Exception) {
      // already gone
    }
    view = null
    shown = false
  }

  private fun dp(ctx: Context, value: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, ctx.resources.displayMetrics).toInt()

  private fun buildView(ctx: Context, onGoBack: () -> Unit, onContinue: () -> Unit): View {
    // Matches the approved Paper "block screen": dark scrim + centered white card.
    val root = FrameLayout(ctx)
    root.setBackgroundColor(Color.parseColor("#F212141F")) // near-opaque dark scrim
    root.isClickable = true // swallow touches to the content behind

    val card = LinearLayout(ctx)
    card.orientation = LinearLayout.VERTICAL
    card.gravity = Gravity.CENTER_HORIZONTAL
    card.setPadding(dp(ctx, 24f), dp(ctx, 24f), dp(ctx, 24f), dp(ctx, 20f))
    val cardBg = android.graphics.drawable.GradientDrawable()
    cardBg.cornerRadius = dp(ctx, 24f).toFloat()
    cardBg.setColor(Color.WHITE)
    card.background = cardBg

    // App mark, so the cover is clearly Lighthouse (not the blocked app).
    val mark = android.widget.ImageView(ctx)
    try {
      mark.setImageDrawable(ctx.packageManager.getApplicationIcon(ctx.packageName))
    } catch (_: Exception) {
      // icon lookup can't realistically fail for our own package; skip if it does
    }
    val markLp = LinearLayout.LayoutParams(dp(ctx, 34f), dp(ctx, 34f))
    mark.layoutParams = markLp

    val label = TextView(ctx)
    label.text = LABEL
    label.setTextColor(Color.parseColor("#C2382B"))
    label.textSize = 13f
    label.typeface = Typeface.DEFAULT_BOLD
    label.gravity = Gravity.CENTER
    val labelLp =
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      )
    labelLp.topMargin = dp(ctx, 16f)
    label.layoutParams = labelLp

    val title = TextView(ctx)
    title.text = TITLE
    title.setTextColor(Color.parseColor("#1A1A1A"))
    title.textSize = 18f
    title.typeface = Typeface.DEFAULT_BOLD
    title.gravity = Gravity.CENTER
    val titleLp =
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      )
    titleLp.topMargin = dp(ctx, 8f)
    title.layoutParams = titleLp

    val body = TextView(ctx)
    body.text = BODY
    body.setTextColor(Color.parseColor("#5A6472"))
    body.textSize = 14f
    body.gravity = Gravity.CENTER
    val bodyLp =
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      )
    bodyLp.topMargin = dp(ctx, 8f)
    body.layoutParams = bodyLp

    // Primary: full-width cyan pill — the safe way out.
    val button = Button(ctx)
    button.text = BUTTON
    button.isAllCaps = false
    button.setTextColor(Color.WHITE)
    button.textSize = 16f
    button.typeface = Typeface.DEFAULT_BOLD
    button.stateListAnimator = null
    // Chunky 3D edge (board 22): deep #0E7FA8 base peeking 4dp under a cyan face.
    val pillEdge = android.graphics.drawable.GradientDrawable()
    pillEdge.cornerRadius = dp(ctx, 16f).toFloat()
    pillEdge.setColor(Color.parseColor("#0E7FA8"))
    val pillFace = android.graphics.drawable.GradientDrawable()
    pillFace.cornerRadius = dp(ctx, 16f).toFloat()
    pillFace.setColor(Color.parseColor("#1CABE2"))
    val pillLayers =
      android.graphics.drawable.LayerDrawable(arrayOf(pillEdge, pillFace))
    pillLayers.setLayerInset(1, 0, 0, 0, dp(ctx, 4f))
    button.background = pillLayers
    button.minWidth = 0
    button.minHeight = 0
    button.setPadding(0, dp(ctx, 14f), 0, dp(ctx, 14f))
    button.setOnClickListener { onGoBack() }
    val btnLp =
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      )
    btnLp.topMargin = dp(ctx, 20f)
    button.layoutParams = btnLp

    // Secondary: full-width red-outlined button — visible, honest, not tempting.
    val cont = Button(ctx)
    cont.text = CONTINUE
    cont.isAllCaps = false
    cont.setTextColor(Color.parseColor("#8E8E93"))
    cont.textSize = 15f
    cont.typeface = Typeface.DEFAULT_BOLD
    cont.stateListAnimator = null
    // Quiet gray ghost with the same chunky bottom edge, per board 22.
    val outline = android.graphics.drawable.GradientDrawable()
    outline.cornerRadius = dp(ctx, 16f).toFloat()
    outline.setColor(Color.TRANSPARENT)
    outline.setStroke(dp(ctx, 2f), Color.parseColor("#E8ECF0"))
    val outlineEdge = android.graphics.drawable.GradientDrawable()
    outlineEdge.cornerRadius = dp(ctx, 16f).toFloat()
    outlineEdge.setColor(Color.parseColor("#E8ECF0"))
    val outlineLayers =
      android.graphics.drawable.LayerDrawable(arrayOf(outlineEdge, outline))
    outlineLayers.setLayerInset(1, 0, 0, 0, dp(ctx, 2f))
    cont.background = outlineLayers
    cont.minWidth = 0
    cont.minHeight = 0
    cont.setPadding(0, dp(ctx, 12f), 0, dp(ctx, 12f))
    cont.setOnClickListener { onContinue() }
    val contLp =
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      )
    contLp.topMargin = dp(ctx, 12f)
    cont.layoutParams = contLp

    val footer = TextView(ctx)
    footer.text = FOOTER
    footer.setTextColor(Color.parseColor("#8E8E93"))
    footer.textSize = 11.5f
    footer.gravity = Gravity.CENTER
    val footerLp =
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      )
    footerLp.topMargin = dp(ctx, 16f)
    footer.layoutParams = footerLp

    card.addView(mark)
    card.addView(label)
    card.addView(title)
    card.addView(body)
    card.addView(button)
    card.addView(cont)
    card.addView(footer)

    val cardLp =
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
      )
    cardLp.gravity = Gravity.CENTER
    cardLp.leftMargin = dp(ctx, 24f)
    cardLp.rightMargin = dp(ctx, 24f)
    root.addView(card, cardLp)
    return root
  }
}
