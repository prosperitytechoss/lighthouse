# Lighthouse

Child safety that runs on the phone. Parents get a category, never the content.

Lighthouse is a free Android app for families. It reads what is on a child's screen in the apps a parent chooses, decides on the phone whether it is risky, and tells the parent the kind of thing it saw. The words, the pictures and the screen never leave the phone.

Built in Nigeria for Nigerian families first. English, Nigerian Pidgin, Yoruba, Hausa and Igbo.

## How it works

```
watched app on the child's phone
  -> on screen text, notifications, and a screen frame every 15 to 60 seconds
  -> word list (exact phrases)
  -> tiny text model (when the word list is silent)
  -> nudity model (on the screen frame)
  -> category and severity only
  -> encrypted signal to the server
  -> parent gets an email
frame is freed in memory. Nothing is stored. Nothing is uploaded.
```

Everything that decides runs on the device. The server only ever sees a category, a severity, an app name and a time.

## What is in this repository

| Folder | What |
|---|---|
| `apps/child` | The Android app. React Native shell plus the native engine in Kotlin: capture, classifier, vision, block overlay, keep alive. |
| `apps/api` | Express and Postgres API. Accounts, devices, encrypted signals, alerts, weekly summary, word list publishing. |
| `apps/admin` | Web admin. Word list review and publish, phones, alerts, training examples. |
| `apps/web` | The public website. |
| `packages` | Shared UI, tokens, types and copy. |
| `ml` | Evaluation harness, word list tooling, text model training, vision model notes. |
| `docs` | Architecture, evaluation findings, release notes. |

## What is not in this repository

- The full Lighthouse word list. A 48 word English starter ships so the app runs. Grow your own through the admin.
- The trained text model and the nudity model files. See `apps/child/models/README.md`.
- Signing keys, API keys and credentials. Provide your own through environment variables.

## Running it

You need Node 20 or newer, Yarn 1, Postgres and Redis, and the Android SDK.

```
yarn install
cd apps/api && cp .env.example .env && yarn db:migrate && yarn db:seed-lexicon && yarn dev
cd apps/admin && yarn dev
cd apps/child && node ../../node_modules/expo/bin/cli run:android
```

The child app needs a real Android device or emulator on Android 11 or newer for the vision channel. Full setup notes are in `apps/api/README.md` and the docs folder.

## Privacy line

Lighthouse is honest with children. The app tells them what it can and cannot see. The consent screen before enabling Android's Accessibility Service says exactly what happens. Any change that sends message text, screen images or location off the device will not be merged.

## Evaluation

The classifier is scored against a hand written set of code switched Nigerian messages and against benign Nigerian tweets. Results and caveats are in `ml/guard-eval` and `ml/textmodel/REPORT.md`. Numbers measured on real low end phones are still pending and are marked as such.

## License

Code is licensed under Apache 2.0. See LICENSE.

The Lighthouse name, the mascot and logo, the word list, the dataset and the trained model files are not licensed. See NOTICE. Forks must use their own name and mascot.

## Contributing

See CONTRIBUTING.md. If you speak Pidgin, Yoruba, Hausa or Igbo, CONTRIBUTING-LEXICON.md is the best place to start.

## Security

See SECURITY.md. Report problems privately to hello@prosperitytech.org.

## Who

Lighthouse is built by Prosperity Tech Projects, a nonprofit working on technology justice. https://prosperitytech.org
