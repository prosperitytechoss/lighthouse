import json
import random
import struct
from pathlib import Path

import numpy as np

from features import BUCKETS, CATEGORIES, SEVERITIES, featurize, to_csr
from model import QuantModel, quantize_head

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "apps/child/models/textmodel.bin"
MAGIC = b"LHTM"
VERSION = 1


def write_head(buf: bytearray, Wq: np.ndarray, scales: np.ndarray, b: np.ndarray):
    buf += np.asarray(scales, dtype="<f4").tobytes()
    buf += np.ascontiguousarray(Wq, dtype=np.int8).tobytes()
    buf += np.asarray(b, dtype="<f4").tobytes()


def main():
    m = np.load(HERE / "model.npz")
    cat = quantize_head(m["W_cat"], m["b_cat"])
    sev = quantize_head(m["W_sev"], m["b_sev"])

    buf = bytearray()
    buf += MAGIC
    buf += struct.pack("<HIBB", VERSION, BUCKETS, len(CATEGORIES), len(SEVERITIES))
    for name in CATEGORIES + SEVERITIES:
        enc = name.encode("utf-8")
        buf += struct.pack("<B", len(enc)) + enc
    write_head(buf, *cat)
    write_head(buf, *sev)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(bytes(buf))

    qm = QuantModel(cat, sev)
    rng = random.Random(42)
    rows = []
    for p in ("ml/guard-eval/testset.jsonl", "ml/guard-eval/testset_hard.jsonl"):
        rows += [json.loads(l)["text"] for l in (ROOT / p).read_text().splitlines() if l.strip()]
    train = [json.loads(l)["text"] for l in (HERE / "data/train.jsonl").read_text().splitlines() if l.strip()]
    benign = [json.loads(l)["text"] for l in (HERE / "data/benign_check.jsonl").read_text().splitlines() if l.strip()]
    rows += rng.sample(train, 90) + rng.sample(benign, 40)
    rows += ["", "   ", "😂😂😂", "İstanbul ΣΟΦΟΣ", "ẹ káàárọ̀ o, báwo ni", "p0rn l1nk s3nd", "a" * 400]
    rows = [t for t in rows if featurize(t)][:200]
    preds = qm.predict(to_csr(rows))
    fixture = [{"text": t, **p} for t, p in zip(rows, preds)]
    (HERE / "parity.json").write_text(json.dumps(fixture, ensure_ascii=False, indent=0))

    meta = {
        "magic": MAGIC.decode(),
        "version": VERSION,
        "buckets": BUCKETS,
        "categories": CATEGORIES,
        "severities": SEVERITIES,
        "maxCodepoints": 300,
        "charNgrams": [3, 4, 5],
        "hash": "fnv1a32 over utf8 bytes, prefix byte 1 word, 2 bigram, 3 char",
        "quant": "int8 per class scale, clip 99.95 pct",
        "C": {"category": float(m["C_cat"]), "severity": float(m["C_sev"])},
        "nullBelow": 0.5,
        "hybridThreshold": 0.85,
        "bytes": len(buf),
        "layout": "magic, u16 version, u32 buckets, u8 nClasses, u8 nSev, names (u8 len + utf8), per head: f32 scale[c], i8 w[buckets*c], f32 bias[c]",
    }
    (HERE / "model.meta.json").write_text(json.dumps(meta, indent=2))
    print(f"wrote {OUT} ({len(buf)} bytes), parity fixture {len(fixture)} rows")


if __name__ == "__main__":
    main()
