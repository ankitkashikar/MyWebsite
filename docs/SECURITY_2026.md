# TCB Website Security Model — 2026

This document is the security handover for The Chinese Bliss direct-order website and Order Console.

## Core rule

A browser is never trusted.

A visitor can always open DevTools, edit HTML, change JavaScript variables, replay requests, alter hidden fields, or replace the visible page on their own phone/laptop. That cannot be prevented on any public website.

TCB security therefore depends on making browser changes powerless:

- prices are recalculated on the server from the products table;
- order/customer tables are not directly writable by browser roles;
- payment state is changed only by an authorized server path;
- order lifecycle changes are accepted only by the authenticated TCB operations account;
- server-side transition rules reject illegal status jumps;
- customer tracking returns only a deliberately limited field set;
- service/secret credentials never appear in browser code;
- rate limiting is enforced server-side;
- sensitive admin actions are audit logged.

## Admin identity

TCB uses exactly **one shared restaurant operations account**.

The `admin-orders` Edge Function validates the Supabase Auth JWT and then requires the authenticated email to exactly match the server-side `TCB_ADMIN_EMAIL` secret.

Do not create personal Ankit/Atul admin identities unless the business later changes this decision.

### Account requirements

Before production:

- use a unique email dedicated to TCB operations;
- use a randomly generated password of at least 16 characters;
- do not reuse the password anywhere else;
- enable TOTP MFA in Supabase Auth for the operations account when the MFA challenge UI is enabled;
- use a password manager;
- keep recovery/admin access under owner control;
- keep kitchen device OS/browser updated and protected by device PIN/biometrics;
- do not leave the console signed in on public/shared computers.

## Browser keys vs server keys

The browser may contain a Supabase publishable/legacy anon key. That key is not an administrator credential and must have no direct privilege to sensitive tables.

Never expose any of the following in HTML, CSS, frontend JavaScript, GitHub Pages, screenshots, browser local storage, or public repository secrets:

- Supabase secret/service-role key;
- payment gateway secret;
- logistics API secret;
- email-provider API secret;
- database password;
- `TCB_ADMIN_EMAIL` does not need to be public and should remain an Edge Function secret.

Supabase is moving from legacy `anon` / `service_role` keys to publishable / secret keys during 2026. Migrate the website project when the project keys are available, then disable unused legacy keys after validation.

## Database access

Migration `20260917_order_security_hardening.sql`:

- enables RLS on customer/order/audit tables;
- revokes direct privileges from `anon` and `authenticated` browser roles on sensitive tables;
- removes browser write privileges from the products table;
- adds server-only rate-limit storage;
- adds admin-action audit history;
- adds unique idempotency indexes to prevent duplicate orders during concurrent retries.

The intended architecture is:

`Browser -> Edge Function -> server authorization/validation -> database`

not:

`Browser -> sensitive database table`

## Edge Function origin policy

All three order functions use an exact origin allowlist.

Configure:

`TCB_ALLOWED_ORIGINS=https://ankitkashikar.github.io`

If a future custom domain is added, include it explicitly as a comma-separated origin. Do not use `*` for production CORS.

CORS is defense-in-depth, not authentication. Admin security still depends on a valid JWT plus server-side email authorization.

## Rate limiting

Server-side fixed-window rate limits protect the public endpoints against basic abuse/brute force.

Current repository policy:

- place order: IP and phone limits;
- order tracking: IP and order-number+phone pair limits;
- admin API: authenticated-user request limit.

The database stores only SHA-256 derived rate-limit keys, not raw customer IP addresses.

Set a strong random `TCB_RATE_LIMIT_SALT` Edge Function secret before production.

## Order creation protection

`place-order` must continue to enforce all of the following server-side:

- valid order type;
- request-size limit;
- valid idempotency key;
- customer name length;
- Indian mobile validation;
- 25–100 character address validation;
- direct-delivery PIN 411057;
- supported payment method;
- bounded item count and quantity;
- no duplicate product IDs in the payload;
- product exists, is active, and matches order type;
- prices read from database, never from browser totals;
- integer-paise arithmetic before converting back to rupees;
- payment starts pending;
- duplicate idempotency requests return the original order;
- incomplete order headers are rolled back if item insertion fails.

## Admin Order Console protection

`orders.html` is only a UI. Hiding it from navigation is not a security measure.

Real security is in `admin-orders`:

- requires a valid Supabase Auth JWT;
- requires confirmed email;
- requires exact `TCB_ADMIN_EMAIL` match;
- uses server-only database credentials only after authorization;
- applies rate limiting;
- validates delivery URLs and rider fields;
- payment can only move into the allowed verified state;
- an unpaid order cannot be accepted;
- lifecycle transitions are server controlled;
- concurrent stale status updates are rejected;
- reject/cancel requires a reason;
- status events are audit logged;
- payment verification and delivery edits are audit logged.

Changing button HTML, enabling disabled buttons in DevTools, or crafting a custom fetch request must not bypass these checks.

## Customer tracking protection

`order-status` requires both:

- order number;
- checkout phone number.

It deliberately does not return:

- delivery address;
- customer name;
- internal database ID;
- restaurant notes;
- rejection/cancellation reasons;
- admin audit events.

Lookup failures use the same not-found response so the API does not reveal whether only the phone number was wrong.

## XSS and browser rendering

Any database/customer value rendered into HTML must be HTML-escaped or written with `textContent`.

The current Order Console uses `escapeHtml()` before inserting order/customer values into generated markup.

Future development rule: do not insert untrusted customer text into `innerHTML` without explicit escaping.

## Security headers

Edge Function responses include:

- `Cache-Control: no-store`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- restrictive `Permissions-Policy`;
- explicit CORS origin handling.

GitHub Pages controls hosting headers for the static website. If TCB later moves behind Cloudflare/Vercel/another controllable edge, add a strict HTTP Content-Security-Policy, HSTS, frame-ancestors policy and other site-wide response headers at that layer rather than relying on weak HTML-only substitutes.

## Deployment order

Do not deploy the hardened Edge Functions before the security migration.

1. Confirm the target is the website Supabase project referenced by `supabase-config.js`.
2. Back up / confirm recovery.
3. Apply `20260916_order_operations.sql` if not already applied.
4. Apply `20260917_order_security_hardening.sql`.
5. Verify RLS/grants on every sensitive table.
6. Configure `TCB_ADMIN_EMAIL`.
7. Configure `TCB_ALLOWED_ORIGINS`.
8. Configure a random `TCB_RATE_LIMIT_SALT`.
9. Deploy `place-order`.
10. Deploy `admin-orders`.
11. Deploy `order-status`.
12. Create/verify the single TCB Auth user.
13. Run unauthorized API tests before signing in.
14. Run authorized console workflow tests.
15. Run customer tracking tests.
16. Review Supabase Security Advisor findings.
17. Only then use the system for live customer orders.

## Required negative/security tests

Production smoke testing must prove denial as well as success:

- anonymous browser cannot select customers/orders directly;
- anonymous browser cannot insert/update/delete orders;
- ordinary authenticated user cannot access orders;
- wrong admin email receives 403;
- expired/invalid JWT receives 401;
- unsupported origin receives 403;
- oversized/malformed body is rejected;
- price/total fields forged in DevTools do not affect server total;
- illegal status jump is rejected;
- unpaid order cannot be accepted;
- invalid tracking URL is rejected;
- repeated order submission with same idempotency key does not create a duplicate;
- repeated tracking guesses hit rate limiting;
- customer tracking never leaks address/name/internal notes.

## Payment and logistics deferred

Payment gateway and logistics API integration are intentionally deferred by the owner.

Until selected:

- do not add provider secrets;
- do not claim automatic payment verification;
- do not claim automatic rider booking;
- keep payment state separate from order state;
- keep customer delivery fee separate from delivery-partner cost;
- do not invent a sub-₹799 delivery fee.

## References checked for 2026 hardening

- OWASP guidance / ASVS: https://owasp.org/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API security: https://supabase.com/docs/guides/api/securing-your-api
- Supabase Edge Function auth: https://supabase.com/docs/guides/functions/auth
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa

Security is an ongoing process. Re-run the security QA and review dependencies/configuration whenever the order system, authentication, payment, logistics, hosting, or database schema changes.
