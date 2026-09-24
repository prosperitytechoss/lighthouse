# Lexicon expansion audit

Published as lexicon version 8 on 2026-09-04: 229 → 7866 live terms (7637 new, source `curated`, addedBy `expansion-v1`).

## Counts (base → merged)

| category | en | pidgin | yoruba | hausa | igbo | total |
|---|---|---|---|---|---|---|
| Self-Harm | 20 → 455 | 14 → 417 | 6 → 116 | 4 → 143 | 4 → 164 | 48 → 1295 |
| Eating Disorders | 18 → 233 | 4 → 147 | 1 → 51 | 0 → 51 | 0 → 48 | 23 → 530 |
| Sexual Content | 20 → 660 | 13 → 584 | 2 → 116 | 1 → 135 | 1 → 120 | 37 → 1615 |
| Violence | 19 → 342 | 10 → 453 | 5 → 104 | 4 → 108 | 3 → 104 | 41 → 1111 |
| Graphic Content | 10 → 232 | 2 → 163 | 0 → 49 | 0 → 55 | 0 → 50 | 12 → 549 |
| Substance Use | 16 → 307 | 9 → 246 | 1 → 72 | 2 → 94 | 1 → 96 | 29 → 815 |
| Hate Speech | 8 → 287 | 3 → 187 | 0 → 60 | 0 → 77 | 0 → 83 | 11 → 694 |
| Gambling | 13 → 353 | 14 → 514 | 1 → 107 | 0 → 145 | 0 → 146 | 28 → 1265 |

## Precision guard

Benign corpora: NaijaSenti tweets (hau, ibo, pcm, yor, 10k lines each) and DailyDialog English (10k lines), fetched from the Hugging Face datasets server and cached in `.cache/`.

Two passes:
1. `fp_audit.ts` dropped 16 terms that fired more than 2 times per 10k benign lines.
2. `prune.py` dropped 65 more (3+ hits, or low severity with 2+ hits, or a bare low severity word with any hit) and demoted 5 to low (i don give up, hennessy, kai kai, ogogoro, cutlass). A short keep list holds real slang that also shows up in adult tweets (ashawo, olosho, konji, dey knack, kafiri, omo ale, sugar daddy, commit suicide, kill yourself and a few more).

Flag rate on benign lines per 10k, base → merged:

| corpus | base | merged |
|---|---|---|
| naijasenti_pcm | 132 | 249 |
| naijasenti_hau | 23 | 73 |
| naijasenti_ibo | 18 | 67 |
| naijasenti_yor | 4 | 31 |
| dailydialog_en | 23 | 35 |

These tweets are adult Twitter, so a share of the hits are true positives (sex work slang, betting talk, drug names). Still, the merged lexicon flags roughly twice as often as the base on Pidgin tweets. Watch the wrong flag feedback from real devices and prune again.

## Guard eval with the merged lexicon (`eval_report.md`)

Combined n=70: accuracy 99 percent (was 94), positive detection 100 percent (was 91), hard negative pass 96 percent (unchanged, the one miss is the pre existing "blaze" idiom), SAFE false positives 3 percent (unchanged).

## Dropped terms

- `hw` (en, Eating Disorders, low): over per 10k limit, 13 hits
- `mallam` (en, Hate Speech, low): over per 10k limit, 28 hits
- `ofe mmanu` (en, Hate Speech, review): over per 10k limit, 13 hits
- `nigga` (en, Hate Speech, low): over per 10k limit, 32 hits
- `mumu` (en, Hate Speech, low): over per 10k limit, 62 hits
- `osu` (en, Hate Speech, low): over per 10k limit, 58 hits
- `loud` (en, Substance Use, low): over per 10k limit, 34 hits
- `weed` (en, Substance Use, review): over per 10k limit, 17 hits
- `ice` (en, Substance Use, low): over per 10k limit, 11 hits
- `drugs` (en, Substance Use, low): over per 10k limit, 13 hits
- `knack` (pidgin, Sexual Content, high): over per 10k limit, 16 hits
- `shege` (hausa, Hate Speech, low): over per 10k limit, 54 hits
- `fyade` (hausa, Violence, review): over per 10k limit, 13 hits
- `yan bindiga` (hausa, Violence, review): over per 10k limit, 15 hits
- `ikpu` (igbo, Sexual Content, high): over per 10k limit, 15 hits
- `akwuna` (igbo, Sexual Content, high): over per 10k limit, 20 hits
- `gw` (en, Eating Disorders, low): bare low severity word that fires on benign tweets, 1 hits
- `starve` (en, Eating Disorders, low): 3+ hits on benign tweets, 5 hits
- `starving` (en, Eating Disorders, low): 3+ hits on benign tweets, 4 hits
- `sw` (en, Eating Disorders, low): low severity and 2 hits on benign tweets, 2 hits
- `purge` (en, Eating Disorders, review): 3+ hits on benign tweets, 4 hits
- `i never chop since` (pidgin, Eating Disorders, review): 3+ hits on benign tweets, 3 hits
- `betting` (en, Gambling, low): 3+ hits on benign tweets, 8 hits
- `lotto` (en, Gambling, low): low severity and 2 hits on benign tweets, 2 hits
- `poker` (en, Gambling, low): bare low severity word that fires on benign tweets, 1 hits
- `caca` (hausa, Gambling, low): low severity and 2 hits on benign tweets, 2 hits
- `chaa chaa` (igbo, Gambling, low): 3+ hits on benign tweets, 4 hits
- `ogwu ego` (igbo, Graphic Content, review): 3+ hits on benign tweets, 3 hits
- `aboki` (en, Hate Speech, low): 3+ hits on benign tweets, 8 hits
- `afin` (en, Hate Speech, low): low severity and 2 hits on benign tweets, 2 hits
- `albino` (en, Hate Speech, low): bare low severity word that fires on benign tweets, 1 hits
- `homo` (en, Hate Speech, low): bare low severity word that fires on benign tweets, 1 hits
- `imbecile` (en, Hate Speech, low): bare low severity word that fires on benign tweets, 1 hits
- `witch` (en, Hate Speech, low): 3+ hits on benign tweets, 4 hits
- `adaba` (yoruba, Hate Speech, low): 3+ hits on benign tweets, 5 hits
- `ohu` (igbo, Hate Speech, low): 3+ hits on benign tweets, 6 hits
- `onye ocha` (igbo, Hate Speech, low): 3+ hits on benign tweets, 5 hits
- `depression` (en, Self-Harm, low): 3+ hits on benign tweets, 10 hits
- `so depressed` (en, Self-Harm, low): 3+ hits on benign tweets, 3 hits
- `na daina` (hausa, Self-Harm, low): low severity and 2 hits on benign tweets, 2 hits
- `suck my` (en, Sexual Content, high): 3+ hits on benign tweets, 3 hits
- `condom` (en, Sexual Content, review): 3+ hits on benign tweets, 5 hits
- `nipples` (en, Sexual Content, review): 3+ hits on benign tweets, 3 hits
- `bumbum` (pidgin, Sexual Content, low): 3+ hits on benign tweets, 3 hits
- `e dey sweet me` (pidgin, Sexual Content, low): 3+ hits on benign tweets, 10 hits
- `short time` (pidgin, Sexual Content, low): low severity and 2 hits on benign tweets, 2 hits
- `chop you` (pidgin, Sexual Content, review): 3+ hits on benign tweets, 6 hits
- `idi re` (yoruba, Sexual Content, low): low severity and 2 hits on benign tweets, 2 hits
- `oko mi` (yoruba, Sexual Content, low): 3+ hits on benign tweets, 3 hits
- `do mi` (yoruba, Sexual Content, review): 3+ hits on benign tweets, 4 hits
- `karuwai` (hausa, Sexual Content, high): 3+ hits on benign tweets, 3 hits
- `amu gi` (igbo, Sexual Content, high): 3+ hits on benign tweets, 3 hits
- `otu gi` (igbo, Sexual Content, high): 3+ hits on benign tweets, 4 hits
- `ike gi` (igbo, Sexual Content, low): 3+ hits on benign tweets, 9 hits
- `ara gi` (igbo, Sexual Content, review): 3+ hits on benign tweets, 5 hits
- `225` (en, Substance Use, low): bare low severity word that fires on benign tweets, 1 hits
- `arizona` (en, Substance Use, low): bare low severity word that fires on benign tweets, 1 hits
- `bars` (en, Substance Use, low): 3+ hits on benign tweets, 6 hits
- `crystal` (en, Substance Use, low): 3+ hits on benign tweets, 4 hits
- `lean` (en, Substance Use, low): 3+ hits on benign tweets, 6 hits
- `ref` (en, Substance Use, low): 3+ hits on benign tweets, 7 hits
- `shisha` (en, Substance Use, low): 3+ hits on benign tweets, 4 hits
- `kpuru` (en, Substance Use, review): 3+ hits on benign tweets, 7 hits
- `benson` (pidgin, Substance Use, low): 3+ hits on benign tweets, 3 hits
- `i dey trip` (pidgin, Substance Use, low): low severity and 2 hits on benign tweets, 2 hits
- `tabar wiwi` (hausa, Substance Use, high): 3+ hits on benign tweets, 3 hits
- `kwaya` (hausa, Substance Use, low): 3+ hits on benign tweets, 8 hits
- `dan kwaya` (hausa, Substance Use, review): 3+ hits on benign tweets, 3 hits
- `igbo di` (igbo, Substance Use, review): 3+ hits on benign tweets, 5 hits
- `agbero` (en, Violence, low): 3+ hits on benign tweets, 8 hits
- `bully` (en, Violence, low): 3+ hits on benign tweets, 3 hits
- `cult` (en, Violence, low): 3+ hits on benign tweets, 3 hits
- `yahoo boys` (en, Violence, low): 3+ hits on benign tweets, 4 hits
- `eiye` (en, Violence, review): 3+ hits on benign tweets, 6 hits
- `kidnappers` (en, Violence, review): 3+ hits on benign tweets, 6 hits
- `chop slap` (pidgin, Violence, low): low severity and 2 hits on benign tweets, 2 hits
- `i go show you` (pidgin, Violence, low): low severity and 2 hits on benign tweets, 2 hits
- `jew` (pidgin, Violence, low): 3+ hits on benign tweets, 4 hits
- `one chance` (pidgin, Violence, low): 3+ hits on benign tweets, 7 hits
- `ka mutu` (hausa, Violence, low): 3+ hits on benign tweets, 5 hits
- `yan daba` (hausa, Violence, review): 3+ hits on benign tweets, 3 hits

## Still needed

Native speaker review of every Yoruba, Hausa and Igbo entry. They were drafted from knowledge of slang, not verified with speakers.
