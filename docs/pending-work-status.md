## Legacy production catalogue review — 1 October 2026

Owner confirmed underline layout tests passed. Production history matches the first eight local migrations. Catalogue evidence shows 24 placeholder N-series products; all 75 required base IDs absent. N001 has one saved order-item reference; direct/category coupon counts zero. Eight synthetic PGlite upgrade-preservation checks now pass. Unrestricted coupons, fresh schema/configuration and approved price manifest remain pending. No production writes. See legacy-catalogue-upgrade-review.md.

## Public spacing refinement — 1 October 2026

Reduced stacked footer padding/margins, aligned column headings, removed heading underline spacing, unified logo/tagline/social gaps, and added responsive footer grid sizing. Moderated homepage section and policy-page spacing. Shared spacing layer applied to 12 public HTML pages; staff screens unchanged. Static QA passes. Local browser review now checks footer padding, heading alignment and spacing and saves footer screenshots at 390/1280px. Real browser review pending. No deployment.

## Footer social icons and duplicate address — 1 October 2026

Reviewed all 14 pages and updated all nine existing footers with inline Instagram/Facebook icons linked to the confirmed profiles. Removed CSS-generated contact text responsible for showing the address in place of the homepage FSSAI paragraph. Full contact footers now use their actual HTML address once, with FSSAI information retained. No new footers added to checkout/staff pages. Static QA and nine-footer DOM checks pass. Expanded local browser review verifies icons, tap targets, address counts and generated content at both widths. Local browser run pending; no deployment.

## Our Story visual redesign — 30 September 2026

Replaced the sparse story layout with a split photo introduction, readable typography, founder monograms, chapter panel and menu invitation. Original Hakka Noodles photo unchanged. Confirmed founder details and Delivery Details retained. Styles scoped to Our Story, restrained motion with reduced-motion support. Static QA passes; desktop/mobile browser screenshots still to run locally using menu_layout_review.mjs. No deployment.

## Explore title readability and Our Story — 30 September 2026

Changed only the three Explore Menu dish-title fonts to the menu/body font. Restored Ankit/Atul founder cards and a short story based on recorded hometowns, roommate relationship and co-founder roles, with Delivery Details below. Did not restore old explicitly invented anecdotes or random founder photos. Static QA passed; browser review pending. No deployment.

## Consistent page logos — 30 September 2026

All 14 pages now use a shared homepage-logo treatment: original PNG, circular clipping, transparent background, 60px desktop/50px mobile. Footer logos stay 42px. Removed the extra policy-header name/tagline, corrected console backgrounds, and added the logo to admin login/settings. Static QA and DOM checks pass. Expanded menu_layout_review.mjs to check logo asset, size and background on every page at both widths. Browser execution pending locally; no deployment.

## Homepage polish, tracking and IST — 30 September 2026

Fixed tall Explore Menu image areas, refined compact cards, removed favicon white corners, added homepage and bulk-confirmation tracking links, and replaced visible Asia/Kolkata with IST. Static and focused tests pass; real browser visual review remains pending. Not deployed. See homepage-explore-update.md.

## Homepage Explore Menu and favicon — 30 September 2026

Three supplied original photos now used in Explore Menu cards with warm accents, category links and dietary labels. Exact existing logo SVG configured as favicon on all 14 pages. Policy wording verified statically. Local visual review helper expanded; real browser run remains pending. No deployment. See homepage-explore-update.md.

## Website wording correction — 30 September 2026

Changed visible semicolons to sentence punctuation and replaced midnight wording with 12:00 AM across affected pages. Eleven pages updated. All 14 HTML pages checked, scripts/styles unchanged and static QA passed. Operating hours remain 4:00 PM–12:00 AM Asia/Kolkata. Not deployed. Next: verify wording in local preview, then finish the pending layout review.

## Photo scope closed; compact menu cards — 30 September 2026

69/75 dishes now have supplied original photos. Owner accepts the other six without photos, last in each subsection; do not request further photos. Added all soups and Chicken Fried Rice, retained identical noodle re-upload. Compact side-photo card layout prepared. No deployment. Next: local visual review of compact cards.

## Static dish photos and second upload batch — 30 September 2026

Added 25 original photos, now 58/75 dishes covered. All starters covered; 17 missing across noodles, rice and soups. Per owner instruction, a dish photo remains static for every preparation/choice. This supersedes prior Dry-only photo handling. Photo-first sorting retained in every section. Local-only, not deployed. Next: remaining photos, section by section.

## Photo assignment — 30 September 2026

User reported 38 checkout/API and 85 admin/operations checks passed with exit code 0 for the menu update. Added supplied photos to 33 regular-menu dishes; 42 still missing. Originals preserved, duplicate consolidated, Dry-specific photo restricted to Dry. Not deployed. See menu-photo-assignment.md for mappings and missing list. Next: visual review and remaining photos.

## Menu variants and add-ons — latest owner decisions, 29 September 2026

Implemented locally: 250 ml drinks as add-ons only, no promotional offers, removed two Peri Peri dishes and excluded Veg Noodles/standalone drinks/mineral water. Added inline add-ons and 127 choices across 75 regular-menu dishes, with server pricing, eligibility checks and named saved order lines. Existing base prices preserved. 13 focused SQL/API/DOM checks and 13/13 selected offline suites pass; static QA clean. See menu-variants-addons.md. Not deployed. Next: real local Supabase/browser acceptance, then images. Earlier unresolved menu notes below are historical.

## Menu content import — 29 September, 20:07 IST

Owner supplied PetPooja New Online Menu (1).xlsx; requested item names, variants, add-ons and descriptions, excluding mineral water. Read all 79 item rows; preserved 78 non-water records with source row provenance. Added source descriptions to 75 matching website dishes. Three source items absent from website: Veg Noodles, Thums Up 250 ml, Sprite 250 ml. Two existing Peri Peri dishes absent from source preserved. Prices/images unchanged. Variants/add-ons fully extracted but not yet enabled: drink sizes conflict (200 ml add-ons vs 250 ml items), website add-on/offer prices unconfirmed and server SKU mapping required. See petpooja-menu-content-import.md. Not published. Next: clarify drink sizes, website add-on prices/10% starter offer, and new/missing items; then complete catalogue integration before images.

## Policy wording review closeout — 29 September, 19:52 IST

Current-scope policy copy reviewed and corrected; five policy pages and support hub prepared, not published. See policy-review-closeout-20260929.md for procedure and outstanding named-contact, FSSAI-scope, retention and held payment/menu issues. USB confirmed for Shreyans SRS89C-U; printing and refund-system development stay separate. Next agreed content task: owner item descriptions, followed by images.

## Latest update — 29 September 2026, 12:55 IST

Public complaint contact changed to Customer Support Manager (owner requested no personal name). Acceptance is the customer cancellation cutoff. Refund policy now explains original-photo evidence and full/partial/rejected admin decisions, with truthful transfer terminology. Prepared only, not deployed. Full refund-request/evidence/approval workflow remains to implement; automatic printing pending connection/device details. Shreyans photo inspected; SRS89C-U model supplied by owner. Earlier cancellation/name notes below are historical.

## Latest owner decisions — 29 September 2026, 12:37 IST

Atul/shop manager handle complaints daily; full refund if kitchen cannot fulfil; verified item issues assessed case by case. Copy updated locally. Owner reports no GST registration and requests automatic website receipt printing on accepted orders. Printer integration is selected but pending hardware details; orders/items already persist. Owner wants no deletion; lawful retention/privacy handling and FSSAI e-commerce scope remain unresolved. Policies still unpublished. See policy-business-decisions-20260929.md.

# Current update — 29 September 2026

This update supersedes the historical deployment/approval statements below. The owner approved development publication: matching backend and frontend were deployed on 28 September; eight migration IDs matched. Original homepage photos were restored and verified live. This is not completed business/payment acceptance.

P6/P7: operational wording corrected on branch `tcb-policy-disclosures-review-20260929`, not published. Normal PIN 411057 versus bulk destination acceptance, 24-hour Asia/Kolkata notice, website-only status updates, one coupon per order and admin Customers privacy disclosure now agree. See `policy-disclosures-review-20260929.md` for remaining inputs and validation. Menu, images, prices and payments stay held. Production recovery stays deferred.

Owner supplied The Chinese Bliss and FSSAI number 21525083001763 on 29 September, with existing support phone/email as grievance contact. Added locally; no separate named officer invented. Policies & Support hub (`policies.html`) now prepared with five policy links, existing support contacts, Order Status link and owner-supplied business/FSSAI details. Linked from homepage/menu/story and all five policy footers. Static QA: 14 HTML, 16 CSS, zero errors/warnings. Not published. Next: approve publication of the prepared hub and P6/P7 updates; retention decisions and final compliance/payment review remain pending.

---

# P1–P23 status — 25 September 2026

The numbered pending scope has not been reduced. Grouping it into five work areas did not remove items. Owner holds menu, images, prices and payments until the remaining selected work is complete. Future F-list features remain unselected except the kitchen alerts explicitly authorized in this conversation. No production release is authorized.

| ID | Work | Current handling |
| --- | --- | --- |
| P1 | Regular menu | Hold: menu/prices |
| P2 | Bulk catalogue | Hold: menu/prices |
| P3 | Approved images | Hold: images |
| P4 | Business/contact/hours/service area | Owner confirmed address, phone, email and Mon–Sun 4 PM–midnight on 28 September. Normal PIN 411057; bulk not restricted to that PIN |
| P5 | Restaurant/platform/social links | Owner confirmed all four links on 28 September; restaurant cards and main-page social footer links connected locally. Publication pending |
| P6 | Food descriptions/disclosures | Food/menu content held; other business disclosures can be reviewed |
| P7 | Final policies | Review non-held sections now; menu/price/payment-dependent finalization held |
| P8 | Actual delivery charges | Hold: prices; admin controls already built |
| P9 | Actual coupon offers | Hold: offer amounts; coupon management already built |
| P10 | Payment method/provider | Hold |
| P11 | Verified payment destination | Hold; UPI placeholder remains a release blocker |
| P12 | Payment integration | Hold |
| P13 | Bulk advance/balance | Hold |
| P14 | Refund/reconciliation | Hold: payments |
| P15 | Notifications | Kitchen alerts: user reported 85 local checks passed. Customer updates are website status page only; WhatsApp/SMS/email excluded by owner. |
| P16 | Delivery operations | Owner selected four-stage customer order progress; simplification accepted: owner reported 85 checks passed, exit 0. Full delivery tracking deferred. |
| P17 | Monitoring/support process | Local acceptance passed: owner reported 85 checks, exit 0 after reference assertion fix. Production monitoring ownership/retention still to confirm |
| P18 | Final full regression | Selected offline review/test fixes complete: see selected-regression-review.md. Final release-candidate, real-device and held-payment regression pending |
| P19 | Production configuration | Repository readiness review/checklist prepared; account-level evidence and hosting/CI gaps remain. See production-configuration-readiness.md |
| P20 | Production rollout | Coordinated rollout/recovery plan and repository check fixes prepared; execution pending approval and unresolved gates |
| P21 | Production recovery plan | Deferred by owner on 28 September. Procedure prepared; Free plan/no dashboard backups and no Storage buckets shown. Production recovery and write-pause remain unverified |
| P22 | Live acceptance | After approved deployment |
| P23 | Release approval | Explicit owner approval required after concrete release review |

Prior accepted user results: 81 local Customers/coupon/delivery/operations checks and 12 Docker recovery checks, exit 0. These are now recorded as passed, superseding earlier pending notes. Kitchen alert changes require the newly expanded acceptance suite (85 admin/operations checks). No menu, price, image or payment work was changed for alerts.

Next after kitchen alerts pass: decide customer notification channel/event scope, then implement the selected flow. Do not choose a paid messaging service without owner agreement. When the agreed non-held development/review work is complete, explicitly tell the owner to revisit held menu/images/prices/payments. Production acceptance and approval necessarily follow that work; they cannot be completed first.

Latest scope: see customer-order-progress.md. After its acceptance, move to P17 monitoring/support review; do not reopen outbound notifications or full tracking without owner direction.

P16 acceptance: owner reported 85 local checks passed, exit 0 after admin startup fix. P17 implementation details and limits: see error-monitoring-support.md. Next: run local acceptance for P17; then P18 review remaining regression coverage within the non-held scope.

26 September: P17 accepted locally (85 checks, exit 0). P18 reviewed selected coverage, repaired offline logging mocks and added hidden-tab/in-flight refresh checks. Next P19 configuration readiness review; P4–P7 owner confirmations and all holds remain tracked.

P20 preparation: see coordinated-rollout-recovery-plan.md. Offline smoke-contract tests passed; no live probes or deployment. Next P21: confirm production recovery evidence and prepare the missing write-control/reconciliation procedure.

28 September P21: recovery/write-pause/reconciliation procedure prepared. No live account access available and no production changes. Next collect non-secret Backups page evidence; do not skip to live acceptance or release.
