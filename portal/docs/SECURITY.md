# Security model

## Trust boundaries

The browser is untrusted. Roles, user IDs, date ranges, sort choices, and account state are resolved or allowlisted on the server. Supabase RLS is the final authorization boundary, and server actions repeat role and ownership checks. The service-role key is server-only and reserved for Auth administration, profile state changes, immutable audit writes, and the authenticated student leaderboard calculation. The leaderboard response exposes names and calculated scores only, never peer contact details, notes, or raw routine records.

Public registration is disabled. Temporary passwords are generated with cryptographic randomness, contain all required character groups, are returned once, and are never persisted or logged. Passwords require 14–128 characters with uppercase, lowercase, number, and symbol. The sole internal `super_admin` is displayed as Admin; internal `admin` accounts are displayed as Mentors. Admin credential and Mentor-management operations require password re-entry within 15 minutes. TOTP MFA remains the most important future upgrade.

## Data controls

- Every exposed table has forced RLS and explicitly limited grants.
- Private security-definer functions use an empty `search_path`, schema-qualified names, and narrow execution grants.
- Students can select and update only their own eligible entries. Admins have reporting read access but no entry write policy.
- Growth Scores are derived on the server from stored entries and protected settings; browser-supplied scores are never accepted. Only Admin can change the global rubric.
- Mentor access is restricted by `profiles.mentor_id` in server actions and PostgreSQL RLS. Students can edit only today and yesterday; Mentor/Admin corrections retain the audited 90-day window.
- Shared Resources, Weekly Program, and Attendance use normal portal roles and RLS; no shared module password is accepted.
- Inactive profiles disappear through RLS; Auth accounts are also banned on deactivation. History remains intact and there is no hard-delete UI.
- The application and a database trigger both enforce the India-time 90-day window, maximum 16-hour sleep, 0–18-hour study duration, enum allowlists, and note limits.
- The Supabase query builder uses parameterized filters. No user input is concatenated into SQL, ordering, function names, filenames, or redirects.
- Audit rows cannot be updated or deleted. Audit metadata excludes passwords, tokens, cookies, notes, and phone numbers.

## Web controls

Sessions use secure, HTTP-only, same-site cookies. Server Actions accept same-origin requests only and are limited to 64 KB; proxy requests are limited to 128 KB. A per-request nonce CSP denies frames, objects, foreign base URLs, and foreign form targets. HSTS, `nosniff`, DENY framing, restrictive referrer/permissions, COOP, CORP, and no-index headers are emitted globally.

React escapes student text, and the codebase does not use `dangerouslySetInnerHTML`. Auth responses are deliberately generic to reduce account enumeration. Turnstile tokens are passed directly to Supabase Auth. CSV cells beginning with spreadsheet formula characters are prefixed with an apostrophe, all cells are quoted, ranges are limited to 7/30/90 days, and exports cap at 5,000 records.

## Verification

`npm run verify` runs lint, type checking, unit/security tests, and a production build. `supabase test db` runs RLS tests for cross-student access, forged writes, admin read-only access, settings privilege, inactive users, and date boundaries. GitHub Actions additionally runs audit, secret scanning, and CodeQL.

Before every release, review dependency changes, run the Supabase Security Advisor, confirm leaked-password protection and CAPTCHA, inspect Netlify/Supabase logs for abnormal failures without copying personal data into tickets, and exercise all roles in a staging project.
