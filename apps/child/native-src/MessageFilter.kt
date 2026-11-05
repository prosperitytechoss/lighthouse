package fund.fastforward.lighthouse.child

object MessageFilter {
  private val UI_LABEL = Regex(
    "^(liked by|replying to|view (all|more|replies|\\d)|add a comment|original audio|suggested|sponsored|see translation|follow(ing)?\\b|reply\\b|share\\b|send message|message\\b|catch up with)" +
      "|\\b(ago|likes?|views?|comments?|replies|followers|following|reposts?|shares?)\\s*$" +
      "|^\\S+\\s+\\d+[smhdwy]\\s*$",
    RegexOption.IGNORE_CASE,
  )
  private val WORD = Regex("\\p{L}{2,}")

  fun looksLikeMessage(text: String): Boolean =
    text.length >= 12 && WORD.findAll(text).take(3).count() >= 3 && !UI_LABEL.containsMatchIn(text)
}
