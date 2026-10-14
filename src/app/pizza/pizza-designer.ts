import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type { Application, Graphics } from 'pixi.js';
import { INGREDIENTS, INGREDIENT_CATEGORIES, cityDef, ingredient } from '../game/data';
import { GameService } from '../game/game.service';
import { Cut, IngredientCategory, Recipe, Topping } from '../game/model';
import { CUSTOMER_GROUPS, CUT_NAMES, maxCut, pizzaStats } from '../game/pizza-stats';
import { MAX_TOPPINGS, recipeCost } from '../game/recipes';
import { ArtCacheService } from '../shell/art-cache.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { drawPizza, drawTopping } from './pizza-art';

const SIZE = 420;
const RADIUS = 180;
const PLACE_LIMIT = 0.86;
const PICK_RADIUS = 0.13;
const ICON = 44;

/** What clicking on the pizza does. */
type Mode = 'place' | 'knife' | 'rotate' | 'remove';

/**
 * The pizza design screen: a marble counter with ingredient trays by category,
 * the pizza in the middle, and tools to place, chop (whole → chopped → minced),
 * rotate and remove toppings. The info panel shows the recipe's stats.
 */
@Component({
  selector: 'app-pizza-designer',
  template: `
    <div class="designer">
      <div class="trays">
        <div class="cats" role="tablist" aria-label="Ingredient category">
          @for (c of categories; track c.id) {
            <button type="button" role="tab" class="cat" [attr.aria-selected]="category() === c.id" (click)="category.set(c.id)">{{ c.label }}</button>
          }
        </div>
        <div class="tray" role="radiogroup" aria-label="Ingredient">
          @for (i of trayItems(); track i.id) {
            <button type="button" role="radio" class="tile" [attr.aria-checked]="selected() === i.id" (click)="choose(i.id)" [attr.title]="i.name">
              @if (icon(i.id); as src) {<img [src]="src" [width]="iconSize" [height]="iconSize" alt="" />} @else {<span class="ph"></span>}
              <span>{{ i.name }}</span>
            </button>
          }
        </div>
        <div class="row" role="radiogroup" aria-label="Cut new pieces">
          <span>Cut:</span>
          @for (c of cuts; track c.value) {
            <button type="button" role="radio" class="chip" [attr.aria-checked]="placeCut() === c.value" [disabled]="c.value > maxPlaceCut()" (click)="placeCut.set(c.value)">{{ c.label }}</button>
          }
        </div>
        <div class="row" role="radiogroup" aria-label="Tool">
          @for (m of modes; track m.id) {
            <button type="button" role="radio" class="chip" [attr.aria-checked]="mode() === m.id" (click)="mode.set(m.id)">{{ m.label }}</button>
          }
        </div>
      </div>

      <div class="board">
        <div
          #canvasHost
          class="canvas"
          tabindex="0"
          role="application"
          aria-roledescription="pizza editor"
          aria-label="Pizza. Click to use the current tool: place the chosen ingredient, chop a piece finer, rotate it or remove it. Shift-click or right-click removes. Keyboard: arrow keys move the cursor, Enter uses the tool, Delete removes, K knife, R rotate, P place."
          aria-describedby="pizza-summary"
          (keydown)="onKey($event)"
          (contextmenu)="$event.preventDefault()"
        ></div>
        <p id="pizza-summary" class="summary" aria-live="polite">{{ summary() }}</p>
      </div>

      <div class="side">
        <label for="pizza-name">Name</label>
        <input id="pizza-name" maxlength="32" [value]="draft().name" (input)="rename($any($event.target).value)" />
        <label class="check"><input type="checkbox" [checked]="draft().sauce" (change)="toggle('sauce')" /> Tomato sauce</label>
        <label class="check"><input type="checkbox" [checked]="draft().cheese" (change)="toggle('cheese')" /> Mozzarella</label>
        <h3>Who will love it</h3>
        <ul class="groups">
          @for (g of groups(); track g.id) {
            <li><span>{{ g.label }}</span><meter min="0" max="100" low="40" high="70" optimum="100" [value]="g.value" [attr.aria-label]="g.label"></meter><b>{{ g.value }}</b></li>
          }
        </ul>
        <div class="buttons">
          <button type="button" class="secondary" (click)="clear()">Clear</button>
          <button type="button" class="secondary" (click)="cancelled.emit()">Cancel</button>
          <button type="button" (click)="save()" [disabled]="!draft().name.trim()">Save</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; container-type: inline-size; }
    .designer { display: grid; grid-template-columns: minmax(160px, 200px) minmax(240px, 420px) minmax(160px, 210px); gap: 14px; align-items: start; justify-content: center; }
    .trays { display: grid; gap: 8px; }
    .cats { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .cat { font-family: var(--font-lcd); font-size: 1.1rem; text-transform: uppercase; font-weight: 400; padding: 2px 4px; color: #2b1d0e;
      background: linear-gradient(180deg, #ffe08a, #e0b23c); border: 2px solid; border-color: #b07a2a #5c3a12 #5c3a12 #b07a2a; }
    .cat[aria-selected='true'] { background: linear-gradient(180deg, #fff3c4, #f2c14e); outline: 2px solid #7a4a1c; }
    .tray { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; max-height: 330px; overflow: auto; padding: 6px; border-radius: 6px;
      background: repeating-linear-gradient(45deg, #7a4a1c 0 6px, #8b5a2b 6px 12px); }
    .tile { display: grid; justify-items: center; gap: 2px; padding: 4px; background: #f5ecd9; color: #2b1d0e; border: 2px solid #c9a227; font-weight: 400; font-size: 0.75rem; }
    .tile[aria-checked='true'] { background: #fff8e1; border-color: var(--tomato); box-shadow: inset 0 0 0 2px var(--tomato); }
    .ph { width: ${ICON}px; height: ${ICON}px; }
    .row { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; font-size: 0.85rem; }
    .chip { padding: 2px 8px; font-size: 0.8rem; background: #fffaf0; color: var(--ink); border-color: var(--line); font-weight: 400; }
    .chip[aria-checked='true'] { background: var(--ink); color: var(--cream); border-color: var(--ink); }
    .board { display: grid; gap: 6px; justify-items: center; }
    .board { min-width: 0; width: 100%; }
    .canvas { width: 100%; max-width: ${SIZE}px; aspect-ratio: 1; border-radius: 10px; overflow: hidden; cursor: crosshair; box-shadow: 0 6px 18px #0004; }
    .canvas:focus-visible { outline: 3px solid #f4a261; outline-offset: 2px; }
    .summary { font-size: 0.9rem; max-width: ${SIZE}px; margin: 0; text-align: center; }
    .side { display: grid; gap: 6px; }
    .side input:not([type]) { font: inherit; padding: 6px; }
    .check { display: flex; gap: 6px; align-items: center; }
    h3 { margin: 8px 0 0; font-size: 0.95rem; }
    .groups { list-style: none; padding: 0; margin: 0; display: grid; gap: 3px; font-size: 0.85rem; }
    .groups li { display: grid; grid-template-columns: 1fr 60px 26px; gap: 6px; align-items: center; }
    .groups meter { width: 60px; }
    .buttons { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .side, .trays { min-width: 0; }
    @container (max-width: 640px) { .designer { grid-template-columns: 1fr; } .tray { grid-template-columns: repeat(3, 1fr); } }
  `,
})
export class PizzaDesignerComponent {
  private readonly game = inject(GameService);
  private readonly art = inject(ArtCacheService);
  private readonly shell = inject(ShellService);
  readonly recipe = input.required<Recipe>();
  readonly saved = output<Recipe>();
  readonly cancelled = output<void>();

  protected readonly categories = INGREDIENT_CATEGORIES;
  protected readonly cuts: { value: Cut; label: string }[] = [
    { value: 0, label: 'Whole' },
    { value: 1, label: 'Chopped' },
    { value: 2, label: 'Minced' },
  ];
  protected readonly modes: { id: Mode; label: string }[] = [
    { id: 'place', label: 'Place' },
    { id: 'knife', label: 'Knife' },
    { id: 'rotate', label: 'Rotate' },
    { id: 'remove', label: 'Remove' },
  ];
  protected readonly iconSize = ICON;

  protected readonly category = signal<IngredientCategory>('vegetables');
  protected readonly selected = signal(INGREDIENTS[0].id);
  protected readonly placeCut = signal<Cut>(0);
  protected readonly mode = signal<Mode>('place');
  protected readonly draft = signal<Recipe>({ id: '', name: '', ownerId: null, sauce: true, cheese: true, toppings: [] });
  /** Keyboard cursor in pizza coordinates (-1..1). */
  private readonly cursor = signal({ x: 0, y: 0, visible: false });

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');
  private app: Application | null = null;
  private g: Graphics | null = null;

  protected readonly trayItems = computed(() => INGREDIENTS.filter((i) => i.category === this.category()));
  protected readonly maxPlaceCut = computed(() => maxCut(this.selected()));
  protected readonly stats = computed(() => pizzaStats(this.draft(), this.game.city()?.districts ?? []));
  protected readonly cost = computed(() => recipeCost(this.draft()) * cityDef(this.game.state()?.currentCityId ?? 'rome').costOfLiving);
  protected readonly groups = computed(() => CUSTOMER_GROUPS.map((g) => ({ ...g, value: this.stats().groups[g.id] })));
  protected readonly summary = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.draft().toppings) counts.set(t.ingredient, (counts.get(t.ingredient) ?? 0) + 1);
    const parts = [...counts].map(([id, n]) => `${n} ${ingredient(id).name}`);
    const total = this.draft().toppings.length;
    return total === 0 ? 'No toppings yet. Choose an ingredient and click the pizza.' : `${total} pieces, ${this.stats().toppingGrams} g: ${parts.join(', ')}.`;
  });

  private readonly lines = computed<LcdLine[]>(() => {
    const s = this.stats();
    const d = this.draft();
    return [
      { label: d.name || 'New recipe' },
      { label: 'Calories', value: `${s.calories} cal` },
      { label: 'Fat', value: `${s.fat}%` },
      { label: 'Sweet', value: `${s.sweet}%` },
      { label: 'Salty', value: `${s.salty}%` },
      { label: 'Hot', value: `${s.hot}%` },
      { label: 'Appearance', value: String(s.appearance) },
      { label: 'Refinement', value: String(s.refinement) },
      { label: 'Normality', value: String(s.normality) },
      { label: 'Herbs', value: String(s.herbs) },
      { label: 'Trend', value: String(s.trend) },
      { label: 'Imitation', value: `${s.imitation}%` },
      { label: s.closestClassic ? `Like ${s.closestClassic}` : '' },
      { label: 'Cost', value: `$${this.cost().toFixed(2)}` },
    ];
  });
  private readonly tools = computed<Tool[]>(() => {
    const cat = this.category();
    const m = this.mode();
    return [
      { id: 'veg', label: 'Vegetables', icon: ICONS.plus, pressed: cat === 'vegetables', action: () => this.category.set('vegetables') },
      { id: 'meat', label: 'Meat & fish', icon: ICONS.box, pressed: cat === 'meat', action: () => this.category.set('meat') },
      { id: 'fruit', label: 'Fruit', icon: ICONS.sun, pressed: cat === 'fruit', action: () => this.category.set('fruit') },
      { id: 'cheese', label: 'Cheese', icon: ICONS.pizza, pressed: cat === 'cheese', action: () => this.category.set('cheese') },
      { id: 'knife', label: 'Knife', icon: ICONS.pencil, pressed: m === 'knife', action: () => this.mode.set(m === 'knife' ? 'place' : 'knife') },
      { id: 'rotate', label: 'Rotate', icon: ICONS.rotate, pressed: m === 'rotate', action: () => this.mode.set(m === 'rotate' ? 'place' : 'rotate') },
      { id: 'undo', label: 'Undo', icon: ICONS.back, disabled: this.draft().toppings.length === 0, action: () => this.undo() },
      { id: 'save', label: 'Save', icon: ICONS.save, disabled: !this.draft().name.trim(), action: () => this.save() },
      { id: 'cancel', label: 'Cook book', icon: ICONS.book, action: () => this.cancelled.emit() },
    ];
  });

  constructor() {
    effect(() => this.draft.set(structuredClone(this.recipe())));
    effect(() => this.redraw(this.draft(), this.cursor()));
    // Keep the chosen cut within what the selected ingredient allows.
    effect(() => {
      if (this.placeCut() > this.maxPlaceCut()) this.placeCut.set(this.maxPlaceCut());
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
    afterNextRender(() => {
      this.init().catch((err) => console.error('Failed to start pizza designer', err));
    });
    destroyRef.onDestroy(() => {
      this.app?.destroy({ removeView: true }, { children: true });
      this.app = null;
    });
  }

  protected icon(id: string): string | null {
    return this.art.get(`ing-${id}`, ICON, ICON, (PIXI) => {
      const g = new PIXI.Graphics();
      g.circle(ICON / 2, ICON / 2, ICON / 2 - 2).fill(0xf1d39a);
      drawTopping(g, { ingredient: id, x: 0, y: 0, rotation: 0.6 }, ICON / 2, ICON / 2, ICON * 0.3);
      return g;
    });
  }

  protected choose(id: string): void {
    this.selected.set(id);
    this.mode.set('place');
  }

  private async init(): Promise<void> {
    const PIXI = await import('pixi.js');
    const app = new PIXI.Application();
    await app.init({ width: SIZE, height: SIZE, background: 0xe9e6e1, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
    app.canvas.setAttribute('aria-hidden', 'true');
    app.canvas.style.width = '100%';
    app.canvas.style.height = 'auto';
    this.host().nativeElement.appendChild(app.canvas);
    this.app = app;
    this.g = new PIXI.Graphics();
    app.stage.addChild(this.g);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', (e) => {
      const x = (e.global.x - SIZE / 2) / RADIUS;
      const y = (e.global.y - SIZE / 2) / RADIUS;
      this.cursor.set({ x, y, visible: false });
      if (e.button === 2 || e.shiftKey) this.apply('remove', x, y);
      else this.apply(this.mode(), x, y);
    });
    this.redraw(this.draft(), this.cursor());
  }

  private redraw(d: Recipe, c: { x: number; y: number; visible: boolean }): void {
    const g = this.g;
    if (!g) return;
    g.clear();
    // Marble counter with soft veins.
    g.rect(0, 0, SIZE, SIZE).fill(0xe9e6e1);
    for (let i = 0; i < 9; i++) {
      const y0 = (i * 97) % SIZE;
      g.moveTo(0, y0).bezierCurveTo(SIZE * 0.3, y0 + 40, SIZE * 0.6, y0 - 30, SIZE, y0 + 20).stroke({ width: 1.5, color: 0xb8b2a7, alpha: 0.5 });
    }
    drawPizza(g, d, SIZE / 2, SIZE / 2, RADIUS);
    if (c.visible) {
      const px = SIZE / 2 + c.x * RADIUS;
      const py = SIZE / 2 + c.y * RADIUS;
      if (this.mode() === 'place') drawTopping(g, { ingredient: this.selected(), x: c.x, y: c.y, rotation: 0, cut: this.placeCut() }, px, py, RADIUS * 0.09);
      g.circle(px, py, RADIUS * PICK_RADIUS).stroke({ width: 2, color: 0x1d3557 });
    }
  }

  private nearest(x: number, y: number): number {
    let best = -1;
    let bestD = PICK_RADIUS;
    this.draft().toppings.forEach((t, i) => {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  private apply(mode: Mode, x: number, y: number): void {
    if (mode === 'place') {
      if (Math.hypot(x, y) > PLACE_LIMIT || this.draft().toppings.length >= MAX_TOPPINGS) return;
      const t: Topping = { ingredient: this.selected(), x, y, rotation: Math.random() * Math.PI * 2 };
      if (this.placeCut() > 0) t.cut = this.placeCut();
      this.draft.update((d) => ({ ...d, toppings: [...d.toppings, t] }));
      return;
    }
    const i = this.nearest(x, y);
    if (i < 0) return;
    this.draft.update((d) => {
      const toppings = [...d.toppings];
      const t = { ...toppings[i] };
      if (mode === 'remove') {
        toppings.splice(i, 1);
      } else if (mode === 'knife') {
        // Each cut makes the piece one step finer, as far as the ingredient allows.
        const next = Math.min(maxCut(t.ingredient), (t.cut ?? 0) + 1) as Cut;
        t.cut = next;
        toppings[i] = t;
      } else {
        t.rotation += Math.PI / 2;
        toppings[i] = t;
      }
      return { ...d, toppings };
    });
  }

  protected onKey(ev: KeyboardEvent): void {
    const c = this.cursor();
    const step = 0.06;
    let { x, y } = c;
    switch (ev.key) {
      case 'ArrowLeft': x -= step; break;
      case 'ArrowRight': x += step; break;
      case 'ArrowUp': y -= step; break;
      case 'ArrowDown': y += step; break;
      case 'Enter': case ' ': this.apply(this.mode(), x, y); break;
      case 'Delete': case 'Backspace': this.apply('remove', x, y); break;
      case 'k': case 'K': this.mode.set('knife'); break;
      case 'r': case 'R': this.mode.set('rotate'); break;
      case 'p': case 'P': this.mode.set('place'); break;
      default: return;
    }
    ev.preventDefault();
    const r = Math.hypot(x, y);
    if (r > PLACE_LIMIT) {
      x = (x / r) * PLACE_LIMIT;
      y = (y / r) * PLACE_LIMIT;
    }
    this.cursor.set({ x, y, visible: true });
  }

  protected rename(name: string): void {
    this.draft.update((d) => ({ ...d, name }));
  }

  protected toggle(part: 'sauce' | 'cheese'): void {
    this.draft.update((d) => ({ ...d, [part]: !d[part] }));
  }

  protected undo(): void {
    this.draft.update((d) => ({ ...d, toppings: d.toppings.slice(0, -1) }));
  }

  protected clear(): void {
    this.draft.update((d) => ({ ...d, toppings: [] }));
  }

  protected save(): void {
    const d = this.draft();
    if (!d.name.trim()) return;
    this.saved.emit({ ...d, name: d.name.trim() });
  }

  protected readonly cutName = (c: Cut) => CUT_NAMES[c];
}
