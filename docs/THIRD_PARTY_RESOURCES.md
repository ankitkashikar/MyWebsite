# The Chinese Bliss — External Resources & Sources

Last updated: 10 September 2026

This file records external libraries/services/assets referenced by the website so future contributors know what is used, where it comes from and whether it is a runtime dependency or only a design reference.

## Google Fonts

Purpose: web typography.

Used families:

- Playfair Display — display/heading typeface.
- Inter — body and UI typeface.

Source: https://fonts.google.com/

CSS delivery endpoint used by the design system:

`https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700&display=swap`

The CSS includes system fallbacks so the site remains functional if the font service is unavailable.

## Lucide Icons

Purpose: consistent interface icons.

Official project: https://lucide.dev/

Static package: `lucide-static`

Pinned version used by this branch: `1.43.0`

CDN: jsDelivr — https://cdn.jsdelivr.net/npm/lucide-static@1.43.0/icons/

License: ISC (as documented by the Lucide project/package).

Implementation: selected individual SVGs are referenced as CSS masks. This avoids loading the complete icon font/sprite and lets icons inherit TCB colours.

## Supabase

Purpose: application data/order backend and Edge Functions.

Official site: https://supabase.com/

Repository usage:

- `supabase-config.js`
- `supabase/functions/place-order/index.ts`
- order/menu/bulk-order flows that call the configured backend

No secret/service-role credential should be placed in public browser JavaScript.

## GitHub

Purpose: source control, branch review and repository workflow.

Official site: https://github.com/

Repository: `ankitkashikar/MyWebsite`

Production/default branch: `main`

Design-system review branch: `tcb-design-system-refresh`

## Existing image sources

The repository currently contains both local image assets and externally hosted image URLs.

Local brand/platform assets include files under `images/`, including The Chinese Bliss logo and Swiggy/Zomato assets.

Some food/hero images in the current HTML use Wix-hosted URLs. Treat these as existing/placeholder content unless ownership/licensing is confirmed. Production photography should ideally be TCB-owned or explicitly licensed.

## Design references — not runtime dependencies

### shadcn/ui

Website: https://ui.shadcn.com/

Use: reference for modern component proportions, inputs, drawers, buttons and UI discipline.

Status in TCB: not installed; no React/shadcn runtime dependency.

### Tailwind CSS

Website: https://tailwindcss.com/

Use: reference for utility-first spacing/responsive conventions when useful.

Status in TCB: not installed; the current site uses hand-written CSS.

### Google Fonts catalog

Website: https://fonts.google.com/

Use: font discovery plus runtime delivery of the selected open web fonts.

## Brand assets vs UI icons

Do not replace a company/platform logo with a generic Lucide icon. Lucide is for interface semantics; official logos remain separate brand assets and must follow the relevant brand/licensing rules.

## Maintenance rule

Whenever a new third-party font, icon library, CDN, analytics service, API, payment provider or externally hosted production image is added, update this document with:

1. Name and purpose.
2. Exact source URL/package.
3. Version if applicable.
4. License/usage note.
5. Which site files/components use it.
