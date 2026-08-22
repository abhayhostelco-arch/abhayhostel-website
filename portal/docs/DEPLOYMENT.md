# Deployment handoff

## 1. Supabase

Create a production project in an India-near region when available. In `portal/`, link it with the Supabase CLI and run `supabase db push`. Do not paste the service-role key into chat, source control, client code, or a `NEXT_PUBLIC_` variable.

In Authentication settings:

1. Disable new-user signup and anonymous sign-ins.
2. Set the site URL to `https://app.abhayhostel.in` and allow only `https://app.abhayhostel.in/auth/callback` as the recovery redirect. The callback exchanges Supabase's one-time recovery code for a secure session before sending the user to `/change-password`.
3. Require 14 characters with lower/upper letters, digits, and symbols. Enable leaked-password detection if the project plan exposes it.
4. Keep email verification/recovery throttles conservative (start with one request per 60 seconds and review abuse logs).
5. Configure a Cloudflare Turnstile secret under Auth CAPTCHA and enable CAPTCHA. Use the matching public site key in Netlify.
6. Enforce SSL, restrict direct PostgreSQL connections to trusted administrative IPs, and use the pooler for approved operational tools.
7. Run Database Linter/Security Advisor and resolve all exposed-table, RLS, function, and mutable-search-path findings.

Set the bootstrap variables locally, run `npm run bootstrap:super-admin` once, store the temporary password in a password manager, then remove the bootstrap variables. The script refuses to create a second Super Admin.

## 2. Cloudflare Turnstile

Create a Managed Turnstile widget restricted to `app.abhayhostel.in` (add `localhost` only to a separate development widget). Put its site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; put its secret only in Supabase Auth CAPTCHA. The login and recovery widgets use the action `turnstile-spin-v1`. Rotate either key immediately if exposed.

No Turnstile resource is created automatically by this repository because external account changes require the owner’s credentials and confirmation.

## 3. Netlify

Create a **separate Netlify project** from the same GitHub repository. Do not reuse or modify the existing `abhayhostel.in` project. Set **Base directory** to `portal`; Netlify will detect Next.js and use its maintained OpenNext adapter. Use `npm run build` as the build command and leave the publish directory on the detected Next.js default. Do not use drag-and-drop deployment because the portal requires server rendering, Server Actions, middleware, and Route Handlers.

If Netlify shows **Connect GitHub to complete setup**, first connect the GitHub account under Team settings > Connected accounts. Then import `abhayhostelco-arch/abhayhostel-website` as the new portal project. Add these Production environment variables:

- `NEXT_PUBLIC_APP_URL=https://app.abhayhostel.in`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Sensitive)
- `REAUTH_SECRET` (at least 32 random bytes; Sensitive)

Do not add bootstrap variables to Netlify. Deploy to the generated `*.netlify.app` URL first, verify login and security headers, and then attach `app.abhayhostel.in` in Domain management.

The verified existing topology is: GoDaddy authoritative DNS (`ns51/ns52.domaincontrol.com`) and Netlify hosting for the static marketing site (`www` points to `ephemeral-tarsier-d3f397.netlify.app`; the apex is served by Netlify). Preserve the apex (`abhayhostel.in`) and `www` records. After the new Netlify project supplies its `*.netlify.app` target, add only a CNAME record named `app` in GoDaddy DNS pointing to that target. Cloudflare is used only for the portal's Turnstile widget unless the owner explicitly changes this architecture.

Netlify automatically provides network-wide DDoS protection for all sites and plans. Keep Turnstile enabled and retain the application's request-size, query, export, and date-range caps. Free Netlify accounts can define a limited number of code-based rate-limit rules; add them only after validating that they do not block legitimate shared-network users. Netlify WAF is an Enterprise/High Performance Edge feature, so a paid WAF or an additional security proxy is the first infrastructure upgrade if sustained automated abuse appears.

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
