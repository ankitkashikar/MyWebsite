# The Chinese Bliss QR Menu — Master Context

Last updated: 2026-10-16
Purpose: Handoff/context file for continuing the QR digital menu project in a future ChatGPT session.

## 1. Goal and agreed customer experience

Build a simple, modern, text-only QR menu for The Chinese Bliss.

Required customer flow:
**Scan QR → Menu opens quickly → Browse dishes → Read dish name and price → Order at counter**

Explicitly out of scope for the first version: food photos, online ordering/cart/checkout, customer login, animations or heavy libraries, delivery app links, main website navigation, admin tools exposed to customers.

## 2. Visual direction

Use the supplied design reference: dark black/charcoal background, white text, warm orange accents, rounded dark category chips, clean modern typography, and prices aligned on the right.

Menu should be readable on mobile, fast on ordinary mobile data, and simple to browse. Category links should scroll within the same page. A fixed footer should say 'Please order at counter'.

## 3. Architecture decision

Use the existing GitHub repository but deploy only the qr-menu/ folder as a separate Vercel project.

- GitHub repository: ankitkashikar/MyWebsite
- Working branch: qr-menu-v1
- Vercel project root directory: qr-menu
- Intended permanent domain: menu.thechinesebliss.in (not yet confirmed/configured)
- Customer site must not expose or route into the inventory/admin/main website.
- Unknown paths should show a 404 page.
- Use the same Supabase project only for public, read-only menu data.
- Do not put privileged secrets in the public repository or browser code.

This deployment separation means Vercel deploys only files inside qr-menu/; it does not make the public GitHub repository private. A public repository remains readable by anyone. Security must be enforced by access controls and database policies, not by hiding URLs or source code.

## 4. Work already committed to branch qr-menu-v1

The following files were added to ankitkashikar/MyWebsite on branch qr-menu-v1:

- qr-menu/index.html — menu page shell and loading/error/empty states
- qr-menu/styles.css — dark/orange responsive style
- qr-menu/config.js — public Supabase URL and anon key
- qr-menu/app.js — reads active menu rows and renders category sections, names, and prices
- qr-menu/404.html — custom 404 page
- qr-menu/robots.txt — disallows search indexing
- qr-menu/vercel.json — basic security headers and asset cache settings
- qr-menu/README.md — deployment/security notes
- supabase/migrations/20261002000100_qr_menu.sql — schema and RLS migration

The commits were created on the branch, not merged to main. Do not assume production deployment has happened.

## 5. Supabase data design

A new independent table is planned: public.qr_menu_items

Columns: id UUID primary key; category text; name text; price numeric(10,2); category_sort integer; sort_order integer; active boolean; created_at and updated_at.

The migration enables RLS, grants SELECT to anon and authenticated, and creates a policy that permits reading active rows only. No public INSERT/UPDATE/DELETE policy is created. This menu table must remain a separate display catalogue; do not silently couple it to checkout or inventory pricing without verifying business rules.

The front end expects category, name, price, sort_order, category_sort, and filters active=eq.true.

## 6. Important remaining work / blockers

### A. Validate the initial code
- Review all files on branch qr-menu-v1.
- Check syntax, responsive layout, 404 behavior, caching, and Supabase query fields.
- Confirm unknown paths truly return a 404 on Vercel; test deployed behavior rather than assuming the static 404.html alone guarantees all routing behavior.
- Verify the correct Supabase anon key is present in qr-menu/config.js. It must be the public anon key only. Never use a service-role key here.
- Consider adding a restrictive Content Security Policy after testing required Supabase requests.
- Confirm whether noindex is desired; it is currently configured in HTML/robots.

### B. Apply and verify database migration
- Review migration supabase/migrations/20261002000100_qr_menu.sql.
- Apply it to the intended Supabase project only after confirming the target project and safe migration process.
- Test anonymous REST read returns active menu rows only.
- Test anonymous INSERT, UPDATE, and DELETE are denied.
- Confirm table grants and RLS work as intended.

### C. Obtain the real menu
The user has not supplied final dish names/prices yet. Do not invent final prices. Ask the user for the current menu in any format, including categories and half/full prices if applicable. Populate the table only with user-confirmed data.

### D. Build protected menu management
The user wants to change menu prices from the backend without regenerating the QR code. Plan a staff-only editor integrated into the existing protected inventory/admin system, or a suitable protected admin workflow. Do not expose write operations to public customers. Verify authentication, authorization, and RLS before implementing writes.

Minimum admin functions: list menu rows; edit dish name, category, price, and ordering; toggle active to hide/show an item; save with validation and clear success/failure state.

### E. Deploy safely on Vercel
- Create a new Vercel project from ankitkashikar/MyWebsite.
- Set Root Directory to qr-menu.
- Framework preset: Other; no build command should be needed for static files.
- Deploy to a temporary Vercel URL and test.
- Configure menu.thechinesebliss.in only after domain/DNS ownership and availability are confirmed.
- Test all customer paths and confirm the main inventory/admin app is not part of this deployment.
- Generate the final QR only after the permanent URL works. QR points to the permanent domain and remains unchanged for price updates.

## 7. Security expectations

- Menu site is public and only displays menu data.
- Public browser gets read-only access to active menu rows.
- Never rely on an obscure URL, hidden buttons, or public-repository secrecy as security.
- Do not commit .env files, database passwords, Supabase service-role keys, payment secrets, or API tokens.
- The Supabase anon key is public by design, but safe only when RLS and grants are correctly configured.
- A 404 on the menu subdomain does not prevent someone from visiting the main site if they know its URL; the main site must independently enforce authentication/authorization.
- Do not claim that the app is secure until deployed and negative access tests pass.

## 8. Performance requirements

- No images.
- No frontend framework required.
- Small static HTML/CSS/JS.
- No login or third-party UI libraries.
- Single page with anchor-based category navigation.
- Menu rows fetched from Supabase, with friendly loading/error/empty states.
- Price/name edits should reflect from database without QR regeneration or redeployment.

## 9. Current project status

**Started, not production-ready.** The initial code and migration file are committed on qr-menu-v1. The migration has not been confirmed applied; real menu data has not been provided; admin editing is not yet built; Vercel deployment and domain are not configured; QR code has not been generated; security tests have not yet been run.

## 10. Recommended next steps

1. Ask the user to provide the real current menu and prices.
2. Review the branch files and migration; correct issues before deployment.
3. Apply migration safely and verify read-only public access.
4. Insert user-confirmed menu data.
5. Build and test protected menu management.
6. Deploy the qr-menu/ folder as a separate Vercel project.
7. Run functional, mobile performance, 404/isolation, and database permission tests.
8. Configure permanent domain and create QR code.
9. Only then consider production-ready.

## 11. How a future assistant should continue

- Continue step-by-step; clearly state what is done, pending, and blocked.
- Do not merge into main, apply database migrations, configure production DNS, or claim deployment without verifying the action.
- Respect the user's preference for a simple, fast, text-only menu.
- Keep payment, inventory, checkout, and existing website functionality out of this public menu.
- First request the actual menu data if it has not been provided.