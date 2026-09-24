# Lighthouse content taxonomy (the policy we feed the model)

The classify() contract on-device is `text → { category, severity } | null`.
`null` means SAFE — nothing leaves the phone.

## Categories (8)

| Category | Definition (what counts) | Does NOT count |
|---|---|---|
| **Self-Harm** | Expressions of wanting to die, suicide ideation, cutting/self-injury, hopelessness directed at self | Recovery/support talk, idioms ("this homework is killing me"), grief discussion |
| **Eating Disorders** | Pro-ana/pro-mia content, thinspo, deliberate starvation/purging, food restriction framed as self-punishment | Ordinary fitness, dieting on advice, sports weight goals |
| **Sexual Content** | Explicit sexual text, requests for nudes, sextortion, porn links/refs, sexual propositions to/from a minor | Health/biology class content, non-sexual affection |
| **Violence** | Threats to hurt/kill, weapon talk with intent, planning fights/attacks | Sports metaphors ("killed it"), news/history discussion, gaming banter without a real-world target |
| **Graphic Content** | Gore, beheading/graphic-death media, shock content shared for effect | Fictional/movie references without shock imagery, news headlines |
| **Substance Use** | Buying/selling drugs, plans to get high/drunk, vaping/drug solicitation | Mentions of adults' legal drinking, news about seizures, generator smoke etc. |
| **Hate Speech** | Slurs, dehumanizing groups ("subhuman", "kill all X"), telling someone to "go back to their country" | Discussing racism critically, history class |
| **Gambling** | Betting/staking money (bet9ja/sporty etc.), parlays, casino deposits, urging others to bet | Figurative "lottery of life", raffle at school fair |

## Severity (3 + none)

| Severity | Meaning | Examples |
|---|---|---|
| **high** | Immediate danger, explicit content, or active solicitation — alert-worthy on its own | "I want to die tonight", "send nudes", "I fit buy weed give you" |
| **review** | Concerning pattern worth a parent's attention, not an emergency | "I feel worthless", "drop your parlay", "we jump am after school" |
| **low** | Mild/ambiguous brush with the category | "I'm so fat", "lottery", "drunk" mentions |
| **none / SAFE** | Everything else — the overwhelming majority of a kid's messages | greetings, homework, food, football |

## Mapping Qwen3Guard-Gen output → our contract

Qwen3Guard-Gen-0.6B outputs (fixed format, from its chat template):

```
Safety: Safe | Controversial | Unsafe
Categories: <from its FIXED list> | None
```

Its fixed list: Violent, Non-violent Illegal Acts, Sexual Content or Sexual Acts, PII,
Suicide & Self-Harm, Unethical Acts, Politically Sensitive Topics, Copyright Violation, Jailbreak.

### Severity mapping (both arms)

| Qwen `Safety` | Our severity |
|---|---|
| Unsafe | **high** |
| Controversial | **review** |
| Safe | **none** (SAFE) |

> **Honesty flag #1 — no `low`.** The model has no third flagged tier, so our `low`
> severity is unrepresentable: any expected-`low` item can at best score `review`.
> We report severity agreement separately from category accuracy because of this.
> If the model wins the spike, `low` would be derived later (e.g. token-prob of the
> Safety label, or collapsing low→review in the product contract).

### Category mapping — native arm

| Qwen native category | Our category |
|---|---|
| Violent | Violence |
| Sexual Content or Sexual Acts | Sexual Content |
| Suicide & Self-Harm | Self-Harm |
| Non-violent Illegal Acts | Substance Use **or** Gambling (credited if expected is either) |
| Unethical Acts | Hate Speech (loose — see flag) |
| PII / Politically Sensitive / Copyright / Jailbreak / None | no mapping (scored as miss if something was expected) |

> **Honesty flag #2 — native taxonomy gaps.** Eating Disorders and Graphic Content have
> NO native Qwen category at all, and Hate Speech only loosely lands in "Unethical Acts".
> The native arm *cannot* get these fully right; that's exactly why the eval also runs a
> **custom-policy arm**: same prompt scaffold, but the category list swapped for OUR 8
> definitions above. The model card does not officially support custom policies —
> whether the 0.6B obeys is one of the questions this spike answers empirically.

> **Honesty flag #3 — keyword baseline port.** The Python baseline is a line-by-line
> port of the TS stub (same lexicon, `\b` word-boundary regexes, same
> severity-then-category-order precedence). Python and JS `\b` semantics match for
> this ASCII lexicon, so behavior is faithful.
