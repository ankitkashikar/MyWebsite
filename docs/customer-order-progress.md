# Customer order progress — 25 September 2026

Owner scope: website status only, no outbound notifications and no full delivery tracking.

Customer timeline: Accepted → Preparing → Food is Ready → Dispatched.
New orders display Awaiting Acceptance without marking Accepted. Rejected/cancelled orders show explicit problem states without a completed progress step. Internal rider_assigned maps to Food is Ready; internal delivered maps to the final Dispatched stage. Internal staff order statuses and order records are unchanged.

Removed customer delivery-provider/tracking-link panel and ETA display. Public order-status responses no longer select or return provider, tracking URL, rider-assignment time or estimated delivery window fields. Rider name/phone remain private. Existing order items, totals, payment labels and requested slots remain unchanged. No menu, image, pricing or payment integration work was performed.

Timestamps use Asia/Kolkata. Automatic lookup uses a single timeout every 120 seconds following a successful active-order response (instead of a 30-second interval). A single page makes at most about six checks across ten minutes, below the existing eight-per-order/network limit. Manual repeat submits share the two-minute per-order cooldown within the page. No requests are made while hidden; recheck waits for a later visible timer tick. Network calls have a 15-second timeout. Dispatch, delivered, rejected and cancelled stop automatic checks. Failures pause auto checks, and displayed old results are identified as stale. HTTP 429 triggers a ten-minute cooldown. Editing either lookup input clears the prior result and invalidates outstanding responses.

The server guessing protections are unchanged. Multiple tabs, reloads, shared-network traffic and manual API requests can still hit server limits. This is not real-time push; customer status can lag staff updates by two minutes or more depending on visibility/connectivity. There is no live GPS tracking or external delivery link.

Verification: 11 offline API/DOM checks passed, with mocked clock/API and an actual handler executed against a query adapter. Coverage includes all state mappings, empty progress before acceptance, private-field omission for both order types, IST rollover, markup escaping, polling cadence, repeated clicks, terminal states, network errors, 429 cooldown, stale responses and fail-closed rate limiting. Existing order-status security source checks pass. Local Supabase/browser acceptance remains pending for this revision; the preceding revision's 85 checks passed as reported by the user.

## Local acceptance

Extract the package into the existing QA project. In the serving terminal, Ctrl+C then:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/start_local_delivery_qa.sh
```

In another Git Bash terminal:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa" &&
bash scripts/run_local_delivery_acceptance.sh
echo "Exit code: $?"
```

Expected: 38 checkout and 85 operations/admin checks, exit 0. The customer-browser assertion now expects the final Dispatched label even when the staff's internal state is delivered. It also checks exactly four steps, no external link, and the narrowed public response. No database migration is required.

Next after acceptance: P17 review of failed-order/error monitoring and support handling. Full delivery tracking remains deferred. P1–P23 remain tracked separately; menu/images/prices/payments remain held.
