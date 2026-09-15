# The Chinese Bliss — Content & Business Consistency Review

**Branch:** `tcb-design-system-refresh`  
**Review date:** 15 September 2026

This review covers public-facing website copy and business consistency. It intentionally does not invent missing business facts. Where the website and project context disagree, the item is marked for owner confirmation.

## Release status

**Status: HOLD — content/business blockers remain before production merge.**

The UI and interaction QA can pass while public content is still inaccurate, placeholder, or unverified. The items below should be resolved before merging this branch to `main`.

## Critical blockers

### 1. Business location conflict — owner confirmation required

The project master context identifies The Chinese Bliss as a cloud kitchen in **Kharadi, Pune**. The public website footer currently shows:

> Shop No A1, Street of Europe, 24, Maan Rd, Hinjawadi Phase-1, Pune, Maharashtra 411057

Do not change this automatically. Confirm the correct public business address / operating location first, then update all public pages consistently.

### 2. Cloud-kitchen model conflicts with homepage copy

The business model is cloud kitchen / delivery-first with no dine-in. The homepage currently says **“Dine In & Delivery”**. This must be changed to delivery/cloud-kitchen wording before release.

### 3. Bulk Order page still contains placeholder products

`bulk-order.html` currently contains five items named **“Dish Name”** with placeholder descriptions and prices. The bulk-order flow should not be treated as production-ready until the actual bulk menu and pricing are supplied.

### 4. UPI payment details are placeholders

Both `menu.html` and `bulk-order.html` currently use:

- `UPI ID: yourbusiness@upi`
- a placeholder QR-code box
- a UPI deep link containing `pa=yourbusiness@upi`

These must be replaced with the real business UPI details before UPI can be considered production-ready. The current payment-confirmation wording is appropriately honest about manual verification and should be preserved.

### 5. Swiggy and Zomato links are generic placeholders

`order.html` currently links the Swiggy card to `https://www.swiggy.com` and the Zomato card to `https://www.zomato.com`, with comments stating that the real restaurant URLs still need to be inserted.

Provide the direct restaurant listing URLs or hide/disable those cards until they are available.

### 6. Our Story page is explicitly placeholder content

`our-story.html` labels its narrative as placeholder/filler and uses random Picsum images for Ankit, Atul, and story scenes. The only confirmed founder facts in project context are:

- Ankit is from Jabalpur.
- Atul is from Nagpur.
- They were roommates before becoming co-founders.
- The Chinese Bliss is an Indo-Chinese cloud kitchen in Pune.

Do not publish invented anecdotes or random people as founder imagery. Replace the copy with owner-approved history and use real founder/brand photography when available.

## Claims requiring verification or removal

The homepage currently presents numerical/social-proof claims that are not supported by the project master context:

- `4.7 Rating` / `4.7★ Average Rating`
- `30 Min Delivery` / `30 Mins Average Delivery`
- `10k+ Happy Customers`
- `4550+ Orders Delivered`
- `2 Locations`
- named five-star customer testimonials
- dish-specific rating counts such as `4.7 (230+)`, `4.8 (180+)`, and `4.6 (150+)`

Before release, either provide the source/current numbers or replace these with non-numerical, verifiable brand statements. Delivery time should be framed as an estimate, consistent with the Terms & Conditions.

## Menu and homepage consistency

### Customer Favorites prices/names do not match the live menu

Homepage cards currently show:

- Hakka Noodles — ₹199
- Chilli Chicken — ₹249
- Schezwan Fried Rice — ₹189

The current menu contains:

- Veg Hakka Noodles — ₹190
- Chicken Chilli — ₹220
- Veg Schezwan Fried Rice — ₹180

Either update the homepage cards to the exact menu items/prices or confirm that the homepage cards represent different variants.

### Menu descriptions are still placeholder copy

Many standard menu items still show:

> Add-ons & description go here

Until real dish descriptions are available, removing the placeholder line is preferable to displaying unfinished copy publicly.

Combo descriptions are already more specific and should remain aligned with their selectable options.

## Homepage content issues

### Footer quick links

The homepage footer currently contains two inconsistent links:

- `our-story` points to the homepage story anchor instead of using the normal `Our Story` label.
- `Catering` points to `our-story.html` instead of `bulk-order.html`.

These are safe to correct once the content cleanup pass is applied.

### Non-functional story video control

The homepage story image includes a **Play video** button but no video behavior or destination. Remove the control unless a real video is supplied.

### Story wording

Homepage story copy says **“authentic Chinese flavors and Indian spices”** and **“premium ingredients”**. The confirmed positioning is Indo-Chinese. Prefer copy that stays within the confirmed brand positioning and avoids ingredient-quality claims unless the business wants to stand behind them.

### Instagram/social section

The homepage displays `@thechinesebliss`, while footer social links currently point to generic Instagram, Facebook, and Yelp homepages. Confirm the real social profile URLs. The image grid still uses external placeholder photography and should not be presented as an actual brand feed until real images are supplied.

## Order page consistency

The order page currently says:

> Hot food at your door in 30 minutes

The Terms & Conditions correctly state that delivery times are estimates and can vary. Replace the order-page sentence with non-guaranteed language unless a 30-minute SLA is actually offered.

The direct-order card currently says **“No commission”**. Consider customer-facing wording such as **“Order directly from us”** instead; the commission statement is an internal/business benefit rather than a customer promise.

## Legal pages

`privacy.html` and `terms.html` are broadly consistent with the current ordering flow, including:

- order/contact information handling,
- manual UPI confirmation,
- Cash on Delivery,
- delivery timing being an estimate,
- cancellation/refund handling being conditional,
- allergy/dietary caution.

Review their “Last updated” dates again after the final business/content changes are made.

## Confirmed business details currently repeated on the site

These values appear consistently in the current public footer/legal content, but should still be owner-verified before production:

- Phone: `+91-8956150583`
- Email: `chinesebliss1@gmail.com`
- Hours: Mon–Sun, 4:00 PM–2:00 AM
- Address currently shown: Shop No A1, Street of Europe, 24, Maan Rd, Hinjawadi Phase-1, Pune, Maharashtra 411057

## Owner inputs required to complete Step 3

1. Correct public business location/address: Kharadi or the current Hinjawadi address?
2. Confirm phone number, email, and opening hours.
3. Real UPI ID and QR image, or confirmation to keep UPI disabled for launch.
4. Direct Swiggy and Zomato restaurant URLs.
5. Actual bulk-order dishes/prices and whether “minimum 10 persons” is a real policy.
6. Which homepage metrics/reviews are real and can be published.
7. Real founder/story copy and founder photos, or approval to use a short facts-only story temporarily.
8. Real Instagram/Facebook/social URLs.

## Recommended cleanup order

1. Resolve address/contact/payment/platform-link facts.
2. Remove or replace unsupported metrics/testimonials.
3. Sync homepage featured dishes with menu pricing.
4. Replace bulk-order placeholders.
5. Replace Our Story filler and random founder imagery.
6. Remove placeholder menu descriptions or add approved dish copy.
7. Correct homepage footer links and non-functional story control.
8. Re-run static QA + responsive/interaction QA.

Only after these items are resolved should the branch be considered content-ready for production merge.
