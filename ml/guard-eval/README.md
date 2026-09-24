# guard-eval — validation spike

**Question:** does an off-the-shelf small guard model (Qwen3Guard-Gen-0.6B) beat our
hand-written keyword classifier ([apps/child/src/native/classify.ts](../../apps/child/src/native/classify.ts))
on realistic, messy, code-switched kid messages — *before* we invest in any on-device work?

This is a **Mac-only validation spike**. It does NOT touch the app, the `classify()` seam,
or any on-device integration. Quantization/ONNX and the cheap-phone (Tecno) benchmark are
explicitly out of scope and only happen if this spike says the model is worth it.

## What's here

| File | What |
|---|---|
| `taxonomy.md` | Our 8-category × 3-severity policy + the mapping from Qwen3Guard's native output to our `{category, severity}` contract, with honesty flags |
| `testset.jsonl` | 50 **hand-written** labeled messages: per-category positives, keyword-breaking hard negatives, plain-safe, heavy EN/Pidgin/Yorùbá/Hausa/Igbo code-switching |
| `keyword_baseline.py` | Faithful Python port of the TS keyword stub (same lexicon, word-boundary regexes, same precedence rules) |
| `qwen_guard.py` | Loads Qwen3Guard-Gen-0.6B on MPS; two prompting arms: **native** (official chat template, fixed taxonomy) and **custom-policy** (same prompt structure, our 8 categories) |
| `run_eval.py` | Runs all arms over the test set, computes metrics, writes `results/report.md` + `results/results.json` |

## Run it

```bash
cd ml/guard-eval
uv sync          # first time (downloads torch etc.)
uv run python run_eval.py            # full eval (downloads ~1.5 GB model on first run)
uv run python run_eval.py --keyword-only   # just the baseline, no model
```

Requires Apple Silicon (uses MPS) and ~2 GB free RAM for the model. First model run
downloads `Qwen/Qwen3Guard-Gen-0.6B` into the HF cache (`~/.cache/huggingface`).

## Monorepo note

`ml/` is intentionally **not** a yarn workspace (root `package.json` workspaces are
`apps/*`, `packages/*`, `tooling/*`) so nothing here is picked up by turbo/TS builds.
Python env is managed by **uv** (`pyproject.toml` + committed `uv.lock`); `.venv` is
git-ignored.
