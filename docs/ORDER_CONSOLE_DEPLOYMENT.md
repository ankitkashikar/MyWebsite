# The Chinese Bliss — Order Console Deployment Guide

**Branch:** `tcb-design-system-refresh`  
**Status:** Code-ready foundation; Supabase production migration/functions are **not deployed yet**.

This guide documents the deployment order for the internal TCB restaurant order console. Keep it together with the final post-deployment workflow document.

## What is already implemented in the branch

- `orders.html` — authenticated restaurant order console.
- `orders-console.css` — tablet/mobile/desktop console styling.
- `supabase/functions/admin-orders/index.ts` — secure restaurant operations API.
- `supabase/functions/place-order/index.ts` — server-side customer order creation and price validation.
- `supabase/migrations/20260916_order_operations.sql` — lifecycle/audit/delivery schema additions.
- `scripts/order_console_qa.mjs` — browser smoke test for the internal console.
- `scripts/responsive_qa.mjs` — public checkout/responsive tests, including PIN 411057 validation.

## Current direct-order rules represented in code

- Direct website PIN: `411057`.
- COD is disabled.
- New UPI orders start with `payment_status = pending`.
- Restaurant acceptance requires payment to be marked `paid` under the current direct-order model.
- Order states:
  - `new`
  - `accepted`
  - `rejected`
  - `preparing`
  - `ready_for_pickup`
  - `rider_assigned`
  - `dispatched`
  - `delivered`
  - `cancelled`
- Rejection/cancellation requires a reason.
- Status changes are written to `order_status_events`.
- `delivery_fee` means the customer-facing delivery amount agreed before payment.
- `delivery_partner_cost` means the actual logistics cost quoted/charged by the rider provider later. These values must not be silently substituted for each other.

## Important deployment blocker

The connected Supabase management integration currently returns a permission error for database and Edge Function management. Therefore, the migration and new Edge Function have **not** been applied/deployed from this workspace.

Do not treat `orders.html` as operational until the steps below are completed.

## Deployment sequence

### 1. Take a database backup / confirm recovery plan

Before altering production tables, confirm a recent Supabase backup or recovery option.

### 2. Inspect the current production schema

Confirm these tables exist and match the assumptions in the repository:

- `customers`
- `products`
- `normal_orders`
- `normal_order_items`
- `bulk_orders`
- `bulk_order_items`

Pay special attention to primary-key types, current payment fields, current order-number generation and any existing RLS policies.

### 3. Apply the order-operations migration

Apply:

`supabase/migrations/20260916_order_operations.sql`

Review the migration before applying. It is intentionally idempotent for the added columns/constraints, but production schema differences must still be inspected first.

### 4. Create the single TCB operations account in Supabase Auth

Create exactly one Supabase Auth email/password user for the shared TCB restaurant operations account. Do not create separate personal admin accounts.

Do not use the old `admin.html` sessionStorage demo login for order operations.

### 5. Configure the single TCB operations email

Set the Edge Function secret:

```text
TCB_ADMIN_EMAIL=tcb-operations@example.com
```

The `admin-orders` function checks both:

1. a valid Supabase Auth JWT, and
2. that the authenticated email exactly matches this single server-side TCB operations email.

### 6. Deploy the updated customer-order function

Deploy the repository version of:

`supabase/functions/place-order/index.ts`

This version enforces direct delivery PIN `411057` server-side in addition to browser validation.

### 7. Deploy the restaurant admin function

Deploy:

`supabase/functions/admin-orders/index.ts`

Keep JWT verification enabled. Before final production launch, restrict CORS from `*` to the final production website/admin origin where practical.

### 8. Verify `supabase-config.js`

Confirm the production project URL/anon key are correct. Only the public anon key belongs in browser JavaScript. Never add the Supabase service-role key, payment secret or delivery-provider secret to the repository/browser.

### 9. Test login and authorization

Verify:

- the TCB operations account can sign in;
- any other Supabase user receives access denied;
- signed-out user cannot load order data;
- expired session requires sign-in again.

### 10. Complete one non-financial test order

Before accepting real customer payments, place a controlled test order and verify:

1. customer record is created/reused by phone;
2. order-time name/phone/address/PIN snapshot is stored;
3. server-trusted product prices are used;
4. item rows are created;
5. order appears in the console as `new`;
6. browser sound/attention banner appears;
7. payment remains `pending` until explicitly verified;
8. payment confirmation enables acceptance;
9. Accept → Preparing → Ready → Rider Assigned → Dispatched → Delivered works;
10. `order_status_events` records transitions.

### 11. Test rejection/cancellation

Verify a rejected/cancelled order requires a reason and that prepaid/refund handling is not silently skipped.

### 12. Test delivery fields

Until a delivery API is integrated, manually record:

- provider name;
- provider booking/reference;
- actual provider cost (`delivery_partner_cost`);
- rider name/phone when available;
- tracking URL when available.

The customer-facing `delivery_fee` must already have been determined before final payment. The console must not use a later rider quote to secretly increase the customer bill.

## Delivery charge implementation still pending

The business rule is:

- food subtotal `>= ₹799`: planned customer delivery charge = ₹0 within the supported area;
- food subtotal `< ₹799`: customer pays an applicable delivery charge.

The final under-₹799 charge calculation is intentionally **not implemented yet** because the delivery provider / quoting method has not been selected. Do not hard-code a fake Porter/Borzo/Shiprocket quote.

Before production payment is enabled for sub-₹799 orders, implement one of:

1. a live provider quote API, or
2. an owner-approved deterministic delivery-fee table.

The server must verify the quote/fee and compute the final payable total before payment.

## Email backup notification still pending

Launch alert design is:

- primary: order console visual + repeated browser sound;
- backup: email;
- no WhatsApp template dependency.

The email provider has not been selected. Add the email alert server-side after order creation; do not send it from customer browser JavaScript.

## Scheduled-order reminder still pending

Scheduled orders are stored today, but production reminder timing should be added after the order console is live. The reminder should move a future order into the active kitchen attention window based on its requested slot and the configured preparation buffer.

## Pre-launch security checklist

- [ ] Production schema inspected.
- [ ] Migration applied successfully.
- [ ] Single TCB operations Supabase Auth account created.
- [ ] `TCB_ADMIN_EMAIL` configured.
- [ ] Updated `place-order` deployed.
- [ ] `admin-orders` deployed with JWT verification.
- [ ] CORS tightened for production.
- [ ] Service-role/payment/delivery secrets confirmed server-side only.
- [ ] TCB account and unauthorized-user login paths tested.
- [ ] New-order alert sound tested on intended kitchen device.
- [ ] Full order lifecycle tested.
- [ ] Duplicate/idempotency behavior tested.
- [ ] Reject/cancel/refund path tested.
- [ ] Customer delivery charge finalized before payment.
- [ ] Static QA passes.
- [ ] Responsive interaction QA passes.
- [ ] Order-console QA passes.
- [ ] Production smoke test completed.

## After deployment

Update `TCB_Order_and_Customer_Data_Workflow.docx` with the exact production admin URL, database fields, payment provider, delivery provider, email provider and final staff roles. That version becomes the permanent restaurant/developer operations handover.
