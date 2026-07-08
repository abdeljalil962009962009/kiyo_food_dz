# Kiyo Food Owner Access Recovery

The authorized platform owner email is:

`sameraldjaber@gmail.com`

## What Changed

The web client no longer overwrites profile roles during login. Before migration `0029`, an existing `super_admin` or `restaurant_owner` profile could be overwritten back to `customer` by the client profile bootstrap.

## Required Production Step

Apply this migration in Supabase:

`supabase/migrations/20260708133000_0029_auth_role_repair_and_owner_access.sql`

After applying it, the profile with email `sameraldjaber@gmail.com` is repaired to:

- `profiles.role = 'super_admin'`
- `admin_configuration.is_active = true` when the table exists
- suspended/locked flags cleared for that owner profile

## Verify

Run this SQL in Supabase:

```sql
select id, email, role, is_suspended, locked_until
from profiles
where lower(email) = lower('sameraldjaber@gmail.com');
```

Expected:

- `role` is `super_admin`
- `is_suspended` is `false`
- `locked_until` is empty/null

Then log out of Kiyo Food, log in again with `sameraldjaber@gmail.com`, and open `/admin`.
