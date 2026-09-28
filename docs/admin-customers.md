# Admin Customers section

Built locally; not deployed. `admin.html` now includes Customers above Delivery Settings and Coupons. Existing Coupons already supports create/edit/enable/disable/delete and audited changes. Only one coupon per normal or bulk order remains allowed.

## Customer features

- Search by current customer name (case-insensitive) or phone substring. Search characters are literal, not SQL wildcard syntax.
- Directory pages contain 20 customers, ordered by customer UUID, with normal/bulk order counts and latest-order time. Counts include all statuses.
- Profile shows current stored name/phone, up to 10 most recently used distinct addresses, and paginated order history (20 at a time). Historical orders retain their own recorded name, phone and address.
- History includes order number/type, placed timestamp, status, payment status, total, items and quantities. It does not expose payment references or internal delivery costs.
- Favourite items are the top 10 products by ordered quantity, grouped by product ID and order type; latest recorded item name is displayed. Cancelled/rejected orders are excluded. Other orders, including pending/in-progress orders, are counted; the UI labels this clearly.
- Top five ordering-hour buckets use order creation time in Asia/Kolkata, not scheduled delivery. Cancelled/rejected orders are excluded. Fewer than three eligible orders shows a limited-history notice.
- Empty states are explicit. Names, addresses and item strings render with textContent. Customer data is not written to browser localStorage. Sign-out clears directory/profile/history, invalidates pending responses, and hides the admin page. API 401/403 also clears the page.

Records are linked using existing customer IDs; the existing unique phone constraint defines a customer record. Shared phone numbers are not inferred to be distinct individuals. This feature is read-only: it does not edit or delete customer or order data, and does not import Swiggy/Zomato customers.

## Security and migration

New migration: `20260925000100_admin_customers.sql`, after the previous five pending migrations. It adds three read-only, SECURITY INVOKER functions, explicitly revokes PUBLIC/anon/authenticated execute access, and grants service_role execute. Existing forced RLS stays in place. The admin-orders Edge Function checks Supabase Auth identity and configured admin email before service-role access. Client-supplied email/role flags cannot grant access. Search, UUIDs and pagination are validated server-side. Responses use no-store.

All reporting is through authenticated admin actions `customers_list` and `customer_detail`. Orders are limited to the selected customer. No public customer directory or frontend-only authorization is used. No production migration, push, merge or deployment has been performed.

Order-history pagination is offset-based, with deterministic timestamp/type/ID ordering. Concurrent new orders can shift page boundaries; refresh the customer before reconciling totals. Large-customer query performance has not been load-tested. Existing customer_id indexes support per-customer queries; global substring search is bounded in output but may scan the customer directory.

## Verification completed here

- 14 PGlite database/API checks: accurate normal/bulk counts; cancelled/rejected exclusions; quantity totals; IST midnight rollover; historical contact/items; tied-timestamp pagination; empty/unknown customers; literal search; customer cursors; invalid parameters; forced RLS service access; public-role rejection; missing/anonymous/non-admin API rejection; no-store and 404 behavior.
- 7 DOM checks using simulated API responses: safe text rendering, profile/time/item display, search, sign-out clearing, stale directory/detail response suppression and API error state.
- 25 full migration-upgrade checks with the sixth migration included.
- 12 PGlite recovery checks with all six pending migrations included.
- Syntax and whitespace checks passed.

Real browser/local Supabase acceptance has NOT been run here. Chromium download failed in this workspace. The actual local Auth/API/browser test suite now includes customer access denial and mobile/desktop history checks. Docker pg_dump/pg_restore recovery also remains pending: the last user result was a startup failure, for which the TCP-readiness fix was supplied. Do not mark either gate passed based on the offline checks.

## Run on Windows

Extract the update into the existing QA project, preserving folders. For offline tests:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/run_customers_qa.sh
echo "Exit code: $?"
```

Expected: 14 database/API + 7 DOM checks, exit 0.

For real local acceptance, start Docker Desktop. In the existing Edge Functions terminal, press Ctrl+C, then run:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/start_local_delivery_qa.sh
```

This syncs the new function code and applies the customer migration to the guarded local-only database. Leave the terminal serving functions. In a second Git Bash terminal:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/run_local_delivery_acceptance.sh
echo "Exit code: $?"
```

Expected: **38 checkout + 81 customers/coupon/delivery/operations checks**, exit 0. The added browser checks search an existing synthetic checkout customer, open their saved history, verify no horizontal overflow at 390/1280 widths, and assert customer content is cleared on logout.

Next: complete real local customer acceptance and the pending Docker recovery run. Continue remaining development, then the deferred public content/catalogue review before UPI/payment integration and final release approval.
