package fund.fastforward.lighthouse.child

/**
 * Redacts personal identifiers from DEV-only capture logs. Page text is useful in
 * debug, but identifiers (emails) are more sensitive and must not sit in any log —
 * so we scrub them even in DEBUG. Release builds drop the logs entirely.
 */
object LogScrub {
  private val EMAIL = Regex("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}")

  fun scrub(text: String): String = text.replace(EMAIL, "[email]")
}
