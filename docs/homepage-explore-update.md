# Homepage polish, tracking and IST — 30 September 2026

Fixed the Explore Menu intrinsic-image-height bug with a constrained 3:2 image area. Compact photo-led cards retain the three original owner-supplied photos, category links, dietary labels, keyboard focus and reduced-motion support.

Clipped the existing logo SVG to a circle and generated a 64px transparent PNG fallback. All 14 HTML pages use cache-busted favicon links. The original logo asset is unchanged.

Added Track Order near the bottom of the homepage and in its footer. Bulk-order confirmations now provide the same order-number link and session-only phone handoff as normal-order confirmations. Phone numbers are not placed in tracking URLs.

Visible timezone wording now uses IST across all HTML pages. Scheduling code retains Asia/Kolkata. Removed “page” from visible “Order Status page” wording.

Validation: static QA zero errors/warnings; all 14 pages pass visible wording and inline JavaScript syntax checks; normal/bulk confirmation handoffs pass; PNG corners are transparent; 13 menu option SQL/API/DOM checks pass. No production changes.

Real browser visual validation remains pending because Chromium is absent here. Run `node scripts/menu_layout_review.mjs` locally. It tests at 390px and 1280px, including image/card size bounds, tracking navigation, policy wording and existing menu search/add-on checks. It saves screenshots in `.menu-layout-review`. External requests and backend calls are blocked.

Next: review desktop/mobile screenshots before preparing the matching release.
