# Task 6 — Leave decision emails

## Delivered

- Replaced the direct leave-decision update with `decide_leave_request`, preserving the migration-owned compare-and-set, audit event, decision-version snapshot, no-op, and transition behavior.
- Added server-only Resend REST delivery using `RESEND_API_KEY`, `LEAVE_EMAIL_FROM`, and `NEXT_PUBLIC_APP_URL`; snapshot-based HTML is escaped and plain text includes decision, dates, optional rejection reason, and portal link.
- Claims deliveries in a 60-second lease batch, supplies the durable idempotency key to Resend, and completes each delivery as sent or retryable failed without undoing the decision.
- Preserved rejected-attachment cleanup after a committed rejection. Submission and withdrawal paths do not invoke email delivery.
- Added action results for successful/failed email delivery and Super Admin-only retry controls for failed approval or rejection emails.

## TDD evidence

- RED captured for missing renderer/delivery modules, direct decision RPC action behavior, and UI result/retry behavior.
- Added tests for escaped snapshot rendering, Resend idempotency headers, lease claim/completion token use, provider and invalid-recipient failures, decision no-ops, retry authorization, result messages, and retry visibility.
- Existing migration tests continue to cover transactional decision transitions, snapshots, concurrent leases, idempotency storage, and retry authorization.

## Verification

- `npm test` — 48 files, 233 tests passed.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run security:secrets` — passed.

## Self-review

- Confirmed the only remaining direct `leave_requests.status` mutation is student withdrawal, which must not create an email and has no supplied decision RPC.
- Restored targeted Admin and Mentor student-page revalidation after a decision.
- Forgot-password behavior is untouched.

## Configuration

Set `RESEND_API_KEY` and `LEAVE_EMAIL_FROM` in the server environment. `NEXT_PUBLIC_APP_URL` remains the existing required portal origin.

## Fix round 1 — targeted delivery and recipient refresh

### Root cause

- A decision action called the globally ordered `claim_leave_notification_batch` with a limit of 50. Its just-created notification was not guaranteed to be among those claims, so the action could report a failed email while the notification remained pending.
- Retrying a failed notification reset delivery state but retained the email snapshot made at decision time, so a corrected profile email could never be used.

### RED / GREEN evidence

- RED: `npm test -- src/lib/leave-notifications.test.ts src/app/actions/leave.test.ts` failed as expected: `deliverLeaveNotification is not a function`, and the action returned `Decision saved; email failed` instead of sent when given a targeted claim fixture.
- GREEN: the same focused command passed with 2 files and 6 tests after adding the targeted claim path and action integration.
- `npm run typecheck` passed.
- `npm run lint` passed.
- Database coverage was updated for targeted claim, invalid-recipient retryability, corrected-recipient refresh, retry no-op, and unauthorized retry. `npm run test:db` could not run because the local PostgreSQL endpoint at `127.0.0.1:54322` refused the connection; no live database was used.
