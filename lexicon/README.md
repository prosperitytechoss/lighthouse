# Lighthouse Lexicon

The word list Lighthouse uses to spot risky messages on a child's phone. 11,901 phrases in five languages, each tagged with a category and a severity.

**Content warning:** this list contains slurs, sexual language, and references to self-harm and violence. That is its purpose.

## Files

| File | What it is |
|---|---|
| `lighthouse-lexicon.csv` | One row per phrase: `text, language, category, severity` |
| `lighthouse-lexicon.json` | The exact format the app loads, plus the matching rules in `context` |

Version 11, published 2026-10-06. The app's bundled copy is `apps/child/src/native/lexicon.json`.

## What's in it

| Language | Code | Phrases |
|---|---|---|
| Nigerian Pidgin | `pcm` | 6,181 |
| English | `en` | 2,950 |
| Igbo | `ig` | 982 |
| Hausa | `ha` | 953 |
| Yorùbá | `yo` | 835 |

| Category | Phrases |
|---|---|
| Sexual Content | 2,396 |
| Substance Use | 2,000 |
| Gambling | 1,986 |
| Violence | 1,634 |
| Self-Harm | 1,484 |
| Hate Speech | 1,113 |
| Eating Disorders | 651 |
| Graphic Content | 637 |

Severity: `high` 7,640 · `review` 3,729 · `low` 532.

## How it matches

- Whole words, in order. Case and punctuation are ignored. `kill me` matches "Kill me!" but not "skill meeting".
- Number for letter spellings match too: `k1ll me`.
- A negator just before a phrase cancels it: `not`, `don't`, `no dey` and others within 3 words.
- A soft self-harm idiom next to "lol" or a laughing emoji is dropped.
- `igbo` only counts as Substance Use next to drug words like `buy` or `smoke`.
- When several phrases match, the highest severity wins.

The full rules are in `context` in the JSON file.

## Where it came from

Written by the Lighthouse team, then expanded with Gemini. AI suggestions only go live after a person approves them. The list is checked against everyday Nigerian tweets ([NaijaSenti](https://huggingface.co/datasets/HausaNLP/NaijaSenti-Twitter)) so normal speech doesn't trigger it.

## Contributing

Add or fix phrases through the Lexicon Admin. See [CONTRIBUTING-LEXICON.md](../CONTRIBUTING-LEXICON.md).

## License

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Use it, change it, share it. Credit "Lighthouse Lexicon by Prosperity Tech".
