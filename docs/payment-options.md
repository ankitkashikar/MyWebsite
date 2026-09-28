# Payment decision notes — 23 September 2026

Decision deferred by owner. No provider account, payment details, integration,
merge or deployment was changed. Pricing pages are offers, not merchant quotes.

## Recommendation

Shortlist PhonePe PG first for a cost-sensitive launch if TCB qualifies for its
offer and written merchant terms are acceptable. Confirm offer expiry, caps,
post-offer rate, taxes, settlement timing and refund charges before selection.
Cashfree is another low-cost candidate. Razorpay is a standard-price alternative.
No provider is established as permanently cheapest.

Official pricing reviewed:

- PhonePe advertises Free* during an offer period, with zero setup and annual
  maintenance charges; page strikes out 1.99%. Terms apply; expiry and TCB's
  eligibility are not verified.
  https://www.phonepe.com/business-solutions/payment-gateway/pricing/
- Cashfree advertises zero platform fees on eligible new merchants' first ₹20 lakh,
  campaign ending 31 March 2027. Its terms retain GST computed on the standard
  1.95% fee even during the waiver. Standard 1.95% plus applicable taxes follows
  the offer. Eligibility, exclusions and withdrawal conditions apply.
  https://www.cashfree.com/payment-gateway-charges/
- Razorpay advertises standard 2% plus GST. At 18% GST on that fee, an eligible
  ₹1,000 payment costs ₹23.60. Actual instrument/merchant terms must be confirmed.
  https://razorpay.com/pricing/

Manual business UPI is an alternative with less gateway integration but requires
staff to reconcile every receipt against the order. Verify merchant/bank fees;
do not assume all payment instruments or business services are free. A screenshot
or customer 'I paid' click must never mark an order paid.

## Intended TCB flow when payment work resumes

Normal orders collect the full server-calculated payable amount. Bulk orders
collect 50% advance, then the balance before dispatch, as already documented.
Use separate payment attempts linked to one bulk order, with exact minor-unit
rounding and no over-collection. Provider secrets stay in server functions.
Authenticated provider callbacks/server status checks must verify the merchant
order, amount, currency and successful payment before updating payment status.
Handle repeated/out-of-order callbacks, abandoned attempts, pending payments,
refunds and reconciliation. Customer redirects alone are not payment evidence.

Local acceptance so far used synthetic payments. Actual integration, merchant
onboarding, recipient verification, failure/refund testing and approved live
payment acceptance remain release requirements. Remove all placeholder payment
destinations from the final chosen checkout flow and rerun release preflight.
