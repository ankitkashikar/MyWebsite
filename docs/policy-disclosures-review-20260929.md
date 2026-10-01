# P6/P7 operational disclosure review — 29 September 2026

Status: prepared and checked locally; not published. P6/P7 remain partially complete.

## Corrections

- Delivery Policy, Terms, Bulk Policy and order-choice copy distinguish normal orders (PIN 411057) from bulk (no single-PIN restriction; kitchen acceptance, capacity and delivery availability required).
- Terms now matches the implemented 24-hour bulk notice in Asia/Kolkata. Normal 35–50 minute estimate does not apply to bulk.
- Normal operating hours stated Monday–Sunday, 4 PM to midnight, Asia/Kolkata.
- Delivery Policy describes staff-updated Accepted → Preparing → Food is Ready → Dispatched. Dispatched does not confirm delivery. No live rider tracking promised.
- Terms explicitly prohibits combining two coupon codes. Delivery eligibility is separately calculated by existing checkout rules.
- Privacy describes website-only status updates, session storage for lookup, admin-only customer history/item/time summaries and safe support references. Manual fulfilment/support contact remains possible.
- Supporting policy pack updated for selected notification/service-area scope.

## Remaining decisions and held work

- Owner supplied business/legal entity name: The Chinese Bliss; FSSAI number: 21525083001763. Added to homepage contact and Terms. Owner selected existing support phone +91 8956150583 and email chinesebliss1@gmail.com for grievances. No separate person/designation supplied or invented. These are owner-provided details, not independent licence verification. Any named-officer disclosure applicability remains part of final compliance review.
- Confirm retention periods and responsibility for handling correction/deletion requests; no automated deletion or fixed retention period is claimed.
- Final policy applicability/compliance review remains open. Existing grievance wording says “aim” and qualifies resolution timing; review against applicable rules rather than treating it as compliance approval.
- Food descriptions, allergens and other menu inputs remain held. No ingredient or dietary claims added.
- Prices, actual offers, payments, bulk 50% advance/balance language and refund financial terms remain held and were not changed. Existing policy text does not prove payment functionality is implemented. Refund Policy inspected, not edited.
- Legal-review instructions still present in older public policy notes should be replaced with final customer-facing wording once those decisions are settled.
- Local synthetic recovery acceptance is not hosted recovery verification; owner deferred that work.

## Reference review

Department of Consumer Affairs official rules index: https://consumeraffairs.gov.in/pages/consumer-protection-acts
Official 2020–21 report describes grievance acknowledgement within 48 hours and redress within one month: https://consumeraffairs.gov.in/public/upload/files/1617263115_AR2020-21_1733218509.pdf
PIB release dated 10 September 2026 announces amended rules effective 1 January 2027: https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532
These are review references, not a determination that every marketplace provision applies to this direct kitchen website. Upcoming changes require applicability review; no registration or external account action was taken.

## Validation

- `python3 scripts/qa_check.py`: PASS; 13 HTML, 16 CSS, zero errors/warnings.
- `git diff --check`: PASS after correcting Markdown trailing whitespace.
- Diff reviewed: copy/documentation only; no backend, schema, pricing, payment, menu data, image or runtime logic changes.
- No new browser interaction test required for these text/link edits; no visual browser verification claimed.

Next: publication review of the prepared non-held disclosure updates. Retention decisions and final compliance/payment policy review remain open.
