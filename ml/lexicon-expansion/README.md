# Lexicon expansion v1

Grows the on device lexicon from 229 to 2500+ terms across 8 categories x 5 languages (en, pidgin, yoruba, hausa, igbo) with a precision guard.

## Files

- `seed/*.json` hand authored terms, one file per category. Each entry is `{text, language, category, severity, note}`. Lowercase, no diacritics, typed the way kids type.
- `variants.ts` spelling variants for English and Pidgin high/review multi word terms (misspellings, u/ur/2/4 swaps, Pidgin tense swaps, a few dropped vowels, doubled last letter on a short allowlist). Writes `variants.json`. Suffix variants like "i wan die o" are not generated because the classifier matches token sequences and the base phrase already covers them.
- `fp_audit.ts` the precision guard. Merges seeds + variants + the current `apps/child/src/native/lexicon.json`, dedupes, fetches benign corpora from the Hugging Face datasets server (NaijaSenti hau/ibo/pcm/yor tweets, DailyDialog English utterances, 10k lines each, cached in `.cache/`), counts hits per term with the same tokenizer, l33t and negation rules as `classify.ts`, and drops any new term firing more than 2 times per 10k benign lines unless it is listed in `keep_overrides.json`. Writes `expansion.json` and `audit_report.json`.
- `keep_overrides.json` `{ "term": "reason" }` for over limit terms that were inspected and found to be real hits, not false positives.
- `eval_merged.ts` runs `ml/guard-eval/ts/score_rules.ts` with the merged lexicon active and writes `eval_report.md` (the guard eval results file is restored afterwards).
- `expansion.json` the audited flat list that gets imported.
- `audit.md` counts before and after, dropped terms with reasons, eval scoreboard.

## Rerun

From the repo root, after `yarn install`:

```
npx tsx ml/lexicon-expansion/variants.ts
npx tsx ml/lexicon-expansion/fp_audit.ts          # add --offline to reuse .cache only
npx tsx ml/lexicon-expansion/eval_merged.ts
```

Then import and publish from `apps/api` (needs `curated` in the `lexicon_source` enum, migration applied):

```
yarn db:import-lexicon      # idempotent, inserts new rows as live/curated/expansion-v1 then publishes
yarn db:export-lexicon      # refreshes apps/child/src/native/lexicon.json from the published snapshot
```

`db:import-lexicon` skips publishing when nothing new was inserted. Pass `--publish` to force a new version.

## Editing

Edit `seed/*.json`, rerun the three scripts, check `audit.md` and `eval_report.md`, then import. Non English lists were drafted without native speaker review and need one before anyone relies on them.
