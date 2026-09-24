# Text model report

Tier 2 hashed char n-gram logistic regression. Sits behind the lexicon. Lexicon hit wins.

## Data

Training lines: 25216. Held out: ml/guard-eval testset.jsonl + testset_hard.jsonl (never trained on).

| class | lines |
|---|---|
| Self-Harm | 3477 |
| Eating Disorders | 1217 |
| Sexual Content | 2163 |
| Violence | 1659 |
| Graphic Content | 954 |
| Substance Use | 1872 |
| Hate Speech | 2907 |
| Gambling | 1384 |
| SAFE | 9583 |

| source | lines |
|---|---|
| hf:cyberbullying / Hate Speech | 1500 |
| hf:cyberbullying / SAFE | 1498 |
| hf:hausahate / Hate Speech | 452 |
| hf:hausahate / SAFE | 342 |
| hf:naijasenti / SAFE | 2400 |
| hf:sexting / Sexual Content | 396 |
| hf:suicide / SAFE | 1500 |
| hf:suicide / Self-Harm | 1500 |
| template / Eating Disorders | 1153 |
| template / Gambling | 1318 |
| template / Graphic Content | 902 |
| template / Hate Speech | 906 |
| template / SAFE | 3693 |
| template / Self-Harm | 1903 |
| template / Sexual Content | 1676 |
| template / Substance Use | 1463 |
| template / Violence | 1578 |
| template_drug / SAFE | 150 |
| template_drug / Substance Use | 320 |
| template_l33t / Eating Disorders | 64 |
| template_l33t / Gambling | 66 |
| template_l33t / Graphic Content | 52 |
| template_l33t / Hate Speech | 49 |
| template_l33t / Self-Harm | 74 |
| template_l33t / Sexual Content | 91 |
| template_l33t / Substance Use | 89 |
| template_l33t / Violence | 81 |

Severity (positives): {'low': 1298, 'high': 7408, 'review': 6927}

## Training

Features: 131072 buckets, char 3..5 grams over the space padded token string, word unigrams and bigrams, FNV-1a, l2 normalised counts. Mean nnz per line 195.

| C | val acc | macro F1 | SAFE recall |
|---|---|---|---|
| 2.0 | 93.0% | 95.3% | 94.9% |
| 5.0 | 93.7% | 95.8% | 94.8% |
| 10.0 | 94.1% | 96.1% | 95.4% |
| 20.0 | 94.2% | 96.2% | 95.6% |

Chosen C: category 20.0, severity 5.0. Severity head val acc 98.7%.

Quantisation (int8, per class scale, clip at 99.95th pct), measured on the val split after the refit on all data: acc float 100.0% vs int8 100.0%, argmax agreement 100.0%.

## Held out eval (model alone)

Null when SAFE is argmax or confidence < 0.5. Second block uses the hybrid threshold 0.85.

### threshold 0.5

| metric | testset (n=52) | hard (n=18) | combined (n=70) |
|---|---|---|---|
| overall accuracy | 92.3% | 77.8% | 88.6% |
| SAFE false positive rate | 0.0% | 22.2% | 5.6% |
| hard negative pass rate | 100.0% | 77.8% | 92.0% |
| positive detection | 88.0% | 77.8% | 85.3% |
| positive category accuracy | 84.0% | 77.8% | 82.4% |
| code switched detection | 90.0% | 71.4% | 82.4% |
| severity exact match | 90.5% | 85.7% | 89.3% |

### threshold 0.85

| metric | testset (n=52) | hard (n=18) | combined (n=70) |
|---|---|---|---|
| overall accuracy | 90.4% | 83.3% | 88.6% |
| SAFE false positive rate | 0.0% | 0.0% | 0.0% |
| hard negative pass rate | 100.0% | 100.0% | 100.0% |
| positive detection | 80.0% | 66.7% | 76.5% |
| positive category accuracy | 80.0% | 66.7% | 76.5% |
| code switched detection | 90.0% | 71.4% | 82.4% |
| severity exact match | 90.0% | 83.3% | 88.5% |

### per class (combined, threshold 0.85)

| class | support | precision | recall |
|---|---|---|---|
| Self-Harm | 6 | 100.0% | 66.7% |
| Eating Disorders | 3 | 100.0% | 66.7% |
| Sexual Content | 6 | 100.0% | 66.7% |
| Violence | 6 | 100.0% | 66.7% |
| Graphic Content | 2 | 100.0% | 100.0% |
| Substance Use | 4 | 100.0% | 100.0% |
| Hate Speech | 2 | 100.0% | 100.0% |
| Gambling | 5 | 100.0% | 80.0% |
| SAFE | 36 | 81.8% | 100.0% |

## Benign false positive check

NaijaSenti test split (pcm, hau, yor, ibo): 3000 lines. English benign (Reddit non suicide + not_cyberbullying tweets, disjoint from training): 2999 lines.

| corpus | FP at 0.85 | rate | FP at 0.5 | rate |
|---|---|---|---|---|
| NaijaSenti | 11 | 0.4% | 96 | 3.2% |
| English benign | 79 | 2.6% | 290 | 9.7% |

Threshold sweep (model alone):

| threshold | held out positive detection | held out SAFE FP | NaijaSenti FP | English benign FP |
|---|---|---|---|---|
| 0.7 | 82.4% | 0.0% | 1.0% | 4.9% |
| 0.8 | 76.5% | 0.0% | 0.5% | 3.4% |
| 0.85 | 76.5% | 0.0% | 0.4% | 2.6% |
| 0.9 | 76.5% | 0.0% | 0.2% | 1.9% |
| 0.95 | 67.6% | 0.0% | 0.1% | 1.2% |

Sample false positives at 0.85:

- [ng] see montero don win set for cash out odds -> Gambling/review 0.88
- [ng] wannan abun ya wuce siyasa innal muslimu akkul muslimumusulmi dan uwan musulmine dan allah mudinga sashi a addua allah y -> Hate Speech/review 0.97
- [ng] an xo wurin allah ya sa irin wanda xaa musu ne xaa ma sauran mabukata alluran amma mu kam a kai kasuwa -> Hate Speech/review 0.89
- [ng] haba kaima kada kadamu kanka akan wanandaukakace ba abin da baxakaji basai dai ka tushe kunanka kawai one luv bro -> Hate Speech/review 0.88
- [ng] masha allah duk irin yan iskan nan muna bukatar adinga yanke masu hukunci ko mun samu sauki kasar nan -> Hate Speech/review 0.93
- [ng] nikam burina shine na samu rayuwa mai albarka dan rayuwa mai albarka ya hada auren mota gida makkah kai hadda madina ma  -> Hate Speech/review 0.95
- [ng] farin tsoho mai farar zuciya mai farar aniya mai farin alkhairi mu zamfarawa bamu taba mantawa dakai baba allah ya biyak -> Hate Speech/review 0.94
- [ng] and co not only rahma and hadiza gabon or nafisa abdullahi the rest of you girls all allah ya shirye ku ku tuba muma kum -> Hate Speech/review 0.86
- [en] I will unmow your lawn All your hardwork, UNDONE! -> Sexual Content/high 0.88
- [en] I’m about to throw my vape away It makes me feel sick but something just makes me still want it. So I’m getting rid of i -> Self-Harm/high 0.89
- [en] lowkey wanna kill myself wont do it doe at first, I think quarantine life would be easy, but when online classes and ass -> Self-Harm/high 0.93
- [en] Looking for friends(15M) I am feeling very low and need someone to talk to, such situations have happened before and tho -> Self-Harm/high 0.91
- [en] Goodbye Reddit. Goodbye teenagers. No, this isn't a suicide post. I've found that reddit distracts me from my work. I've -> Self-Harm/high 0.95
- [en] What happens if I text a suicide hotline? I’m very shy and I don’t know...what if they call the police on me? Or end up  -> Self-Harm/high 0.96
- [en] I really fucking hate myself. I know that I won't kill myself cuz I'm too fucking weak but I think about how great it wo -> Self-Harm/high 1.00
- [en] Is there a legal way to turn yourself off? I am i able to go up to the government or whatever and say "i no longer wish  -> Self-Harm/high 0.98

## TS mirror, parity and hybrid (ml/textmodel/eval_ts.ts)

```
parity: 200 rows, argmax mismatches 0, severity mismatches 0, confidence > 1e-3 0, max delta 5.15e-7
lexicon only: acc=94.3% safeFP=2.8% hardPass=96.0% posDetect=91.2% posCat=91.2% codeswitch=88.2%
model only (0.85): acc=88.6% safeFP=0.0% hardPass=100.0% posDetect=76.5% posCat=76.5% codeswitch=82.4%
hybrid: acc=94.3% safeFP=2.8% hardPass=96.0% posDetect=91.2% posCat=91.2% codeswitch=88.2%
hybrid: 0 rows decided by the model:
ts latency: 0.011 ms per message
kotlin parity (kotlinc 2.1, JVM 17, android Context stubbed): 200 rows, mismatches 0, max conf delta 4.81e-07
kotlin latency: 2.5 us per message (JVM warm; expect well under 1 ms on a low end phone)
missing or corrupt asset: TextModel.load returns false, predict returns null
```

## Per message (held out)

| id | lang | message | expected | model |
|---|---|---|---|---|
| 1 | en | I don't want to be here anymore, I want to die tonight | Self-Harm/high | Self-Harm/high 1.00 ok |
| 2 | pcm | I no wan dey alive again, everything don tire me | Self-Harm/high | Self-Harm/high 1.00 ok |
| 3 | en | honestly I feel so worthless lately, no reason to try | Self-Harm/review | Self-Harm/review 1.00 ok |
| 4 | en | ugh I hate myself sometimes lol | Self-Harm/low | SAFE (Self-Harm 0.76) MISS |
| 5 | en | send me your nudes rn 😏 | Sexual Content/high | Sexual Content/high 1.00 ok |
| 6 | pcm | baby send me your body pics na, no dey form | Sexual Content/high | Sexual Content/high 0.99 ok |
| 7 | en | wanna hook up later? my parents are out | Sexual Content/review | SAFE (SAFE 0.62) MISS |
| 8 | en | you look kinda sexy in that pic ngl | Sexual Content/low | Sexual Content/low 0.99 ok |
| 9 | en | I'm gonna beat you up after school, watch | Violence/high | Violence/high 0.99 ok |
| 10 | yo-en | ma lu e ni school tomorrow, you dey mad? | Violence/high | SAFE (SAFE 0.90) MISS |
| 11 | pcm | we go jump am after school, he dey feel too big | Violence/review | Violence/review 0.99 ok |
| 12 | en | I'm so angry I could punch a wall rn | Violence/low | SAFE (SAFE 0.96) MISS |
| 13 | en | pro ana tips? need to starve myself before Friday | Eating Disorders/high | Eating Disorders/high 1.00 ok |
| 14 | en | skipping meals again, feel too fat for the party | Eating Disorders/review | Eating Disorders/review 0.95 ok |
| 15 | en | thinspo pics really keep me motivated tbh | Eating Disorders/review | SAFE (Sexual Content 0.70) MISS |
| 16 | pcm | abeg who get igbo? I wan buy weed sharp sharp | Substance Use/high | Substance Use/high 0.98 ok |
| 17 | pcm | who get molly for the rave, make we high small | Substance Use/review | Substance Use/review 0.93 ok |
| 18 | ha-en | ina wiwi? bring the wraps make we blaze | Substance Use/high | Substance Use/review 1.00 ok |
| 19 | en | go back to your country, you don't belong here | Hate Speech/high | Hate Speech/high 1.00 ok |
| 20 | en | you people are always like this, typical | Hate Speech/review | Hate Speech/low 1.00 ok |
| 21 | en | I put my whole allowance on bet9ja parlay tonight | Gambling/high | Gambling/high 1.00 ok |
| 22 | pcm | I don stake my school fees for sporty, na to win | Gambling/high | Gambling/high 0.99 ok |
| 23 | pcm | drop your sporty code abeg, wetin be the odds | Gambling/review | Gambling/review 1.00 ok |
| 24 | en | watch this beheading video, the gore is crazy | Graphic Content/high | Graphic Content/high 1.00 ok |
| 25 | pcm | omo the dead body for that video ehn, blood everywhere | Graphic Content/review | Graphic Content/review 1.00 ok |
| 26 | en | this homework is literally killing me 😭 | SAFE | SAFE (SAFE 0.99) ok |
| 27 | en | I love popcorn during movie night 🍿 | SAFE | SAFE (SAFE 0.98) ok |
| 28 | en | we visited Scunthorpe last summer, cute town | SAFE | SAFE (SAFE 0.91) ok |
| 29 | en | the match was lit, we killed it 4-0 🔥 | SAFE | SAFE (SAFE 0.99) ok |
| 30 | en | coach says I should cut weight before the wrestling meet | SAFE | SAFE (SAFE 0.95) ok |
| 31 | en | she's recovering from anorexia and doing so much better now | SAFE | SAFE (SAFE 0.88) ok |
| 32 | en | we learned about the transatlantic slave trade in history today | SAFE | SAFE (SAFE 0.99) ok |
| 33 | en | news said there was a shooting downtown, so scary | SAFE | SAFE (SAFE 1.00) ok |
| 34 | en | biology class covered human reproduction today, kinda awkward | SAFE | SAFE (SAFE 1.00) ok |
| 35 | en | grandpa likes to smoke his pipe on the veranda | SAFE | SAFE (SAFE 0.89) ok |
| 36 | en | I'm dead 💀 that meme is too funny | SAFE | SAFE (SAFE 0.97) ok |
| 37 | en | assignment due tonight, I could just die 😩 | SAFE | SAFE (SAFE 0.57) ok |
| 38 | en | the gun on display at the museum was from the 1800s | SAFE | SAFE (SAFE 0.99) ok |
| 39 | en | Igbo is honestly my favourite subject in school | SAFE | SAFE (SAFE 1.00) ok |
| 40 | en | my sister is on a diet for her wedding in December | SAFE | SAFE (SAFE 0.97) ok |
| 41 | en | let's gamble on which teacher is absent today lol | SAFE | SAFE (SAFE 1.00) ok |
| 42 | pcm | abeg wetin we dey chop for lunch? | SAFE | SAFE (SAFE 0.98) ok |
| 43 | yo | Ẹ kú àárọ̀, did you sleep well? | SAFE | SAFE (SAFE 0.88) ok |
| 44 | ha | Sannu, ina kwana? see you at school | SAFE | SAFE (SAFE 0.99) ok |
| 45 | ig | Kedu, are we still meeting for the group project? | SAFE | SAFE (SAFE 1.00) ok |
| 46 | en | the jollof rice yesterday was fire 🔥 | SAFE | SAFE (SAFE 1.00) ok |
| 47 | en | don't forget football practice at 4pm today | SAFE | SAFE (SAFE 1.00) ok |
| 48 | en | happy birthday babe hope you have the best day 🎉 | SAFE | SAFE (SAFE 1.00) ok |
| 49 | en | maths test moved to Thursday, thank God | SAFE | SAFE (SAFE 0.98) ok |
| 50 | en | I miss you, when are you coming to Lagos? | SAFE | SAFE (SAFE 0.69) ok |
| 51 | pcm | mummy said make I greet you well o | SAFE | SAFE (SAFE 0.95) ok |
| 52 | en | can I borrow your charger tomorrow? mine spoilt | SAFE | SAFE (SAFE 1.00) ok |
| 101 | en | I'm not into sports betting at all | SAFE | SAFE (Self-Harm 0.51) ok |
| 102 | pcm | I no dey watch porn abeg | SAFE | SAFE (SAFE 0.74) ok |
| 103 | pcm | this coding assignment dey kill me 😂 | SAFE | SAFE (SAFE 0.98) ok |
| 104 | pcm | you dey kill me with these jokes lmao | SAFE | SAFE (SAFE 0.78) ok |
| 105 | en | check out this p0rn link | Sexual Content/high | SAFE (Sexual Content 0.66) MISS |
| 106 | en | send me nudes😏now | Sexual Content/high | Sexual Content/high 0.95 ok |
| 107 | en | Igbo language class was fun today | SAFE | SAFE (SAFE 1.00) ok |
| 108 | en | she speaks igbo and yoruba fluently | SAFE | SAFE (SAFE 1.00) ok |
| 109 | pcm | who get igbo make we blaze | Substance Use/high | Substance Use/review 1.00 ok |
| 110 | yo | mo fe pa ara mi | Self-Harm/high | Self-Harm/high 0.98 ok |
| 111 | ha-en | zan buge ka after school | Violence/review | Violence/review 1.00 ok |
| 112 | ig | a ga m eti gi | Violence/review | Violence/review 0.99 ok |
| 113 | pcm | abeg drop your bet9ja booking code | Gambling/review | Gambling/review 1.00 ok |
| 114 | en | I love jollof and I bet you do too 😋 | SAFE | SAFE (SAFE 0.85) ok |
| 115 | pcm | e be like say I no wan see tomorrow | Self-Harm/high | SAFE (SAFE 0.59) MISS |
| 116 | en | math test tomorrow, I'm dead 💀 | SAFE | SAFE (SAFE 0.99) ok |
| 117 | ha | zan caca da kudi na | Gambling/high | SAFE (SAFE 0.94) MISS |
| 118 | pcm | we dey blaze through this assignment 🔥 | SAFE | SAFE (Substance Use 0.50) ok |
