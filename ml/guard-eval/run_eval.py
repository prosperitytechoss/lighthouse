"""
Keyword-baseline eval harness over the hand-written test set.

History: this spike also compared Qwen3Guard-Gen-0.6B (native + custom-policy
arms). That model LOST to the keyword stub and did not solve code-switching (see
FINDINGS.md), so the model runner + weights were removed. What survives here is
the harness, the labelled test set, and the keyword baseline. The *current*
head-to-head that matters — OLD keyword stub vs the NEW rules classifier — lives
in ts/score_rules.ts (see RULES_FINDINGS.md).

  uv run python run_eval.py
"""
import json
from pathlib import Path

import keyword_baseline as kw

HERE = Path(__file__).parent
RESULTS = HERE / "results"
RESULTS.mkdir(exist_ok=True)


def load(name):
    return [json.loads(l) for l in (HERE / name).read_text().splitlines() if l.strip()]


def category_match(expected, predicted):
    return (predicted is None) if expected is None else (predicted == expected)


def metrics(items, preds):
    pos = [i for i in items if i["category"] is not None]
    safe = [i for i in items if i["category"] is None]
    hard = [i for i in items if i["kind"] == "hard_negative"]
    cs = [i for i in pos if i["lang"] != "en"]
    g = lambda i: preds[i["id"]]
    frac = lambda a, ok: (sum(1 for i in a if ok(i)) / len(a)) if a else 0.0
    return {
        "overall_accuracy": frac(items, lambda i: category_match(i["category"], g(i)["category"])),
        "safe_false_positive_rate": frac(safe, lambda i: g(i)["category"] is not None),
        "hard_negative_pass_rate": frac(hard, lambda i: g(i)["category"] is None),
        "positive_category_accuracy": frac(pos, lambda i: category_match(i["category"], g(i)["category"])),
        "codeswitch_detection_rate": frac(cs, lambda i: g(i)["category"] is not None),
        "n": len(items),
    }


def main():
    items = load("testset.jsonl")
    preds = {i["id"]: (kw.classify(i["text"]) or {"category": None, "severity": None}) for i in items}
    m = metrics(items, preds)
    (RESULTS / "keyword_baseline.json").write_text(json.dumps(m, indent=2))
    print(f"keyword baseline over {m['n']} messages:")
    for k, v in m.items():
        if k != "n":
            print(f"  {k:32} {v:.0%}")
    print(f"\nwrote {RESULTS/'keyword_baseline.json'}")
    print("(NEW rules classifier vs this stub: npx tsx ts/score_rules.ts)")


if __name__ == "__main__":
    main()
