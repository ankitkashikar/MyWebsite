# The Chinese Bliss — Customer Terms & Policy Pack

**Status:** Working draft for business/legal review  
**Operating area:** Hinjewadi Phase 1, Pune — direct-delivery PIN 411057  
**Last reviewed:** 15 September 2026

> This document consolidates the customer-facing operating rules for direct website orders. It is intended to guide the website implementation and legal review. It is not a substitute for professional legal advice.

## 1. Confirmed direct-order operating model

- Customer-facing positioning: **The Chinese Bliss / Indo-Chinese Kitchen / Delivery**. Do not describe the business as dine-in or use “cloud kitchen” in public copy.
- Direct website delivery area: serviceable addresses in **PIN 411057**, Hinjewadi Phase 1, Pune.
- Direct website delivery window: **4:00 PM to 12:00 AM**.
- Normal delivery target for standard orders: **approximately 35–50 minutes from order confirmation**, clearly presented as an estimate rather than a guarantee.
- Normal preparation guidance:
  - one item, no queue: approximately 6–7 minutes;
  - around three items: commonly 10–12 minutes depending on item mix and queue;
  - Friday–Sunday peak preparation: plan around 10–15 minutes, subject to rush.
- Delivery partner arrival after booking is commonly around 5–7 minutes in the current operating pattern, but this is not guaranteed and depends on provider availability.
- Direct orders will receive priority in the kitchen where operationally possible.
- Delivery may be fulfilled through a third-party hyperlocal logistics provider. Porter, Shiprocket and Borzo are currently under consideration; the final provider or routing logic is not yet selected.
- Orders with food subtotal **₹799 or above**: planned free direct delivery within the supported area.
- Orders below ₹799: customer pays the applicable delivery charge. The final website should show the delivery charge before payment/order confirmation. A live delivery quote should only be automated after the logistics provider/API is selected.
- Scheduled orders: supported. A scheduled time is a requested delivery window and should generate transactional notifications.
- Cash on Delivery: **not currently planned for direct website orders**.
- Bulk orders: request at least **1–2 days in advance**, **50% advance to confirm**, remaining **50% before dispatch**, with no post-delivery credit planned.

## 2. Recommended customer notification lifecycle

The website should notify the customer for meaningful order events. Recommended transactional events:

1. **Order received** — order number, items, amount, delivery address/slot and payment state.
2. **Order confirmed** — confirmation that TCB accepted the order and current estimated delivery window.
3. **Payment update** — payment pending, payment confirmed, payment failed or payment action required.
4. **Scheduled-order reminder** — for future orders, a reminder before preparation begins.
5. **Preparing order** — optional but useful once the operational process is stable.
6. **Rider assigned / dispatched** — provider/rider or tracking link where the logistics partner supports it.
7. **Delay update** — proactively notify the customer when the expected delivery is materially outside the earlier estimate.
8. **Delivered** — delivery completion and support contact.

For launch, order confirmation + payment status + rider/dispatch + delay notification are higher priority than building a complex live-tracking interface.

## 3. Delivery policy principles

### Serviceability

Direct delivery is intended for PIN 411057, but final serviceability depends on the exact address and delivery-partner availability.

### Delivery ETA

Use wording such as:

> **Estimated delivery: 35–50 minutes**
>
> Timing may vary with order volume, distance, traffic, heavy rain, road conditions, building access and delivery-partner availability.

Do not advertise “30-minute delivery” as a guaranteed promise.

### Delivery charges

- Food subtotal ₹799 or above: free direct delivery within the supported area, subject to final business implementation.
- Below ₹799: delivery fee payable by the customer.
- Until a logistics API is selected, do not fabricate a live delivery fee.
- Final implementation should calculate or retrieve the charge before payment and include it in the final payable amount.
- Any mandatory delivery charge should be clearly disclosed before the customer pays or finally confirms the order.

### Customer-caused delay

The customer should provide an accurate address and active phone number, remain reasonably reachable, and provide gate/security/building instructions. Delays or additional delivery costs caused by an incorrect address, customer unresponsiveness, refusal of access or a request to deliberately hold the rider can affect available compensation or refund treatment, subject to applicable law.

### Weather / traffic / peak demand

Heavy rain, flooding, unusual traffic, road restrictions, peak demand, rider shortages and similar operating conditions should be disclosed as ETA variables. Delay coupons should not be marketed as an automatic entitlement merely for crossing an estimate.

At the same time, customer policies must preserve any non-waivable rights available under Indian consumer law. In particular, the Consumer Protection (E-Commerce) Rules, 2020 contain refund obligations for late delivery from a stated delivery schedule, subject to the force-majeure exception. Final customer wording should therefore be reviewed legally before launch.

## 4. Cancellation & refund principles

- Encourage customers to contact TCB immediately if they want to cancel or modify an order.
- Cancellation is more likely to be accepted before preparation begins and before a delivery partner is committed.
- Once food preparation has started, cancellation may be restricted because prepared food is perishable.
- Actual unavoidable delivery-partner cancellation/reverse-delivery costs may be considered where permitted by applicable law.
- If TCB cannot fulfil a prepaid order for a reason attributable to TCB, the unfulfilled amount should be refunded or otherwise appropriately resolved.
- Wrong, missing, spilled, damaged or genuine quality complaints may require order details and reasonable photo evidence.
- Resolution may include replacement, partial refund, full refund, credit or goodwill coupon depending on the issue and applicable law.
- A customer who is unreachable, supplies a materially incorrect address, refuses required access or intentionally delays handover may have limited refund eligibility where the order has already been prepared/delivery cost incurred, subject to applicable law.
- Approved refunds should normally return through the original payment route where possible.

## 5. Payment policy

### Current position

The present placeholder UPI ID/QR in the development site is not production-ready and must not be treated as a live payment method.

### Recommended launch architecture

Use:

**Website → Supabase/server function → payment provider → signed webhook → order payment status**

Do not place payment-provider secret keys in browser JavaScript and do not mark an order paid merely because the customer clicks “I paid”.

Until gateway integration is complete, any manual UPI flow should keep the wording **“Payment Pending Confirmation”** until TCB verifies the transaction.

### Customer payment safety wording

TCB should never ask a customer to disclose a UPI PIN, card PIN, CVV or online-banking password.

## 6. Scheduled-order policy

- Scheduled orders are accepted subject to availability and kitchen capacity.
- A requested slot is not an absolute guarantee.
- TCB should notify the customer if there is a material timing issue.
- Customers should keep the supplied phone number reachable near the scheduled time.
- Once operational rules are final, define the cut-off for modifying/cancelling a scheduled order before preparation starts.

## 7. Bulk-order policy

- Minimum planning notice: **1–2 days**.
- Final menu, quantities, delivery time, address, packaging requirements and special instructions must be confirmed before production.
- Order becomes commercially confirmed after TCB accepts the order details and receives **50% advance payment**.
- Remaining **50% must be received and verified before dispatch**.
- No post-delivery credit is planned.
- Regular-order 35–50 minute ETA does not apply to bulk orders.
- Bulk delivery charges and any multi-vehicle/special handling costs should be confirmed before final payment.
- Cancellation treatment depends on procurement, preparation, staffing, packaging and logistics already committed; order-specific written confirmation may include stricter terms.

## 8. Privacy and third-party providers

For direct-order fulfilment, TCB may need to process/share:

- customer name;
- mobile number;
- delivery address, landmark and instructions;
- order information relevant to fulfilment;
- requested delivery time/slot;
- payment reference/status where needed for reconciliation.

Delivery providers should receive only the information reasonably needed to complete delivery. Payment providers should process payment data through their secure systems. TCB should not collect or store customers’ UPI PINs, card PINs, CVVs or banking passwords.

## 9. Menu information and food descriptions

The current placeholder line **“Add-ons & description go here”** should not appear in production.

Recommended description structure: **cooking style + main components + dominant flavour/texture**, usually 8–14 words. The owner has real food descriptions and will provide them for the menu-content pass. Do not invent ingredients, allergens or dietary claims.

If allergy or dietary information is introduced, it should be based on actual recipes and kitchen practices.

## 10. Business content still pending

The following remain intentionally deferred until owner inputs are provided:

- real Our Story copy and founder/kitchen photos;
- real menu descriptions;
- Swiggy, Zomato and other direct restaurant/platform links;
- verified homepage ratings, order counts, customer counts, testimonials and location claims;
- homepage featured-price reconciliation;
- final bulk-order products and prices;
- production payment gateway and UPI details;
- final delivery/logistics provider and API pricing logic;
- real social profile links and brand photography.

## 11. Indian compliance items to verify before launch

The final pre-launch legal/compliance review should confirm at least:

- the correct legal/business name and address shown to customers;
- FSSAI registration/licence display requirements for the website and order invoices/receipts;
- FSSAI number on invoices/bills where required;
- applicable GST/tax disclosure and invoice requirements;
- grievance-contact / grievance-officer requirements applicable to the direct website model;
- clear total-price disclosure, including compulsory delivery charges, before purchase;
- cancellation/refund wording under the Consumer Protection Act and E-Commerce Rules;
- customer data/privacy obligations under applicable Indian data-protection law;
- payment-gateway merchant terms, settlement, refund and chargeback rules;
- consent/template requirements for WhatsApp/SMS transactional notifications;
- final logistics-provider terms and liability allocation.

## 12. Industry-policy patterns used as references

This draft follows common patterns visible in major Indian food-delivery platforms, without copying their terms:

- **Swiggy** treats delivery time as approximate, addresses cancellation/refund based on order progress/reason, and considers customer unavailability or incorrect address in refund treatment.
- **Zomato** states that quoted delivery periods are approximate, requires proof for certain order complaints, and excludes customer-caused delay and specified external conditions from some delay-benefit schemes.
- Both platforms separate the restaurant/merchant role from third-party delivery operations in their customer terms.

TCB should use these patterns only as operational references; its final terms must accurately describe TCB’s own business model and comply with applicable law.

## 13. Official references for legal review

1. Department of Consumer Affairs — Consumer Protection (E-Commerce) Rules, 2020: https://consumeraffairs.nic.in/sites/default/files/E%20commerce%20rules.pdf
2. Department of Consumer Affairs — Consumer Protection resources: https://consumeraffairs.nic.in/acts-and-rules/consumer-protection/consumer-protection
3. FSSAI — Food Safety and Standards Regulations: https://www.fssai.gov.in/food-law/regulations
4. FSSAI — Licensing/Registration information: https://fssai.gov.in/business/registration
5. FSSAI FoSCoS FAQ — FSSAI number on bills/invoices: https://fssai.gov.in/upload/uploadfiles/files/FAQs_Licensing_Registration_21_06_2021.pdf
6. FSSAI advisory on e-commerce food-business compliance (3 December 2024): https://www.fssai.gov.in/upload/advisories/2024/12/674efa161d756Adobe%20Scan%203%20Dec%202024.pdf
7. Swiggy Terms & Conditions: https://www.swiggy.com/terms-and-conditions
8. Swiggy Refund & Cancellation Policy: https://www.swiggy.com/refund-policy
9. Zomato Terms of Service: https://www.zomato.com/policies/terms-of-service/

## 14. Pre-production checklist

Before merging the website to production:

- [ ] Replace placeholder UPI/payment details.
- [ ] Select payment gateway / payment method and test signed webhook verification.
- [ ] Select logistics partner/routing method.
- [ ] Implement and test delivery-fee calculation or clear pre-payment quote.
- [ ] Confirm whether all direct website deliveries are limited to PIN 411057.
- [ ] Add actual Swiggy/Zomato/other restaurant URLs.
- [ ] Add real Our Story content and founder/kitchen photos.
- [ ] Replace menu description placeholders with owner-approved descriptions.
- [ ] Replace/verify homepage proof claims and featured prices.
- [ ] Confirm FSSAI number and display it where required.
- [ ] Confirm grievance-contact details and any required designation.
- [ ] Confirm legal business/tax details on invoices.
- [ ] Confirm customer-notification channel and templates.
- [ ] Obtain final Indian legal/compliance review of Privacy, Terms, Delivery, Refund and Bulk Order policies.
- [ ] Re-run static QA, responsive/browser QA and payment/delivery integration tests.
