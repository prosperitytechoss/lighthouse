# Rules classifier — before/after scoreboard

_OLD keyword stub vs NEW rules-based classify(). Metrics identical to guard-eval/run_eval.py._

app unit harness (classify.cases.ts): **20/20 pass**

## A · Original guard-eval set (apples-to-apples)  (n=52)

| metric | OLD stub | NEW rules | Δ |
|---|---|---|---|
| overall accuracy | 83% | 98% | +15% ✅ |
| SAFE false-positive rate | 11% | 0% | -11% ✅ |
| hard-negative pass rate | 81% | 100% | +19% ✅ |
| positive detection | 76% | 96% | +20% ✅ |
| positive category accuracy | 76% | 96% | +20% ✅ |
| code-switched detection | 40% | 100% | +60% ✅ |
| severity exact-match | 89% | 92% | +2% ✅ |

## B · Held-out hard set (negation / sarcasm / l33t / more code-switch)  (n=18)

| metric | OLD stub | NEW rules | Δ |
|---|---|---|---|
| overall accuracy | 44% | 83% | +39% ✅ |
| SAFE false-positive rate | 22% | 11% | -11% ✅ |
| hard-negative pass rate | 78% | 89% | +11% ✅ |
| positive detection | 11% | 78% | +67% ✅ |
| positive category accuracy | 11% | 78% | +67% ✅ |
| code-switched detection | 0% | 71% | +71% ✅ |
| severity exact-match | 100% | 100% | +0% — |

## C · Combined  (n=70)

| metric | OLD stub | NEW rules | Δ |
|---|---|---|---|
| overall accuracy | 73% | 94% | +21% ✅ |
| SAFE false-positive rate | 14% | 3% | -11% ✅ |
| hard-negative pass rate | 80% | 96% | +16% ✅ |
| positive detection | 59% | 91% | +32% ✅ |
| positive category accuracy | 59% | 91% | +32% ✅ |
| code-switched detection | 24% | 88% | +65% ✅ |
| severity exact-match | 90% | 94% | +4% ✅ |

## Per-message (52)

| # | lang | message | expected | OLD stub | NEW rules |
|---|---|---|---|---|---|
| 1 | en | I don't want to be here anymore, I want to die tonight | Self-Harm/high | Self-Harm/high ✓ | Self-Harm/high ✓ |
| 2 | pcm | I no wan dey alive again, everything don tire me | Self-Harm/high | SAFE ✗ | Self-Harm/high ✓ |
| 3 | en | honestly I feel so worthless lately, no reason to try | Self-Harm/review | Self-Harm/review ✓ | Self-Harm/review ✓ |
| 4 | en | ugh I hate myself sometimes lol | Self-Harm/low | Self-Harm/low ✓ | Self-Harm/low ✓ |
| 5 | en | send me your nudes rn 😏 | Sexual Content/high | Sexual Content/high ✓ | Sexual Content/high ✓ |
| 6 | pcm | baby send me your body pics na, no dey form | Sexual Content/high | SAFE ✗ | Sexual Content/high ✓ |
| 7 | en | wanna hook up later? my parents are out | Sexual Content/review | Sexual Content/review ✓ | Sexual Content/review ✓ |
| 8 | en | you look kinda sexy in that pic ngl | Sexual Content/low | Sexual Content/low ✓ | Sexual Content/low ✓ |
| 9 | en | I'm gonna beat you up after school, watch | Violence/high | Violence/high ✓ | Violence/high ✓ |
| 10 | yo-en | ma lu e ni school tomorrow, you dey mad? | Violence/high | SAFE ✗ | Violence/review ✓ |
| 11 | pcm | we go jump am after school, he dey feel too big | Violence/review | SAFE ✗ | Violence/review ✓ |
| 12 | en | I'm so angry I could punch a wall rn | Violence/low | Violence/low ✓ | SAFE ✗ |
| 13 | en | pro ana tips? need to starve myself before Friday | Eating Disorders/high | Eating Disorders/high ✓ | Eating Disorders/high ✓ |
| 14 | en | skipping meals again, feel too fat for the party | Eating Disorders/review | Eating Disorders/low ✓ | Eating Disorders/review ✓ |
| 15 | en | thinspo pics really keep me motivated tbh | Eating Disorders/review | Eating Disorders/review ✓ | Eating Disorders/review ✓ |
| 16 | pcm | abeg who get igbo? I wan buy weed sharp sharp | Substance Use/high | Substance Use/high ✓ | Substance Use/high ✓ |
| 17 | pcm | who get molly for the rave, make we high small | Substance Use/review | Substance Use/review ✓ | Substance Use/review ✓ |
| 18 | ha-en | ina wiwi? bring the wraps make we blaze | Substance Use/high | SAFE ✗ | Substance Use/high ✓ |
| 19 | en | go back to your country, you don't belong here | Hate Speech/high | Hate Speech/high ✓ | Hate Speech/high ✓ |
| 20 | en | you people are always like this, typical | Hate Speech/review | Hate Speech/review ✓ | Hate Speech/review ✓ |
| 21 | en | I put my whole allowance on bet9ja parlay tonight | Gambling/high | Gambling/review ✓ | Gambling/review ✓ |
| 22 | pcm | I don stake my school fees for sporty, na to win | Gambling/high | SAFE ✗ | Gambling/high ✓ |
| 23 | pcm | drop your sporty code abeg, wetin be the odds | Gambling/review | Gambling/review ✓ | Gambling/review ✓ |
| 24 | en | watch this beheading video, the gore is crazy | Graphic Content/high | Graphic Content/high ✓ | Graphic Content/high ✓ |
| 25 | pcm | omo the dead body for that video ehn, blood everywhere | Graphic Content/review | Graphic Content/review ✓ | Graphic Content/review ✓ |
| 26 | en | this homework is literally killing me 😭 | SAFE | SAFE ✓ | SAFE ✓ |
| 27 | en | I love popcorn during movie night 🍿 | SAFE | SAFE ✓ | SAFE ✓ |
| 28 | en | we visited Scunthorpe last summer, cute town | SAFE | SAFE ✓ | SAFE ✓ |
| 29 | en | the match was lit, we killed it 4-0 🔥 | SAFE | SAFE ✓ | SAFE ✓ |
| 30 | en | coach says I should cut weight before the wrestling meet | SAFE | SAFE ✓ | SAFE ✓ |
| 31 | en | she's recovering from anorexia and doing so much better now | SAFE | SAFE ✓ | SAFE ✓ |
| 32 | en | we learned about the transatlantic slave trade in history today | SAFE | SAFE ✓ | SAFE ✓ |
| 33 | en | news said there was a shooting downtown, so scary | SAFE | SAFE ✓ | SAFE ✓ |
| 34 | en | biology class covered human reproduction today, kinda awkward | SAFE | SAFE ✓ | SAFE ✓ |
| 35 | en | grandpa likes to smoke his pipe on the veranda | SAFE | Substance Use/low ✗ | SAFE ✓ |
| 36 | en | I'm dead 💀 that meme is too funny | SAFE | SAFE ✓ | SAFE ✓ |
| 37 | en | assignment due tonight, I could just die 😩 | SAFE | SAFE ✓ | SAFE ✓ |
| 38 | en | the gun on display at the museum was from the 1800s | SAFE | Violence/high ✗ | SAFE ✓ |
| 39 | en | Igbo is honestly my favourite subject in school | SAFE | SAFE ✓ | SAFE ✓ |
| 40 | en | my sister is on a diet for her wedding in December | SAFE | Eating Disorders/low ✗ | SAFE ✓ |
| 41 | en | let's gamble on which teacher is absent today lol | SAFE | SAFE ✓ | SAFE ✓ |
| 42 | pcm | abeg wetin we dey chop for lunch? | SAFE | SAFE ✓ | SAFE ✓ |
| 43 | yo | Ẹ kú àárọ̀, did you sleep well? | SAFE | SAFE ✓ | SAFE ✓ |
| 44 | ha | Sannu, ina kwana? see you at school | SAFE | SAFE ✓ | SAFE ✓ |
| 45 | ig | Kedu, are we still meeting for the group project? | SAFE | SAFE ✓ | SAFE ✓ |
| 46 | en | the jollof rice yesterday was fire 🔥 | SAFE | SAFE ✓ | SAFE ✓ |
| 47 | en | don't forget football practice at 4pm today | SAFE | SAFE ✓ | SAFE ✓ |
| 48 | en | happy birthday babe hope you have the best day 🎉 | SAFE | SAFE ✓ | SAFE ✓ |
| 49 | en | maths test moved to Thursday, thank God | SAFE | SAFE ✓ | SAFE ✓ |
| 50 | en | I miss you, when are you coming to Lagos? | SAFE | SAFE ✓ | SAFE ✓ |
| 51 | pcm | mummy said make I greet you well o | SAFE | SAFE ✓ | SAFE ✓ |
| 52 | en | can I borrow your charger tomorrow? mine spoilt | SAFE | SAFE ✓ | SAFE ✓ |

## Per-message (18)

| # | lang | message | expected | OLD stub | NEW rules |
|---|---|---|---|---|---|
| 101 | en | I'm not into sports betting at all | SAFE | Gambling/review ✗ | SAFE ✓ |
| 102 | pcm | I no dey watch porn abeg | SAFE | Sexual Content/high ✗ | SAFE ✓ |
| 103 | pcm | this coding assignment dey kill me 😂 | SAFE | SAFE ✓ | SAFE ✓ |
| 104 | pcm | you dey kill me with these jokes lmao | SAFE | SAFE ✓ | SAFE ✓ |
| 105 | en | check out this p0rn link | Sexual Content/high | SAFE ✗ | Sexual Content/high ✓ |
| 106 | en | send me nudes😏now | Sexual Content/high | Sexual Content/high ✓ | Sexual Content/high ✓ |
| 107 | en | Igbo language class was fun today | SAFE | SAFE ✓ | SAFE ✓ |
| 108 | en | she speaks igbo and yoruba fluently | SAFE | SAFE ✓ | SAFE ✓ |
| 109 | pcm | who get igbo make we blaze | Substance Use/high | SAFE ✗ | Substance Use/high ✓ |
| 110 | yo | mo fe pa ara mi | Self-Harm/high | SAFE ✗ | Self-Harm/high ✓ |
| 111 | ha-en | zan buge ka after school | Violence/review | SAFE ✗ | Violence/review ✓ |
| 112 | ig | a ga m eti gi | Violence/review | SAFE ✗ | Violence/review ✓ |
| 113 | pcm | abeg drop your bet9ja booking code | Gambling/review | SAFE ✗ | Gambling/review ✓ |
| 114 | en | I love jollof and I bet you do too 😋 | SAFE | SAFE ✓ | SAFE ✓ |
| 115 | pcm | e be like say I no wan see tomorrow | Self-Harm/high | SAFE ✗ | SAFE ✗ |
| 116 | en | math test tomorrow, I'm dead 💀 | SAFE | SAFE ✓ | SAFE ✓ |
| 117 | ha | zan caca da kudi na | Gambling/high | SAFE ✗ | SAFE ✗ |
| 118 | pcm | we dey blaze through this assignment 🔥 | SAFE | SAFE ✓ | Substance Use/review ✗ |
