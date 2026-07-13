# Kiyo Food Supabase Security Remediation

## Scope and safety

This remediation is additive and must be applied to staging before production. It does not drop application tables, application data, Storage objects, PostGIS, `spatial_ref_sys`, or extension-owned routines. Production rollout requires a confirmed database restore point and a separate Storage-object backup because Supabase database backups do not contain Storage object bytes.

Sources of truth:

- Forward migration: `supabase/migrations/20260713233000_0046_supabase_security_remediation.sql`
- Advisor follow-up migration: `supabase/migrations/20260714003000_0047_security_advisor_actionable_cleanup.sql`
- Trusted domain boundary: `supabase/migrations/20260714013000_0048_trusted_domain_action_boundary.sql`
- Legacy grant closure: `supabase/migrations/20260714023000_0049_close_legacy_domain_rpc_grants.sql`
- Emergency recovery: `supabase/rollback/20260713233000_0046_supabase_security_remediation.rollback.sql`
- Follow-up recovery: `supabase/rollback/20260714003000_0047_security_advisor_actionable_cleanup.rollback.sql`
- Domain-boundary recovery: `supabase/rollback/20260714013000_0048_trusted_domain_action_boundary.rollback.sql`
- Legacy-grant recovery: `supabase/rollback/20260714023000_0049_close_legacy_domain_rpc_grants.rollback.sql`
- Read-only database inventory: `supabase/audits/security_inventory.sql`
- Staging assertions: `supabase/tests/0046_security_assertions.sql`
- Advisor assertions: `supabase/tests/0047_security_advisor_assertions.sql`
- Domain-boundary assertions: `supabase/tests/0048_trusted_domain_action_boundary.sql`
- Closed-grant assertions: `supabase/tests/0049_closed_domain_rpc_grants.sql`

## Confirmed findings and disposition

| Severity | Finding | Confirmed cause | Remediation |
| --- | --- | --- | --- |
| Error | `public.spatial_ref_sys` reports RLS disabled | PostGIS owns the table and manages its contract | Accepted extension-managed finding. Do not enable RLS, change ownership, or delete it. |
| High | Application functions executable by `PUBLIC`/`anon` | PostgreSQL grants function execution to `PUBLIC` by default unless revoked | Revoke from every application-owned function while excluding extension dependencies; explicitly regrant two vetted public read RPCs. |
| High | Signed-in users can directly execute owner/financial functions | Admin RPCs were exposed to all `authenticated` users and relied only on an internal role check | Revoke browser execution and route allowlisted owner actions through a service-role-only, idempotent database gateway called by a verified Vercel server function. |
| High | Mutable function search path | Several application routines had no fixed `search_path` | Set an explicit path on every application-owned routine missing one; revoke `CREATE` on `public` from browser roles. Extension routines are untouched. |
| High | Forged audit events | `log_activity` was callable by any signed-in user | Make audit and trigger routines service-role/internal only and remove the browser call. |
| High | `search_logs` policy always true | Any signed-in user could forge another `customer_id` and arbitrary analytics values | Require `customer_id = auth.uid()`, bounded text/count values, and a sane timestamp window. |
| Critical | Restaurant application bucket publicly listable/readable | Bucket was public and its SELECT policy had no owner/admin condition | Make it private, restrict paths to the applicant or owner, validate extensions, and use signed URLs. Existing objects are preserved. |
| High | Permanent public application-media URLs | Browser stored `getPublicUrl()` values for sensitive onboarding media | New records store object paths. Legacy URLs are parsed safely. Admin/applicant previews use signed URLs; published restaurant media uses a server-verified short-lived redirect. |
| Medium | Platform internals broadly readable | Platform health, owner bootstrap, campaigns, disabled flags, and inactive plans/zones had always-true read policies | Restrict internals to owner; expose only active public-facing rows and a small allowlist of runtime settings. |
| Medium | Future functions inherit public execution | Default privileges were not hardened | Revoke default function execution from `PUBLIC`, `anon`, and `authenticated`; future RPCs require explicit grants. |
| Error | `public.driver_profile_view` uses definer permissions | A legacy view ran as its owner and could bypass `drivers`/`profiles` RLS | Force `security_invoker` and `security_barrier`; underlying own-driver/owner policies now govern every row. |
| Medium | Internal calculation/discovery routines remain signed-in callable | Historical grants survived after these routines became internal implementation details | Revoke browser execution from financial calculators, superseded discovery RPCs, route helpers, owner health, RLS maintenance, and promo internals; retain service execution. |
| Medium | Simple notification/read helpers use definer rights | Three ownership-only helpers retained unnecessary elevated mode | Convert notification marking and own restaurant lookup to `SECURITY INVOKER`; existing RLS supplies authorization. |
| Info | `owner_action_requests` has RLS but no policy | Browser table privileges were already revoked and service role bypasses RLS | Add an explicit deny policy for `anon`/`authenticated` so the closed contract is machine-verifiable. |
| High | Customer, restaurant, order, application and driver definer RPCs remain directly executable | Valid canonical functions still had broad `authenticated` grants, causing Advisor warnings and leaving a wider attack surface | Revoke direct browser execution and call the same validated functions through `execute_user_action`, reached only through a token-verifying Vercel endpoint. Public location insights use a separate bounded endpoint. |
| Advisory | PostGIS installed in `public` | Existing migrations and spatial indexes depend on current extension placement | Do not move during this patch. Treat a move as a separate project with dependency inventory, route/location regression tests, and rollback. |
| Advisory | Leaked password protection disabled | Dashboard/plan-level Auth setting, not a database migration | Enable in Auth password settings when the production project is Pro or higher. Do not claim resolved until dashboard verification. |

## Function classification

The inventory SQL produces the exact live signature, owner, mode, path, volatility, extension owner, and privileges for every routine. Its categories are:

- A: PostGIS/Supabase extension-owned; do not change individually.
- B: Trigger functions; no browser execution.
- C: Maintenance/cron; service-role only.
- D: Public read-only; only bounded published-data routines may receive `anon`.
- E: Customer RPC; authenticated with `auth.uid()` ownership checks.
- F: Restaurant RPC; authenticated with active restaurant membership checks.
- G: Owner/admin RPC; trusted server gateway only.
- H: Service-role backend RPC.
- I: no proven caller; remains closed pending separate review.

Static code tracing found no Supabase Edge Function directory and no committed cron definition. The only trusted server consumers are Vercel functions under `api/`. The private service key appears only in those server files and the example environment file; it is not referenced from `src/`.

## Final permission model

- `anon`: public restaurant/location reads only. No application media, owner action, audit, financial, or maintenance execution.
- `authenticated`: invoker-safe CRUD/RPC access governed by RLS. Definer domain mutations enter through the verified server boundary.
- `service_role`: routing ingestion, owner/user gateways, maintenance, triggers/internal routines, and signed public restaurant-image verification.
- Owner identity: verified twice, first by server-side access-token lookup and profile status, then inside `execute_owner_action` before the canonical function is invoked.

## Storage model

`restaurant-applications` is private. Objects remain under `<auth.uid()>/<filename>`. Applicants can select, insert, update, and delete only their own folder. Super admins can review all objects. MIME types and 5 MB size remain bucket-enforced. Permanent public URLs are no longer generated.

Historical public URL strings are not rewritten destructively. The application extracts their object path and requests a signed URL. Anonymous public restaurant images are served only when a trusted server query proves the object is referenced by a currently published restaurant.

## Auth actions that cannot be migrated with SQL

In the production Supabase Dashboard, verify under Authentication password/security settings:

1. Minimum password length is at least 8.
2. Leaked password protection is enabled if the project is Pro or higher.
3. CAPTCHA is configured before launch for signup, sign-in, and recovery if abuse risk warrants it.
4. Site URL and redirects remain restricted to Kiyo Food production and approved previews.
5. Password recovery cooldown remains usable and secure.

These settings must be verified without changing the working OAuth or password-recovery templates during the database rollout.

## Rollout and restore procedure

1. Confirm staging is selected, never production.
2. Apply migration 0046 and run `supabase/tests/0046_security_assertions.sql`.
3. Re-run Security Advisor and record the exact residual findings.
4. Apply migration 0047 and run `supabase/tests/0047_security_advisor_assertions.sql`.
5. Apply migration 0048 and run `supabase/tests/0048_trusted_domain_action_boundary.sql`.
6. Deploy and verify the compatible application server gateway.
7. Apply migration 0049 and run `supabase/tests/0049_closed_domain_rpc_grants.sql`.
8. Run `supabase/audits/security_inventory.sql` and export the result grids.
9. Re-run Security Advisor. Expected residuals are PostGIS-managed objects, three required read-only RLS helpers, and leaked-password protection when unavailable on the current plan.
10. Test anonymous, customer, second customer, two restaurant owners, staff, driver, owner, and service backend identities.
11. Verify owner actions, application media, signup, recovery, browsing, checkout, order transitions, realtime, and PostGIS routes.
12. Only after staging passes, confirm a production backup/restore point and preserve Storage objects separately.
13. Production migration 0037 is currently unresolved; do not apply 0038-0049 or merge PR #4 until 0037 succeeds in a controlled rollout.
14. Deploy compatible application code and migrations in the verified order during a controlled maintenance window.
15. Re-run assertions and Security Advisor in production.

The rollback file restores the previous browser RPC grants and broad policies only for an emergency application rollback. It deliberately keeps application media private. It never deletes production business data.

## Verification status

- TypeScript app and server functions: passing.
- ESLint: passing.
- Unit/integration tests: 69 passing.
- Production build: passing.
- Dependency production audit: zero known vulnerabilities at audit time.
- Staging migrations 0046 and 0047 and their SQL assertions: passed.
- Security Advisor after 0047: 1 PostGIS-managed error, 28 warnings, 0 informational findings.
- Trusted user/domain boundary migration 0048 and assertions: passed in staging.
- Application gateway switch and legacy-grant closure 0049: implemented; staging deployment/execution pending.
- Cross-role RLS/storage identity tests: pending after 0049.
- Final Security Advisor result: pending 0049 staging execution and refresh.
- Production application: intentionally not performed.
