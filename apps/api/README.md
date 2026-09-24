# @lighthouse/api

Lighthouse backend. **Skeleton + infra only** — no accounts / auth / pairing yet.
Express + TypeScript (strict) + Drizzle ORM (Postgres) + Redis. The single proof
of life is `GET /health`, which pings both Postgres and Redis.

## Structure

```
apps/api/
  drizzle.config.ts       drizzle-kit config (reads DATABASE_URL)
  drizzle/                generated SQL migrations
  .env.example            env template (copy to .env)
  src/
    index.ts              bootstrap: connect Redis, start server, graceful shutdown
    app.ts                Express app: JSON, request logger, routes, error handler
    config/env.ts         zod-validated env (fails fast on missing/invalid vars)
    db/
      client.ts           postgres.js pool + drizzle client + pingDb/closeDb
      schema.ts           minimal `health_checks` table (placeholder)
    lib/
      logger.ts           tiny logger + request-logging middleware
      redis.ts            redis client wrapper: connect / ping / close
      error-handler.ts    centralized error handler
    routes/
      health.ts           GET /health → pings Postgres + Redis
```

## Run it locally

Uses your own **locally-running Postgres + Redis** (no Docker). Start them however
you normally do, then point `.env` at them.

```bash
# 1. Postgres + Redis running locally (e.g. `brew services start postgresql redis`),
#    and a database created for Lighthouse:
createdb lighthouse

# 2. Configure env (defaults assume localhost:5432 / localhost:6379)
cd apps/api
cp .env.example .env        # edit DATABASE_URL / REDIS_URL if your setup differs

# 3. Install workspace deps from the repo root, then run the migration
yarn db:generate            # writes drizzle/*.sql (only after schema changes)
yarn db:migrate             # applies migrations to your Postgres

# 4. Dev (nodemon hot reload)
yarn dev

# 5. Prod
yarn build && yarn start

# 6. Prove it's alive
curl -s http://localhost:4000/health
# -> {"status":"ok","db":"ok","redis":"ok","uptime":1.23}
```

`yarn dev` runs **nodemon** (`src/index.ts` via tsx); `yarn start` runs the
compiled `dist/index.js`. Everything is env-driven — change `DATABASE_URL` /
`REDIS_URL` to target any Postgres/Redis.

## Auth (email/password + email OTP)

Server-side only (no client screens yet). Sessions + OTP live in Redis; passwords
are argon2id-hashed in Postgres; OTPs are sha256-hashed in Redis (10-min TTL,
max 5 attempts, 60s resend cooldown).

| Endpoint | Body | Effect |
|---|---|---|
| `POST /auth/signup` | `{email, password}` | Create unverified account, email a 6-digit OTP. Generic response (no enumeration). |
| `POST /auth/verify-otp` | `{email, code}` | Verify code → mark verified → return a session `token`. |
| `POST /auth/login` | `{email, password}` | Verified accounts get a session `token`; unverified get 403. |
| `POST /auth/resend-otp` | `{email}` | Rate-limited (60s) resend. |
| `POST /auth/logout` | `Authorization: Bearer <token>` or `{token}` | Invalidate the session. |

### Email transport

Behind an `EmailService` interface (`src/services/email.ts`):
- **Dev transport (default):** logs the OTP to the server console — no provider key needed.
- **Resend:** set `RESEND_API_KEY` in `.env` to switch on real sends. Uses the
  official `resend` SDK and the `EMAIL_FROM` address.

> Real sends require the **from-domain to be verified in Resend** first. Until
> then, leave `RESEND_API_KEY` unset and read OTPs from the console.

## Scripts

Run from `apps/api`:

| Script | What |
|---|---|
| `yarn dev` | nodemon + tsx, hot reload |
| `yarn build` | `tsc` → `dist/` |
| `yarn start` | run the built server (`node dist/index.js`) |
| `yarn type-check` | `tsc --noEmit` |
| `yarn lint` | eslint |
| `yarn db:generate` | generate a migration from the schema |
| `yarn db:migrate` | apply migrations |
