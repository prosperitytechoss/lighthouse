package fund.fastforward.lighthouse.child

import java.text.Normalizer

class KeeperTokenizer(spm: ByteArray) {
  private val ids = HashMap<String, Int>()
  private val scores = HashMap<String, Float>()
  private var maxLen = 1
  private var unkId = 1
  private var unkScore = -10f

  init {
    var minScore = Float.MAX_VALUE
    var pos = 0
    var index = 0
    while (pos < spm.size) {
      val (tag, p1) = varint(spm, pos)
      pos = p1
      val field = (tag shr 3).toInt()
      when ((tag and 7).toInt()) {
        0 -> pos = varint(spm, pos).second
        1 -> pos += 8
        5 -> pos += 4
        2 -> {
          val (len, p2) = varint(spm, pos)
          val end = p2 + len.toInt()
          if (field == 1) {
            val (piece, score, type) = parsePiece(spm, p2, end)
            when (type) {
              1, 4 -> {
                ids[piece] = index
                scores[piece] = if (type == 4) 0f else score
                maxLen = maxOf(maxLen, piece.codePointCount(0, piece.length))
                if (type == 1) minScore = minOf(minScore, score)
              }
              2 -> unkId = index
            }
            index++
          }
          pos = end
        }
        else -> throw IllegalArgumentException("bad spm")
      }
    }
    unkScore = minScore - 10f
  }

  private fun varint(b: ByteArray, start: Int): Pair<Long, Int> {
    var result = 0L
    var shift = 0
    var p = start
    while (true) {
      val x = b[p++].toInt() and 0xff
      result = result or ((x and 0x7f).toLong() shl shift)
      if (x and 0x80 == 0) return Pair(result, p)
      shift += 7
    }
  }

  private fun parsePiece(b: ByteArray, start: Int, end: Int): Triple<String, Float, Int> {
    var piece = ""
    var score = 0f
    var type = 1
    var p = start
    while (p < end) {
      val (tag, p1) = varint(b, p)
      p = p1
      val field = (tag shr 3).toInt()
      when ((tag and 7).toInt()) {
        0 -> { val (v, p2) = varint(b, p); if (field == 3) type = v.toInt(); p = p2 }
        5 -> {
          val bits = (b[p].toInt() and 0xff) or ((b[p + 1].toInt() and 0xff) shl 8) or
            ((b[p + 2].toInt() and 0xff) shl 16) or ((b[p + 3].toInt() and 0xff) shl 24)
          if (field == 2) score = java.lang.Float.intBitsToFloat(bits)
          p += 4
        }
        2 -> { val (len, p2) = varint(b, p); if (field == 1) piece = String(b, p2, len.toInt(), Charsets.UTF_8); p = p2 + len.toInt() }
        1 -> p += 8
      }
    }
    return Triple(piece, score, type)
  }

  fun normalize(text: String): String {
    val nfkc = Normalizer.normalize(text, Normalizer.Form.NFKC)
    val sb = StringBuilder(nfkc.length)
    var space = true
    var i = 0
    while (i < nfkc.length) {
      val cp = nfkc.codePointAt(i)
      i += Character.charCount(cp)
      val mapped = OVERRIDES[cp] ?: intArrayOf(Character.toLowerCase(cp))
      for (m in mapped) {
        if (m == 0x20) {
          if (!space) { sb.append(' '); space = true }
        } else {
          sb.appendCodePoint(m)
          space = false
        }
      }
    }
    val out = sb.toString().trimEnd(' ')
    return if (out.isEmpty()) out else "\u2581" + out.replace(' ', '\u2581')
  }

  fun encode(text: String, maxTokens: Int = 127): LongArray {
    val s = normalize(text)
    if (s.isEmpty()) return LongArray(0)
    val cps = s.codePoints().toArray()
    val n = cps.size
    val best = FloatArray(n + 1) { Float.NEGATIVE_INFINITY }
    val from = IntArray(n + 1)
    val piece = IntArray(n + 1)
    best[0] = 0f
    val sb = StringBuilder()
    for (i in 0 until n) {
      if (best[i] == Float.NEGATIVE_INFINITY) continue
      sb.setLength(0)
      var single = false
      for (len in 1..minOf(maxLen, n - i)) {
        sb.appendCodePoint(cps[i + len - 1])
        val key = sb.toString()
        val id = ids[key] ?: continue
        if (len == 1) single = true
        val sc = best[i] + scores[key]!!
        if (sc > best[i + len]) { best[i + len] = sc; from[i + len] = i; piece[i + len] = id }
      }
      if (!single) {
        val sc = best[i] + unkScore
        if (sc > best[i + 1]) { best[i + 1] = sc; from[i + 1] = i; piece[i + 1] = unkId }
      }
    }
    val rev = ArrayList<Int>()
    var j = n
    while (j > 0) { rev.add(piece[j]); j = from[j] }
    val out = ArrayList<Long>(rev.size + 1)
    out.add(2L)
    for (k in rev.indices.reversed()) {
      val id = rev[k]
      if (id == unkId && out.size > 1 && out.last() == unkId.toLong()) continue
      out.add(id.toLong())
      if (out.size > maxTokens) break
    }
    return out.toLongArray()
  }

  companion object {
    private val OVERRIDES: Map<Int, IntArray> by lazy {
      val m = HashMap<Int, IntArray>()
      for (e in TABLE.split(',')) {
        val (k, v) = e.split(':')
        m[k.toInt()] = v.split('.').filter { it.isNotEmpty() }.map { it.toInt(16) }.toIntArray()
      }
      m
    }

    private const val TABLE = "1:,2:,3:,4:,5:,6:,7:,8:,9:20.,10:20.,11:,12:20.,13:20.,14:,15:,16:,17:,18:,19:,20:,21:,22:,23:,24:,25:,26:,27:,28:,29:,30:,31:,127:,143:,159:,837:3b9.,890:20.3b9.,962:3c3.,1010:3c3.,5024:13a0.,5025:13a1.,5026:13a2.,5027:13a3.,5028:13a4.,5029:13a5.,5030:13a6.,5031:13a7.,5032:13a8.,5033:13a9.,5034:13aa.,5035:13ab.,5036:13ac.,5037:13ad.,5038:13ae.,5039:13af.,5040:13b0.,5041:13b1.,5042:13b2.,5043:13b3.,5044:13b4.,5045:13b5.,5046:13b6.,5047:13b7.,5048:13b8.,5049:13b9.,5050:13ba.,5051:13bb.,5052:13bc.,5053:13bd.,5054:13be.,5055:13bf.,5056:13c0.,5057:13c1.,5058:13c2.,5059:13c3.,5060:13c4.,5061:13c5.,5062:13c6.,5063:13c7.,5064:13c8.,5065:13c9.,5066:13ca.,5067:13cb.,5068:13cc.,5069:13cd.,5070:13ce.,5071:13cf.,5072:13d0.,5073:13d1.,5074:13d2.,5075:13d3.,5076:13d4.,5077:13d5.,5078:13d6.,5079:13d7.,5080:13d8.,5081:13d9.,5082:13da.,5083:13db.,5084:13dc.,5085:13dd.,5086:13de.,5087:13df.,5088:13e0.,5089:13e1.,5090:13e2.,5091:13e3.,5092:13e4.,5093:13e5.,5094:13e6.,5095:13e7.,5096:13e8.,5097:13e9.,5098:13ea.,5099:13eb.,5100:13ec.,5101:13ed.,5102:13ee.,5103:13ef.,5104:13f0.,5105:13f1.,5106:13f2.,5107:13f3.,5108:13f4.,5109:13f5.,5112:13f0.,5113:13f1.,5114:13f2.,5115:13f3.,5116:13f4.,5117:13f5.,5760:20.,7296:432.,7297:434.,7298:43e.,7299:441.,7300:442.,7301:442.,7302:44a.,7303:463.,7304:a64b.,7305:1c8a.,8203:20.,8204:20.,8206:20.,8207:20.,8232:20.,8233:20.,42955:264.,42956:a7cd.,42958:a7cf.,42962:a7d3.,42964:a7d5.,42970:a7db.,42972:19b.,42993:73.,43888:13a0.,43889:13a1.,43890:13a2.,43891:13a3.,43892:13a4.,43893:13a5.,43894:13a6.,43895:13a7.,43896:13a8.,43897:13a9.,43898:13aa.,43899:13ab.,43900:13ac.,43901:13ad.,43902:13ae.,43903:13af.,43904:13b0.,43905:13b1.,43906:13b2.,43907:13b3.,43908:13b4.,43909:13b5.,43910:13b6.,43911:13b7.,43912:13b8.,43913:13b9.,43914:13ba.,43915:13bb.,43916:13bc.,43917:13bd.,43918:13be.,43919:13bf.,43920:13c0.,43921:13c1.,43922:13c2.,43923:13c3.,43924:13c4.,43925:13c5.,43926:13c6.,43927:13c7.,43928:13c8.,43929:13c9.,43930:13ca.,43931:13cb.,43932:13cc.,43933:13cd.,43934:13ce.,43935:13cf.,43936:13d0.,43937:13d1.,43938:13d2.,43939:13d3.,43940:13d4.,43941:13d5.,43942:13d6.,43943:13d7.,43944:13d8.,43945:13d9.,43946:13da.,43947:13db.,43948:13dc.,43949:13dd.,43950:13de.,43951:13df.,43952:13e0.,43953:13e1.,43954:13e2.,43955:13e3.,43956:13e4.,43957:13e5.,43958:13e6.,43959:13e7.,43960:13e8.,43961:13e9.,43962:13ea.,43963:13eb.,43964:13ec.,43965:13ed.,43966:13ee.,43967:13ef.,65279:20.,65374:ff5e.,65533:20.,68944:10d70.,68945:10d71.,68946:10d72.,68947:10d73.,68948:10d74.,68949:10d75.,68950:10d76.,68951:10d77.,68952:10d78.,68953:10d79.,68954:10d7a.,68955:10d7b.,68956:10d7c.,68957:10d7d.,68958:10d7e.,68959:10d7f.,68960:10d80.,68961:10d81.,68962:10d82.,68963:10d83.,68964:10d84.,68965:10d85.,93856:16ebb.,93857:16ebc.,93858:16ebd.,93859:16ebe.,93860:16ebf.,93861:16ec0.,93862:16ec1.,93863:16ec2.,93864:16ec3.,93865:16ec4.,93866:16ec5.,93867:16ec6.,93868:16ec7.,93869:16ec8.,93870:16ec9.,93871:16eca.,93872:16ecb.,93873:16ecc.,93874:16ecd.,93875:16ece.,93876:16ecf.,93877:16ed0.,93878:16ed1.,93879:16ed2.,93880:16ed3.,117974:61.,117975:62.,117976:63.,117977:64.,117978:65.,117979:66.,117980:67.,117981:68.,117982:69.,117983:6a.,117984:6b.,117985:6c.,117986:6d.,117987:6e.,117988:6f.,117989:70.,117990:71.,117991:72.,117992:73.,117993:74.,117994:75.,117995:76.,117996:77.,117997:78.,117998:79.,117999:7a.,118000:30.,118001:31.,118002:32.,118003:33.,118004:34.,118005:35.,118006:36.,118007:37.,118008:38.,118009:39.,120531:3c3.,120589:3c3.,120647:3c3.,120705:3c3.,120763:3c3."
  }
}
