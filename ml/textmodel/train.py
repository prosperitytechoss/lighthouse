import json
import sys
import time
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

from features import BUCKETS, CATEGORIES, SEVERITIES, to_csr
from model import QuantModel, quantize_head

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
EVAL = ROOT / "ml/guard-eval"
HYBRID_THRESHOLD = 0.85
NULL_THRESHOLD = 0.5


def read_jsonl(p: Path):
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]


def class_weights(y: np.ndarray, n_classes: int, safe_boost: float) -> np.ndarray:
    counts = np.bincount(y, minlength=n_classes).astype(np.float64)
    w = np.sqrt(counts.sum() / (n_classes * np.maximum(counts, 1)))
    w[CATEGORIES.index("SAFE")] *= safe_boost
    return w


def fit(X, y, sample_weight, C: float):
    clf = LogisticRegression(C=C, solver="lbfgs", max_iter=400, tol=1e-4)
    clf.fit(X, y, sample_weight=sample_weight)
    return clf


def head_from(clf, n_classes: int):
    W = np.zeros((BUCKETS, n_classes), dtype=np.float64)
    b = np.zeros(n_classes, dtype=np.float64)
    for i, c in enumerate(clf.classes_):
        W[:, c] = clf.coef_[i]
        b[c] = clf.intercept_[i]
    return W, b


def decide(pred: dict, threshold: float):
    if pred["category"] == "SAFE" or pred["confidence"] < threshold:
        return None, None
    return pred["category"], pred["severity"]


def eval_rows(rows, preds, threshold: float):
    pos = [i for i, r in enumerate(rows) if r["category"]]
    safe = [i for i, r in enumerate(rows) if not r["category"]]
    hard = [i for i, r in enumerate(rows) if r["kind"] == "hard_negative"]
    cs = [i for i in pos if rows[i]["lang"] != "en"]
    dec = [decide(p, threshold) for p in preds]
    ok = lambda i: dec[i][0] == rows[i]["category"]
    frac = lambda idx, f: (sum(1 for i in idx if f(i)) / len(idx)) if idx else 0.0
    cat_ok = [i for i in pos if ok(i)]
    return {
        "n": len(rows),
        "overall": frac(range(len(rows)), ok),
        "safeFP": frac(safe, lambda i: dec[i][0] is not None),
        "hardPass": frac(hard, lambda i: dec[i][0] is None),
        "posDetect": frac(pos, lambda i: dec[i][0] is not None),
        "posCat": frac(pos, ok),
        "codeswitch": frac(cs, lambda i: dec[i][0] is not None),
        "sevExact": frac(cat_ok, lambda i: dec[i][1] == rows[i]["severity"]),
    }


def per_class(rows, preds, threshold: float):
    dec = [decide(p, threshold)[0] or "SAFE" for p in preds]
    gold = [r["category"] or "SAFE" for r in rows]
    out = {}
    for c in CATEGORIES:
        tp = sum(1 for g, d in zip(gold, dec) if g == c and d == c)
        fp = sum(1 for g, d in zip(gold, dec) if g != c and d == c)
        fn = sum(1 for g, d in zip(gold, dec) if g == c and d != c)
        out[c] = {
            "support": tp + fn,
            "precision": tp / (tp + fp) if tp + fp else None,
            "recall": tp / (tp + fn) if tp + fn else None,
        }
    return out


def pct(x):
    return "n/a" if x is None else f"{100 * x:.1f}%"


def main():
    t0 = time.time()
    report_only = "--report-only" in sys.argv
    data = read_jsonl(HERE / "data/train.jsonl")
    texts = [r["text"] for r in data]
    y_cat = np.array([CATEGORIES.index(r["category"] or "SAFE") for r in data])
    print(f"featurising {len(texts)} lines", file=sys.stderr)
    X = to_csr(texts)
    print(f"  nnz/row={X.nnz / X.shape[0]:.0f} in {time.time() - t0:.0f}s", file=sys.stderr)

    idx = np.arange(len(data))
    tr, va = train_test_split(idx, test_size=0.1, random_state=7, stratify=y_cat)
    w_cat = class_weights(y_cat, len(CATEGORIES), safe_boost=2.0)
    sw = w_cat[y_cat]

    best = None
    tuning = []
    for C in () if report_only else (2.0, 5.0, 10.0, 20.0):
        clf = fit(X[tr], y_cat[tr], sw[tr], C)
        p = clf.predict_proba(X[va])
        pred = clf.classes_[p.argmax(1)]
        acc = float((pred == y_cat[va]).mean())
        safe_i = CATEGORIES.index("SAFE")
        safe_mask = y_cat[va] == safe_i
        safe_rec = float((pred[safe_mask] == safe_i).mean())
        f1s = []
        for c in range(len(CATEGORIES)):
            tp = np.sum((pred == c) & (y_cat[va] == c))
            fp = np.sum((pred == c) & (y_cat[va] != c))
            fn = np.sum((pred != c) & (y_cat[va] == c))
            f1s.append(2 * tp / (2 * tp + fp + fn) if tp else 0.0)
        macro = float(np.mean(f1s))
        score = macro + safe_rec
        tuning.append({"C": C, "valAcc": acc, "macroF1": macro, "safeRecall": safe_rec})
        print(f"  C={C}: acc={acc:.4f} macroF1={macro:.4f} safeRecall={safe_rec:.4f}", file=sys.stderr)
        if best is None or score > best[0]:
            best = (score, C)
    saved = np.load(HERE / "model.npz") if report_only else None
    tuning = json.loads((HERE / "data/tuning.json").read_text()) if report_only else tuning
    C_cat = float(saved["C_cat"]) if report_only else best[1]
    if report_only:
        W_cat, b_cat = saved["W_cat"], saved["b_cat"]
    else:
        print(f"refit category head C={C_cat}", file=sys.stderr)
        cat_clf = fit(X, y_cat, sw, C_cat)
        W_cat, b_cat = head_from(cat_clf, len(CATEGORIES))

    pos = np.array([i for i, r in enumerate(data) if r["category"]])
    y_sev = np.array([SEVERITIES.index(data[i]["severity"]) for i in pos])
    counts = np.bincount(y_sev, minlength=3).astype(np.float64)
    w_sev = np.sqrt(counts.sum() / (3 * counts))
    sev_tr, sev_va = train_test_split(np.arange(len(pos)), test_size=0.1, random_state=7, stratify=y_sev)
    best_s = None
    for C in () if report_only else (2.0, 5.0, 10.0):
        clf = fit(X[pos[sev_tr]], y_sev[sev_tr], w_sev[y_sev[sev_tr]], C)
        acc = float((clf.predict(X[pos[sev_va]]) == y_sev[sev_va]).mean())
        print(f"  sev C={C}: acc={acc:.4f}", file=sys.stderr)
        if best_s is None or acc > best_s[0]:
            best_s = (acc, C)
    if report_only:
        C_sev = float(saved["C_sev"])
        W_sev, b_sev = saved["W_sev"], saved["b_sev"]
        best_s = (float(saved["sev_val_acc"]), C_sev)
    else:
        C_sev = best_s[1]
        sev_clf = fit(X[pos], y_sev, w_sev[y_sev], C_sev)
        W_sev, b_sev = head_from(sev_clf, 3)
        np.savez_compressed(HERE / "model.npz", W_cat=W_cat, b_cat=b_cat, W_sev=W_sev, b_sev=b_sev, C_cat=C_cat, C_sev=C_sev, sev_val_acc=best_s[0])
        (HERE / "data/tuning.json").write_text(json.dumps(tuning))

    qm = QuantModel(quantize_head(W_cat, b_cat), quantize_head(W_sev, b_sev))
    fm = QuantModel.__new__(QuantModel)
    fm.cat_W, fm.cat_b, fm.sev_W, fm.sev_b = W_cat.astype(np.float32), b_cat.astype(np.float32), W_sev.astype(np.float32), b_sev.astype(np.float32)

    val_pred_f = np.array([CATEGORIES.index(p["category"]) for p in fm.predict(X[va])])
    val_pred_q = np.array([CATEGORIES.index(p["category"]) for p in qm.predict(X[va])])
    val_acc_f = float((val_pred_f == y_cat[va]).mean())
    val_acc_q = float((val_pred_q == y_cat[va]).mean())
    val_agree = float((val_pred_f == val_pred_q).mean())

    orig = read_jsonl(EVAL / "testset.jsonl")
    hard = read_jsonl(EVAL / "testset_hard.jsonl")
    both = orig + hard
    Xe = to_csr([r["text"] for r in both])
    pe = qm.predict(Xe)
    pe_o, pe_h = pe[: len(orig)], pe[len(orig) :]

    benign = read_jsonl(HERE / "data/benign_check.jsonl")
    Xb = to_csr([r["text"] for r in benign])
    pb = qm.predict(Xb)
    fp_rows = {"ng": [], "en": []}
    for r, p in zip(benign, pb):
        if decide(p, HYBRID_THRESHOLD)[0]:
            fp_rows[r["lang"]].append((r["text"], p))
    n_ng = sum(1 for r in benign if r["lang"] == "ng")
    n_en = len(benign) - n_ng
    fp05 = {
        "ng": sum(1 for r, p in zip(benign, pb) if r["lang"] == "ng" and decide(p, NULL_THRESHOLD)[0]),
        "en": sum(1 for r, p in zip(benign, pb) if r["lang"] == "en" and decide(p, NULL_THRESHOLD)[0]),
    }

    stats = json.loads((HERE / "data/stats.json").read_text())
    lines = []
    lines.append("# Text model report\n")
    lines.append("Tier 2 hashed char n-gram logistic regression. Sits behind the lexicon. Lexicon hit wins.\n")
    lines.append("## Data\n")
    lines.append(f"Training lines: {stats['total']}. Held out: ml/guard-eval testset.jsonl + testset_hard.jsonl (never trained on).\n")
    lines.append("| class | lines |\n|---|---|")
    for c in CATEGORIES:
        lines.append(f"| {c} | {stats['byCategory'].get(c, 0)} |")
    lines.append("")
    lines.append("| source | lines |\n|---|---|")
    for k, v in stats["bySource"].items():
        lines.append(f"| {k} | {v} |")
    lines.append("")
    lines.append(f"Severity (positives): {stats['bySeverity']}\n")
    lines.append("## Training\n")
    lines.append(f"Features: {BUCKETS} buckets, char 3..5 grams over the space padded token string, word unigrams and bigrams, FNV-1a, l2 normalised counts. Mean nnz per line {X.nnz / X.shape[0]:.0f}.\n")
    lines.append("| C | val acc | macro F1 | SAFE recall |\n|---|---|---|---|")
    for t in tuning:
        lines.append(f"| {t['C']} | {pct(t['valAcc'])} | {pct(t['macroF1'])} | {pct(t['safeRecall'])} |")
    lines.append(f"\nChosen C: category {C_cat}, severity {C_sev}. Severity head val acc {pct(best_s[0])}.\n")
    lines.append(f"Quantisation (int8, per class scale, clip at 99.95th pct), measured on the val split after the refit on all data: acc float {pct(val_acc_f)} vs int8 {pct(val_acc_q)}, argmax agreement {pct(val_agree)}.\n")
    lines.append("## Held out eval (model alone)\n")
    lines.append(f"Null when SAFE is argmax or confidence < {NULL_THRESHOLD}. Second block uses the hybrid threshold {HYBRID_THRESHOLD}.\n")
    for thr in (NULL_THRESHOLD, HYBRID_THRESHOLD):
        lines.append(f"### threshold {thr}\n")
        lines.append("| metric | testset (n=52) | hard (n=18) | combined (n=70) |\n|---|---|---|---|")
        mo, mh, mb = eval_rows(orig, pe_o, thr), eval_rows(hard, pe_h, thr), eval_rows(both, pe, thr)
        for key, label in [
            ("overall", "overall accuracy"),
            ("safeFP", "SAFE false positive rate"),
            ("hardPass", "hard negative pass rate"),
            ("posDetect", "positive detection"),
            ("posCat", "positive category accuracy"),
            ("codeswitch", "code switched detection"),
            ("sevExact", "severity exact match"),
        ]:
            lines.append(f"| {label} | {pct(mo[key])} | {pct(mh[key])} | {pct(mb[key])} |")
        lines.append("")
    lines.append(f"### per class (combined, threshold {HYBRID_THRESHOLD})\n")
    lines.append("| class | support | precision | recall |\n|---|---|---|---|")
    for c, m in per_class(both, pe, HYBRID_THRESHOLD).items():
        lines.append(f"| {c} | {m['support']} | {pct(m['precision'])} | {pct(m['recall'])} |")
    lines.append("")
    lines.append("## Benign false positive check\n")
    lines.append(f"NaijaSenti test split (pcm, hau, yor, ibo): {n_ng} lines. English benign (Reddit non suicide + not_cyberbullying tweets, disjoint from training): {n_en} lines.\n")
    lines.append("| corpus | FP at 0.85 | rate | FP at 0.5 | rate |\n|---|---|---|---|---|")
    lines.append(f"| NaijaSenti | {len(fp_rows['ng'])} | {pct(len(fp_rows['ng']) / n_ng)} | {fp05['ng']} | {pct(fp05['ng'] / n_ng)} |")
    lines.append(f"| English benign | {len(fp_rows['en'])} | {pct(len(fp_rows['en']) / n_en)} | {fp05['en']} | {pct(fp05['en'] / n_en)} |")
    lines.append("")
    lines.append("Threshold sweep (model alone):\n")
    lines.append("| threshold | held out positive detection | held out SAFE FP | NaijaSenti FP | English benign FP |\n|---|---|---|---|---|")
    for thr in (0.7, 0.8, 0.85, 0.9, 0.95):
        mb = eval_rows(both, pe, thr)
        ng = sum(1 for r, p in zip(benign, pb) if r["lang"] == "ng" and decide(p, thr)[0])
        en = sum(1 for r, p in zip(benign, pb) if r["lang"] == "en" and decide(p, thr)[0])
        lines.append(f"| {thr} | {pct(mb['posDetect'])} | {pct(mb['safeFP'])} | {pct(ng / n_ng)} | {pct(en / n_en)} |")
    lines.append("")
    lines.append("Sample false positives at 0.85:\n")
    for lang in ("ng", "en"):
        for t, p in fp_rows[lang][:8]:
            lines.append(f"- [{lang}] {t[:120]} -> {p['category']}/{p['severity']} {p['confidence']:.2f}")
    lines.append("")
    ts_out = HERE / "data/eval_ts.txt"
    if ts_out.exists():
        lines.append("## TS mirror, parity and hybrid (ml/textmodel/eval_ts.ts)\n")
        lines.append("```\n" + ts_out.read_text().strip() + "\n```\n")
    lines.append("## Per message (held out)\n")
    lines.append("| id | lang | message | expected | model |\n|---|---|---|---|---|")
    for r, p in zip(both, pe):
        exp = f"{r['category']}/{r['severity']}" if r["category"] else "SAFE"
        c, s = decide(p, HYBRID_THRESHOLD)
        got = f"{c}/{s} {p['confidence']:.2f}" if c else f"SAFE ({p['category']} {p['confidence']:.2f})"
        mark = "ok" if c == r["category"] else "MISS"
        lines.append(f"| {r['id']} | {r['lang']} | {r['text'].replace('|', ' ')} | {exp} | {got} {mark} |")
    lines.append("")
    (HERE / "REPORT.md").write_text("\n".join(lines))
    fp_dump = {lang: [{"text": t, **p} for t, p in rows] for lang, rows in fp_rows.items()}
    (HERE / "data/benign_fp.json").write_text(json.dumps(fp_dump, indent=1, ensure_ascii=False))
    print("\n".join(lines[: lines.index("## Per message (held out)\n")]))
    print(f"done in {time.time() - t0:.0f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
