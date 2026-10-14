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

- [ ] Pizza designer: place toppings on a dough base with the mouse/keyboard
- [ ] Recipe quality scoring (ingredient balance, coverage, freshness)
- [ ] Cook book with standard recipes
- [ ] Recipe import/export as JSON files
- [ ] District taste preferences react to recipes

## Phase 4 – Rivals, world, saving and winning

- [ ] AI competitor chains that open restaurants and compete on price/quality
- [ ] Multiple cities on a world map; expand by opening in another city
- [ ] Bank loans with interest
- [ ] Advertising campaigns
- [ ] Save/load to `localStorage` plus autosave; export/import save files
- [ ] Win condition: be the most popular chain in every city

## Phase 5 – Polish

- [ ] Keyboard navigation and screen-reader labels for every panel (WCAG AA)
- [ ] Sound effects via Web Audio (generated, no samples)
- [ ] Balancing pass and tutorial hints
- [ ] Settings screen (game speed, autosave interval, reduced motion)
- [ ] README with screenshots and contribution guide
