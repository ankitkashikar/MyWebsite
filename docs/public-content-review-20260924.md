# Public content review — 24 September 2026

Development-only cleanup. No push, merge, production change or live validation.

## Confirmed business facts retained
Hinjewadi Phase 1, Pune; delivery PIN 411057; direct hours 4 PM–midnight;
35–50 minute delivery estimate from confirmation; bulk minimum notice 24 hours.
Address and contact details retained from the owner-confirmed business review.
The older attached handoff says Kharadi; repository owner confirmation supersedes it.

## Corrected
- Removed unverified ratings, dish review counts, customer/order/location counts,
  bestseller labels and named testimonials rather than fabricate new values.
- Removed unverified homepage featured prices; link to current menu instead.
- Removed random founder/timeline photos, placeholder anecdotes and unsupported
  preparation claims. Story now uses confirmed business/service information.
- Removed unverified homepage food photos and purported Instagram feed. Existing
  brand logo supplies hero/story artwork; real approved food photography is pending.
- Removed generic Instagram/Facebook/Yelp destinations. Swiggy/Zomato cards now
  provide app-search guidance and are not misleading generic outbound links.
- Removed menu description boilerplate without inventing ingredients/allergens.
- Clearly labelled bulk rows as samples, with confirmation required. Underlying
  sample catalogue, prices and ordering logic remain unchanged for development QA.

## Release blockers requiring owner input
1. Five actual bulk dishes/packages, quantities/servings and prices. Sample rows
   are NOT production-ready even with the preview notice; replace before release.
2. Confirm regular menu items, portions, dietary labels and current prices against
   the production product catalogue. Source below is frontend only, not verified DB.
3. Direct restaurant-specific Swiggy/Zomato URLs and genuine social profile URLs.
4. Approved food photos; founder/story material only if you want the fuller story
   restored. No invented testimonials or metrics are needed to launch.
5. Final food descriptions, ingredients/allergen details and any required business
   disclosures remain owner inputs. Payment integration stays last.

## Validation and limits
Static QA plus source invariants checked. Menu IDs/names/prices and checkout JS
are unchanged. Browser visual review still pending; no claim of live-page QA.
User reported coupon suite 78 passes, exit 0 before this copy-only step.

## Menu review inventory

### menu.html: 71 entries

| ID | Current source name | Source price (₹) |
|---|---|---:|
| VS-1 | Paneer Chilli | 180 |
| VS-2 | Paneer Garlic | 180 |
| VS-3 | Veg Manchurian Dry | 180 |
| VS-4 | Paneer 65 (Dry) | 180 |
| VS-5 | Paneer Schezwan | 180 |
| VS-6 | Soyabean Chilli (Dry) | 180 |
| VS-7 | Veg 65 | 180 |
| VS-8 | Veg Corn Crispy | 180 |
| VS-9 | Veg Crispy | 180 |
| VS-10 | Veg Chinese Bhel | 180 |
| NS-1 | Chicken Chilli | 220 |
| NS-2 | Chicken Chinese Bhel | 220 |
| NS-3 | Chicken Crispy | 220 |
| NS-4 | Chicken Garlic Dry | 220 |
| NS-5 | Chicken Lollipop Dry | 220 |
| NS-6 | Chicken Lollipop Masala | 220 |
| NS-7 | Chicken Schezwan (Dry) | 220 |
| NS-8 | Chicken 65 | 220 |
| VN-1 | Veg Chilli Garlic Noodles | 190 |
| VN-2 | Veg Cocktail Noodles | 190 |
| VN-3 | Veg Hakka Noodles | 190 |
| VN-4 | Veg Hong Kong Noodles | 190 |
| VN-5 | Veg Peri Peri Hakka Noodles | 190 |
| VN-6 | Veg Schezwan Noodles | 190 |
| VN-7 | Veg Singapore Noodles | 190 |
| VN-8 | Veg Triple Schezwan Fried Noodles | 190 |
| VN-9 | Veg Manchurian Noodles | 190 |
| VN-10 | Veg Paneer Noodles | 190 |
| NN-1 | Chicken Burnt Garlic Noodles | 230 |
| NN-2 | Chicken Chilli Garlic Noodles | 230 |
| NN-3 | Chicken Chilli Noodles | 230 |
| NN-4 | Chicken Drumstick Noodles | 230 |
| NN-5 | Chicken Garlic And Onion Noodles | 230 |
| NN-6 | Chicken Hakka Noodles | 230 |
| NN-7 | Chicken Hong Kong Noodles | 230 |
| NN-8 | Chicken Schezwan Noodles | 230 |
| NN-9 | Chicken Singapore Noodles | 230 |
| NN-10 | Chicken Triple Schezwan Noodles | 230 |
| NN-11 | Egg Hakka Noodles | 230 |
| VR-1 | Veg Fried Rice | 180 |
| VR-2 | Veg Fried Garlic Rice | 180 |
| VR-3 | Paneer Schezwan Fried Rice | 180 |
| VR-4 | Veg Cocktail Fried Rice | 180 |
| VR-5 | Veg Hong Kong Fried Rice | 180 |
| VR-6 | Veg Manchurian Fried Rice | 180 |
| VR-7 | Veg Paneer Fried Rice | 180 |
| VR-8 | Veg Peri Peri Fried Rice | 180 |
| VR-9 | Veg Schezwan Fried Rice | 180 |
| VR-10 | Veg Singapore Fried Rice | 180 |
| VR-11 | Veg Triple Schezwan Fried Rice | 180 |
| NR-1 | Chicken Chilli Fried Rice | 220 |
| NR-2 | Chicken Fried Rice | 220 |
| NR-3 | Chicken Garlic and Onion Fried Rice | 220 |
| NR-4 | Chicken Burnt Garlic Fried Rice | 220 |
| NR-5 | Chicken Chopper Fried Rice | 220 |
| NR-6 | Chicken Drumstick Fried Rice | 220 |
| NR-7 | Chicken Hong Kong Fried Rice | 220 |
| NR-8 | Chicken Schezwan Fried Rice | 220 |
| NR-9 | Chicken Singapore Fried Rice | 220 |
| NR-10 | Chicken Triple Schezwan Fried Rice | 220 |
| NR-11 | Egg Fried Rice | 220 |
| VSP-1 | Hot & Sour Soup | 120 |
| VSP-2 | Tomato Soup | 120 |
| VSP-3 | Veg Clear Soup | 120 |
| VSP-4 | Veg Lemon Coriander Soup | 120 |
| VSP-5 | Veg Manchow Soup | 120 |
| VSP-6 | Veg Noodle Soup | 120 |
| NSP-1 | Chicken Clear Soup | 150 |
| NSP-2 | Chicken Hot and Sour Soup | 150 |
| NSP-3 | Chicken Lemon Coriander Soup | 150 |
| NSP-4 | Chicken Manchow Soup | 150 |

### bulk-order.html: 5 entries

| ID | Current source name | Source price (₹) |
|---|---|---:|
| B001 | Dish Name | 150 |
| B002 | Dish Name | 180 |
| B003 | Dish Name | 190 |
| B004 | Dish Name | 200 |
| B005 | Dish Name | 280 |
