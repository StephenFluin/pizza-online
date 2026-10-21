# Pizza Online

A browser-only, open-source pizza restaurant tycoon game built with **Angular** and **PixiJS**.
It is a homage to the 1994 DOS classic _Pizza Tycoon_ and the
[Pizza Legacy](https://codeberg.org/cowomaly/pizzalegacy) reimplementation, written from
scratch: no original code, graphics, sounds or characters are used. Everything you see
is drawn procedurally with PixiJS.

## Playing

1. Pick a character. Each has a bio and a perk (better haggling, cheaper ingredients, family money, …).
2. Explore the city. Drag to scroll, zoom smoothly with the wheel, pinch or the on-screen buttons, and hover for details.
3. Click a lot with a sign and **call the realtor** to rent or buy it. Haggling is allowed, within reason.
4. Open the **Phone** to call the bank (loans), the wholesaler (weekly deals) and the staff agency (hiring).
5. **View restaurant** to buy tables, decorations, ovens, prep counters, fridges and dishwashers.
   Seats, kitchen output and atmosphere all come from what you place.
6. Design pizzas in the **Cook book**, put them on the menu and set prices for the local tastes.
7. Beat three rival chains by being the most popular pizza chain in all ten cities. Go bankrupt and you lose.

Saves live in browser storage (with a monthly autosave) and can be exported or imported as files.

## Development

```bash
npm install
npm start
```

Open http://localhost:4200. In dev builds the game service is exposed as `window.pizza`
for debugging, e.g. `pizza.state()`.

```bash
npm run build
```

### Code map

- `src/app/game/`: framework-free simulation (city generation, customers, AI rivals,
  furniture, phone contacts, saves) plus the Angular services that hold state.
- `src/app/map/`: PixiJS city renderer and traffic.
- `src/app/interior/`: PixiJS restaurant floor plan.
- `src/app/pizza/`: PixiJS pizza designer and cook book.
- `src/app/characters/`: procedural portraits rendered once and cached as images.
- `src/app/screens/`: title screen, HUD, toolbar, dialogs and panels.

See [ROADMAP.md](ROADMAP.md) for what's done and what's next.

## Working on this project

These conventions are for anyone changing the code, whether that's a person or an AI coding
assistant working in the repo.

### Before you commit

```bash
npm run lint           # ESLint, including Angular template and accessibility rules
npm run format         # Prettier (CI runs npm run format:check)
npm run build
```

### Angular and TypeScript style

The app follows current Angular (v22) conventions:

- **Components** are standalone (the default, so don't add `standalone: true`), small, and do one
  job. OnPush change detection is the default, so don't set `changeDetection`. Small components use
  inline templates; external template and style paths are relative to the component file.
- **State** lives in signals: `signal()` for local state, `computed()` for derived state, and
  `linkedSignal()` for state that must follow several sources. Change signals with `set()` or
  `update()` and keep transformations pure.
- **Inputs and outputs** use `input()`, `output()` and, for two-way bindings, `model()` rather
  than decorators. Inject dependencies with `inject()`, and make singletons
  `providedIn: 'root'` (or `@Service` for new ones).
- **Templates** use built-in control flow (`@if`, `@for`, `@switch`), `class` and `style` bindings
  instead of `ngClass`/`ngStyle`, the async pipe for observables, and import only the directives
  and pipes they use (no `CommonModule`). Host bindings go in the decorator's `host` object, not
  `@HostBinding`/`@HostListener`. Keep logic out of templates, and don't reach for globals such as
  `new Date()` there.
- **Forms**: Signal Forms (`@angular/forms/signals`) for new forms, otherwise reactive forms.
- **Images**: `NgOptimizedImage` for static images (it can't handle inline base64 images).
- **Routing**: lazy-load feature routes.
- **TypeScript** is strict. Let inference work when the type is obvious, and use `unknown` rather
  than `any`.

### Accessibility

Every page must pass AXE checks and meet WCAG AA, including focus management, color contrast and
ARIA attributes.

## License

[MIT](LICENSE)
