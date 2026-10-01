# PetPooja menu content import — 29 September 2026

Source: owner-uploaded PetPooja New Online Menu (1).xlsx, sheet The Chinese Bliss Swiggy Zomato.

- 79 source items; mineral water excluded entirely from imported catalogue.
- 78 source content records preserved with row provenance, exact item names, variants, add-ons and descriptions in data/petpooja-menu-content.json.
- 75 existing website dishes matched and descriptions added/replaced. Only obvious “chieken” typo corrected in displayed text. No invented ingredients.
- Product IDs, cart labels, selectors and prices kept unchanged pending catalogue/variant reconciliation. JSON is source staging, not a live selectable add-on catalogue.
- Base source price column intentionally not imported: explicitly Swiggy/Zomato pricing and website price work held. Add-on raw text preserved for review, not used to charge customers.
- Existing combo selectors and server order contract retained. New variant and add-on SKU mapping/validation still required before enabling selection, charging or saving choices.
- Bulk catalogue not changed; source does not establish bulk quantities or prices.

## Source items absent from website

- Veg Noodles
- Thums Up (250ml) [kk]
- Sprite (250ml) [kk]

## Existing website dishes absent from source

- Veg Peri Peri Hakka Noodles (preserved; no invented description)
- Veg Peri Peri Fried Rice (preserved; no invented description)

## Decisions required before complete catalogue integration

- Confirm 200 ml add-on drinks versus 250 ml standalone drinks, or confirm both exist as separate sizes.
- Confirm whether listed add-on prices and “all starters 10% off” apply to the website; do not turn these into discounts automatically while offer/prices are held. Several rice add-on strings have misplaced “10% Off” text.
- Confirm treatment of the two existing Peri Peri dishes absent from source.
- New source dishes require website product IDs and owner-approved website prices; do not invent prices or reuse a different dish ID.
- Starter variants absent from current product records and non-veg combo sauce choices need explicit server-supported variant mapping. Preserve selected variant through cart, server save and receipt. No browser-only paid add-ons.

## Verification

Source-to-HTML description equality checked for every matched record (with declared typo correction), original data-id/data-item/data-price and option values preserved. Static QA and diff checks run. No live deployment or database changes.

Next: resolve the drink-size and website add-on/offer pricing questions, then complete selectable variants/add-ons with backend validation. Images remain the following content task.
