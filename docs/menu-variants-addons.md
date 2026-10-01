# Menu variants and inline add-ons — 29 September 2026

Prepared locally; not deployed. This supersedes the unresolved menu decisions in petpooja-menu-content-import.md.

## Approved behaviour

- 75 regular-menu dishes with 127 explicit dish/variant choices. Names and descriptions follow the supplied PetPooja sheet.
- Remove Veg Peri Peri Hakka Noodles and Veg Peri Peri Fried Rice. Do not add source-only Veg Noodles, standalone Thums Up/Sprite or mineral water.
- Drinks are 250 ml add-ons only. No source-sheet promotional offers are imported. Existing separately configured coupons remain subject to existing one-coupon rules.
- Add-ons appear inside the dish row after quantity becomes positive. No additional screen or dialog. Each checked add-on is charged once per portion. Setting quantity to zero clears the add-ons.
- One variant and add-on configuration per dish row, matching the existing cart model. Changing the variant applies to that row's entire quantity.
- Existing base dish prices remain unchanged. Listed add-on amounts: chutney/egg ₹19; drinks ₹39; gravy, three-piece Manchurian and soup chicken ₹49; paneer and other extra chicken ₹59, where applicable to the source item.
- Bulk catering catalogue is unchanged. The shared backend validator also checks its existing product IDs and quantities.

## Validation and persistence

The browser sends IDs and quantities. The server checks active products, order type, eligible parent dishes, integer quantities and combined duplicate lines. Add-on quantity cannot exceed eligible dish quantity. All prices and saved names come from database products. Quotes and final atomic transactions validate the choices. Database row locks hold during final validation and creation. Completed idempotent retries remain valid after catalogue changes.

Each selected variant/add-on has an explicit SKU and named saved order line. Add-on names include their parent dish. Existing order history is not rewritten. Existing 60-line and 50-total-unit normal-order limits include add-ons.

Anonymous/customer roles cannot edit catalogue mappings or execute the validation RPC directly. The service role can. Coupon quotes use the same cart validation.

## Changes and rollout requirements

- `data/menu-options.json`: approved structured catalogue and parent mappings.
- `menu.html`, `menu-options.js`, `menu-design.css`: selectors, inline controls and cart integration.
- `20260929000100_menu_cart_validation.sql`: protected mapping table and validation in order/coupon SQL functions.
- `20260929000200_menu_catalogue.sql`: preserves existing base prices, creates options/add-ons and deactivates old choices. Requires all 75 current base products; a missing base aborts the migration. Reconcile production catalogue read-only before any deployment. New variants inherit base active state.
- `place-order/index.ts`: validates menu selections before pricing; final database transaction validates again.

Deploy both migrations, matching function and frontend together only after local acceptance and deployment approval. Old open carts containing retired option IDs must be reselected; completed retries retain their existing response. Do not publish only menu.html. This work does not change payments or images.

## Checks performed here

- 13 focused PGlite/actual-handler/DOM checks passed, covering all option combinations, invalid parents/quantities, forged prices, persisted names, direct SQL rejection, replay, permissions and inline visibility.
- 13/13 selected offline suites passed.
- Static website QA: 0 errors, 0 warnings.
- No real Chromium, Docker/Supabase, concurrent-client or production execution in this environment.

## Next local acceptance

Use the updated project files in your existing local QA folder. In Git Bash terminal 1:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa"
bash scripts/start_local_delivery_qa.sh
```

Keep terminal 1 running. Once the functions are serving, use terminal 2:

```bash
cd "/d/Personal Projects/TCB-local-supabase-qa/MyWebsite-local-supabase-qa"
bash scripts/run_local_delivery_acceptance.sh
echo "Exit code: $?"
```

Preparation is guarded to the marked, unlinked localhost:55322 QA database. It applies the new validation and seeds the synthetic menu only locally. Normal checkout acceptance now selects Semi Gravy plus an inline add-on at mobile and desktop sizes, and checks saved names and totals. Existing bulk and admin regression scenarios remain included. Inspect the menu at mobile/desktop sizes as part of acceptance. After this passes, proceed to the agreed image work.
