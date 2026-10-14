# Pizza Online roadmap

Pizza Online is a browser-only, open-source pizza restaurant tycoon game built with
Angular and PixiJS. It is inspired by the gameplay of the 1994 DOS classic
_Pizza Tycoon_ and the [Pizza Legacy](https://codeberg.org/cowomaly/pizzalegacy)
reimplementation, but it is written from scratch: no original code, graphics or
sounds are used. Every visual is drawn procedurally with PixiJS.

The work is split into phases. Each phase ends in a playable, committed state, so
work can stop after any phase and pick up again at the next unchecked item.

## Phase 1 – Foundation and city map

- [x] PixiJS installed, canvas mounted in the browser only (SSR-safe)
- [x] Game data model (`src/app/game/model.ts`) and seeded RNG
- [x] Procedural city generator: roads, blocks, parks, water, districts, lots
- [x] City map renderer with drag-scrolling, wheel/pinch zoom and lot selection
- [x] Game clock (pause / 1x / 2x / 4x) and HUD with date and cash
- [x] New game screen (player name, starting city)

## Phase 2 – Restaurants and the customer simulation

- [x] Rent or buy a lot and open a restaurant (rent, purchase price, size)
- [x] Restaurant panel: reputation, daily stats, decor upgrades
- [x] Hire and fire staff (cooks, waiters) with skill and wage
- [x] Ingredient stock: buy from the market, spoilage over time
- [x] Menu: pick recipes and set prices
- [x] Daily customer simulation by district (population, wealth, taste)
- [x] Finances ledger and a monthly report

## Phase 3 – Pizza designer and recipes

- [x] Pizza designer: place toppings on a dough base with the mouse/keyboard
- [x] Recipe quality scoring (amount, even spread, variety, sauce and cheese)
- [x] Cook book with standard recipes (copy, edit, delete)
- [x] Recipe import/export as JSON files
- [x] Monthly food trends shift district tastes

## Phase 4 – Rivals, world, saving and winning

- [x] AI competitor chains that open restaurants and compete on price/quality
- [x] Multiple cities on a world map; expand by opening in another city
- [x] Bank loans with interest
- [x] Advertising campaigns
- [x] Save/load to `localStorage` plus autosave; export/import save files
- [x] Win condition: be the most popular chain in every city (lose on bankruptcy)

## Phase 5 – Original-style city view and UI shell

Match the original game's screen structure more closely (with original art).

- [x] Icon toolbar drives the game (phone, restaurant, cook book, finances, world, staff, disk) instead of side panels
- [x] City drawn in a 3/4 view: building façades, roofs, windows, shop signs, trees, bridges
- [x] Animated traffic on roads and pedestrians on pavements, denser near busy districts
- [x] Hover info for buildings and lots; rival and own restaurants marked on the map
- [x] Dynamic zoom (no fixed levels) with on-screen zoom controls and bounds-clamped panning
- [x] Map overlays: districts, wealth, competitor locations

## Phase 6 – Characters and the phone

- [x] Character selection screen with a large cast of original procedurally drawn portraits, each with a bio and a starting perk
- [x] Rival chains are run by characters from the same cast
- [x] Phone system: every lot has a realtor; clicking "Call realtor" connects directly (no dialling)
- [x] Realtor calls: ask about the property, negotiate rent or price, sign the lease or purchase
- [x] Bank calls (loans), supplier calls (ingredient deals and deliveries), staff agency calls (hiring)
- [x] Buying or renting property happens only through the phone, as in the original

## Phase 7 – Restaurant interior

- [ ] "View restaurant" screen: a PixiJS floor plan sized from the property's footprint
- [ ] Furniture shop: tables, chairs, decorations, lighting, with styles and prices
- [ ] Cookware shop: ovens, prep counters, fridges, dishwashers
- [ ] Place, move and sell items on the grid; seats come from placed tables and chairs
- [ ] Kitchen throughput comes from ovens and counters; ambience from decor replaces the abstract decor level
- [ ] Menu board in the restaurant view (prices, which pizzas are served)

## Phase 8 – Polish

- [ ] Balancing pass: mature shops currently earn ~$20k/month, so rivals snowball
- [ ] Keyboard navigation and screen-reader labels for every panel (WCAG AA)
- [ ] Sound effects via Web Audio (generated, no samples)
- [ ] Balancing pass and tutorial hints
- [ ] Settings screen (game speed, autosave interval, reduced motion)
- [ ] README with screenshots and contribution guide
