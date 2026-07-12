# Kiyo Food marketplace domain model

## Identity and access

`profiles.role` remains the primary account role used by route guards. Merchant
application state is stored separately in `restaurant_applications`; applying
does not grant restaurant access. Approved restaurant access is represented by
`restaurant_memberships` with `owner`, `manager`, or `staff` membership roles.
Database RLS and domain RPCs are authoritative; client checks are only UX.

## Restaurant application lifecycle

The canonical lifecycle is:

`draft -> submitted -> under_review -> preliminarily_approved -> onboarding_in_progress -> menu_review -> ready_to_publish -> published`

Review branches are `changes_requested -> resubmitted`, `rejected`,
`suspended`, and `archived`. Every accepted transition is written to
`restaurant_application_transitions`. Optimistic `application_version` checks
reject actions from stale tabs. One active application per applicant and one
restaurant per application are enforced by unique indexes.

The applicant submits through `submit_restaurant_application`. The platform
owner reviews through `review_restaurant_application`, performs the atomic
owner/restaurant/commercial-term creation through
`preliminarily_approve_restaurant_application`, and publishes only through
`publish_restaurant`.

## Preliminary approval and publication

Preliminary approval atomically creates or reuses the internal restaurant,
assigns its owner membership, grants the restaurant-owner account role, and
activates an admin-approved versioned commercial agreement. It does not make
the restaurant public.

`get_restaurant_publication_readiness` is the shared server validator used by
the owner queue and restaurant workspace. Final publication is rejected unless
ownership, commercial terms, verified location, hours, profile image, delivery
coverage, menu category, and an available priced dish are complete.

## Commercial governance

Applicant-proposed values are informational. Only an active row in
`restaurant_commercial_terms` is authoritative. Agreements are versioned and
old versions are retained. Restaurant settings display the active agreement as
read-only; restaurant users cannot set their own commission.

## Security invariants

- Application, transition, message, membership, and commercial-term writes use
  authorized RPCs or platform-owner policies.
- Menu writes use `can_manage_restaurant`; public visibility never grants edit
  permission.
- Direct authenticated inserts into `financial_ledger` are denied.
- Restaurant status changes are guarded. Application-backed restaurants use the
  review and publication workflow rather than generic dashboard shortcuts.
- Existing restaurants receive owner memberships and baseline commercial terms
  without deleting or rewriting historical records.

## Rollout

1. Apply `20260712173000_0037_marketplace_domain_workflow.sql` in a staging
   Supabase project and run role/RLS workflow tests.
2. Deploy the matching web branch to staging and test submit, review, messaging,
   requested changes, resubmission, preliminary approval, readiness, and final
   publication.
3. Apply the migration to production before merging/deploying the dependent UI.
4. Verify a new application appears in the owner queue and that unpublished
   restaurants remain inaccessible to customers.

Migration `0038_authoritative_cod_financials.sql` adds the server-authoritative
Google Routes quote contract, restaurant/Wilaya/global rule resolver, immutable
Cash on Delivery order snapshots, and server order state machine. It must be
applied only after `0037`, and the Vercel server variables
`SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_ROUTES_API_KEY` must be configured first.
The browser never receives either private key. If routing is unavailable,
checkout fails clearly instead of silently billing straight-line distance.

The precedence model is restaurant override, then Wilaya override, then global
`platform_settings`. Approved commercial terms remain authoritative over any
applicant proposal. `delivery_route_quotes` are single-use and expire after ten
minutes. Every new order stores its route, item prices, rules, commercial-term
version, commissions, delivery allocation, restaurant net, customer total,
currency, and calculation timestamp.
