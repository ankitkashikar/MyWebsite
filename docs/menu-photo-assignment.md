# Menu photo assignment — 30 September 2026

Current coverage: **69 of 75 dishes**, with six intentionally left without photos. Added 25 original photos from Veg Starters.zip, Non Veg Starter.zip, veg Noodles.zip and non veg noodles.zip. Two photos in the noodle archives belong to noodle combos and are assigned there. Filename spelling Panner Garlic maps to Paneer Garlic.

## Static-photo rule

One photo per dish remains visible for every Dry, Semi Gravy, Gravy or combo starter selection. This supersedes the earlier Chicken Schezwan Dry-only visibility rule. One note below the menu introduction says: “Images are for illustration. Actual presentation may vary.” Individual cards have no photo captions. Original file bytes preserved; no image editing. Photo-first ordering remains within each existing subsection, preserving category and dietary grouping.

## Accepted without photos

Owner has no remaining photos and accepts these dishes without images at the bottom of their respective sections. Do not request additional photos.

- Veg Cocktail Noodles
- Chicken Drumstick Noodles
- Chicken Hakka Noodles
- Veg Cocktail Fried Rice
- Chicken Garlic And Onion Fried Rice
- Chicken Drumstick Fried Rice

## Assigned originals

| Menu key | Source file |
| --- | --- |
| NS-8 | Chicken 65.png |
| NR-4 | Chicken Burnt Garlic Fried Rice.png |
| NR-1 | Chicken Chilli Fried Rice.png |
| NN-3 | Chicken Chilli Noodles.png |
| CMB5-1 | Chicken Fried Rice Half With Choice Of Starter.png |
| NN-5 | Chicken Garlic And Onion Noodles.png |
| NS-4 | Chicken Garlic Dry.png |
| NR-7 | Chicken Hong Kong Fried Rice.png |
| NS-6 | Chicken Lollipop Masala.png |
| NR-9 | Chicken Singapore Fried Rice.png |
| NR-10 | Chicken Triple Schezwan Fried Rice.png |
| CMB6-1 | Egg Fried Rice Half With Choice Of Starter.png |
| NR-11 | Egg Fried Rice.png |
| CMB3-1 | Egg Hakka Noodles With Choice Of Starter.png |
| VR-2 | Veg Fried Garlic Rice.png |
| CMB4-1 | Veg Fried Rice Half With Choice Of Veg Starter.png |
| VR-1 | Veg Fried Rice.png |
| VN-3 | Veg Hakka Noodles.png |
| VR-6 | Veg Manchurian Fried Rice.png |
| VN-10 | Veg Paneer Noodles.png |
| VN-6 | Veg Schezwan Noodles.png |
| VR-10 | Veg Singapore Fried Rice.png |
| NR-5 | Chicken Chopper Fried Rice.png |
| NN-7 | Chicken Hong Kong Noodles.png |
| NS-7 | Chicken Schezwan (Dry).png |
| NR-8 | Chicken Schezwan Fried Rice.png |
| NN-10 | Chicken Triple Schezwan Noodles.png |
| NN-11 | Egg Hakka Noodles.png |
| VR-3 | Paneer Schezwan Fried Rice.png |
| VR-5 | Veg Hong Kong Fried Rice.png |
| VR-7 | Veg Paneer Fried Rice.png |
| VR-9 | Veg Schezwan Fried Rice.png |
| VR-11 | Veg Triple Schezwan Fried Rice.png |
| VS-4 | Paneer 65 (Dry).png |
| VS-1 | Paneer Chilli.png |
| VS-5 | Paneer Schezwan.png |
| VS-2 | Panner Garlic.png |
| VS-6 | Soyabean Chilli (Dry).png |
| VS-7 | Veg 65.png |
| VS-10 | Veg Chinese Bhel.png |
| VS-8 | Veg Corn Crispy.png |
| VS-9 | Veg Crispy.png |
| VS-3 | Veg Manchurian Dry.png |
| NS-1 | Chicken Chilli.png |
| NS-2 | Chicken Chinese Bhel.png |
| NS-3 | Chicken Crispy.png |
| NS-5 | Chicken Lollipop Dry.png |
| VN-1 | Veg Chilli Garlic Noodles.png |
| CMB1-1 | Veg Hakka Noodles Half With Choice Of Veg Starter (Paneer Chilly Half Gravy).png |
| VN-4 | Veg Hong Kong Noodles.png |
| VN-9 | Veg Manchurian Noodles.png |
| VN-7 | Veg Singapore Noodles.png |
| VN-8 | Veg Triple Schezwan Fried Noodles.png |
| NN-1 | Chicken Burnt Garlic Noodles.png |
| NN-2 | Chicken Chilli Garlic Noodles.png |
| CMB2-1 | Chicken Hakka Noodles Half Choice Of Starter (Chicken Chilly Half).png |
| NN-8 | Chicken Schezwan Noodles.png |
| NN-9 | Chicken Singapore Noodles.png |

## Verification

69 file hashes and menu links verified; every variant keeps the same visible photo. Photo-first order verified across all sections. Static website QA passes. Browser visual review remains on the local Windows preview. Not deployed.

## Install

Copy the contents of the complete ZIP into the existing local project, replace matching files and preserve .local-supabase-qa. Refresh the running local menu preview with Ctrl+F5. Next: review the compact card layout locally.

## Final photo batch and compact cards

Added ten soup photos and Chicken Fried Rice. Chicken Garlic And Onion Noodles upload is byte-identical to the existing photo and retained once. Cards use a contained 140px desktop / 100px mobile photo beside full dish text, with price and quantity below. Category ordering, prices, descriptions, ordering and admin behaviour unchanged. Static QA, photo/hash/order checks and the 13 existing menu checks pass. Real-browser visual verification remains pending. Not deployed.

## Desktop/mobile review helper

Run `node scripts/menu_layout_review.mjs` from the local project. Uses installed Playwright/Chromium, an isolated temporary localhost server and blocks all external requests including production APIs. It checks 390/1280px overflow, all image loads, card bounds, inline add-ons and search visibility. Saves screenshots and results under `.menu-layout-review`. External fonts may fall back locally. Owner should visually inspect screenshots; this is not a backend acceptance test. Chromium is unavailable in the development environment, so this helper has been syntax-checked but not executed here.

Fixed search/card CSS interaction by using `hidden` with an explicit CSS override. Non-matching cards now have a visibility rule stronger than the grid layout.

### Search review correction

The first real browser review exposed a higher-specificity `#cat-combos .combo-row` display rule from combo-modern.css overriding `.menu-row[hidden]`. Added `#cat-combos .combo-row[hidden]` with display:none!important, which is more specific than the existing combo rule. The test still requires only matching cards and zero visible hidden cards. Real browser rerun pending.
