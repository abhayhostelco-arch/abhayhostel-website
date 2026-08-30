# Admin Data Cleanup and Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` task-by-task. The user's no-commit instruction overrides that skill's commit mechanics: never run `git add`, `git commit`, push, merge, tag, deploy, or production migration commands. The controller supplies a task brief and records a per-task patch in `.superpowers/sdd/admin-data-cleanup/` for independent review.

**Goal:** Add backward-compatible, Super Admin-only historical cleanup, non-blocking automatic retention, and resumable inactive-Student deletion across Supabase Postgres, Storage, Auth, Next.js, and Netlify.

**Architecture:** A forward-only migration adds isolated maintenance state and service-role-only RPCs. Authenticated Next.js routes/actions create durable runs; a secret-authenticated Netlify Background Function processes fenced, idempotent batches through a shared server-only cleanup core. Storage is inspected through read-only metadata and mutated only through the Storage API.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Zod 4, Supabase JS 2.112, PostgreSQL/pgTAP, Netlify Background/Scheduled Functions, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-30-admin-data-cleanup-design.md`

## Global Constraints

- Only active `super_admin` users may view or initiate maintenance.
- Automatic cleanup defaults off and uses a fixed strict 90-day India-time cutoff.
- Historical dates use `< India today - N`; exactly-N-day-old records remain.
- Pending leaves, active programs, profiles/Auth, audit payloads, settings, definitions, and mappings are never auto-purged.
- Archived resource URLs are manual-only; there is no resource-upload bucket.
- Storage metadata is read-only SQL state; object removal uses the Storage API in batches of at most 500.
- Permanent Student deletion requires inactive role, exact current email, two-hour signed-upload quarantine, no blockers, and durable phases.
- One fenced global lease serializes destructive batches.
- New code must work before the migration through maintenance-unavailable behavior and the two guarded legacy reactivation fallbacks.
- Do not edit existing migration files.
- Do not commit, push, deploy, or apply the migration to production.
- Application, Supabase, npm, and Netlify commands run from `portal`; repository snapshot/status commands run from the repository root.

## Fixed Operational Constants

```ts
export const CLEANUP_LEASE_MS = 17 * 60_000;
export const CLEANUP_WORK_BUDGET_MS = 13 * 60_000;
export const CLEANUP_EXTERNAL_TIMEOUT_MS = 10_000;
export const CLEANUP_OBJECT_BATCH_SIZE = 500;
export const CLEANUP_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000] as const;
export const CLEANUP_PREVIEW_TTL_MS = 15 * 60_000;
export const SIGNED_UPLOAD_TTL_MS = 2 * 60 * 60_000;
```

The worker secret is base64url-decoded and must contain at least 32 bytes. A worker stops claiming new work at 13 minutes, while its 17-minute lease outlives Netlify's 15-minute invocation ceiling. Every outbound function/Storage request has a 10-second timeout.

---

## File Structure

- `portal/supabase/migrations/202608300001_admin_data_cleanup.sql`: all additive schema, constraints, policies, triggers, and maintenance RPCs.
- `portal/supabase/tests/cleanup.sql`: pgTAP coverage for boundaries, permissions, state transitions, fencing, blockers, and backward compatibility.
- `portal/src/lib/cleanup/types.ts`: shared maintenance enums and result contracts.
- `portal/src/lib/cleanup/schemas.ts`: browser/action/worker input validation.
- `portal/src/lib/cleanup/repository.ts`: service-role RPC adapter and read-only status/preview loading.
- `portal/src/lib/cleanup/worker.ts`: provider-independent orchestration over injected Supabase/Auth/Storage dependencies.
- `portal/src/app/actions/cleanup.ts`: authenticated manual/toggle/preview/confirm/resume actions.
- `portal/src/app/api/admin/cleanup/auto/route.ts`: same-origin automatic enqueue/dispatch route.
- `portal/netlify/functions/cleanup-worker.mts`: secret-authenticated background entrypoint.
- `portal/netlify/functions/cleanup-dispatcher.mts`: hourly scheduled due-run dispatcher.
- `portal/src/components/admin-cleanup-panel.tsx`: Admin profile maintenance UI.
- `portal/src/components/auto-cleanup-trigger.tsx`: non-blocking dashboard trigger.
- `portal/scripts/cleanup-integration.ts`: real local Supabase integration harness.
- `portal/scripts/verify-netlify-functions.mjs`: validates the bundled function manifest/classification.
- `/.gitignore`: ignores the root SDD scratch workspace before task implementation starts.

## Public Interfaces

```ts
export const cleanupCategories = [
  "daily_entries",
  "gita_attendance",
  "weekly_programs",
  "attendance_records",
  "completed_leaves",
  "archived_resources",
  "orphan_files",
] as const;

export type CleanupCategory = (typeof cleanupCategories)[number];
export type CleanupMode = "auto" | "manual" | "student_delete";
export type CleanupStatus =
  | "previewed" | "queued" | "running" | "completed"
  | "partial" | "failed" | "cancelled";

export type CleanupPhase = "history_database" | "object_removal" | StudentDeletionPhase;

export type StudentDeletionPhase =
  | "claimed" | "auth_banned" | "upload_quarantine"
  | "storage_cleared" | "database_cleared" | "auth_deleted" | "completed";

export type CleanupBlockerCode =
  | "PROFILE_REFERENCE" | "UNKNOWN_BUCKET_OBJECT"
  | "NON_TARGET_REFERENCE" | "MISMATCHED_OWNER"
  | "AUTH_EMAIL_MISMATCH" | "ACTIVE_STUDENT";

export interface CleanupSettingsView {
  automaticEnabled: boolean;
  lastAutomaticRunId: string | null;
  lastAutomaticStartedAt: string | null;
  lastAutomaticFinishedAt: string | null;
  lastAutomaticStatus: CleanupStatus | null;
  lastAutomaticSummary: CleanupSummary | null;
}

export interface CleanupPreviewImpact {
  rowCounts: Record<CleanupCategory, number>;
  objectCount: number;
  knownObjectBytes: number;
  unknownObjectSizeCount: number;
  estimatedLogicalRowBytes: number;
  blockers: Array<{ code: CleanupBlockerCode; label: string }>;
}

export interface StudentDeletionImpact extends CleanupPreviewImpact {
  studentId: string;
  studentName: string;
  studentEmail: string;
  quarantineUntil: string | null;
}

export interface CleanupSummary {
  rowsDeleted: Record<string, number>;
  rowsSkipped: Record<string, number>;
  objectsDeleted: number;
  objectsFailed: number;
  objectBytesDeleted: number;
  estimatedLogicalRowBytes: number;
}

export interface CleanupRunView {
  id: string;
  mode: CleanupMode;
  status: CleanupStatus;
  phase: CleanupPhase;
  createdAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  cutoffDate: string | null;
  categories: CleanupCategory[];
  previewExpiresAt: string | null;
  nextWorkAt: string | null;
  summary: CleanupSummary;
  errorSummary: string | null;
  previewImpact: CleanupPreviewImpact | StudentDeletionImpact | null;
}

export interface ClaimedWork {
  run: CleanupRunView;
  workerId: string;
  generation: number;
  leaseExpiresAt: string;
}

export type ManagedBucket =
  | "student-avatars" | "maha-mantra-evidence" | "leave-applications";

export interface ObjectTask {
  id: string;
  bucket: ManagedBucket;
  path: string;
  objectId: string;
  observedVersion: string;
  attemptCount: number;
}

export interface RemoveResult {
  taskId: string;
  outcome: "deleted" | "missing" | "stale" | "retryable" | "permanent_failure";
  errorClass?: string;
}

export interface CleanupWorkerDependencies {
  claimLease(runId: string, workerId: string): Promise<ClaimedWork | null>;
  releaseLease(runId: string, workerId: string, generation: number): Promise<void>;
  processDatabaseBatch(claim: ClaimedWork, limit: number): Promise<{ remaining: boolean }>;
  claimObjectBatch(claim: ClaimedWork, limit: number): Promise<ObjectTask[]>;
  completeObjectTasks(claim: ClaimedWork, results: RemoveResult[]): Promise<void>;
  finalizeRun(claim: ClaimedWork): Promise<CleanupStatus>;
  removeObjects(bucket: ManagedBucket, tasks: ObjectTask[], timeoutMs: number): Promise<RemoveResult[]>;
  banUser(userId: string): Promise<{ error: string | null }>;
  readAuthUser(userId: string): Promise<{ exists: boolean; email: string | null; banned: boolean }>;
  hardDeleteUser(userId: string): Promise<{ error: string | null }>;
  profileExists(userId: string): Promise<boolean>;
  invoke(runId: string): Promise<boolean>;
  sleep(milliseconds: number): Promise<void>;
  now(): Date;
}
```

The worker entrypoint accepts only `{ runId: UUID }` and the fixed-length decoded secret header. The scheduled dispatcher accepts Netlify's scheduled event without an inbound cleanup secret, loads server credentials internally, and adds the secret only to outgoing worker invocations. Browser routes never accept actor IDs, automatic retention days, or automatic categories.

---

### Task 0: Tooling and No-Commit Review Protocol Bootstrap

**Files:**
- Create: `/.gitignore`
- Modify: `portal/package.json`
- Modify: `portal/package-lock.json`
- Modify: `portal/.gitignore`

**Interfaces:** Makes all later commands and untracked-file review reproducible before any implementation task begins.

- [ ] **Step 1: Add the root scratch ignore**

Add `/.superpowers/sdd/` to the root `.gitignore`. Keep `/.netlify/` ignored and add only generated function output if needed.

- [ ] **Step 2: Install pinned tooling before later tasks consume it**

Add `@netlify/functions@6.0.0`, `netlify-cli@26.2.0`, and `supabase@2.116.0` to `portal` devDependencies. Add these scripts before later tasks consume them:

```json
{
  "test:db": "supabase test db",
  "test:cleanup:integration": "tsx scripts/cleanup-integration.ts",
  "verify:netlify": "netlify functions:build --src netlify/functions --functions .netlify/functions-dist && node scripts/verify-netlify-functions.mjs .netlify/functions-dist",
  "verify:cleanup": "npm run test:db && npm run test:cleanup:integration && npm run verify:netlify"
}
```

Do not change existing build scripts.

- [ ] **Step 3: Bootstrap the untracked-file review protocol**

Create `.superpowers/sdd/admin-data-cleanup/progress.md` with the plan path as its first line. For each task, snapshot the declared allowed paths plus `git status --porcelain=v1` and SHA-256 hashes before and after. Copy absent files as explicit markers; do not rely on `git diff`, which omits untracked files. Produce the review patch with `git diff --no-index --binary before-tree after-tree`; accept exit status 1 as “differences found.”

- [ ] **Step 4: Run tooling checks**

Run `npm install --package-lock-only` from `portal`, then `npm test -- --run` and `npm run verify:netlify`. Expected: the new scripts exist; feature tests are not yet present.

- [ ] **Step 5: Record the bootstrap in the ledger**

Record task status, snapshots, and the explicit prohibition on staging, committing, pushing, deploying, or applying production migrations.

---

### Task 1: Maintenance Schema, Security, and State Machine

**Files:**
- Create: `portal/supabase/migrations/202608300001_admin_data_cleanup.sql`
- Create: `portal/supabase/tests/cleanup.sql`
- Modify: `portal/src/lib/schema-compat.ts`
- Test: `portal/src/lib/schema-compat.test.ts`

**Interfaces:**
- Produces the tables, checks, indexes, fencing lease, audit correlation, `profiles.deletion_pending_at`, path-reservation helper, and service-role-only RPC foundations consumed by every later task.
- Produces `isMissingCleanupSchemaError(error): boolean` that recognizes missing maintenance relations, columns, and `PGRST202` missing RPC responses without treating arbitrary errors as compatibility fallbacks.

- [ ] **Step 1: Write failing schema-compat tests**

```ts
expect(isMissingCleanupSchemaError({ code: "PGRST202", message: "function not found" })).toBe(true);
expect(isMissingCleanupSchemaError({ code: "23505", message: "duplicate" })).toBe(false);
```

- [ ] **Step 2: Add pgTAP tests for defaults and grants**

Assert the toggle defaults false, new profile state is null, anon/authenticated cannot execute each maintenance RPC, `service_role` can, maintenance tables force RLS, and existing profile/account rows survive migration unchanged.

- [ ] **Step 3: Run focused tests and confirm failure**

Run `npm test -- src/lib/schema-compat.test.ts` and `npx supabase@2.116.0 test db supabase/tests/cleanup.sql`. Expected: missing symbols/relations.

- [ ] **Step 4: Implement additive schema**

Use text checks rather than new globally shared enums so later status additions do not require enum rewrites. Add indexes for `(status, next_work_at)`, unique auto India date, candidate `(run_id, category, entity_id)`, task `(run_id, bucket_id, object_name)`, and unique audit cleanup correlation.

The global lease fields are `active_run_id`, `lease_owner`, `lease_generation bigint`, and `lease_expires_at`. Every mutating RPC takes `p_generation bigint` and rejects a mismatch.

Add the invariant:

```sql
alter table public.profiles add constraint profiles_deletion_pending_inactive
check (deletion_pending_at is null or is_active = false);
```

The audit trigger permits only `old.actor_id is not null AND new.actor_id is null` with `id`, `action`, `target_id`, `metadata`, and `created_at` unchanged. Extend its action constraint with the complete existing/currently-emitted/new union.

Add nullable `audit_events.cleanup_run_id uuid` with a unique partial index `where cleanup_run_id is not null`; do not add a restrictive foreign key because run detail is housekept. Include this column in the audit immutability comparison. New maintenance actions are exactly `cleanup_settings_updated`, `cleanup_history_completed`, `cleanup_history_partial`, `student_deletion_completed`, and `student_deletion_partial`.

- [ ] **Step 5: Implement security and state RPC foundations**

Create public service-role-only RPCs with exact names:

```text
cleanup_get_settings()
cleanup_update_auto(actor_uuid, enabled_boolean)
cleanup_claim_lease(run_uuid, worker_uuid)
cleanup_release_lease(run_uuid, worker_uuid, generation_bigint)
cleanup_get_run(run_uuid)
cleanup_resume_run(actor_uuid, run_uuid)
cleanup_cancel_expired_previews()
```

Each actor-taking RPC checks an active `super_admin`. Revoke execute from `PUBLIC`, `anon`, and `authenticated`; grant to `service_role` only.

Define terminal operations before any worker uses them:

```text
cleanup_finalize_run(run_uuid, worker_uuid, generation_bigint, final_status, summary_jsonb) -> jsonb
cleanup_housekeep_terminal_runs() -> integer
```

Finalization atomically writes aggregate counts, updates automatic last-run fields, inserts one correlated maintenance audit event, and transitions the terminal state. Housekeeping deletes candidate/task detail only after aggregate and audit correlation exist. Resume resets permanent object failures to pending and clears only safe retry state.

- [ ] **Step 6: Implement cleanup schema compatibility detection**

Add the focused helper and use no broad catch-all beyond known missing-schema codes/text.

- [ ] **Step 7: Run focused tests**

Expected: schema-compat tests pass and pgTAP foundations pass.

- [ ] **Step 8: Save task patch and report**

Controller records an uncommitted binary patch and sends it with this task brief to an independent reviewer.

---

### Task 2: Historical Preview and Transactional Database Cleanup

**Files:**
- Modify: `portal/supabase/migrations/202608300001_admin_data_cleanup.sql`
- Modify: `portal/supabase/tests/cleanup.sql`

**Interfaces:**
- Produces:

```text
cleanup_preview_history(actor_uuid, retention_days_int, categories_text[]) -> run_uuid
cleanup_enqueue_auto(actor_uuid) -> nullable run_uuid
cleanup_confirm_preview(actor_uuid, run_uuid) -> boolean
cleanup_process_database_batch(run_uuid, worker_uuid, generation_bigint, limit_int) -> jsonb
cleanup_claim_object_batch(run_uuid, worker_uuid, generation_bigint, limit_int) -> jsonb
cleanup_complete_object_tasks(run_uuid, worker_uuid, generation_bigint, results_jsonb) -> jsonb
cleanup_dispatch_due_runs() -> uuid[]
```

- [ ] **Step 1: Write pgTAP boundary and selection tests**

For every category seed records at N-1, exactly N, and N+1 India days. Assert strict `<`. Assert pending leaves, active weekly programs, published resources, definitions, mappings, profiles, audit events, and settings are excluded.

- [ ] **Step 2: Write exact-candidate and stale tests**

Preview, then republish a resource, reopen a program, add/change a weekly child, change a leave status, or change a file reference. Confirm changed candidates are stale/skipped and unseen rows are never selected.

- [ ] **Step 3: Write auto-toggle and concurrency tests**

Assert default-off produces no run, simultaneous enqueue yields one India-day run, concurrent disable prevents work, cancelled same-day auto does not restart, and the next India day can create a run.

- [ ] **Step 4: Run pgTAP and confirm failure**

- [ ] **Step 5: Implement exact preview materialization**

Allow retention values only `90`, `180`, or `365`; automatic SQL hard-codes 90 and excludes `archived_resources`. Calculate India date/instant inside PostgreSQL. Materialize exact row IDs and weekly child IDs/fingerprint. Read `storage.objects` for candidate identity/metadata only.

- [ ] **Step 6: Implement fenced database batches**

Lock/revalidate exact candidates, delete eligible database rows, and enqueue linked object tasks in the same transaction. Preserve rows when eligibility or version changed. Return only aggregate counts and safe task metadata.

- [ ] **Step 7: Implement path reservation and object completion**

Recreate the existing managed-bucket insert/update policies with an added `not private.cleanup_path_reserved(bucket_id, name)` predicate. Add assignment triggers for avatar, evidence, and leave paths. Complete tasks only when object ID/version still matches; changed paths become stale.

- [ ] **Step 8: Run all cleanup pgTAP tests**

- [ ] **Step 9: Save task patch and obtain independent task review**

---

### Task 3: Atomic Reactivation and Permanent Student Deletion SQL

**Files:**
- Modify: `portal/supabase/migrations/202608300001_admin_data_cleanup.sql`
- Modify: `portal/supabase/tests/cleanup.sql`
- Modify: `portal/src/app/actions/accounts.ts`
- Modify: `portal/src/app/actions/leave.ts`
- Test: `portal/src/app/actions/accounts.test.ts`
- Test: `portal/src/app/actions/leave.test.ts`

**Interfaces:**
- Produces:

```text
reactivate_profile_if_unclaimed(actor_uuid, target_uuid) -> boolean
cleanup_preview_student(actor_uuid, target_uuid) -> run_uuid
cleanup_confirm_student(actor_uuid, run_uuid, exact_email_text) -> boolean
cleanup_process_student_database(run_uuid, worker_uuid, generation_bigint) -> jsonb
```

- [ ] **Step 1: Write account-action tests**

Mock the new RPC. Assert profile-first activation, Auth unban only after success, compensation to inactive on unban failure, claimed-profile refusal, creation-time restoration ordering, and legacy fallback only for a recognized missing cleanup RPC.

- [ ] **Step 2: Write the complete FK blocker matrix in pgTAP**

Test owned dependencies separately from blockers through `profiles.created_by`, `profiles.mentor_id`, both settings tables, resource/program/person/event creators, attendance/Gita recorders, and leave deciders.

- [ ] **Step 3: Write Student workflow tests**

Cover exact email, inactive role, Auth/profile email mismatch, two-hour quarantine, managed owner/prefix/reference union, cross-Student references, mismatched non-null owner, unknown buckets, null owner, compare-and-swap phases, audit idempotency, and replay when Auth/profile are already absent.

- [ ] **Step 4: Run focused tests and confirm failure**

- [ ] **Step 5: Implement atomic reactivation and guarded fallback**

Preserve `canManage` semantics inside `reactivate_profile_if_unclaimed`: Super Admin may reactivate eligible non-Super-Admins; Mentor may reactivate only an assigned Student. Use the RPC before Auth unban. On failure to unban, update `is_active=false` through the service client. Apply the same sequence to inactive-account restoration. Treat only `PGRST202` for this exact RPC or the exact `deletion_pending_at` column error as legacy fallback; permission, validation, and network errors remain failures.

- [ ] **Step 6: Implement Student preview/claim SQL**

Add `cleanup_begin_signed_upload_grant(actor_uuid, request_uuid, path_text, expires_at)` and `cleanup_finish_signed_upload_grant(grant_uuid)` RPCs. The begin RPC locks the Student profile, rejects `deletion_pending_at`, and records an active grant before `createSignedUploadUrl`; the leave action rolls it back when URL creation fails. Claim locks the same profile, revalidates blockers, and transitions to `claimed`; the worker then bans/verifies Auth before moving to `auth_banned` and `upload_quarantine`, computing quarantine as the maximum of the two-hour grant expiries and claim-plus-two-hours. Student-owned rows are exact candidates; unsafe ownership/reference cases are blockers.

- [ ] **Step 7: Implement Student database purge and Auth-cascade support**

Delete owned dependencies only. Replace the profile/Auth FK through add/validate/swap and use audit actor `ON DELETE SET NULL`. Final audit insertion and terminal phase use the unique run correlation in one transaction. Include compare-and-swap phase transitions and treat Auth/profile already absent as successful replay.

- [ ] **Step 8: Run account and pgTAP tests**

- [ ] **Step 9: Save task patch and obtain independent task review**

---

### Task 4: Cleanup Domain Types and Provider-Independent Worker

**Files:**
- Create: `portal/src/lib/cleanup/types.ts`
- Create: `portal/src/lib/cleanup/schemas.ts`
- Create: `portal/src/lib/cleanup/repository.ts`
- Create: `portal/src/lib/cleanup/worker.ts`
- Create: `portal/src/lib/cleanup/worker.test.ts`
- Modify: `portal/src/lib/types.ts`
- Modify: `portal/src/lib/env.ts`
- Test: `portal/src/lib/validation.test.ts`

**Interfaces:** Implements the shared types above plus:

```ts
export async function processCleanupRun(
  runId: string,
  dependencies: CleanupWorkerDependencies,
): Promise<{ status: "completed" | "partial" | "deferred" | "busy" }>;

export function verifyWorkerSecret(
  supplied: string | null,
  expected: string,
): boolean;
```

- [ ] **Step 1: Write worker tests before implementation**

Cover invalid secret, no lease, fencing rejection, DB batch progression, 500-object maximum, exact identity recheck, five total attempts with 1/2/4/8-second injected timers, permanent failure, Auth ban failure/retry, quarantine deferral, Storage-blocker reconciliation, unknown-bucket partial state, toggle cancellation, worker safety deadline, lease release, and successor invocation only for immediately eligible work.

- [ ] **Step 2: Write Zod input tests**

Allow only UUID run IDs, retention presets, category allowlist, boolean toggle, and exact unmodified confirmation strings. Automatic schema accepts no retention/categories/actor.

- [ ] **Step 3: Run worker/validation tests and confirm failure**

- [ ] **Step 4: Implement types, schemas, and secret validation**

Decode secrets to fixed-length buffers, require at least 32 bytes of entropy, reject length mismatch before `timingSafeEqual`, and never log the supplied secret.

- [ ] **Step 5: Implement repository adapter**

All privileged calls use `createAdminClient()` behind authenticated routes or the worker secret boundary. Convert RPC JSON into typed results and map raw errors to safe classifications.

- [ ] **Step 6: Implement the worker state machine**

Use dependency injection for time, sleep, RPCs, Storage, Auth, and successor invocation. Await bounded work; do not detach promises. Release the fenced lease on every terminal/deferred path.

- [ ] **Step 7: Extend environment validation**

Add `getCleanupWorkerEnv()` that validates and decodes `CLEANUP_WORKER_SECRET` only at cleanup route/function boundaries. Keep `getServerEnv()` and public-env detection compatible without the cleanup secret. Tests prove non-maintenance pages/actions still work when the cleanup secret is absent.

- [ ] **Step 8: Run focused tests, typecheck, and lint for new files**

- [ ] **Step 9: Save task patch and obtain independent task review**

---

### Task 5: Netlify Background/Scheduled Functions and Automatic Route

**Files:**
- Create: `portal/netlify/functions/cleanup-worker.mts`
- Create: `portal/netlify/functions/cleanup-dispatcher.mts`
- Create: `portal/src/app/api/admin/cleanup/auto/route.ts`
- Create: `portal/src/app/api/admin/cleanup/auto/route.test.ts`
- Create: `portal/src/lib/cleanup/netlify.ts`
- Test: `portal/src/lib/cleanup/netlify.test.ts`
- Modify: `portal/netlify.toml`

**Interfaces:**
- `POST /api/admin/cleanup/auto` returns `202` for enqueued/resumed, `204` when disabled/no work, `401/403` for auth failures, and `403` for cross-origin requests.
- The background worker accepts only server-secret-authenticated requests. The scheduled dispatcher accepts Netlify's scheduled event payload without an inbound cleanup secret, loads server credentials internally, and places the secret only on outgoing worker invocations.

- [ ] **Step 1: Write route tests**

Assert Origin/Sec-Fetch-Site rejection, unauthenticated/mentor rejection before admin client creation, default-off no-op, run enqueue, due-run dispatch, sanitized failure, and no browser-controlled privileged inputs.

- [ ] **Step 2: Write function-entry tests**

Assert `background: true` on the worker, `config.schedule = "@hourly"` on the dispatcher, worker secret refusal, scheduled-event acceptance, only run-ID payloads to the worker, due-run iteration, and no automatic-run creation by the scheduled dispatcher.

- [ ] **Step 3: Run tests and confirm failure**

- [ ] **Step 4: Implement server-to-server invocation helper**

Use canonical `NEXT_PUBLIC_APP_URL`, fixed internal function paths, secret header, short request timeout, and safe boolean result. A failed invocation leaves the run queued.

- [ ] **Step 5: Implement route and functions**

The route authenticates with the session client, then uses the service role. The worker calls `processCleanupRun`. The dispatcher handles Netlify's scheduled event, requests due run IDs, and invokes the background worker for each without creating daily auto runs. It is not protected by an inbound cleanup-secret header.

- [ ] **Step 6: Configure Netlify classification**

Keep `config.background = true` beside the worker and `config.schedule = "@hourly"` beside the dispatcher. Add only the required functions directory configuration without altering existing Next build/publish settings.

- [ ] **Step 7: Run tests and local function bundle**

Run `npm test -- src/app/api/admin/cleanup/auto/route.test.ts src/lib/cleanup/netlify.test.ts` and the no-deploy function build.

- [ ] **Step 8: Save task patch and obtain independent task review**

---

### Task 6: Super Admin Actions and Profile Maintenance UI

**Files:**
- Create: `portal/src/app/actions/cleanup.ts`
- Create: `portal/src/components/admin-cleanup-panel.tsx`
- Create: `portal/src/components/admin-cleanup-panel.test.tsx`
- Create: `portal/src/components/auto-cleanup-trigger.tsx`
- Modify: `portal/src/app/admin/profile/page.tsx`
- Modify: `portal/src/app/admin/page.tsx`
- Modify: `portal/src/app/globals.css`

**Interfaces:**

```ts
updateAutoCleanupAction(previous: ActionState, formData: FormData): Promise<ActionState>
previewHistoricalCleanupAction(previous: ActionState, formData: FormData): Promise<ActionState>
confirmCleanupPreviewAction(previous: ActionState, formData: FormData): Promise<ActionState>
previewStudentDeletionAction(previous: ActionState, formData: FormData): Promise<ActionState>
confirmStudentDeletionAction(previous: ActionState, formData: FormData): Promise<ActionState>
resumeCleanupRunAction(formData: FormData): Promise<void>
```

- [ ] **Step 1: Write component/action tests**

Cover Super Admin-only rendering, toggle warning/default, presets/checklist, preview counts and labels, exact email with whitespace/case mismatch, disabled destructive button before match, stale/expired preview, partial progress/Resume, safe errors, migration-unavailable state, and preservation of existing Staff profile content.

- [ ] **Step 2: Write auto-trigger test**

Assert one mount POST with `keepalive:true`, swallowed network rejection, and no awaited UI state/navigation dependency.

- [ ] **Step 3: Run UI tests and confirm failure**

- [ ] **Step 4: Implement authenticated actions**

Every action calls `requireProfile(["super_admin"])` before `createAdminClient()`. Parse through cleanup schemas, revalidate paths, and dispatch queued work. Missing cleanup schema returns the maintenance-unavailable message; other errors remain failures.

- [ ] **Step 5: Implement Admin-only profile composition**

Keep `StaffProfilePage` unchanged. Render it and the new maintenance panel from the Admin profile page. Load maintenance data with a server-only helper and graceful missing-schema handling.

- [ ] **Step 6: Add dashboard trigger**

Mount the small client trigger in both `/admin/page.tsx` and `/admin/profile/page.tsx`; it does not block server rendering and dispatches due manual/Student runs as well as the enabled automatic run.

- [ ] **Step 7: Add scoped responsive styles**

Follow existing panels, form messages, status pills, and mobile breakpoints. Do not refactor unrelated CSS.

- [ ] **Step 8: Run UI tests, typecheck, and lint**

- [ ] **Step 9: Save task patch and obtain independent task review**

---

### Task 7: Tooling, Local Integration Harness, and Documentation

**Files:**
- Modify: `portal/.env.example`
- Modify: `portal/docs/DEPLOYMENT.md`
- Modify: `portal/docs/SECURITY.md`
- Create: `portal/scripts/cleanup-integration.ts`
- Create: `portal/scripts/verify-netlify-functions.mjs`

**Interfaces:** Completes the integration harness and operational documentation. Pinned dependencies and scripts are created in Task 0.

- [ ] **Step 1: Add a failing integration harness skeleton**

The script must refuse non-local Supabase URLs, create unique fixture IDs, seed Auth/database/all three buckets, invoke the shared worker core, assert database/object/Auth/audit results and crash recovery, and clean up only its validated fixture prefix in `finally`.

- [ ] **Step 2: Document configuration and operations**

Add a placeholder-format `CLEANUP_WORKER_SECRET` entry to `.env.example`, document generation of at least 32 decoded random bytes, maintenance migration application, background/scheduled functions, monitoring, Resume, quota-report caveats, and no `VACUUM FULL` automation.

- [ ] **Step 3: Complete real integration scenarios**

Cover historical deletion, pending/active protection, orphan removal, Student signed-upload quarantine, late object reconciliation, hard Auth/profile cascade, audit preservation, unknown-bucket blocker, ambiguous Storage response retry, and fenced stale worker rejection.

- [ ] **Step 4: Run the local integration harness**

Run only against a validated loopback stack using `npx supabase@2.116.0 db reset --local` and `npm run test:cleanup:integration`. Expected: all scenarios pass and fixture cleanup completes.

- [ ] **Step 5: Run Netlify function bundle verification**

Run `npm run verify:netlify`; `verify-netlify-functions.mjs` must inspect the generated manifest/artifacts and fail unless the worker is background and dispatcher is scheduled with `@hourly`.

- [ ] **Step 6: Save task patch and obtain independent task review**

---

### Task 8: Full Regression, Security Review Package, and Completion Evidence

**Files:**
- Modify only files required by failures directly caused by Tasks 1–7.
- Create/update: `.superpowers/sdd/admin-data-cleanup/progress.md` and task patch/report artifacts (gitignored).

- [ ] **Step 1: Run database reset and pgTAP suite**

```bash
npx supabase@2.116.0 start
npx supabase@2.116.0 db reset --local
npx supabase@2.116.0 test db supabase/tests/cleanup.sql
```

- [ ] **Step 2: Run cleanup integration verification**

```bash
npm run test:cleanup:integration
```

- [ ] **Step 3: Run the complete existing portal verification**

```bash
npm run verify
```

- [ ] **Step 4: Run the cleanup-specific aggregate verification**

```bash
npm run verify:cleanup
```

- [ ] **Step 5: Verify the requirements-to-tests matrix**

Record exact evidence for every binding requirement: (a) retention boundaries and pending/active/published protections in `supabase/tests/cleanup.sql`; (b) true concurrent enqueue/toggle/lease/fencing behavior in `scripts/cleanup-integration.ts` using two independent Supabase clients and transaction barriers; (c) 501+ object pagination, 24-hour boundaries, current/stale avatars, and all phase crash injection in the integration harness; (d) account/profile/daily/evidence/leave/attendance/resource/settings/report/auth regressions in their existing Vitest files plus targeted new action tests; (e) worker classification in `scripts/verify-netlify-functions.mjs`.

Retention fixtures older than the application’s 90-day write window are inserted by the local direct database harness with the validation triggers disabled inside a rolled-back fixture transaction, never by production application actions.

- [ ] **Step 6: Confirm repository constraints**

Verify `git status --short`, `git diff --check`, no secrets, no generated function bundles tracked, no existing migration edited, and no commit created.

- [ ] **Step 7: Produce the final independent-review package**

Save a complete before/after tree comparison (including untracked files) using the Task 0 snapshot protocol, plus the spec, plan, verification output, and per-task review dispositions under the gitignored SDD workspace. Dispatch a fresh high-capability independent implementation auditor.

- [ ] **Step 8: Fix and re-review all Critical/Important findings**

Use one focused implementer dispatch for the final findings, rerun affected tests, and send the fix patch for scoped independent re-review.

- [ ] **Step 9: Re-run fresh final verification**

Only claim completion after fresh successful database, integration, lint, typecheck, unit, secret scan, Next build, and Netlify bundle evidence.

## No-Commit Subagent Review Protocol

For every implementation task:

1. Controller records a complete repository tree snapshot before dispatch (tracked and untracked files, explicit absent-file markers, hashes, and status) in the gitignored SDD workspace; raw `git diff HEAD` is insufficient because new files are part of the work.
2. A fresh implementer receives only the task brief, spec path, prior-task interface notes, and report path.
3. The implementer edits/tests but may not stage or commit.
4. Controller records the after snapshot and creates an isolated task patch from the before/after trees (for example, `git diff --no-index --binary` for each changed path), including additions and deletions.
5. A different agent independently reviews task specification compliance and code quality from the brief, report, and patch.
6. Critical/Important findings enter a fix-and-re-review loop before the next task.
7. Controller records rulings, test evidence, and `Task N: complete` in `.superpowers/sdd/admin-data-cleanup/progress.md`.

This protocol replaces commit-SHA review packages and skips all branch-finishing steps while retaining independent review gates.
