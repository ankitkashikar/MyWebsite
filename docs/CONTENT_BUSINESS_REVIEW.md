# The Chinese Bliss — Content & Business Consistency Review

**Branch:** `tcb-design-system-refresh`  
**Review date:** 15 September 2026  
**Owner decisions updated:** 15 September 2026

This review covers public-facing website copy and business consistency. Missing business facts are intentionally not invented.

## Current release status

**Status: HOLD — several owner-supplied content/payment items remain before production merge.**

UI, static QA, and browser interaction QA can pass while public content is still placeholder or unverified. The remaining items below should be resolved before merging this branch to `main`.

## Confirmed business decisions

### Location

The Chinese Bliss operates from **Hinjewadi Phase 1, Pune**. The current public address is:

> Shop No A1, Street of Europe, 24, Maan Rd, Hinjawadi Phase-1, Pune, Maharashtra 411057

Do not replace this with Kharadi.

### Business positioning

Public-facing copy should describe The Chinese Bliss as a **delivery** food business / Indo-Chinese kitchen. Do **not** use the terms **cloud kitchen** or **dine-in** in customer-facing copy.

A safe cleanup pass has removed the homepage dine-in claim, removed visible cloud-kitchen wording from the placeholder story, removed the non-functional story video control, fixed the homepage story/footer links, and removed the hard 30-minute promise from the Order page.

### Bulk Order

The owner is preparing the real bulk-order menu and will provide it later. Do not invent bulk products, prices, minimum quantities, or event/catering policies. `bulk-order.html` still contains placeholder items and is therefore not production-ready.

### Swiggy / Zomato / other ordering platforms

The owner will provide direct restaurant URLs when this integration is developed. Do not guess or substitute generic platform URLs as final production links.

### Homepage proof claims and featured prices

The owner will provide verified inputs when this section is developed. Do not invent or silently change ratings, customer/order counts, location counts, testimonials, dish review counts, or featured prices.

### Our Story

The owner will create/provide factual founder-story inputs. Do not publish invented anecdotes or random founder imagery. Current placeholder copy and Picsum images are temporary only.

## Payment blocker

Both `menu.html` and `bulk-order.html` still contain placeholder UPI details:

- `UPI ID: yourbusiness@upi`
- placeholder QR content
- UPI deep link containing `pa=yourbusiness@upi`

The current payment confirmation wording is intentionally honest and should remain: a customer action must **not** automatically mark payment as verified. A gateway integration should verify payment server-side (for example through a signed webhook) before changing the order to paid.

The owner is evaluating low-cost merchant UPI and payment-gateway providers before a production choice is made.

## Claims still requiring owner verification

The homepage currently contains numerical/social-proof claims that are not yet owner-verified for production:

- `4.7 Rating` / `4.7★ Average Rating`
- `30 Min Delivery` / `30 Mins Average Delivery`
- `10k+ Happy Customers`
- `4550+ Orders Delivered`
- `2 Locations`
- named five-star customer testimonials
- dish-specific rating counts

Before release, provide source/current values or replace them with non-numerical statements. Delivery timing should always be framed as an estimate unless the business intentionally offers a guaranteed SLA.

## Menu and homepage consistency

### Customer Favorites

Homepage featured prices currently do not match the corresponding menu items. The owner will review these later. Do not change them until requested.

### Dish descriptions

Many standard menu items still show:

> Add-ons & description go here

Recommended production format: one short sentence per dish (roughly 8–14 words) describing the cooking style, main components, and dominant flavour/texture. Avoid unsupported marketing claims. If real ingredient/preparation information is not yet available, hide/remove the placeholder line rather than publish unfinished copy.

Combo descriptions are already specific and should remain aligned with the selectable options.

## Social content

The footer currently uses generic social-homepage links and the homepage image grid uses external placeholder imagery. Ask the owner for the real social profile URLs and brand images when this section is developed.

## Legal pages

`privacy.html` and `terms.html` broadly match the current ordering flow, including manual UPI confirmation, Cash on Delivery, estimated delivery timing, conditional cancellation/refund handling, and allergy/dietary caution.

Review their “Last updated” dates after final ordering/payment/delivery policies are confirmed.

## Current contact details on the site

These values remain on the site and should be reconfirmed before production release:

- Phone: `+91-8956150583`
- Email: `chinesebliss1@gmail.com`
- Hours: Mon–Sun, 4:00 PM–2:00 AM
- Address: Shop No A1, Street of Europe, 24, Maan Rd, Hinjawadi Phase-1, Pune, Maharashtra 411057

## Remaining owner inputs before content-ready release

1. Confirm phone, email, opening hours, delivery area and delivery-time policy.
2. Select the production payment approach and provide merchant onboarding details/UPI QR as applicable.
3. Provide direct Swiggy, Zomato and any other ordering-platform restaurant URLs when integration starts.
4. Provide actual bulk-order products/prices/policies when ready.
5. Provide verified homepage metrics/testimonials when that section is updated.
6. Provide factual founder-story answers and real founder/brand photos.
7. Provide real social profile URLs and brand images.
8. Approve or provide real menu descriptions.

## Recommended remaining order

1. Confirm delivery/service policy.
2. Choose and integrate payment provider.
3. Replace Our Story placeholder content/images.
4. Replace menu description placeholders.
5. Add real platform/social URLs.
6. Add bulk-order content when ready.
7. Reconcile proof claims and homepage featured prices when owner inputs are available.
8. Re-run static QA + responsive/interaction QA and conduct production smoke test.

Only after these remaining content/business items are resolved should the branch be considered content-ready for production merge.
