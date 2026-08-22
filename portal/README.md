# Abhay Hostel Portal

Secure student routine tracking for `app.abhayhostel.in`. This Next.js application is isolated in `portal/`; the static marketing site at the repository root remains independent.

## Stack and features

- Next.js App Router, TypeScript, Supabase Auth/PostgreSQL, and Netlify
- `super_admin`, `admin`, and `student` authorization enforced in server code and PostgreSQL RLS
- Daily Sadhana, study, discipline, and seva records with 90-day history
- Server-calculated Growth Scores, progress charts, named rankings, reports, alerts, and formula-safe CSV exports
- No public registration or hard-delete UI; forced first-login password changes and recent reauthentication for sensitive operations
- Nonce CSP, secure cookies, strict schemas, capped queries/bodies, Turnstile support, audit events, CI, CodeQL, and dependency updates

## Local setup

1. Install Node.js 22.13+ and run `npm ci` in this directory.
2. Create a Supabase project, copy `.env.example` to `.env.local`, and fill every value.
3. Link the Supabase CLI and run `supabase db push` from `portal/`.
4. Configure Auth and CAPTCHA using `docs/DEPLOYMENT.md`.
5. Run `npm run bootstrap:super-admin` exactly once. Save the displayed temporary password securely; it is not stored by the portal.
6. Run `npm run dev` and sign in at `http://localhost:3000/login`.

Never commit `.env.local`, database exports, generated credentials, logs, or service-role keys. The service-role key is used only in server-only modules and the bootstrap script.

## Commands

```bash
npm run verify
npm run test:coverage
npm run bootstrap:super-admin
supabase test db
```

Deployment and operations are documented in `docs/DEPLOYMENT.md`, the control model in `docs/SECURITY.md`, and incident actions in `docs/INCIDENT_RESPONSE.md`.

No internet-facing application can be guaranteed “hacking-free.” These controls provide defense in depth; mandatory TOTP MFA is the highest-priority future improvement.
