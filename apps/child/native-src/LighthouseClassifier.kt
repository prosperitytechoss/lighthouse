package fund.fastforward.lighthouse.child

import android.content.Context
import java.io.File
import org.json.JSONObject

/**
 * Tier 1 classifier — RULES-BASED, ported 1:1 from the PROVEN TS engine
 * (apps/child/src/native/classify.ts). Same {category, severity} contract.
 *
 * The lexicon is DB-owned and versioned (Lighthouse Lexicon Admin). This reads:
 *   1. the bundled default (assets/lexicon.json) — ships with the app, and
 *   2. a synced cache (filesDir/lexicon-cache.json) — a newer published version
 *      pulled by SignalUploader.syncLexicon; wins when present.
 * classify() never breaks if a sync fails — it stays on the cached/bundled copy.
 *
 * Privacy: runs on-device; only {category, severity} leaves here, never the text.
 */
data class Classification(val category: String, val severity: String, val tier: String = "lexicon", val confidence: Float? = null)

object LighthouseClassifier {
  // Tie-break priority: earlier category wins on equal severity. Mirror of TS.
  private val CATEGORY_ORDER = listOf(
    "Self-Harm", "Eating Disorders", "Sexual Content", "Violence",
    "Graphic Content", "Substance Use", "Hate Speech", "Gambling",
  )
  private val SEVERITIES = listOf("high", "review", "low")
  private val SOFT_SELFHARM = setOf("kill me", "dey kill me", "go kill me", "killing me")
  // DB language codes → app codes used in the lexicon payload.
  private val L33T = mapOf('0' to 'o', '1' to 'i', '3' to 'e', '4' to 'a', '5' to 's', '7' to 't', '@' to 'a', '$' to 's')

  private data class Term(val tokens: List<String>, val category: String, val severity: String, val soft: Boolean)
  private class Compiled(
    val version: Int,
    val terms: List<Term>,
    val negators: Set<String>,
    val negatorWindow: Int,
    val drugCtx: Set<String>,
    val sarcasmEmoji: List<String>,
    val sarcasmWords: List<String>,
    val ambiguous: Map<String, Pair<String, String>>, // word -> (category, severity)
  )

  @Volatile private var compiled: Compiled = Compiled(0, emptyList(), emptySet(), 3, emptySet(), emptyList(), emptyList(), emptyMap())

  fun version(): Int = compiled.version

  // ── loading ────────────────────────────────────────────────────────────────

  private const val CACHE_FILE = "lexicon-cache.json"
  const val MODEL_THRESHOLD = 0.9f
  const val ENGINE = "child-0.5.0"

  fun baseMeta(cls: Classification): JSONObject {
    val m = JSONObject()
      .put("engine", ENGINE)
      .put("decidedBy", cls.tier)
      .put("lexiconVersion", compiled.version)
    if (cls.tier == "model") m.put("model", TextModel.NAME)
    cls.confidence?.let { m.put("confidence", Math.round(it * 1000) / 1000.0) }
    return m
  }

  /** Load bundled asset, then overlay a newer synced cache if present. Call on service start. */
  fun init(ctx: Context) {
    TextModel.init(ctx)
    try {
      val bundled = ctx.assets.open("lexicon.json").bufferedReader().use { it.readText() }
      setLexicon(bundled)
    } catch (_: Exception) { /* no bundle → empty until first sync */ }
    try {
      val cache = File(ctx.filesDir, CACHE_FILE)
      if (cache.exists()) {
        val json = cache.readText()
        val v = JSONObject(json).optInt("version", 0)
        if (v > compiled.version) setLexicon(json)
      }
    } catch (_: Exception) { /* corrupt cache → keep bundled */ }
  }

  /** Persist a freshly-synced lexicon to the cache and activate it. */
  fun saveAndActivate(ctx: Context, json: String) {
    try {
      File(ctx.filesDir, CACHE_FILE).writeText(json)
    } catch (_: Exception) { /* cache write best-effort */ }
    setLexicon(json)
  }

  /** Parse + compile a lexicon payload JSON string and make it active. */
  fun setLexicon(json: String) {
    try {
      compiled = compile(JSONObject(json))
    } catch (_: Exception) { /* malformed → keep current active lexicon */ }
  }

  private fun compile(lex: JSONObject): Compiled {
    val cats = lex.optJSONObject("categories") ?: JSONObject()
    val terms = ArrayList<Term>()
    for (category in CATEGORY_ORDER) {
      val byLang = cats.optJSONObject(category) ?: continue
      val langs = byLang.keys()
      while (langs.hasNext()) {
        val lang = langs.next()
        val bySev = byLang.optJSONObject(lang) ?: continue
        for (sev in SEVERITIES) {
          val arr = bySev.optJSONArray(sev) ?: continue
          for (i in 0 until arr.length()) {
            val toks = tokenize(arr.getString(i))
            if (toks.isNotEmpty()) {
              terms.add(Term(toks, category, sev, category == "Self-Harm" && SOFT_SELFHARM.contains(toks.joinToString(" "))))
            }
          }
        }
      }
    }
    val ctx = lex.optJSONObject("context") ?: JSONObject()
    val negators = HashSet<String>()
    ctx.optJSONArray("negators")?.let { for (i in 0 until it.length()) negators.addAll(tokenize(it.getString(i))) }
    val drug = HashSet<String>()
    ctx.optJSONArray("drugContextTokens")?.let { for (i in 0 until it.length()) drug.add(it.getString(i)) }
    val sEmoji = ArrayList<String>()
    ctx.optJSONArray("sarcasmEmoji")?.let { for (i in 0 until it.length()) sEmoji.add(it.getString(i)) }
    val sWords = ArrayList<String>()
    ctx.optJSONArray("sarcasmWords")?.let { for (i in 0 until it.length()) sWords.add(it.getString(i)) }
    val amb = HashMap<String, Pair<String, String>>()
    lex.optJSONObject("ambiguousTerms")?.let { a ->
      val ks = a.keys()
      while (ks.hasNext()) {
        val w = ks.next()
        val o = a.optJSONObject(w) ?: continue
        amb[w.lowercase()] = Pair(o.optString("category"), o.optString("severity"))
      }
    }
    return Compiled(lex.optInt("version", 0), terms, negators, ctx.optInt("negatorWindow", 3), drug, sEmoji, sWords, amb)
  }

  // ── engine (mirror of classify.ts) ───────────────────────────────────────────

  private fun deL33t(s: String): String {
    val sb = StringBuilder(s.length)
    for (ch in s) sb.append(L33T[ch] ?: ch)
    return sb.toString()
  }

  /** Lowercase word tokens split on any non-(letter|digit); Unicode-aware. */
  private fun tokenize(s: String): List<String> {
    val out = ArrayList<String>()
    val sb = StringBuilder()
    for (ch in s.lowercase()) {
      if (Character.isLetterOrDigit(ch)) sb.append(ch)
      else if (sb.isNotEmpty()) { out.add(sb.toString()); sb.setLength(0) }
    }
    if (sb.isNotEmpty()) out.add(sb.toString())
    return out
  }

  private fun seqIndex(hay: List<String>, needle: List<String>): Int {
    if (needle.isEmpty()) return -1
    var i = 0
    while (i + needle.size <= hay.size) {
      var ok = true
      for (j in needle.indices) if (hay[i + j] != needle[j]) { ok = false; break }
      if (ok) return i
      i++
    }
    return -1
  }

  private fun negatedBefore(tokens: List<String>, start: Int, c: Compiled): Boolean {
    val from = maxOf(0, start - c.negatorWindow)
    for (i in from until start) if (c.negators.contains(tokens[i])) return true
    return false
  }

  private fun hasSarcasm(text: String, c: Compiled): Boolean {
    if (c.sarcasmEmoji.any { text.contains(it) }) return true
    val lower = text.lowercase()
    val toks = tokenize(lower).toHashSet()
    return c.sarcasmWords.any { w ->
      val wt = tokenize(w)
      if (wt.size == 1) toks.contains(wt[0]) else lower.contains(w)
    }
  }

  private fun rank(sev: String): Int = when (sev) { "high" -> 3; "review" -> 2; else -> 1 }

  /** Returns the single strongest match, or null (benign / sub-threshold). */
  fun classify(text: String): Classification? {
    if (text.isEmpty()) return null
    val c = compiled
    val rawTokens = tokenize(text)
    if (rawTokens.isEmpty()) return null
    val l33tHay = " " + tokenize(deL33t(text)).joinToString(" ") + " "

    data class M(val category: String, val severity: String, val soft: Boolean)
    val matches = ArrayList<M>()
    for (t in c.terms) {
      val idx = seqIndex(rawTokens, t.tokens)
      if (idx >= 0) {
        if (negatedBefore(rawTokens, idx, c)) continue // NEGATION
        matches.add(M(t.category, t.severity, t.soft))
        continue
      }
      if (l33tHay.contains(" " + t.tokens.joinToString(" ") + " ")) { // l33t / obfuscation
        matches.add(M(t.category, t.severity, t.soft))
      }
    }
    // AMBIGUOUS-TERM GATING ("igbo" = weed only with drug-context tokens).
    for ((word, spec) in c.ambiguous) {
      if (rawTokens.contains(word) && rawTokens.any { c.drugCtx.contains(it) }) {
        matches.add(M(spec.first, spec.second, false))
      }
    }
    // SARCASM: drop soft self-harm idioms when a laughing emoji / lol co-occurs.
    val pool = if (hasSarcasm(text, c)) matches.filter { !it.soft } else matches
    if (pool.isEmpty()) return modelFallback(text)

    var best = pool[0]
    for (m in pool) {
      if (rank(m.severity) > rank(best.severity) ||
        (rank(m.severity) == rank(best.severity) && CATEGORY_ORDER.indexOf(m.category) < CATEGORY_ORDER.indexOf(best.category))
      ) best = m
    }
    return Classification(best.category, best.severity)
  }

  private fun modelFallback(text: String): Classification? {
    val p = TextModel.predict(text) ?: return null
    if (p.confidence < MODEL_THRESHOLD) return null
    val severity = if (p.severity == "high") "review" else p.severity
    return Classification(p.category, severity, "model", p.confidence)
  }

  /**
   * BLOCK decision — brain-agnostic (mirror of shouldBlock in classify.ts).
   * severe→high only, moderate→high+review, all→everything. null never blocks.
   */
  fun shouldBlock(result: Classification?, threshold: String): Boolean {
    if (result == null) return false
    val minRank = when (threshold) { "all" -> 1; "moderate" -> 2; else -> 3 }
    return rank(result.severity) >= minRank
  }
}
