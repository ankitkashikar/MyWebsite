# P17 — error monitoring and support

Implemented locally, 25 September 2026. Production unchanged.

## What is recorded

The four website Edge Functions produce one structured `api_failure` log for each application response with status >=400. Fields: event, endpoint, random server-generated reference, HTTP status, duration_ms. The reference is included in the response message, allowing the customer/admin to provide it to staff. Do not log bodies, headers, phone/address/name, coupons, tokens, IP addresses, database errors or stack traces. Expected validation failures also create records; a single 400/404 is not an outage.

The request reference is scoped to one request, including concurrent requests. No logging table, migration, external tracking SDK or outbound customer notification is added. Existing audit histories remain separate.

Checkout and coupon calls have 15-second timeouts. A checkout timeout does not prove the database rejected the order. The message asks the customer to keep checkout open and retry unchanged, preserving the existing request key. Never advise a second payment. Browser helpers hide raw server/proxy 5xx messages, retain valid support references and explain the 10-minute rate-limit wait. Tracking failures preserve the existing stale-state behavior.

## Staff response

1. Collect the error reference, approximate time in Asia/Kolkata and affected page. If there is no reference, record time and page only. Do not request passwords, OTPs, keys, or an unredacted network export.
2. For an uncertain order submission, use the authenticated Order Console/Customers section to check whether an order exists before asking the customer to start again. Do not infer payment success from the browser.
3. In the website Supabase project's function logs, search the exact reference. Confirm the function and status. For local QA, inspect `.local-supabase-qa/functions.log` on the laptop. Share only the sanitized failure record.
4. 400/404: review entered details; unknown order/wrong phone deliberately have the same public response. 401/403: sign in again or confirm authorization; never weaken access rules. 409: reload/review the changed record. 429: wait 10 minutes; never disable limits. Repeated 5xx: inspect website function health, configuration and database/migration availability using authorized access.
5. If the function produced no reference, inspect gateway/runtime availability around that time. Gateway rejection, runtime boot failure, static script failure and network disconnection can happen before application logging.
6. Record incident time, reference, endpoint, status, scope, corrective action and verification result in a private staff incident note. Keep customer details in the existing restricted order system. Verify recovery locally before a release; use the separate approved recovery plan if rollback is required.

## Limits and release gate

This is manual monitoring through existing function logs, not automatic outage detection, paging, uptime monitoring or a new admin incidents screen. Platform-owned gateway/Auth/database logs have separate contents and retention; these changes do not redact or configure those logs. Production log access/retention, a named staff owner and review frequency must be confirmed during production configuration. Do not claim production monitoring is active from local tests.

Validation: 7 mocked runtime/browser monitoring checks; 11 existing progress checks; static order-status security check. Real local acceptance must be rerun after restarting functions: 38 checkout +85 admin/operations expected. No real payments or production acceptance.
