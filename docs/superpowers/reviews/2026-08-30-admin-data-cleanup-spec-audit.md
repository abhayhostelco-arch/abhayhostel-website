# Admin Data Cleanup Specification Audit

## Review

- Reviewer: independent `/root/spec_audit` agent (`gpt-5.6-sol`, high reasoning)
- Reviewed: `docs/superpowers/specs/2026-08-30-admin-data-cleanup-design.md`
- Initial verdict: not approved
- Repository mutations by reviewer: none

## Findings and Rulings

All Critical and Important findings were accepted.

1. **Delayed retry wake-up:** accepted. The spec now uses bounded second-scale retries, dashboard/profile dispatch of every due run mode, and an hourly scheduled dispatcher for long waits.
2. **Previously issued signed uploads:** accepted. Student deletion now has a two-hour upload quarantine, grant refusal after claim, and final reconciliation after quarantine.
3. **Cross-account Storage loss and path replacement:** accepted. Object tasks bind immutable object identity/version and provenance; non-target references and unsafe ownership mismatches block deletion; active paths are reserved.
4. **Unfenced lease reclamation:** accepted. The global lease now has a monotonically increasing fencing generation required by every mutation.
5. **Reactivation race:** accepted. Reactivation now uses an atomic profile-first RPC, compensation on Auth failure, a database invariant, and a guarded old-schema fallback.
6. **Weekly child-set race:** accepted. Exact weekly-entry membership is materialized and revalidated; changed child sets make the program stale.
7. **Student run/audit idempotency:** accepted. Target snapshots survive profile deletion, phase transitions use compare-and-swap, absent Auth/profile is replay success, and audit correlation is unique.
8. **RPC exposure and grants:** accepted. Worker RPCs are public-schema, service-role-only entry points over forced-RLS private maintenance state; Storage metadata remains read-only.
9. **Existing audit-action mismatch:** accepted. The replacement constraint includes all database and currently emitted application values while limiting new strict audit handling to maintenance.
10. **State transitions and same-day re-enable:** accepted. The specification now defines every transition and makes cancelled same-day automatic runs terminal.
11. **Auth Storage-blocker recovery:** accepted. The worker returns to all-bucket reconciliation for managed late arrivals and surfaces unknown buckets.

Minor findings were also incorporated: explicit Netlify classification verification, decoded-secret entropy, reproducible scripts, worker-specific authentication wording, and the exact gitignored ledger path.

The first scoped re-review found three remaining ambiguities. All were accepted and fixed: enqueue now atomically honors the default-off toggle and the worker rechecks it; mismatched non-null Storage ownership is an unconditional blocker requiring separate remediation; and the backward-compatibility exception is limited to maintenance plus the two named reactivation fallbacks.

## Re-review

The corrected specification was returned to the same independent reviewer for scoped re-review. The first scoped review found three remaining ambiguities, which were fixed as recorded above. The final scoped review verdict was **APPROVED — no Critical or Important findings remain**.
