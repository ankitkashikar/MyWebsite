# The Chinese Bliss — Technical Stack

Last updated: 10 September 2026

## Architecture

The Chinese Bliss website is a static, multi-page web application built with vanilla HTML, CSS and JavaScript. There is no React/Vue framework, no Tailwind runtime, no shadcn/ui runtime and no Vite build requirement for the current site.

### Core frontend

- HTML5 — page structure and semantic content.
- CSS3 — shared visual system, responsive layout, sticky navigation, cards, drawers and forms.
- Vanilla JavaScript — navigation interactions, menu search/filtering, cart/checkout UI and page-specific behaviour.
- `style.css` — stylesheet entry point on the design-system branch.
- `style-base.css` — snapshot of the existing shared stylesheet used as the visual/layout base during this branch experiment.
- `design-system.css` — typography and icon-system layer for Playfair Display + Inter + Lucide.
- `script.js` — shared client-side behaviour.

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
