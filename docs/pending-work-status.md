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
