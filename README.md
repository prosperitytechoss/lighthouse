# Lighthouse

Child safety that runs on the phone. Parents get a category, never the content.

Powered by [Lighthouse Keeper](https://huggingface.co/Prosperitytech/lighthouse-keeper), our open child safety model for Nigerian languages.

Lighthouse is a free Android app for families. It reads what is on a child's screen in the apps a parent chooses, decides on the phone whether it is risky, and tells the parent the kind of thing it saw. The words, the pictures and the screen never leave the phone.

Built in Nigeria for Nigerian families first. English, Nigerian Pidgin, Yoruba, Hausa and Igbo.

## How it works

```
watched app on the child's phone
  -> on screen text, notifications, and a screen frame every 15 to 60 seconds
  -> Lighthouse Keeper (the text, 13 kinds of risk)
  -> nudity model (on the screen frame)
  -> category and severity only
  -> encrypted signal to the server
  -> parent gets an email
frame is freed in memory. Nothing is stored. Nothing is uploaded.
```

Everything that decides runs on the device. The server only ever sees a category, a severity, an app name and a time.

## Lighthouse Keeper

Keeper is the text model inside the app. It is 8.5 MB, runs in under a millisecond, and reads Nigerian English, Pidgin, Yoruba, Hausa and Igbo. It scores each message for bullying, eating disorders, gambling, graphic content, grooming, hate speech, privacy threats, scams, self harm, sextortion, sexual content, substance use and violence.

- Model: https://huggingface.co/Prosperitytech/lighthouse-keeper
- Test set: https://huggingface.co/datasets/Prosperitytech/keeper-nigerian-safety-test
- Demo: https://huggingface.co/spaces/Prosperitytech/lighthouse-keeper-demo

Keeper is Apache 2.0. The app ships with one version built in and picks up newer versions over Wi-Fi when we publish them from the admin.

## What is in this repository

| Folder | What |
|---|---|
| `apps/child` | The Android app. React Native shell plus the native engine in Kotlin: capture, classifier, vision, block overlay, keep alive. |
| `apps/api` | Express and Postgres API. Accounts, devices, encrypted signals, alerts, weekly summary, Keeper version publishing. |
| `apps/admin` | Web admin. Keeper versions, phones, alerts, training examples. |
| `apps/web` | The public website. |
| `packages` | Shared UI, tokens, types and copy. |
| `ml` | Evaluation harness, word list tooling, text model training, vision model notes. |
| `docs` | Architecture, evaluation findings, release notes. |

## What is not in this repository

- The Keeper and nudity model files. `scripts/fetch-keeper.sh` downloads Keeper from Hugging Face. See `apps/child/models/README.md`.
- Signing keys, API keys and credentials. Provide your own through environment variables.

## Running it

You need Node 20 or newer, Yarn 1, Postgres and Redis, and the Android SDK.

```
yarn install
cd apps/api && cp .env.example .env && yarn db:migrate && yarn db:seed-lexicon && yarn dev
cd apps/admin && yarn dev
scripts/fetch-keeper.sh
cd apps/child && node ../../node_modules/expo/bin/cli run:android
```

The child app needs a real Android device or emulator on Android 11 or newer for the vision channel. Full setup notes are in `apps/api/README.md` and the docs folder.

## Privacy line

Lighthouse is honest with children. The app tells them what it can and cannot see. The consent screen before enabling Android's Accessibility Service says exactly what happens. Any change that sends message text, screen images or location off the device will not be merged.

## Evaluation

Keeper is scored on 746 messages it never saw in training, across all five languages and all 13 kinds of risk. Keeper 0.1 gets 80% and catches 84% of risky messages. The word list the app used before got 37% on the same test. Scores per language and the 557 messages we can share are on the Hugging Face pages above. Numbers measured on real low end phones are still pending.

## License

Code is licensed under Apache 2.0. See LICENSE.

Lighthouse Keeper and its test set are Apache 2.0 on Hugging Face.

The Lighthouse name, the mascot and logo, the word list and the training dataset are not licensed. See NOTICE. Forks must use their own name and mascot.

## Contributing

See CONTRIBUTING.md. If you speak Pidgin, Yoruba, Hausa or Igbo and Keeper gets your language wrong, tell us on the [model page](https://huggingface.co/Prosperitytech/lighthouse-keeper/discussions).

## Security

See SECURITY.md. Report problems privately to hello@prosperitytech.org.

## Who

Lighthouse is built by Prosperity Tech Projects, a nonprofit working on technology justice. https://prosperitytech.org
