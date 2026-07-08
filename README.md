# Kiyo Food DZ

Kiyo Food DZ is a React, Vite, Supabase, and Tailwind food delivery platform for customers, restaurants, drivers, and platform owners.

The current production direction is simple: no fake dashboards, no frontend-only authority, no hardcoded owner bypass, and no silent connection to placeholder services.

## Production Deployment

1. Connect this repository to Vercel.
2. Add these Vercel environment variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

3. Deploy from the `main` branch.
4. Confirm the Vercel deployment status is `Ready`.

If either Supabase variable is missing, the app intentionally shows a setup screen instead of silently connecting to an unintended database.

## Database Setup

Apply every SQL migration in `supabase/migrations` to the production Supabase project in order.

The root `supabase_schema.sql` file is kept as a full-schema helper, but the migrations are the source of truth for production evolution.

Required checks after applying migrations:

- RLS is enabled on production tables.
- `platform_settings` exists and contains delivery, commission, settlement, feature, tax, driver, and loyalty settings.
- Owner/admin operations are protected by `is_super_admin()` and RLS.
- Public signup creates customer profiles only.
- Staff roles are granted by authorized admin workflows, not by user metadata.

## Roles

Public users sign up as customers.

Restaurant owner, driver, and super admin access must be assigned through verified onboarding/admin processes. Do not add hardcoded admin emails or frontend bypasses.

## Local Development

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

## Validation Before Launch

Run and verify:

- Customer signup/login/profile.
- Restaurant discovery and checkout.
- Order creation and customer cancellation/support fallback.
- Restaurant dashboard order loading and status updates.
- Driver dashboard status and live location flow.
- Owner Control Center settings persistence.
- Delivery/commission/settlement rules affect real calculations.
- Vercel deployment succeeds with production env vars.
- Supabase logs show no RLS or missing-table errors.

## External Services Required

Some production features require owner-managed accounts and keys:

- Supabase production project.
- Vercel production deployment.
- Maps provider keys for paid map, geocoding, directions, and ETA services.
- Payment provider account and legal/tax onboarding.
- Real restaurant, driver, refund, support, and operating policies.
