# The Chinese Bliss — Master Project Context

**Use this file as the first message/context for any new ChatGPT session working on the TCB website.**  
**Last updated:** 16 September 2026  
**Repository:** `ankitkashikar/MyWebsite`  
**Production branch:** `main`  
**Release merged:** PR #1, merge commit `47589c92d0ef070ff301be21a9f637604b38cae6`

---

## 1. What this project is

**The Chinese Bliss (TCB)** is an Indo-Chinese food-delivery brand operating from **Hinjewadi Phase 1, Pune, Maharashtra, India**.

Confirmed business facts:

- Public operating area: **Hinjewadi Phase 1, Pune**.
- Current public address: **Shop No A1, Street of Europe, 24, Maan Rd, Hinjawadi Phase-1, Pune, Maharashtra 411057**.
- Direct website delivery PIN: **411057**.
- Founders: **Ankit** (from Jabalpur) and **Atul** (from Nagpur), former roommates and co-founders.
- Customer-facing positioning: **Indo-Chinese kitchen / delivery business**.
- Do **not** use “cloud kitchen” or “dine-in” in customer-facing copy.
- No dine-in experience/event positioning.
- Direct delivery hours: **4:00 PM–12:00 AM**.
- Standard direct-order ETA: **approximately 35–50 minutes from order confirmation**, always presented as an estimate, not a guarantee.
- Scheduled ordering is supported.
- Cash on Delivery is **not planned** for direct website orders.
- Direct website orders should receive kitchen priority where operationally possible.

The website goal is not just a brochure. It is a conversion-focused, mobile-first direct-ordering website with a restaurant-side order console and customer order tracking.

---

## 2. Repository and production

- GitHub repo: `https://github.com/ankitkashikar/MyWebsite`
- Default / production branch: `main`
- Previous development branch used for the major refresh: `tcb-design-system-refresh`
- PR #1 merged that refresh into `main` on 16 September 2026.
- GitHub Pages production URL: `https://ankitkashikar.github.io/MyWebsite/`
- Developer workflow: GitHub Codespaces + Live Server / local HTTP server + hard refresh.

The site is intentionally kept simple:

- vanilla HTML
- vanilla CSS
- vanilla JavaScript
- Supabase for direct-order backend/auth/functions
- GitHub Actions for QA
- GitHub Pages for static website hosting

Do not introduce a framework unless explicitly requested.

---

## 3. Very important project boundary

There are **two different Supabase concepts/projects that must not be confused**.

### Website order-system Supabase

The website currently points to:

`https://ncbyfovvetvmkrlzapku.supabase.co`

Project ref:

`ncbyfovvetvmkrlzapku`

This is the Supabase configuration referenced by `supabase-config.js` for:

- `place-order`
- `admin-orders`
- `order-status`

### Separate dashboard/analytics project

A separate Supabase project named **TCB_Dashboard** with ref `friglfticlkpgcsothel` was discovered during one management-tool check.

**Do not make changes to that separate dashboard project when working on the website order system.** The owner explicitly stopped that path and clarified that this project is the **website** and its own order system.

If database work is required, first verify that the target is the Supabase project referenced by the website itself (`ncbyfovvetvmkrlzapku`). Never assume a similarly named dashboard project is the website backend.

---

## 4. Current website structure

Important public/customer pages now include:

- `index.html` — homepage
- `menu.html` — menu, cart and direct-order checkout
- `order.html` — order-choice page
- `bulk-order.html` — bulk-order experience (still contains placeholder business content in places)
- `our-story.html` — founder story page (real owner content/photos still pending)
- `order-status.html` — customer direct-order tracking
- `terms.html` — terms draft
- `privacy.html` — privacy draft
- `delivery-policy.html` — direct-delivery policy
- `refund-policy.html` — cancellation/refund policy
- `bulk-order-policy.html` — bulk-order policy

Internal / operational pages:

- `orders.html` — **TCB Order Console** for direct website orders
- `admin.html` — older coupon-management prototype; do not confuse it with the production order console

The order console is intentionally not linked from the public site.

Expected production path after Pages deployment:

`https://ankitkashikar.github.io/MyWebsite/orders.html`

Customer tracking path:

`https://ankitkashikar.github.io/MyWebsite/order-status.html`

---

## 5. Approved design system

The overall visual direction has been approved. Do not redesign the site from scratch.

### Typography

- **Playfair Display** — major headings, brand moments, page titles, story/founder display text
- **Inter** — navigation, body copy, menu UI, forms, prices, buttons and operational UI

Current CSS tokens include:

- `--fh:'Playfair Display',Georgia,'Times New Roman',serif`
- `--fb:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif`

The old project context that mentioned Manrope is outdated. **Inter is the current approved body/UI font.**

### Icons

Use **Lucide** for interface semantics. Avoid emoji for polished UI controls.

Current Lucide source family is `lucide-static` via CDN/CSS masks. Keep official brand logos for Swiggy, Zomato, Instagram, TCB, etc.; do not replace brand assets with Lucide.

### Visual language

- dark charcoal / near-black surfaces
- restrained TCB red accents
- premium but approachable food-brand feel
- mobile-first interaction discipline
- dark checkout/cart UI
- responsive card/grid system

Core color tokens include:

- `--red: #c0392b`
- `--red2: #e84545`
- `--dark: #111`
- `--dark2: #161616`
- `--card: #1c1c1c`
- `--card2: #222`

Use existing tokens. Do not invent undefined variables.

Detailed reference: `docs/DESIGN_SYSTEM.md`.

---

## 6. Approved navigation / menu / checkout behavior

These areas were iterated heavily and should not be casually reworked.

### Navbar

Approved labels:

**Home · Menu · Contact · Our Story**

Mobile also includes action CTAs such as Bulk Order / Order Online.

### Menu

- responsive category navigation
- search/filter
- veg/non-veg product presentation
- quantity steppers
- combo custom picker
- fixed bottom cart bar
- slide-up checkout drawer

The custom combo section was specifically approved after multiple fixes. Avoid changing its interaction unless there is a real bug.

### Cart / checkout

Mandatory pattern:

**fixed bottom cart bar → slide-up checkout drawer**

Do not replace this with a sticky desktop sidebar on mobile.

Checkout includes:

- customer name
- Indian mobile number validation
- PIN code
- delivery address
- delivery slot / scheduled order flow
- payment step

### Validation

Phone:

- 10-digit Indian mobile
- starts 6–9
- rejects obvious repeated/sequential invalid patterns

Address:

- 25–100 characters

PIN:

- direct website orders currently restricted to **411057**
- browser validates it
- repository version of `place-order` also enforces it server-side

---

## 7. Confirmed direct-delivery operating rules

### Delivery hours

**4:00 PM–12:00 AM**

### ETA

Customer-facing standard estimate:

**35–50 minutes from order confirmation**

Do not advertise a hard 30-minute guarantee.

Delay variables that may affect ETA:

- order volume / kitchen rush
- distance
- traffic
- heavy rain / flooding
- road restrictions
- rider shortages / partner availability
- building/security access
- customer unresponsiveness or incorrect address

### Preparation inputs supplied by owner

- one item, no queue: about **6–7 minutes**
- around three items: commonly **10–12 minutes**, depending on item mix/queue
- Friday–Sunday peak planning: about **10–15 minutes**
- delivery rider may commonly arrive roughly **5–7 minutes** after booking in the current operating pattern, but this is not guaranteed

### Logistics

Final provider is not selected.

Options discussed:

- Porter
- Shiprocket
- Borzo

Do not hard-code one provider until owner confirms it.

### Delivery fee

Confirmed business rule:

- food subtotal **₹799 or above** → planned free direct delivery within service area
- food subtotal **below ₹799** → customer pays applicable delivery charge

Important implementation rule:

The under-₹799 charge is **not finalized**. Do not invent a fixed Porter/Borzo/Shiprocket amount.

Eventually implement either:

1. live logistics quote API, or
2. owner-approved deterministic delivery-fee table

The fee must be visible before final payment/order confirmation.

Keep these separate in data:

- `delivery_fee` = customer-facing delivery charge agreed before payment
- `delivery_partner_cost` = actual later logistics cost paid/quoted by delivery provider

Never silently replace one with the other.

---

## 8. Direct order-system architecture

The direct-order system is built in the website repository.

### Customer flow

**Menu → Cart → Checkout → Order creation → Payment status → Order received → Track Order**

The customer can then see:

**Received → Accepted → Preparing → Ready → Dispatched → Delivered**

### Restaurant flow

Restaurant uses `orders.html`.

Canonical lifecycle:

- `new`
- `accepted`
- `rejected`
- `preparing`
- `ready_for_pickup`
- `rider_assigned`
- `dispatched`
- `delivered`
- `cancelled`

Reject/cancel requires an operational reason.

Payment status remains separate from order status.

### Payment behavior

Current direct-order model:

- COD disabled
- UPI/manual payment starts as `payment_status = pending`
- restaurant acceptance requires payment to be marked `paid`
- customer clicking “I paid” must never itself prove payment
- future payment gateway must update payment state through a verified server-side webhook

Recommended final architecture:

**Website → Supabase Edge Function → payment provider → signed webhook → Supabase payment status**

Never expose service-role/payment-provider secrets in browser code.

### Idempotency / server pricing

Order creation uses an idempotency key so repeated checkout submissions do not intentionally create duplicate orders.

The browser sends product IDs/quantities, not trusted prices. Server code is designed to calculate pricing from database product records.

---

## 9. Restaurant Order Console

Main page:

`orders.html`

Styles:

`orders-console.css`

Server API source:

`supabase/functions/admin-orders/index.ts`

Expected behavior:

- shared TCB sign-in
- load direct website orders
- search orders by order/phone/name
- active/New/Preparing/Ready/Dispatched/Scheduled/Delivered/Closed filters
- prominent new-order attention state
- repeated browser sound after sound is enabled
- payment confirmation
- Accept / Reject
- Preparing
- Ready for Pickup
- Rider Assigned
- Dispatched
- Delivered
- cancellation/rejection reasons
- delivery provider / booking / rider / tracking details

### Authentication rule

The owner explicitly requested **one shared TCB operations account only**.

Do not create separate Ankit / Atul admin accounts unless the owner later changes this decision.

`admin-orders` expects exactly one email configured server-side via:

`TCB_ADMIN_EMAIL`

The authorized TCB Auth user email must match that value exactly.

### Notifications

Owner does **not** want WhatsApp notifications because of paid WhatsApp templates.

Preferred launch notification stack:

1. primary: `orders.html` open on kitchen tablet/laptop, with visual + repeated browser sound
2. backup: email notification
3. SMS/push may be considered later

Email backup provider is not yet selected/implemented.

---

## 10. Customer order tracking

Customer tracking page:

`order-status.html`

Styles:

`order-status.css`

API source:

`supabase/functions/order-status/index.ts`

Checkout success in `menu.html` now links to the tracking page.

Lookup model:

- order number
- same mobile number used at checkout

The phone number is not placed in the URL.

The page stores the most recent order number/phone in sessionStorage for convenience and polls active orders about every 30 seconds.

Customer-safe tracking can show:

- order number
- created time
- order status
- payment status
- total
- slot / ETA
- order items
- delivery provider
- external tracking URL if available

Internal restaurant notes, rejection/cancellation operational details and admin audit data must not be exposed unnecessarily to customers.

---

## 11. Customer and order data design

Current intended backend pattern:

### Customer identity

Customer records are reused/found by phone.

Store/reuse:

- customer ID
- phone
- latest known name

### Order-time snapshot

Each order must preserve the values used for that specific order:

- name
- phone
- address
- PIN
- notes
- items
- prices
- subtotal
- discount
- delivery fee
- total
- payment method/status
- requested delivery slot

Historical order addresses must not be overwritten when a customer later uses another address.

A future `customer_addresses` table may support saved/default addresses, but order-time address snapshots remain immutable history.

### Lifecycle/audit

Repository migration:

`supabase/migrations/20260916_order_operations.sql`

It adds/standardizes lifecycle, payment, delivery and audit fields plus status-event history.

Status transitions are intended to be written to `order_status_events`.

---

## 12. Critical deployment reality — read before claiming orders are live

The **website code, UI and QA are ready and merged to `main`**, but the restaurant order console should **not be described as fully operational for real orders until the website Supabase backend is deployed and tested**.

Repository deployment guide:

`docs/ORDER_CONSOLE_DEPLOYMENT.md`

Required production backend work includes:

- inspect the website Supabase schema
- confirm backup/recovery
- apply `supabase/migrations/20260916_order_operations.sql`
- create the single shared TCB Supabase Auth account
- set `TCB_ADMIN_EMAIL`
- deploy `supabase/functions/place-order/index.ts`
- deploy `supabase/functions/admin-orders/index.ts`
- deploy `supabase/functions/order-status/index.ts`
- verify production CORS/origin policy
- verify browser anon key belongs only to the website project
- run real controlled end-to-end order smoke test

Do not claim those steps were completed unless they have actually been verified on the **website Supabase project**.

This distinction is essential:

**Merged website code ≠ deployed Supabase backend.**

---

## 13. Scheduled orders

Scheduled ordering exists in the website checkout.

Recommended operational behavior:

- save scheduled order immediately
- display it in Scheduled queue
- do not treat it like an immediate “start cooking now” order
- create reminder before the requested slot
- reminder should account for configurable prep buffer
- then move into normal active flow: Accepted → Preparing → Ready → Dispatched → Delivered

Production scheduled-order reminder automation is still pending.

---

## 14. Bulk orders

Real bulk-order product/menu content is still being prepared by the owner. Do not invent products or prices.

Confirmed policy:

- request at least **1–2 days in advance**
- **50% advance** required to confirm
- remaining **50% before dispatch**
- no post-delivery credit planned
- normal 35–50 minute ETA does not apply to bulk orders

Keep naming preferably as **Bulk Order** unless owner explicitly chooses “Catering” as a service label.

`bulk-order.html` still has placeholder content and should not be treated as final business data.

---

## 15. Payment status / gateway direction

Current placeholder UPI details are **not production-ready**.

Previously evaluated provider shortlist includes:

- Cashfree
- Paytm Payment Gateway
- PhonePe Payment Gateway
- Razorpay
- PayU
- Easebuzz
- CCAvenue
- Instamojo
- Pine Labs Online
- Airpay
- BillDesk
- PayGlocal

No final provider has been selected.

Do not add a payment secret to the browser/repository.

For a gateway integration, use server-side initialization and signed webhook verification.

Until then, manual UPI wording must remain honest:

**Order Received — Payment Pending Confirmation**

---

## 16. Our Story / founder content

Current owner commitment:

The owner will provide:

- real founder story
- how the idea started after development/testing
- Ankit and Atul photos
- kitchen photo(s)

Do not invent founder anecdotes.

Confirmed founder facts only:

- Ankit is from Jabalpur
- Atul is from Nagpur
- they were roommates
- they co-founded The Chinese Bliss

`our-story.html` previously contained placeholder/invented filler and temporary/random imagery. Replace only with owner-supplied factual story and real photos.

The recommended story structure is:

**Jabalpur + Nagpur → roommates → actual food/problem moment → experiments/testing → first orders → why The Chinese Bliss → what they wanted to do differently → where TCB is today → what promise remains unchanged**

---

## 17. Food descriptions

The owner already has real dish descriptions and will provide them.

Do not invent:

- ingredients
- allergens
- dietary claims
- preparation details

Placeholder text such as:

`Add-ons & description go here`

should not remain in final production copy.

When real descriptions are supplied, preserve a consistent concise pattern:

**cooking style + main components + dominant flavour/texture**

roughly 8–14 words when appropriate.

---

## 18. Homepage content still requiring owner verification

Do not silently invent or validate these claims.

Existing/unverified examples include:

- 4.7 rating / average rating
- 10k+ happy customers
- 4550+ orders delivered
- 2 locations
- named five-star testimonials
- dish-specific rating counts
- older “30 min” proof language
- homepage featured dish prices that may not match the menu

The owner said they will provide verified inputs when this section is developed.

Homepage featured prices should not be automatically synchronized or changed until owner asks.

---

## 19. Platform and social links

Swiggy/Zomato/other restaurant URLs are not final.

Owner instruction:

**When developing this integration, ask for the direct restaurant links and the owner will provide them.**

Do not substitute generic `swiggy.com` / `zomato.com` links as final restaurant links.

Real social profile URLs are also still pending.

---

## 20. Policies and compliance documents

Website policy pages exist:

- `terms.html`
- `privacy.html`
- `delivery-policy.html`
- `refund-policy.html`
- `bulk-order-policy.html`

Supporting docs:

- `docs/TCB_TERMS_POLICY_PACK.md`
- `docs/CONTENT_BUSINESS_REVIEW.md`
- `docs/ORDER_CONSOLE_DEPLOYMENT.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/TECH_STACK.md`
- `docs/THIRD_PARTY_RESOURCES.md`

A separate downloadable Word handover was also created during development:

- `TCB_Customer_Terms_and_Policy_Pack.docx`
- `TCB_Order_and_Customer_Data_Workflow.docx`

Treat legal/policy pages as operational drafts, not as guaranteed legal advice.

Before final commercial launch, confirm:

- FSSAI registration/licence number
- required FSSAI display on website/invoice/receipt
- GST/tax/invoice requirements
- grievance contact/officer requirements
- final payment gateway merchant rules
- final privacy/data obligations
- cancellation/refund compliance
- final delivery provider contract/terms

---

## 21. QA system and latest release result

Permanent QA files include:

- `scripts/qa_check.py`
- `scripts/responsive_qa.mjs`
- `scripts/order_console_qa.mjs`
- `scripts/order_status_qa.mjs`
- `.github/workflows/site-qa.yml`
- `.github/workflows/responsive-interaction-qa.yml`

Final pre-merge branch head:

`65421d538497577167b804dbae7f177ad18964e7`

Final branch QA before release:

### Static QA

- HTML files checked: **13**
- CSS files checked: **16**
- Errors: **0**
- Warnings: **0**
- Result: **PASS**

### Responsive / interaction QA

- Desktop: PASS
- Tablet: PASS
- Mobile: PASS

### Order Console QA

- Desktop: PASS
- Tablet: PASS
- Mobile: PASS

### Customer Order Status QA

- Desktop: PASS
- Tablet: PASS
- Mobile: PASS

PR #1 also reran the release checks and passed:

- TCB Automated QA
- TCB Responsive Interaction QA
- Jekyll site CI
- static website deployment check

The recurring GitHub Actions Node 20→24 messages are infrastructure deprecation warnings from GitHub actions, not website QA failures.

---

## 22. Release history

Major development branch:

`tcb-design-system-refresh`

Important pre-release head:

`65421d538497577167b804dbae7f177ad18964e7`

Release PR:

`https://github.com/ankitkashikar/MyWebsite/pull/1`

Merged to `main` on 16 September 2026.

Merge commit:

`47589c92d0ef070ff301be21a9f637604b38cae6`

After this release, treat `main` as the source of truth unless the owner explicitly creates a new feature branch.

---

## 23. How another ChatGPT model should work on this project

Follow these rules unless the owner explicitly changes them:

1. Work from the latest `main` branch.
2. Before editing, inspect the actual current file instead of relying only on this context file.
3. Use a feature/test branch for meaningful changes; do not push directly to production unless the owner explicitly asks.
4. Do not touch the separate TCB_Dashboard Supabase project while working on this website.
5. Never invent business facts, menu prices, ratings, testimonials, delivery fees, social URLs, platform URLs, founder stories or ingredients.
6. Ask the owner for Swiggy/Zomato/direct platform links at the moment that integration is being built.
7. Preserve approved navbar, combo picker, fixed cart bar and checkout drawer patterns unless there is a verified bug.
8. Use Playfair Display + Inter + Lucide.
9. Keep mobile/tablet/desktop QA green.
10. Never expose Supabase service-role keys, gateway secrets or logistics API secrets in browser JS.
11. Distinguish code-ready from backend-deployed. Do not claim real orders are operational until the website Supabase migration/functions/auth account are deployed and smoke-tested.
12. Use one shared TCB operations account for `orders.html`, not separate personal accounts.
13. No WhatsApp notification dependency for launch; primary alert is browser order console + sound, backup email later.
14. Keep payment state separate from order lifecycle state.
15. For sub-₹799 delivery fees, do not invent the price. Wait for provider API or owner-approved fee table.
16. Keep internal reject/cancel notes private from customer tracking unless a customer-safe explanation is intentionally defined.
17. Re-run static and browser QA after functional changes.
18. Do not merge a failing branch to `main`.

---

## 24. Recommended next work, in order

The website UI release is merged. The next highest-priority work is the **website order-system production backend deployment**, not more UI redesign.

Recommended sequence:

1. Verify access to the website Supabase project `ncbyfovvetvmkrlzapku`.
2. Inspect its live schema and confirm backups.
3. Apply `supabase/migrations/20260916_order_operations.sql`.
4. Create exactly one shared TCB operations Supabase Auth account.
5. Configure `TCB_ADMIN_EMAIL`.
6. Deploy `place-order`.
7. Deploy `admin-orders`.
8. Deploy `order-status`.
9. Restrict CORS to the real production origin where practical.
10. Place one controlled website test order.
11. Confirm the order appears in `orders.html` as New.
12. Verify payment pending → payment confirmed → Accept → Preparing → Ready → Rider Assigned → Dispatched → Delivered.
13. Confirm customer can track the same order using order number + phone.
14. Verify unauthorized users cannot access restaurant order data.
15. Then add server-side email backup notifications.
16. Finalize payment gateway.
17. Finalize delivery provider / sub-₹799 quote logic.
18. Add scheduled-order kitchen reminder behavior.
19. Replace founder/menu/content placeholders with owner-supplied real content.
20. Perform final legal/compliance and live production smoke test.

---

## 25. Useful operational summary

### Customer places order

`menu.html`

→ validates phone/address/PIN/slot  
→ calls `place-order`  
→ order stored with server-trusted pricing  
→ payment remains pending until verified  
→ checkout success shows order number + Track Order

### Restaurant receives order

`orders.html`

→ sign in with single TCB operations account  
→ New order appears  
→ browser alert/sound  
→ verify payment  
→ Accept or Reject  
→ Preparing  
→ Ready  
→ Rider Assigned  
→ Dispatched  
→ Delivered

### Customer checks order

`order-status.html`

→ enter order number + checkout phone  
→ see safe order/payment/delivery state  
→ active order refreshes automatically

### Order-status truth model

**Order status and payment status are separate.**

An order can exist and be `new` while payment is still `pending`.

---

## 26. Owner preferences

The owner prefers:

- concise/direct communication
- complete implementation, not partial placeholder engineering
- mobile-first polish
- conversion-focused UX
- business facts kept accurate
- test branch / QA before production
- no unnecessary redesign of approved areas
- downloadable handover documents for future reference

When the owner says “do the best you can,” make safe improvements only where the facts are known. If a business fact is missing, leave it pending and ask rather than inventing it.

---

## 27. One-sentence handoff

**TCB now has a fully QA-tested website release on `main` with direct-order checkout, a single-account restaurant Order Console UI, customer order tracking and operational policies; the next critical task is to deploy and smoke-test the corresponding Edge Functions/migration on the website’s own Supabase project (`ncbyfovvetvmkrlzapku`) without touching the separate TCB_Dashboard project, then finish payment/delivery-provider integrations and replace remaining owner-supplied content placeholders.**
