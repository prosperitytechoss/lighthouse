# Background jobs

The API starts BullMQ workers using the existing `REDIS_URL`. No extra service or
new secret is required. In production, use the Redis private URL, persistence,
and `maxmemory-policy=noeviction`; Redis must not evict queued work. Workers run
inside the API process and can later be extracted into a separate service.

- `mail`: every Resend email is accepted into Redis before the calling operation
  succeeds. Workers send at up to two requests per second across API instances.
  Login codes and links take priority over routine messages.
- `scheduled`: device silence checks every 30 minutes, weekly digest eligibility
  every 15 minutes, and dataset harvest at `HARVEST_INTERVAL_MINUTES`. BullMQ owns
  the schedules and a global concurrency limit prevents overlapping scheduled
  work during deploys. The weekly timezone/window and per-device stamps remain.
- Manual dataset/Gemini runs and manual digest generation retain their existing
  API behavior. Their outgoing emails use the mail queue.

Schedulers run only in production or with `RUN_SCHEDULERS=true`. Queue prefixes
include `NODE_ENV`, so a local development worker cannot consume production
mail. Without `RESEND_API_KEY`, the existing development log transport is used;
no real emails are queued or delivered. Do not use that mode in production.

Jobs retry five times in total with exponential backoff starting at five seconds.
Email retries use the same Resend idempotency key, whose provider retention is
24 hours. Queued emails expire after 23 hours; login codes after 9 minutes and
admin links after 14 minutes. Expired jobs fail without sending. Completion
means the provider accepted the message, not that it reached the recipient's inbox.

Email recipients and rendered bodies (including login credentials) are encrypted
with AES-256-GCM before storage. The key is derived with HKDF from the existing
`SIGNAL_ENCRYPTION_KEY`. Keep that key stable while mail is pending. Successful
mail is removed immediately. Failed mail is retained encrypted for at most one
day or 1,000 jobs; BullMQ performs age cleanup when subsequent jobs finish.
Scheduled job history is bounded to 1,000 entries and seven days for failures.

Advanced → Jobs shows aggregate waiting, active, delayed, and failed counts.
Logs identify failures by queue and job ID without logging email content. Inspect
failed jobs with a trusted BullMQ client before deciding whether to retry. Do
not blindly replay expired credentials or mail older than the provider's
idempotency window. Delivery is at least once; repeated application requests
can still create separate emails. Database stamps record queue acceptance.

Graceful shutdown drains active workers before closing Postgres/Redis, with a
25-second process deadline. Jobs interrupted by forced termination can be
recovered by BullMQ's stalled-job handling after restart.

Validation: `yarn workspace @lighthouse/api test:queues` starts an isolated,
disposable local `redis-server` and uses a fake mail delivery function. It never
connects to the configured application database or sends real email.

References: [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production)
and [Resend idempotency](https://resend.com/changelog/idempotency-keys).
