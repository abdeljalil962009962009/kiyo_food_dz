# Kiyo Food Premium Benchmark Execution Plan

This document keeps the premium-delivery work grounded in one rule: Kiyo Food must feel trustworthy to a real customer, a real restaurant owner, and the platform owner during real money and real food operations.

## What Already Exists

- Cash-on-delivery order creation uses server-side route quotes and financial snapshots.
- The cart shows subtotal, delivery fee, service fee, and total before checkout when a delivery address is confirmed.
- Active orders have a visual timeline, live update status, honest ETA refresh, COD cancellation explanation, and direct support entry.
- Past orders support reorder with current price and availability checks.
- Restaurant publication, approval, commercial terms, delivery rules, audit logs, and security boundaries are enforced through the marketplace domain migrations.
- The map/location module stores precise coordinates and uses the shared Google Maps/location utilities.
- Arabic, French, and English are wired across the main customer, restaurant, and admin surfaces.

## Current Batch

- Improve restaurant browsing with premium empty states and trust signals.
- Harden notification localization so legacy English application notifications render in the selected language.
- Fix the returning-customer usual-restaurant shortcut route.
- Keep launch readiness honest: no feature is marked fully verified until it passes through real production UI accounts.

## Competitive Safeguards

- Do not hide fees until the last step. Price transparency starts in cart and is recalculated at checkout.
- Do not show static ETAs when orders run late. The live tracker updates the range and labels it clearly.
- Do not bury cancellation or order support. Active order screens keep both visible when relevant.
- Do not allow closed, paused, suspended, unpublished, or unavailable restaurants to accept customer orders.
- Do not fake popularity, scarcity, ratings, or restaurant availability. Personalization must come from real user history only.
- Do not trust browser totals, roles, commission values, route distance, or delivery fees.

## Real Launch Gate

Kiyo Food is ready for a controlled public launch only after this real production walkthrough passes with test records that are cleaned up afterward:

1. Customer signs up with phone number.
2. Restaurant applicant submits an application with proposed commission.
3. Super admin sees it immediately in Control Center.
4. Admin and applicant exchange real messages.
5. Admin requests changes and applicant resubmits.
6. Admin preliminarily approves the application.
7. Restaurant owner completes profile, location, hours, menu categories, two dishes, prices, and at least one image.
8. Admin publishes the restaurant.
9. A different customer sees it after publish, not before.
10. Customer selects a precise delivery address and receives a road-route delivery quote.
11. Customer places a COD order.
12. Customer, restaurant, and admin all see the order and at least three status changes.
13. The order financial snapshot uses the approved active commission, not the proposed rate.
14. Cross-role checks prove customer and restaurant accounts cannot see private records from other users or restaurants.

## Launch Assessment Rule

Automated tests, typecheck, lint, and production build can raise code confidence, but they do not replace the real production UI walkthrough. The final readiness percentage must be based on observed real-user results, not assumptions.
