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

- [x] "View restaurant" screen: a PixiJS floor plan sized from the property's footprint
- [x] Furniture shop: tables, chairs, decorations, lighting, with styles and prices
- [x] Cookware shop: ovens, prep counters, fridges, dishwashers
- [x] Place, move and sell items on the grid; seats come from placed tables and chairs
- [x] Kitchen throughput comes from ovens and counters; ambience from decor replaces the abstract decor level
- [x] Menu board in the restaurant view (prices, which pizzas are served)

## Fidelity phases

After phase 7 the goal shifted to matching the original's depth and screen
structure much more closely. [docs/ORIGINAL_MECHANICS.md](docs/ORIGINAL_MECHANICS.md)
describes the systems being reproduced (in our own code, text and art).

### Phase 8 – Classic frame and the day cycle

- [x] Wooden frame with the active view, amber info panel and 3×3 tool grid per view
- [x] Every view opens full screen inside the frame, not as a popup over the map
- [x] City view with marker plates (player, range, locations, properties) and folder tabs (map, districts, control)
- [x] Slower clock and an "end day" action
- [x] Detailed daily stats: why each guest was lost, per-pizza demand and margins, food cost, capacity
- [x] Full-screen end-of-day report reviewing every restaurant with findings
- [x] Autosave every 90 seconds and when the tab is hidden

### Phase 9 – Advertising channels and mini-games

- [x] Advertising screen per city with four channels, one campaign each, duration, cost and effectiveness
- [x] Flyers: print run in steps of 100
- [x] Posters: gallery of original procedurally drawn posters
- [x] Newspaper: five-round slogan game with drifting fragment window and family multiplier, then size and colour
- [x] TV: original animated PixiJS commercials to preview and pick
- [x] Effectiveness feeds restaurant popularity

### Phase 10 – Stock purchasing

- [x] More ingredients, grouped into vegetables, meat & fish, fruit and cheese
- [x] Vendors per category with quality, minimum order, reliability and price levels (some items not stocked)
- [x] Stock screen: category → vendor list → order table (price, amount, projected stock, days of supply)
- [x] Deliveries arrive next morning; unreliable vendors sometimes miss
- [x] Stock quality affects how good the pizzas taste

### Phase 11 – Pizza depth

- [x] Ingredient attributes: weights per cut, calories, intensity, fat/sweet/salty/hot
- [x] Chop (whole → chopped → minced) and rotate toppings in the designer
- [x] Recipe stats: calories, flavour mix, appearance, refinement, normality, imitation, herbs, trend
- [x] Six customer groups with taste profiles; per-group popularity of each recipe
- [x] Designer screen in the classic layout (category trays, info panel, tool grid)

### Phase 12 – Demand and popularity model

- [x] Districts with a mix of the six groups, income, price and rent levels, service expectation, desired menu sizes
- [x] Per-pizza demand from group popularity, ingredient trends, economy and price versus income
- [x] Restaurant popularity components: waiting time, menu composition, advertising, stars, fulfilment, events

### Phase 13 – Staff depth

- [x] Staff are characters with stats; wages follow their skills
- [x] Job market pool that rotates weekly
- [x] Training courses for cooking, serving and management
- [x] Staff events with three-choice dialogs (late, sick, raise, quitting, theft)
- [x] Managers who run a daily routine (shopping, prices, staff morale, alerts)

### Phase 14 – Characters

- [x] Full stat block for every original cast member (same attributes as the original)
- [x] Classic selection screen: arrows to cycle, stat box, photo box, rename, human/computer company slots
- [x] Stats drive gameplay (starting money, bank credit, haggling, cooking, staff quality, how many restaurants you can supervise)

### Phase 15 – Restaurant interior rebuild

- [x] Full-screen restaurant view on a much finer grid with detailed furniture
- [x] Dedicated furniture store screen with vendors (quality, price, appeal per customer group) and storage
- [x] Flooring
- [x] Guests seated at tables while open, with a waiter and a cook at work

### Phase 16 – City life

- [ ] Daily newspaper, with events that start ingredient trends
- [ ] Mayor awards and favour, pizza charts, annual pizza competition with judges
- [ ] Social status ranks and awards
- [ ] Economic trend per city, loan schedules, insurance

### Phase 17 – Polish

- [ ] Balancing pass: mature shops currently earn ~$20k/month, so rivals snowball
- [ ] Keyboard navigation and screen-reader labels for every panel (WCAG AA)
- [ ] Sound effects via Web Audio (generated, no samples)
- [ ] Balancing pass and tutorial hints
- [ ] Settings screen (game speed, autosave interval, reduced motion)
- [ ] README screenshots and contribution guide (basic README done)
