# The Chinese Bliss — Design System

Last updated: 12 September 2026

## Design direction

The visual goal is a premium but approachable Indo-Chinese food brand: dark charcoal surfaces, restrained red accents, editorial display typography and clean product-style interface typography.

## Typography

### Playfair Display — display / headings

Use Playfair Display for major brand moments and headings:

- The Chinese Bliss hero wordmark rendered as text.
- Page H1 titles.
- Section H2/H3 titles.
- Menu category titles.
- Our Story/founder names when presented as display titles.
- Major CTA headings.
- Checkout/success headings where a display treatment is appropriate.

The homepage hero intentionally keeps the strong reference treatment: heavy Playfair for `The Chinese` and italic Playfair for `Bliss`.

Preferred display weights:

- 700 for normal section headings.
- 900 for the main homepage hero and high-impact CTA headings.
- 700 italic for `Bliss`/selected emphasis.

### Inter — body / UI

Use Inter for everything that users read or operate as interface content:

- Navigation.
- Buttons.
- Menu item names, descriptions and prices.
- Category shortcut pills.
- Search.
- Cart and checkout details.
- Forms, inputs, labels and validation messages.
- Delivery/rating badges.
- Supporting copy.
- Footer copy.

Preferred UI weights:

- 400 — descriptions and body copy.
- 500 — navigation and secondary controls.
- 600 — buttons, dish names and important UI labels.
- 700 — compact emphasis where needed.

Avoid overusing uppercase and wide letter-spacing in body/UI text. Uppercase tracking is reserved for small eyebrow/section labels.

## Font fallbacks

Display:

`'Playfair Display', Georgia, 'Times New Roman', serif`

UI:

`'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`

## Icon system — Lucide

Lucide is the standard interface icon language for TCB. Icons are line-based, visually consistent and scalable.

Current shared mappings include:

- Search → Lucide `search`.
- CTA forward → Lucide `arrow-right`.
- Back → Lucide `arrow-left`.
- Rating → Lucide `star`.
- Delivery time → Lucide `clock`.
- Customers → Lucide `users`.
- Delivery → Lucide `bike`.
- Authentic/trust → Lucide `badge-check`.
- Freshness → Lucide `sparkles`.
- Video/play → Lucide `play`.
- Quantity increase → Lucide `plus`.
- Quantity decrease → Lucide `minus`.

Additional approved icons in the design token set include `package`, `map-pin`, `phone`, `mail`, `calendar`, `ticket-percent` and `circle-check`.

### Icon rules

- Use Lucide for interface meaning/actions.
- Do not use emoji such as 🚀, 📍 or 📞 for polished UI actions because emoji appearance varies by operating system.
- Keep platform/brand logos as their official image assets; Lucide is not a replacement for Swiggy, Zomato, Instagram or The Chinese Bliss branding.
- Typical UI size: 16–20px.
- Larger feature/trust icon size: 20–24px.
- Icons should normally inherit text/accent colour rather than introducing additional colours.

## Colour tokens

The existing shared CSS remains the source of truth for colours. Core tokens include:

- `--red: #c0392b` — primary TCB red.
- `--red2: #e84545` — brighter accent red.
- `--dark: #111` — main dark background.
- `--dark2: #161616` — secondary dark surface.
- `--card: #1c1c1c` and `--card2: #222` — card surfaces.
- `--t` — primary white text.
- `--t2` — secondary text.
- `--t3` — muted text.

## Menu presentation

The menu is part of the same dark premium visual system as the homepage. It should not look like a separate white ordering widget.

Desktop rules:

- Main menu canvas uses a wide maximum width of roughly 1180px.
- Veg and Non-Veg groups use a two-column dish-card grid.
- Each dish card uses a dark charcoal surface with subtle border and elevation.
- Dish name uses Inter 600; supporting description uses Inter 400; price uses Inter 700 in accent red.
- Main food categories such as Starters, Noodles and Fried Rice use Playfair Display.
- Veg/Non-Veg labels remain small UI labels and use Inter.
- Category shortcut pills and search remain in the sticky toolbar.
- Quantity controls use dark surfaces with Lucide `minus` / `plus` icons.

Responsive rules:

- At tablet/mobile widths, dish cards return to one column.
- Search sits above the horizontally scrollable category shortcuts.
- Cart remains a fixed bottom action bar and checkout remains a slide-up drawer.

The menu visual layer is isolated in `menu-design.css` so it can be iterated without changing menu/order business logic.

## Shape and spacing

The existing visual language uses:

- Pill radius `--rp` for CTA buttons and chips.
- Large radius `--rl` for major cards.
- Medium radius `--rm` for supporting cards.
- Small radius `--rs` for compact controls.

The design-system refresh deliberately does not rebuild the site with a new framework. It layers typography/icon consistency over the existing responsive layout so visual changes can be reviewed safely.

## Accessibility principles

- Keep text readable at mobile sizes; do not reduce core body text solely for visual density.
- Use text labels together with icons for important actions unless the icon is universally understood and has an accessible label.
- Keep focus/hover states visible.
- Preserve semantic headings rather than using decorative text in place of H1/H2/H3 structure.
- Brand red should not be the only indicator of an important state.