import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import type { Application, Graphics } from 'pixi.js';
import { INGREDIENTS, cityDef, ingredient } from '../game/data';
import { GameService } from '../game/game.service';
import { Recipe } from '../game/model';
import { MAX_TOPPINGS, cityTaste, recipeCost, recipeQuality, tasteLabel } from '../game/recipes';
import { drawPizza, drawTopping } from './pizza-art';

const SIZE = 360;
const RADIUS = 160;
const PLACE_LIMIT = 0.86;

/** Interactive pizza editor: click (or use the keyboard) to place toppings on the base. */
@Component({
  selector: 'app-pizza-designer',
  template: `
    <div class="designer">
      <div class="palette" role="radiogroup" aria-label="Topping">
        @for (i of ingredients; track i.id) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="selected() === i.id"
            (click)="selected.set(i.id)"
          >
            <span class="swatch" [style.background]="hex(i.color)" aria-hidden="true"></span>{{ i.name }}
          </button>
        }
      </div>

      <div class="stage">
        <div
          #canvasHost
          class="canvas"
          tabindex="0"
          role="application"
          aria-roledescription="pizza editor"
          aria-label="Pizza. Click to add the selected topping, shift-click or right-click to remove one. With the keyboard: arrow keys move the cursor, Enter adds, Delete removes."
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
        <dl>
          <dt>Quality</dt><dd><meter min="0" max="1" low="0.4" high="0.7" optimum="1" [value]="quality()" aria-label="Quality"></meter> {{ pct(quality()) }}</dd>
          <dt>Cost</dt><dd>\${{ cost().toFixed(2) }}</dd>
          <dt>{{ cityName() }}</dt><dd>{{ taste() }}</dd>
        </dl>
        <p class="tips">Tips: 8–24 toppings, spread evenly, 2–4 kinds. Keep them on the base.</p>
        <div class="buttons">
          <button type="button" class="secondary" (click)="undo()" [disabled]="draft().toppings.length === 0">Undo</button>
          <button type="button" class="secondary" (click)="clear()">Clear</button>
        </div>
        <div class="buttons">
          <button type="button" class="secondary" (click)="cancelled.emit()">Cancel</button>
          <button type="button" (click)="save()" [disabled]="!draft().name.trim()">Save pizza</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .designer { display: grid; grid-template-columns: 160px auto 220px; gap: 16px; align-items: start; }
    .palette { display: grid; gap: 4px; max-height: 420px; overflow: auto; }
    .palette button { display: flex; gap: 8px; align-items: center; background: transparent; color: var(--ink); border: 2px solid var(--line); padding: 4px 8px; font-weight: 400; }
    .palette button[aria-checked='true'] { border-color: var(--ink); background: var(--cream); font-weight: 700; }
    .swatch { width: 14px; height: 14px; border-radius: 50%; border: 1px solid #0006; flex: none; }
    .canvas { width: ${SIZE}px; height: ${SIZE}px; border-radius: 12px; overflow: hidden; background: #6b4f3a; cursor: crosshair; }
    .canvas:focus-visible { outline: 3px solid #f4a261; outline-offset: 2px; }
    .summary { font-size: 0.9rem; max-width: ${SIZE}px; }
    .side { display: grid; gap: 6px; }
    .side input:not([type]) { font: inherit; padding: 6px; }
    .check { display: flex; gap: 6px; align-items: center; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 4px 0; }
    dt { font-weight: 600; }
    dd { margin: 0; }
    .tips { font-size: 0.85rem; margin: 0; }
    .buttons { display: flex; gap: 8px; }
    @media (max-width: 860px) {
      .designer { grid-template-columns: 1fr; }
      .palette { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); max-height: none; }
      .canvas { width: min(${SIZE}px, 100%); }
    }
  `,
})
export class PizzaDesignerComponent {
  private readonly game = inject(GameService);
  readonly recipe = input.required<Recipe>();
  readonly saved = output<Recipe>();
  readonly cancelled = output<void>();

  protected readonly ingredients = INGREDIENTS;
  protected readonly selected = signal(INGREDIENTS[0].id);
  protected readonly draft = signal<Recipe>({ id: '', name: '', ownerId: null, sauce: true, cheese: true, toppings: [] });
  /** Keyboard cursor in pizza coordinates (-1..1). */
  private readonly cursor = signal({ x: 0, y: 0, visible: false });

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('canvasHost');
  private app: Application | null = null;
  private g: Graphics | null = null;

  protected readonly quality = computed(() => recipeQuality(this.draft()));
  protected readonly cost = computed(() => recipeCost(this.draft()) * cityDef(this.game.state()?.currentCityId ?? 'rome').costOfLiving);
  protected readonly cityName = computed(() => this.game.city()?.name ?? 'City');
  protected readonly taste = computed(() => tasteLabel(cityTaste(this.draft(), this.game.city()?.districts ?? [])));
  protected readonly summary = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.draft().toppings) counts.set(t.ingredient, (counts.get(t.ingredient) ?? 0) + 1);
    const parts = [...counts].map(([id, n]) => `${n} ${ingredient(id).name}`);
    const total = this.draft().toppings.length;
    return total === 0 ? 'No toppings yet.' : `${total} toppings: ${parts.join(', ')}.`;
  });

  constructor() {
    effect(() => this.draft.set(structuredClone(this.recipe())));
    effect(() => {
      const d = this.draft();
      const c = this.cursor();
      this.redraw(d, c);
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init().catch((err) => console.error('Failed to start pizza designer', err));
    });
    destroyRef.onDestroy(() => {
      this.app?.destroy(true, { children: true });
      this.app = null;
    });
  }

  private async init(): Promise<void> {
    const PIXI = await import('pixi.js');
    const app = new PIXI.Application();
    await app.init({ width: SIZE, height: SIZE, background: 0x6b4f3a, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
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
      if (e.button === 2 || e.shiftKey) this.removeNear(x, y);
      else this.place(x, y);
    });
    this.redraw(this.draft(), this.cursor());
  }

  private redraw(d: Recipe, c: { x: number; y: number; visible: boolean }): void {
    const g = this.g;
    if (!g) return;
    g.clear();
    // Wooden board.
    g.rect(0, 0, SIZE, SIZE).fill(0x7a5a40);
    for (let i = 0; i < SIZE; i += 24) g.rect(0, i, SIZE, 2).fill({ color: 0x5e4330, alpha: 0.5 });
    drawPizza(g, d, SIZE / 2, SIZE / 2, RADIUS);
    if (c.visible) {
      const px = SIZE / 2 + c.x * RADIUS;
      const py = SIZE / 2 + c.y * RADIUS;
      drawTopping(g, { ingredient: this.selected(), x: c.x, y: c.y, rotation: 0 }, px, py, RADIUS * 0.09);
      g.circle(px, py, RADIUS * 0.14).stroke({ width: 2, color: 0xffffff });
    }
  }

  private place(x: number, y: number): void {
    if (Math.hypot(x, y) > PLACE_LIMIT || this.draft().toppings.length >= MAX_TOPPINGS) return;
    const rotation = Math.random() * Math.PI * 2;
    this.draft.update((d) => ({ ...d, toppings: [...d.toppings, { ingredient: this.selected(), x, y, rotation }] }));
  }

  private removeNear(x: number, y: number): void {
    const ts = this.draft().toppings;
    let best = -1;
    let bestD = 0.15;
    ts.forEach((t, i) => {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) this.draft.update((d) => ({ ...d, toppings: d.toppings.filter((_, i) => i !== best) }));
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
      case 'Enter': case ' ': this.place(x, y); break;
      case 'Delete': case 'Backspace': this.removeNear(x, y); break;
      default: return;
    }
    ev.preventDefault();
    // Keep the cursor on the pizza.
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
    this.saved.emit({ ...d, name: d.name.trim() });
  }

  protected pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  protected hex(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
}
