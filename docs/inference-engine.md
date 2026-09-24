# Inference engine overview

Everything that decides "is this risky" runs on the child's phone. The server never sees content, only categories.

```
notification text ─┐
on screen text ────┼─> LighthouseClassifier
screen frame ──OCR─┘      ├─ tier 1: rules over the published lexicon (exact phrases, negation, sarcasm, ambiguity gates)
                          └─ tier 2: hashed char n-gram linear model, only when tier 1 is silent, flag only, never blocks
screen frame ──> NSFW image model (MobileNetV4 small, ONNX Runtime) ─> Sexual Content
                          └─> {category, severity, app, time, channel} ─> encrypted signal ─> parent email
```

| Piece | Where | Size | Speed (Mac, reference) |
|---|---|---|---|
| Lexicon rules | `LighthouseClassifier.kt`, `classify.ts` | lexicon JSON, versioned, synced from admin | microseconds |
| Text model | `TextModel.kt`, `textmodel.ts`, `models/textmodel.bin` | 1.5 MB, 131072 hashed buckets, int8 | 0.009 ms per message in Node |
| OCR | ML Kit text recognition (bundled) | about 4 MB in the APK | tens to hundreds of ms per frame on a phone |
| Image model | `NsfwClassifier.kt`, `models/nsfw.onnx` | 10 MB | 1.5 ms per 224 crop on the Mac |

Channels on a signal: `text` (accessibility tree), `notification`, `ocr` (text found in a frame), `image` (image model). The admin overview counts signals by channel.

## Data loop

- Lexicon: admin edits or approves terms, publishes a version, phones pull it on the next heartbeat. See `CONTRIBUTING-LEXICON.md`. The expansion in `ml/lexicon-expansion/` took the lexicon from 229 terms to 7,866 (published v8) with a false positive audit over benign Nigerian tweets; see `ml/lexicon-expansion/audit.md`.
- Dataset: a scheduled harvest job (`apps/api/src/lib/harvest.ts`, every `HARVEST_INTERVAL_MINUTES`) pulls labelled rows from public Hugging Face datasets and Gemini synthetic kid messages into `dataset_examples`, always as candidates. Admins approve or reject in the Dataset tab; approved `eval` rows feed the eval scoreboard, approved `train` rows feed the text model.
- Model: `ml/textmodel/` trains and exports the tier 2 model (25k training lines from templates plus public datasets; held out 88.6 percent accuracy, 0 percent SAFE false positives at the 0.9 fallback threshold; benign false positive rate 0.4 percent on NaijaSenti and 1.9 percent on English Reddit and tweets, mostly borderline self harm text). The fallback only fires when the lexicon is silent, caps severity at review, and never blocks. Retrain after approving more examples, copy the new `textmodel.bin`, ship with the next child build.

## Vision

See `docs/vision-engine.md` for cadence tiers (15 s / 30 s / 60 s), gating, and the decision rule.
