# Deployment handoff

## 1. Supabase

Create a production project in an India-near region when available. In `portal/`, link it with the Supabase CLI and run `supabase db push`. Do not paste the service-role key into chat, source control, client code, or a `NEXT_PUBLIC_` variable.

In Authentication settings:

1. Disable new-user signup and anonymous sign-ins.
2. Set the site URL to `https://app.abhayhostel.in` and allow only `https://app.abhayhostel.in/change-password` as the recovery redirect.
3. Require 14 characters with lower/upper letters, digits, and symbols. Enable leaked-password detection if the project plan exposes it.
4. Keep email verification/recovery throttles conservative (start with one request per 60 seconds and review abuse logs).
5. Configure a Cloudflare Turnstile secret under Auth CAPTCHA and enable CAPTCHA. Use the matching public site key in Vercel.
6. Enforce SSL, restrict direct PostgreSQL connections to trusted administrative IPs, and use the pooler for approved operational tools.
7. Run Database Linter/Security Advisor and resolve all exposed-table, RLS, function, and mutable-search-path findings.

Set the bootstrap variables locally, run `npm run bootstrap:super-admin` once, store the temporary password in a password manager, then remove the bootstrap variables. The script refuses to create a second Super Admin.

## 2. Cloudflare Turnstile

Create a Managed Turnstile widget restricted to `app.abhayhostel.in` (add `localhost` only to a separate development widget). Put its site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; put its secret only in Supabase Auth CAPTCHA. The login and recovery widgets use the action `turnstile-spin-v1`. Rotate either key immediately if exposed.

No Turnstile resource is created automatically by this repository because external account changes require the owner’s credentials and confirmation.

## 3. Vercel

Import this GitHub repository as a new Vercel project and set **Root Directory** to `portal`. Keep the existing marketing-site project unchanged. Add these Production environment variables:

- `NEXT_PUBLIC_APP_URL=https://app.abhayhostel.in`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Sensitive)
- `REAUTH_SECRET` (at least 32 random bytes; Sensitive)

Do not add bootstrap variables to Vercel. Deploy, verify the security headers, and attach `app.abhayhostel.in`. Add the DNS record Vercel specifies without changing the apex/root marketing-site records.

Before changing DNS, inspect the owner's existing Cloudflare Pages, Workers, static-site, and DNS configuration. The current marketing deployment may already depend on Cloudflare. Preserve all apex (`abhayhostel.in`) and `www` records and routes; add only the new `app` record after confirming it does not overlap an existing Pages custom domain, Worker route, redirect, or wildcard record.

Use the strongest free Vercel Firewall controls available: restrict unexpected methods, challenge obvious bot/automation traffic, and use Attack Challenge Mode during an active Layer-7 incident. Vercel provides automatic network/application DDoS mitigation; Supabase protects its edge, but neither removes the need for query caps and incident monitoring. If automated abuse persists, the first paid upgrades are WAF rate limiting and managed OWASP rules.

## 4. Launch checks

- Run `npm ci && npm run verify && npm audit --audit-level=high`.
- Run `supabase test db` against the local Supabase stack and run Security Advisor in production.
- Confirm the marketing root and its `index.html`, `robots.txt`, and `sitemap.xml` are unchanged by the portal deployment.
- Test forced password change, every role boundary, deactivation, credential reset, daily-entry limits, XSS-like notes, formula-like CSV values, report caps, and recovery enumeration behavior.
- Check desktop and mobile layouts and unauthenticated redirects; then test authenticated routes using non-production accounts.
- Confirm source maps, responses, logs, and browser bundles contain no service key, reauthentication secret, passwords, or tokens.

## 5. Backups and maintenance

Schedule a weekly encrypted logical export with `pg_dump` over an SSL connection from a trusted administrative IP. Encrypt before uploading, keep at least four weekly copies in access-controlled storage, test a restore quarterly, and securely expire old copies. Supabase free-tier managed backups may not be downloadable and do not provide point-in-time recovery; upgrade before the data becomes operationally critical.

Review alerts and Auth failures daily during launch week, dependencies weekly, access/admin accounts monthly, restore readiness quarterly, and the incident plan after every event. Never place exported student data in shared drives without an explicit retention and access policy.
