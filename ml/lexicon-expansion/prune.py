import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
audit = json.load(open(HERE / "audit_report.json"))
expansion = json.load(open(HERE / "expansion.json"))

KEEP = {
    "ashawo": None, "ashewo": None, "olosho": None, "karuwa": None, "konji": None, "dey knack": None,
    "colorado": None, "horny": None, "commit suicide": None, "kill yourself": None, "betway": None,
    "sugar daddy": None, "sugar mummy": None, "get drunk": None, "on drugs": None, "jungle justice": None,
    "omo ale": None, "kafiri": None, "arna": None, "arne": None, "ndi ofe mmanu": None, "jima i": None,
    "chop beating": None, "orgasm": None,
    "cash out": "low", "i don give up": "low", "hennessy": "low", "ogogoro": "low", "kai kai": "low", "cutlass": "low",
}
flagged = {(x["text"], x["language"], x["category"]): x["hits"] for x in audit["flagged"]}
kept, dropped, demoted = [], [], []
for t in expansion:
    key = (t["text"], t["language"], t["category"])
    hits = flagged.get(key, 0)
    single = len(t["text"].split()) == 1
    if hits >= 3 and t["text"] not in KEEP:
        dropped.append({**t, "hits": hits, "reason": "3+ hits on benign tweets"}); continue
    if hits >= 2 and t["severity"] == "low" and t["text"] not in KEEP:
        dropped.append({**t, "hits": hits, "reason": "low severity and 2 hits on benign tweets"}); continue
    if hits >= 1 and single and t["severity"] == "low" and t["text"] not in KEEP:
        dropped.append({**t, "hits": hits, "reason": "bare low severity word that fires on benign tweets"}); continue
    sev = KEEP.get(t["text"]) if t["text"] in KEEP else None
    if sev and sev != t["severity"]:
        demoted.append({**t, "hits": hits, "to": sev}); t = {**t, "severity": sev}
    kept.append(t)
json.dump(kept, open(HERE / "expansion.json", "w"), indent=1, ensure_ascii=False)
json.dump({"kept": len(kept), "dropped": dropped, "demoted": demoted}, open(HERE / "prune_report.json", "w"), indent=1, ensure_ascii=False)
print(f"kept {len(kept)} dropped {len(dropped)} demoted {len(demoted)}")
