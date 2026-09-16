# The Chinese Bliss — Content & Business Consistency Review

**Branch:** `tcb-design-system-refresh`  
**Review date:** 15 September 2026  
**Owner decisions updated:** 15 September 2026

This review covers public-facing website copy and business consistency. Missing business facts are intentionally not invented.

## Current release status

**Status: HOLD — several owner-supplied content/payment/integration items remain before production merge.**

UI, static QA, and browser interaction QA can pass while public content is still placeholder or unverified. The remaining items below should be resolved before merging this branch to `main`.

## Confirmed business decisions

### Location

The Chinese Bliss operates from **Hinjewadi Phase 1, Pune**. Direct website delivery is currently intended for PIN code **411057**.

Current public address:

> Shop No A1, Street of Europe, 24, Maan Rd, Hinjawadi Phase-1, Pune, Maharashtra 411057

Do not replace this with Kharadi.

### Business positioning

Public-facing copy should describe The Chinese Bliss as a **delivery** food business / Indo-Chinese kitchen. Do **not** use the terms **cloud kitchen** or **dine-in** in customer-facing copy.

A safe cleanup pass has removed the homepage dine-in claim, removed visible cloud-kitchen wording from the placeholder story, removed the non-functional story video control, fixed the homepage story/footer links, and removed the hard 30-minute promise from the Order page.

### Direct delivery policy

Confirmed operating inputs:

- Direct-order hours: **4:00 PM–12:00 AM**.
- Standard ETA target: **approximately 35–50 minutes from order confirmation**, presented as an estimate rather than a guarantee.
- One item, no queue: approximately **6–7 minutes** preparation.
- Around three items: commonly **10–12 minutes**, depending on item mix and current queue.
- Friday–Sunday peak preparation planning: approximately **10–15 minutes**, subject to rush.
- Current operating pattern is to book a delivery partner when the order arrives; rider arrival is commonly around **5–7 minutes**, but this is not guaranteed.
- Direct website orders should receive kitchen priority where operationally possible.
- Third-party delivery options under discussion include Porter, Shiprocket and Borzo. Do not hard-code one provider until selected.
- Food subtotal **₹799 or above**: planned free direct delivery within the supported area.
- Below ₹799: customer pays the applicable delivery charge. The website should show the charge before payment/order confirmation. Do not fabricate a live fee before the selected logistics provider/API can quote it.
- Heavy rain, flooding, traffic, peak demand, rider shortages, building/security access and customer unresponsiveness should be disclosed as ETA variables.
- Goodwill delay coupons may be handled case by case, but customer-facing policy must preserve applicable statutory refund/remedy rights.

### Scheduled orders and notifications

Scheduled ordering is supported. The selected slot should be described as a requested/estimated delivery window rather than an absolute guarantee.

Recommended transactional notification priorities:

1. order received;
2. order confirmed + current ETA;
3. payment status;
4. scheduled-order reminder where applicable;
5. rider assigned / dispatched with tracking link if supported;
6. material delay update;
7. delivered/support message.

### Payment and COD

Cash on Delivery is **not currently planned for direct website orders**.

Both `menu.html` and `bulk-order.html` still contain placeholder UPI details in development. These must not be treated as production-ready.

Recommended payment architecture:

**Website → Supabase/server function → payment provider → signed webhook → payment status**

The customer must never be marked paid merely because they click an “I paid” action. Manual UPI should remain **Payment Pending Confirmation** until verified.

### Bulk Order

The owner is preparing the real bulk-order menu and will provide it later. Do not invent products or prices.

Confirmed bulk-order commercial policy:

- request at least **1–2 days in advance**;
- **50% advance payment** to confirm;
- remaining **50% before dispatch**;
- no post-delivery credit planned;
- regular 35–50 minute ETA does not apply to bulk orders.

### Swiggy / Zomato / other ordering platforms

The owner will provide direct restaurant URLs when this integration is developed. Do not guess or substitute generic platform URLs as final production links.

### Homepage proof claims and featured prices

The owner will provide verified inputs when this section is developed. Do not invent or silently change ratings, customer/order counts, location counts, testimonials, dish review counts, or featured prices.

### Our Story and photography

The owner will provide:

- factual founder-story inputs;
- founder photos of Ankit and Atul;
- kitchen/working photos;
- details about how the idea started after development/testing.

Do not publish invented anecdotes or random founder imagery. Current placeholder copy and Picsum images are temporary only.

### Food descriptions

The owner has real food descriptions and will provide them for the menu-content pass. Do not invent ingredients, allergens, dietary claims or preparation details.

Current placeholder text such as **“Add-ons & description go here”** should be removed/replaced before production.

## Claims still requiring owner verification

The homepage currently contains numerical/social-proof claims that are not yet owner-verified for production:

- `4.7 Rating` / `4.7★ Average Rating`
- `30 Min Delivery` / `30 Mins Average Delivery`
- `10k+ Happy Customers`
- `4550+ Orders Delivered`
- `2 Locations`
- named five-star customer testimonials
- dish-specific rating counts

Before release, provide source/current values or replace them with non-numerical statements.

## Customer policy pages now available

The branch contains dedicated customer policy pages:

- `terms.html`
- `privacy.html`
- `delivery-policy.html`
- `refund-policy.html`
- `bulk-order-policy.html`

A consolidated working document is also maintained in:

- `docs/TCB_TERMS_POLICY_PACK.md`

These are operating/legal drafts and should receive final Indian legal/compliance review before launch.

## Indian compliance items to confirm before launch

- FSSAI registration/licence number and where it must be displayed on the website and invoices/receipts.
- FSSAI number on invoices/bills where required.
- Applicable GST/tax/invoice requirements.
- Grievance-contact / grievance-officer requirements applicable to TCB's direct website model.
- Total-price disclosure including compulsory delivery fees before purchase.
- Cancellation/refund wording under applicable consumer law.
- Customer data/privacy obligations.
- Payment-gateway settlement/refund/chargeback rules.
- WhatsApp/SMS transactional-notification requirements.
- Final delivery-provider terms and liability allocation.

## Remaining owner inputs before content-ready release

1. Select production payment approach and complete merchant onboarding.
2. Select final logistics provider/routing logic and delivery-fee integration.
3. Provide real Our Story inputs and founder/kitchen photos.
4. Provide real menu descriptions.
5. Provide direct Swiggy, Zomato and any other ordering-platform restaurant URLs when integration starts.
6. Provide actual bulk-order products/prices when ready.
7. Provide verified homepage metrics/testimonials and featured-price decisions when that section is updated.
8. Provide real social profile URLs and brand images.
9. Provide FSSAI number and confirm tax/invoice business details for final compliance pass.

## Recommended remaining order

1. Choose payment provider and integrate server-side verification.
2. Choose delivery provider and implement pre-payment delivery-charge calculation/quote.
3. Add customer transactional notifications.
4. Replace Our Story placeholder content/images.
5. Replace menu description placeholders.
6. Add real platform/social URLs.
7. Add bulk-order products when ready.
8. Reconcile proof claims and homepage featured prices when owner inputs are available.
9. Complete legal/compliance review.
10. Re-run static QA + responsive/interaction QA + payment/delivery integration tests and conduct production smoke test.

Only after these remaining content/business items are resolved should the branch be considered content-ready for production merge.
