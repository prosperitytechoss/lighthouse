"""
Faithful Python port of the on-device keyword stub
(apps/child/src/native/classify.ts). Same lexicon, same word-boundary (\\b)
matching, same severity-then-category-order precedence. This is the baseline
the guard model has to beat.

Verified parity notes:
  - Python `re` \\b and JS RegExp \\b agree for this ASCII lexicon.
  - re.IGNORECASE mirrors the JS "i" flag.
  - Tie-break = higher severity wins; equal severity -> earlier CATEGORY_ORDER.
"""
import re

Classification = dict  # {"category": str, "severity": str} | None

LEXICON = {
    "Self-Harm": {
        "high": ["kill myself", "end my life", "suicide", "want to die", "cut myself", "self harm"],
        "review": ["hurt myself", "self-harm", "hopeless", "worthless", "no reason to live"],
        "low": ["depressed", "i hate myself", "give up"],
    },
    "Eating Disorders": {
        "high": ["pro ana", "pro mia", "starve myself", "purge after"],
        "review": ["thinspo", "skip meals", "feel fat", "calorie restrict"],
        "low": ["diet", "lose weight", "too fat"],
    },
    "Sexual Content": {
        "high": ["send nudes", "nudes", "nude", "naked", "explicit", "porn", "nsfw"],
        "review": ["sext", "hook up", "dtf"],
        "low": ["sexy", "hot pics"],
    },
    "Violence": {
        "high": ["kill you", "shoot up", "i will hurt", "beat you up", "gun"],
        "review": ["fight after school", "jump him", "threat"],
        "low": ["punch", "angry", "hate you"],
    },
    "Graphic Content": {
        "high": ["gore", "beheading", "graphic death"],
        "review": ["blood everywhere", "dead body"],
        "low": ["disturbing", "graphic"],
    },
    "Substance Use": {
        "high": ["buy weed", "selling drugs", "cocaine", "meth"],
        "review": ["get high", "vape pen", "molly"],
        "low": ["drunk", "beer", "smoke"],
    },
    "Hate Speech": {
        "high": ["go back to your country", "racial slur", "kill all"],
        "review": ["you people", "slur", "subhuman"],
        "low": ["stupid race", "hate group"],
    },
    "Gambling": {
        "high": ["bet your savings", "casino deposit", "place a bet"],
        "review": ["sports betting", "odds", "parlay"],
        "low": ["lottery", "scratch card"],
    },
}

SEVERITY_RANK = {"low": 1, "review": 2, "high": 3}
CATEGORY_ORDER = [
    "Self-Harm", "Eating Disorders", "Sexual Content", "Violence",
    "Graphic Content", "Substance Use", "Hate Speech", "Gambling",
]


def _word_regex(keyword: str) -> re.Pattern:
    escaped = re.escape(keyword)
    return re.compile(rf"\b{escaped}\b", re.IGNORECASE)


COMPILED = {
    cat: {sev: [_word_regex(k) for k in LEXICON[cat][sev]] for sev in ("high", "review", "low")}
    for cat in CATEGORY_ORDER
}


def classify(text: str):
    if not text:
        return None
    best = None
    for category in CATEGORY_ORDER:
        tiers = COMPILED[category]
        sev = None
        if any(r.search(text) for r in tiers["high"]):
            sev = "high"
        elif any(r.search(text) for r in tiers["review"]):
            sev = "review"
        elif any(r.search(text) for r in tiers["low"]):
            sev = "low"
        if not sev:
            continue
        if (
            best is None
            or SEVERITY_RANK[sev] > SEVERITY_RANK[best["severity"]]
            or (
                SEVERITY_RANK[sev] == SEVERITY_RANK[best["severity"]]
                and CATEGORY_ORDER.index(category) < CATEGORY_ORDER.index(best["category"])
            )
        ):
            best = {"category": category, "severity": sev}
    return best


if __name__ == "__main__":
    for t in ["I love popcorn", "send nudes", "this homework is killing me", "abeg who get igbo"]:
        print(f"{t!r:45} -> {classify(t)}")
