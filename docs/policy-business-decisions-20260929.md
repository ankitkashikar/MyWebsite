# Policy gap review and owner decisions — 29 September 2026

Review only. No publication or business-rule changes. Policies remain prepared on the policy branch.

## Findings and decisions needed

1. Grievance contact: keep existing phone/email, but obtain responsible individual's name/designation. Consumer Protection (E-Commerce) Rules 2020 rule 4 addresses officer identity/contact/designation and 48-hour acknowledgement / one-month redress. Existing vague “aim” wording is not sufficient evidence of an operational process. Ask who monitors and records complaints.
2. FSSAI scope: supplied number is not independent verification. Obtain certificate details (holder, kind of business, type, validity and address). FSSAI official FAQ Q80 says own-platform food sales also require the e-commerce category. Check current FoSCoS applicability with licensing authority; do not infer coverage from the number alone. Invoice/bill FSSAI display is also an operational gap to confirm (FAQ Q112).
3. Cancellation/remedies: current “more likely” before preparation and “refunded or otherwise resolved” are vague. Propose full refund when kitchen cannot fulfil and pre-preparation cancellation with no committed delivery. Do not substitute coupon/credit for an owed refund without customer's agreement. Confirm kitchen practice. Review any post-preparation/courier deductions separately under rule 4(8) and consumer remedies, rather than treating blanket non-refundability as approved.
4. Privacy: name the person handling access/correction/deletion and manual verification. Obtain accountant's record-retention needs before setting periods. No automatic deletion exists; do not promise it. Keep optional customer preference summaries distinct from required financial/order records. DPDP Rules 2025 are phased; core rules include an 18-month commencement group, so do not assert all are in force now.
5. Business identity/tax: confirm FSSAI certificate holder matches supplied business name and whether GST registered, without requesting PAN/Aadhaar. Prices and tax-rate configuration remain on hold. Confirm bill issuer (e.g. existing billing system) and FSSAI number inclusion.
6. Bulk: confirm who approves destination/time and handles changes/cancellation. Existing 50/50 payment text does not establish implemented staged payments; final payment/refund timelines stay held.

## References checked

- Department of Consumer Affairs official rules index: https://consumeraffairs.gov.in/pages/consumer-protection-acts
- 2020 rules, government court-hosted copy: https://thc.nic.in/Central%20Governmental%20Rules/Consumer%20Protection%20(E-Commerce)%20Rules,%202020.pdf
- FSSAI official licensing FAQ, Q80 and Q112: https://www.fssai.gov.in/upload/uploadfiles/files/FAQs_Licensing_Registration_02_12_2021.pdf
- FSSAI receipt/invoice order: https://fssai.gov.in/upload/advisories/2022/09/6320614d91afaOrder_License_Food_13_09_2022.pdf
- Final DPDP Rules notification (phased commencement): https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
- Prior checked PIB announcement of 2026 e-commerce amendments effective 1 January 2027: https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532

The indexed April 2026 FoSCoS eligibility PDF could not be opened through research tools; current certificate scope must be confirmed. This review identifies gaps, not a comprehensive compliance certification. Menu disclosure applicability and payment-specific implementation remain held. No licences, registrations or private account state were verified.

Next: owner answers in chat, followed by concrete policy edits and a manual support/privacy procedure reflecting actual operations. Publish only once approved.

## Owner answers — 29 September, 12:37 IST

- Atul handles complaints, with shop manager as backup. Full name and formal designation not yet supplied. Same support phone/email. Daily checks and prompt, evidence-based resolution confirmed; missing evidence must not silently suspend complaint acknowledgement or applicable redress obligations.
- Full refund when kitchen cannot fulfil confirmed. Wrong/missing/damaged issues assessed case by case. Existing preparation/rider cancellation wording retained; personal-context lookup did not recover a more exact earlier owner decision. Proposed blanket free cancellation before preparation was not approved.
- Owner considers existing FSSAI number sufficient; certificate/e-commerce scope remains unverified. No licence status inferred or fabricated.
- Owner wants secure retention and no deletion. No deletion performed or added. Privacy retention review remains unresolved; do not represent perpetual storage or on-premises-only storage as verified/compliant. Website records use Supabase; privacy requests require assessment.
- Owner reports not GST registered. Reason/exemption not independently verified; no GST eligibility/tax-rate conclusion made.
- NEW SELECTED FEATURE: website-generated customer receipt automatically printed when staff accepts an order, attached to delivery; preserve orders and items in database. Need printer model, connection, paper width and device/OS before choosing printing integration. Normal/bulk item/order persistence already exists. Receipt and automatic print queue not yet implemented.

## Printing acceptance scope to prepare after hardware confirmation

Server-authoritative saved order/items/amounts; business/FSSAI details; receipt/order identifier and IST time; no invented GSTIN or GST collection. Trigger on successful server acceptance (not merely click). Persistent print-job identity per order, visible failures, reconnect handling, and deliberate reprint marked copy. Do not promise physical exactly-once printing when printer acknowledgements are unavailable. Preserve recorded prices on reprint. No raw personal data in print diagnostics. Confirm 58/80 mm layout against printer, and actual hardware test before claiming auto-print works. Treat this as selected future work, not a completed feature or a reason to reopen payment selection.

## Superseding owner details — 29 September, 12:55 IST

- Public complaint label: Customer Support Manager only; remove Atul's name from public wording. Atul/Ankit remain internal reviewers. Named-officer compliance disclosure remains unresolved rather than declared satisfied.
- Cancellation cutoff explicitly confirmed: before restaurant acceptance only, including bulk; retain staff operational cancellation authority after acceptance. This is a policy update, not a new customer cancellation endpoint.
- Wrong/missing/damaged complaints: reason and 2–3 clear original order photos requested, situation/evidence-based full/partial/rejection decision. Do not require food photos for a pre-delivery cancellation or charge-only issue. Allow other evidence for issues not photographable. Confirmed fabricated/misleading evidence grounds rejection; no AI detector or suspicion-only automatic rejection implemented.
- Refund terminology clarified: Request received → Admin review → Approved/refund pending → Transfer initiated → Full/partial refund completed, or Rejected. Rejected refund request is separate from rejected order. Do not mark a money transfer initiated before admin approval or refunded without evidence. Complaint refunds can occur after dispatch/delivery and do not require cancelling the order.
- Existing server supports staff cancellation after acceptance and payment confirmation. Refund request storage, evidence upload, admin decision/amount audit, transfer processing and customer refund status flow are NOT implemented by these policy edits. Keep staged work distinct from existing payment-status enum values.
- Photo successfully inspected: Shreyans branding. Owner-supplied model SRS89C-U; pictured front does not verify model label, interfaces or paper size. Need connection and staff device/OS before printer integration. No purchase recommendation or driver assumptions.

Next: complete public-policy review, keeping named-officer/retention/licensing gaps explicit; then implement any authorised refund workflow separately from provider transfers. Printer setup awaits connection/device confirmation.

## Printer update — 29 September, 19:52 IST

Owner confirms USB. Host device/OS and paper width still pending; do not re-ask connection. Policy consistency review closed separately; see policy-review-closeout-20260929.md.
