# The Chinese Bliss — Technical Stack

Last updated: 12 September 2026

## Architecture

The Chinese Bliss website is a static, multi-page web application built with vanilla HTML, CSS and JavaScript. There is no React/Vue framework, no Tailwind runtime, no shadcn/ui runtime and no Vite build requirement for the current site.

### Core frontend

- HTML5 — page structure and semantic content.
- CSS3 — shared visual system, responsive layout, sticky navigation, cards, drawers and forms.
- Vanilla JavaScript — navigation interactions, menu search/filtering, cart/checkout UI and page-specific behaviour.
- `style.css` — stylesheet entry point on the design-system branch.
- `style-base.css` — snapshot of the existing shared stylesheet used as the visual/layout base during this branch experiment.
- `design-system.css` — typography and icon-system layer for Playfair Display + Inter + Lucide.
- `menu-design.css` — menu-specific visual layer: wide desktop canvas, dark dish cards, responsive two-column menu presentation and quantity-control styling.
- `site-polish.css` — shared polish for Our Story, Order Online, Bulk Order, cart/checkout drawer states, footer details and remaining Lucide icon replacements.
- `script.js` — shared client-side behaviour.

The visual layers intentionally contain presentation only. Menu filtering, cart calculations, validation, checkout state, pricing data and backend calls remain in the existing HTML/JavaScript implementation.

## Main pages

- `index.html` — home/marketing page.
- `menu.html` — menu, search, cart and checkout drawer.
- `bulk-order.html` — bulk-order flow.
- `order.html` — order-platform/direct-order landing page.
- `Our Story.html` — story page currently present in the repository.
- `admin.html` — administrative interface.

## Backend / data

- Supabase is used by the ordering implementation.
- `supabase-config.js` contains the browser-side Supabase configuration used by the site.
- `supabase/functions/place-order/index.ts` is the server-side Edge Function responsible for order placement/server-side handling.
- Menu/cart display values in the client are not a substitute for server-side pricing validation.

## Typography

- Display/headings: Playfair Display.
- Body/UI/forms/menu controls: Inter.
- Delivery: Google Fonts CSS API.
- Fallbacks are included so the site remains usable if Google Fonts cannot load.

## Icons

- UI icon source: Lucide.
- Delivery on this static site: individual SVGs from the `lucide-static` package through jsDelivr.
- Version pinned in CSS: `lucide-static@1.43.0`.
- Rendering method: CSS masks for the shared UI icons. This lets the icon inherit the component colour without introducing an icon font or a large JavaScript bundle.
- Existing brand logos such as Swiggy/Zomato and The Chinese Bliss logo remain brand/image assets rather than being replaced by Lucide.

## Current visual-layer order

`style.css` loads the visual layers in this order:

1. `style-base.css`
2. `design-system.css`
3. `menu-design.css`
4. `site-polish.css`

The later layers are deliberately more specific and are used for branch-based visual iteration without rewriting the business logic.

## Deployment / repository workflow

- Source control: Git + GitHub.
- Default production branch: `main`.
- Design-system test branch: `tcb-design-system-refresh`.
- The repository contains GitHub workflow files targeting `main`; review deployment settings before changing production behaviour.
- Recommended preview workflow: checkout the test branch in Codespaces and open with Live Server before merging.

## Deliberately not introduced

The following tools were discussed as inspiration but are not dependencies of the current implementation:

- Tailwind CSS — not installed.
- Vite — not required.
- shadcn/ui — used only as a UI-quality/design reference, not as a component runtime.

This keeps the existing codebase simple while still adopting a more disciplined typography and icon system.
