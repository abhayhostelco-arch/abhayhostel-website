# Incident response

## Immediate triage

1. Record the time, affected route/account, observed status codes, and request IDs—never copy passwords, cookies, tokens, notes, or phone numbers into the incident record.
2. If traffic is overwhelming the portal, review Netlify traffic and function logs, apply a narrowly scoped rate-limit rule where available, and temporarily disable the affected unauthenticated flow if necessary. Contact Netlify support during a sustained platform-level attack.
3. For suspected credential abuse, deactivate the account, rotate its password, revoke sessions from Supabase Auth, and require password change. For a suspected service-key leak, rotate it immediately in Supabase/Netlify and redeploy.
4. For suspected data access, preserve Netlify, Supabase Auth, PostgreSQL, and audit-event evidence. Restrict direct database access and do not modify audit rows.

## Containment and recovery

Verify RLS and active-state behavior with a clean account, inspect recent privileged audits and exports, and identify the first bad request before restoring access. Patch and test in a separate environment. Restore from the latest verified encrypted export only when integrity is in doubt; keep the compromised database isolated for evidence.

Notify affected people and authorities according to applicable contracts and law after confirming scope with qualified counsel. Do not speculate publicly. Following recovery, rotate relevant credentials, invalidate sessions, review every administrator, increase monitoring, document the root cause, and add a regression test.

## Escalation signals

Escalate immediately for service-key exposure, suspected cross-student reads, Super Admin takeover, audit-table anomalies, sustained 429/403 spikes, unexpected export volume, or database changes outside migrations. The first infrastructure upgrades are mandatory TOTP MFA, paid WAF/rate limiting, downloadable daily backups, and point-in-time recovery.
