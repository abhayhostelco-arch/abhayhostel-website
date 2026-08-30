# Admin Data Cleanup and Retention Design

## Purpose

Abhay Hostel has limited Supabase database and object-storage capacity. The portal needs a Super Admin-only maintenance system that can safely purge old operational data and uploaded files, optionally run the safe retention policy after an Admin dashboard visit, and permanently remove an inactive Student when explicitly requested.

The feature must preserve existing login, profile, reporting, upload, attendance, leave, settings, and account-management behavior. It must not deploy, apply production migrations, or depend on a browser request remaining open while cleanup runs.

## Existing Data Inventory

The current schema stores:

- `profiles` backed by `auth.users`, including `avatar_path` and Mentor assignments.
- `daily_entries`, including `maha_mantra_path` references into `maha-mantra-evidence`.
- `gita_class_attendance` official attendance rows.
- `weekly_programs` and `weekly_program_entries`.
- `attendance_people`, `attendance_events`, mappings, and dated `attendance_records`.
- `leave_requests`, including `attachment_path` references into `leave-applications`.
- `shared_resources`, which contain external URLs only; there is no resource-upload bucket.
- Global alert and score settings.
- Immutable `audit_events`.
- Private objects in `student-avatars`, `maha-mantra-evidence`, and `leave-applications`.

The database role `super_admin` is labelled Admin in the UI. The database role `admin` is labelled Mentor. All maintenance features in this design are restricted to `super_admin`.

## User Experience

Add a Data Maintenance section to `/admin/profile`, leaving the shared Mentor profile UI unchanged.

The section contains:

1. An **Automatic cleanup** toggle, disabled by default, with an irreversible-deletion warning.
2. Last automatic-run status, timestamps, row counts, file counts, and a sanitized error summary.
3. A **Manual historical cleanup** form with 90, 180, and 365-day presets and a category checklist.
4. A preview that shows affected rows, file counts, estimated logical row payload, and exact object bytes where Storage metadata provides a size.
5. An **Inactive Student deletion** tool with Student selection, complete impact preview, exact-email confirmation, progress, and Resume controls.

If the cleanup migration has not been applied, existing profile controls continue working and the maintenance section shows that maintenance is unavailable.

## Retention Policy

All date calculations are performed inside PostgreSQL using `Asia/Kolkata`. A row is eligible only when its date is strictly less than `India today - retention days`. A row exactly 90 days old remains until the following day.

### Historical categories

- **Daily tracking:** delete eligible `daily_entries`. Enqueue their non-null `maha_mantra_path` objects for Storage deletion.
- **Gita attendance:** delete eligible `gita_class_attendance` by `attendance_date`.
- **Weekly programs:** delete programs where `program_date` is eligible and `is_active = false`, together with their `weekly_program_entries`. Never delete an active program.
- **General attendance:** delete eligible `attendance_records` by `attendance_date`. Preserve people, events, and mappings.
- **Leave applications:** delete requests where `end_date` is eligible and status is `approved`, `rejected`, or `withdrawn`. Enqueue non-null attachments. Never delete a pending request.
- **Archived resources:** delete unpublished `shared_resources` whose `updated_at` is before the India cutoff instant. This category is manual-only.
- **Orphan files:** delete objects in the three managed buckets only when they are unreferenced and `greatest(created_at, updated_at)` is more than 24 hours old. Avatar references include profiles of every role.

Automatic cleanup has a fixed 90-day scope containing every historical category except archived resources. It never deletes Auth identities, profiles, audit events, settings, definitions, mappings, active programs, or pending leaves.

## Preview and Staleness Rules

A manual preview is stored as a cleanup run in `previewed` status and expires after 15 minutes. It is bound to the authenticated Super Admin, retention preset, selected categories, exact candidate IDs, and observed eligibility fields.

Confirmation atomically changes a non-expired preview from `previewed` to `queued`. Expiry no longer applies after queuing. Expired previews become `cancelled` and cannot execute or resume.

Before deleting any candidate, execution rechecks the ID, `updated_at`, current status, active flag, parent eligibility, and current file references as applicable. A changed candidate is marked stale and skipped. The system never recomputes a broad predicate and deletes rows that were absent from the preview.

## Durable Run Model

Add the following maintenance state in a new forward migration:

- `cleanup_settings`: singleton automatic toggle, last-run aggregate, and global worker lease.
- `cleanup_runs`: mode (`auto`, `manual`, or `student_delete`), actor, actor and target snapshots, nullable non-restricting target UUID, India run date, cutoff, categories, status, phase, cursors, next-work time, lease information, counts, audit-event correlation, and sanitized errors.
- `cleanup_candidates`: exact database candidate IDs, observed eligibility fields, and exact weekly-program child membership.
- `cleanup_object_tasks`: bucket, path, immutable Storage object ID, observed version/`updated_at`, observed owner, selection provenance, bytes, state, attempt count, next retry time, and sanitized error class.
- `profiles.deletion_pending_at`: nullable timestamp that locks a profile into permanent-deletion workflow.

Automatic runs have a unique India calendar-date key. Run states are `previewed`, `queued`, `running`, `completed`, `partial`, `failed`, and `cancelled`.

A singleton global lease serializes destructive batches across automatic, manual, and Student-deletion runs. Every lease claim increments a fencing generation. Every mutating RPC and task claim must present the current generation, so a stalled worker is rejected after reclamation. The lease lifetime exceeds Netlify's maximum invocation, while each worker stops with a safety margin and external calls have shorter timeouts. The worker releases its lease transactionally before invoking a successor. Previews may be generated concurrently, but destructive batches may not overlap.

Turning automatic cleanup off cancels queued automatic work and causes a running automatic worker to stop before its next batch. It does not cancel manual or Student-deletion runs.

State transitions are explicit:

- `previewed` may become `queued` or `cancelled`.
- `queued` may become `running` or `cancelled`.
- `running` may become `completed`, `partial`, `failed`, or `cancelled` for automatic runs disabled before the next batch.
- `partial` and `failed` may return to `queued` only through an explicit Super Admin Resume.
- Terminal `completed` and `cancelled` runs never resume.
- A stale subset completes with skipped counts; an all-stale run completes with zero deletions.
- Re-enabling automatic cleanup does not revive a cancelled run on the same India date; the next India date may create the next automatic run.

Terminal candidate and object-task details older than 30 days are removed after aggregate results have been copied to the run and audit event.

## Background Processing

Whenever `/admin` mounts, a small client component sends a same-origin `POST /api/admin/cleanup/auto` using `keepalive: true` and does not await the response for navigation or rendering.

The route rejects cross-origin requests, authenticates the user-scoped Supabase session as an active `super_admin`, and only then creates a service-role client. Its enqueue RPC atomically reads `automatic_enabled`; while false it neither creates nor resumes an automatic run and does not invoke a worker. While enabled it atomically enqueues or resumes the current India-day automatic run and invokes a Netlify Background Function using only the run ID and a server-only worker secret. Browser input cannot provide actor IDs, categories, retention days, or privileged run state. The worker independently rechecks the toggle after claiming its lease and before every automatic destructive batch, covering concurrent disable/enqueue races.

`netlify/functions/cleanup-worker.mts` uses `@netlify/functions` background mode. It validates `CLEANUP_WORKER_SECRET` in constant time, claims the durable lease, and processes deterministic bounded batches. Database deletion and task materialization are transactional. Storage objects are removed only through the Supabase Storage API, in batches of at most 500.

The worker self-invokes only when immediately eligible work remains. Object tasks receive five total attempts with four in-invocation delays of 1, 2, 4, and 8 seconds. After the fifth failed attempt, the task becomes permanently failed, the run becomes `partial`, and automatic self-invocation stops. A Super Admin Resume action resets permanently failed tasks to pending.

Every Admin dashboard/profile dispatch request also atomically checks for due nonterminal runs of every mode, not only the daily automatic run. A Netlify Scheduled Function runs hourly and performs the same server-secret-protected due-run dispatch without creating automatic runs. This timer exists to resume rare long waits such as Student upload quarantine; the dashboard remains the only trigger that creates the daily automatic run.

Netlify retry, worker self-invocation, explicit Resume, or a later dashboard visit can all converge on the same persisted run without duplicating deletion.

## Permanent Inactive-Student Deletion

Permanent Student deletion is a separate, never-automatic mode.

The preview includes all Student-owned operational rows, referenced files, managed-bucket objects discovered by ownership and UUID prefix, and every foreign-key blocker. Confirmation requires an exact match to the current stored email with no trimming or case normalization.

Execution atomically revalidates `role = 'student'`, `is_active = false`, profile/Auth email correspondence, the confirmation email, preview validity, and blocker absence before setting `deletion_pending_at`. It explicitly bans Auth and records `signed_upload_quarantine_until = deletion_pending_at + interval '2 hours'`. No new signed upload grant may be issued after claim. Final all-bucket reconciliation and Auth deletion cannot occur until quarantine has elapsed, because previously issued signed upload tokens may remain usable during that window. A claimed Student remains banned and cannot be restored, including while a run is partial.

Reactivation uses an atomic `reactivate_profile_if_unclaimed` RPC that changes the inactive profile to active only when `deletion_pending_at IS NULL`. Only after it succeeds may the server unban Auth. An Auth-unban failure is compensated by returning the profile to inactive. Both normal reactivation and restoration during account creation use this ordering. When the maintenance RPC/column is missing on the previous schema, these two existing flows detect that specific missing-schema response and use their legacy ordering. The database enforces `deletion_pending_at IS NULL OR is_active = false`.

Delete only Student-owned:

- Daily entries and Maha Mantra evidence.
- Gita attendance rows.
- Weekly-program entries.
- Leave requests and attachments.
- The linked attendance person, its records, and its event mappings.
- Avatar and all managed objects found by `owner_id`, Student UUID prefix, or database reference.

Every other foreign key to `profiles` is preflighted. References through profile creation, Mentor assignment, settings attribution, global resource/program/event creation, recording attribution, or leave decisions are blockers rather than reasons to delete global data.

Objects owned by or suspiciously prefixed with the Student UUID in an unknown bucket block deletion. A managed object referenced by any non-target row also blocks deletion, regardless of owner or prefix. A non-null owner different from the target is an unconditional blocker; ownership must be corrected through a separate object-remediation operation before generating a new Student-deletion preview. Target email confirmation never overrides mismatched ownership. Null-owner objects under the target prefix may be removed only when no non-target reference exists.

Each task is tied to the observed Storage object ID and version. A changed or replaced object at the same path makes the task stale. Pending-deletion paths are reserved: authenticated Storage insert/update policies and database path-assignment triggers reject a path actively claimed by cleanup. Previously issued signed uploads are handled by the two-hour quarantine. Managed objects are enumerated again after removal, after quarantine, and immediately before Auth deletion.

Persist phases `claimed`, `upload_quarantine`, `storage_cleared`, `database_cleared`, `auth_deleted`, and `completed` using compare-and-swap transitions. Hard-delete the Auth identity with `auth.admin.deleteUser(id, false)`, then verify both Auth identity and profile absence. A replay where both are already absent is successful. If Auth reports a Storage ownership blocker, return to all-bucket reconciliation: clear managed late arrivals and surface unknown-bucket objects as actionable blockers.

Student-deletion run rows retain target UUID, email, and name snapshots without a restrictive profile foreign key. Audit finalization and the run's terminal transition occur in one database transaction, using a unique cleanup-run correlation key so a lost response cannot insert a duplicate audit event.

Change the profile-to-Auth foreign key to `ON DELETE CASCADE`. Change the audit actor foreign key to `ON DELETE SET NULL`. Narrow the audit immutability trigger so it permits only a non-null-to-null `actor_id` transition with the ID and every payload field unchanged; all ordinary audit update privileges remain revoked.

## Security

- Every page, action, and route requires an active `super_admin` session before creating a service-role client.
- Worker invocation requires a random `CLEANUP_WORKER_SECRET` of at least 32 bytes.
- Maintenance tables use RLS plus forced RLS and explicitly revoke schema/table/function access from `PUBLIC`, `anon`, and `authenticated`. The migration explicitly grants the minimum table and function privileges to `service_role`.
- Worker RPCs live in `public` because only that schema is exposed by the local Data API. They explicitly revoke execute from `PUBLIC`, `anon`, and `authenticated`, grant execute only to `service_role`, use `search_path = ''`, qualify every relation, use fixed category dispatch, and independently validate the attributed actor is an active Super Admin. They never mutate `storage.objects`; object removal remains Storage-API-only.
- Cross-origin state-changing requests are rejected.
- The audit constraint becomes the union of every value already allowed by the latest migration, currently emitted application values including `student_birthdate_updated` and `weekly_program_reopened`, and new maintenance values. Maintenance audit insertion errors are surfaced rather than silently ignored; unrelated existing workflows are not broadened into this transaction refactor.
- Errors exposed to the UI contain no service credentials, SQL detail, raw Storage response, or private object path.

## Backward-Compatible Migration Requirements

The implementation adds one new transactional, forward-only migration and never edits existing migration files.

- Existing tables, columns, types, RPCs, policies, and grants are not renamed or removed.
- New profile state is nullable and requires no backfill or table rewrite. New code uses the atomic reactivation RPC when available and a guarded legacy fallback only for the previous schema's specific missing-RPC/column error.
- New maintenance tables are isolated from current application queries.
- Existing audit action values are preserved when the check constraint is extended.
- Foreign-key replacements use add, validate, and brief swap steps where PostgreSQL permits, reducing lock duration.
- The audit-trigger replacement preserves all existing immutability behavior except the explicit actor-nulling cascade.
- Missing-schema handling is limited to the new maintenance UI/actions plus the two explicitly enumerated guarded fallbacks for normal reactivation and creation-time restoration.
- Migration failure rolls back the complete migration.
- Old application code continues to operate against the migrated schema; new application code continues to operate with maintenance disabled against the previous schema.

Regression coverage must prove account creation/reactivation, profile edits, daily entries and evidence, leave submission/withdrawal/decision, attendance, resources, settings, reports, and authentication retain existing behavior.

## Capacity Reporting

Storage bytes are exact only when object metadata supplies a size. Database bytes are labelled **estimated logical row payload** and may omit page, index, and TOAST effects. PostgreSQL may reuse deleted space internally without immediately lowering the reported project size. The application does not run `VACUUM FULL` because it takes exclusive table locks.

## Verification Requirements

Tests must cover:

- pgTAP authorization, grants, RLS, role validation, retention boundaries, candidate staleness, audit null-only mutation, and every profile foreign-key blocker.
- Concurrent automatic requests, one run per India date, global serialization, lease expiry/recovery, toggle cancellation, manual overlap, and run-detail housekeeping.
- Default-off first dashboard access and a concurrent automatic enqueue/toggle-off race, proving no run or destructive batch starts while disabled.
- Storage ownership/prefix union, unknown buckets, null or mismatched owners, cross-Student references, same-path replacement after an ambiguous response, current and stale avatars, exact 24-hour boundary, pagination, more than 500 objects, removal retries, path reservation, and reference rechecks.
- Failure injection after every Student-deletion phase, an old fenced worker resuming after lease reclamation, and convergence without reactivation or duplicate audit.
- A pre-claim signed leave-upload grant used during deletion quarantine, proving deletion cannot complete while its late object remains.
- Next.js route authorization, same-origin enforcement, forged input rejection, exact-email matching, dashboard non-blocking behavior, unavailable-schema rendering, and existing-workflow regression.
- Netlify worker secret validation, bundling, lease behavior, retry termination, and self-invocation rules.
- A real local Supabase integration harness that seeds database, Auth, and Storage state and verifies row, object, Auth, profile, and audit outcomes.

Use pinned development tooling: `supabase@2.116.0`, `netlify-cli@26.2.0`, and `@netlify/functions@6.0.0`. Add reproducible `test:db`, `test:cleanup:integration`, `verify:netlify`, and `verify:cleanup` scripts. The no-deploy function bundle check must assert that both the cleanup worker and hourly dispatcher are classified with their intended Netlify background/scheduled configurations, not merely compile.

## Repository and Delivery Constraints

- Do not commit, push, merge, tag, deploy, or apply a production migration.
- Keep all tracked changes uncommitted in the current workspace.
- Use the subagent-driven development delegation and independent-review pattern, replacing commit-SHA review packages with per-task patch snapshots and the gitignored ledger `.superpowers/sdd/admin-data-cleanup/progress.md`.
