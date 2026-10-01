# Legacy catalogue upgrade review — 1 October 2026

Owner supplied production evidence: first eight migrations recorded; two September 29 menu migrations absent. Normal catalogue contains N001–N024, all named Dish Name. N001 has one normal-order-item reference. Other supplied item and direct/category coupon counts are zero. These counts do not rule out unrestricted coupons or additional schema dependencies.

## Proposed sequence, not approved deployment SQL

1. Keep all legacy IDs and historical values unchanged. Do not guess mappings from placeholder names.
2. Check unrestricted normal/all-channel coupons, fresh schema dependencies and current production configuration read-only.
3. Prepare a prerequisite catalogue migration before the existing September 29 migrations. It must require an explicitly approved price manifest, reject unexpected ID collisions and add the 75 missing bases. Development prices are not approval.
4. Apply menu validation and catalogue migration in a coordinated release with the matching Edge Function and frontend. Review both base and add-on prices: the current catalogue migration hardcodes development add-on prices.
5. Activation/legacy retirement is a separate reviewed release decision. Do not activate draft products or silently disable legacy checkout. Inactive staging alone is not a usable customer rollout.
6. Confirm new checkout behaviour and preserved historical views/retries on the exact release candidate before production acceptance.

## Local evidence

Run `node scripts/legacy_catalogue_upgrade_qa.mjs` from the project root with existing migration rehearsal dependencies installed. Uses only an ephemeral PGlite database; does not accept production credentials or URLs. It recreates the supplied product IDs/prices and a synthetic N001 order, not real customer data.

Eight checks passed: missing-base guard, inactive prerequisite staging, injected-failure rollback, successful catalogue application, unchanged legacy products, unchanged order/customer/audit history, retained replay response, and inactive new products/no seeded coupons. Prices are synthetic development data. No real Supabase ledger, live schema, browser or concurrent-client verification. No production changes.
