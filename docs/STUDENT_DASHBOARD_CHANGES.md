# Student dashboard changes

## Included

- Responsive dashboard tabs, keyboard navigation and URL-driven group/notification routing.
- Explicit loading, error and retry states across the main dashboard sections.
- Subject and assessment search, status filters, continue-learning links, and device-local chapter bookmarks/completion.
- Assessment instructions, answered counts, question navigation, sticky save/timer status, serialized autosave, reconnect retry and tab-local draft recovery.
- Server-owned attempt deadlines and answer revisions. Reloading retains the deadline. Late edits are rejected; expired submission grades only previously saved answers. Submission is idempotent and writes lock the attempt row.
- Students can read their submitted answers while grading is pending. Released numeric results include the expected answer.
- Daily study activity recording, honest ungraded/empty progress states, accessible result links and accurate enrollment labels.
- Group-specific chat drafts, mobile group workspace, latest-message pagination, multiline messages, clearer mentions, pending states and destructive-action confirmations.
- File-size validation, reset file input, download error handling; card/poll validation and single-response group quizzes.
- Individual notification read state, explicit mark-all action, mobile popover positioning, accessible account/editor controls.

## Rollout

1. Back up the target PostgreSQL database and test the migration in staging.
2. Run `npm ci` and `npm run db:migrate` with the target `DATABASE_URL`.
3. Deploy the frontend and API together using `npm run build`. Migration `0008_student_reliability` adds attempt deadlines, answer revisions and daily study records. Existing timed attempts receive deadlines based on their original start time, so old unfinished attempts can immediately be expired.
4. Require already-open clients to reload after deployment. Answer and submit payloads now require `revision`; start/resume returns it. Successful writes return the next revision. A conflict returns HTTP 409 and requires reconciling with the saved version.
5. Verify login, simultaneous saves from two browser tabs, timed submission, R2 upload/download and notification navigation against the staging services.

The existing Next.js hosting architecture remains unchanged. See the separate architecture review for Netlify configuration and remaining hosting constraints. No cloud deployment or repository push was performed.

## Tests

Run `npm test` for the timing tests. For route integration tests, first migrate a **disposable local PostgreSQL database**, then run:

```sh
STUDYMONK_TEST_DATABASE_URL='postgresql://user:password@127.0.0.1:5432/studymonk_test' npm test
```

The integration suite creates and removes its own synthetic fixtures. It intentionally refuses non-local hosts. It covers deadline preservation, conflicting revisions and ownership, late submissions, numeric results, daily activity, more than 200 group messages, notification read scope and immutable quiz responses.

Verification on 2 October 2026: production build passed; 11 tests passed using an isolated PGlite PostgreSQL-compatible instance with a single connection. That run verifies route behavior but does not establish production multi-connection locking behavior. The build retains three pre-existing React hook warnings in admin components; the changed student components have no hook warnings. Real local login, dashboard rendering, assessment discovery and start instructions were checked in the browser. Browser automation stalled on the native confirmation dialog, so a complete browser submission walkthrough was not completed.

## Remaining limits

- Bookmarks/completion are device-local; assessment drafts are tab-local and are not substitutes for acknowledged server saves.
- An expired attempt is finalized when the student submits/resumes in the browser, not by a background scheduler.
- Uploads show a busy state but do not yet provide percentage progress or cancellation. Real R2 transfer and AI grading were not exercised.
- Production database concurrency, full mobile regression, accessibility testing with assistive technology and usability testing with students remain staging/release checks.
- The architecture review's separate security/dependency and background AI job recommendations are not all addressed by this student-dashboard change.

## Backend follow-up

Added atomic refresh-token rotation, serverless-safe PostgreSQL auth rate limits, upload namespace and R2 metadata verification, and transactional manual grading with answer ownership/maximum-mark validation. Migration `0009_backend_safety` is required in addition to `0008`. The expanded suite passes all 15 tests; TypeScript compilation passes.

Netlify uses its trusted `x-nf-client-connection-ip` header for auth limits. Other hosts can set `TRUSTED_CLIENT_IP_HEADER` only when their ingress overwrites that header; otherwise a shared ingress budget applies. Email/token-specific limits apply as well. Schedule periodic deletion of expired `RateLimitBucket` rows, for example `DELETE FROM "RateLimitBucket" WHERE "expiresAt" < NOW();`. Do not run migrations from untrusted preview builds.

Dependency major-version upgrades and durable background AI jobs remain follow-up work. This commit does not claim production deployment readiness or verification of live R2/AI services. The earlier no-push statement describes the initial verification stage; the user subsequently authorized pushing these changes.
