import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import type { Application, Container, Graphics, Text } from 'pixi.js';
import { cityDef } from '../game/data';
import { CATALOG, CatalogItem, ItemCategory, SELL_BACK, canPlace, catalogItem, itemAt, roomSize, roomStats } from '../game/furniture';
import { GameService } from '../game/game.service';
import { Restaurant, formatMoney } from '../game/model';
import { CELL, WALL, drawItem, drawRoom } from './interior-art';

type Mode = { kind: 'buy'; itemId: string } | { kind: 'move'; index: number } | { kind: 'select' };

const TABS: { id: ItemCategory; label: string }[] = [
  { id: 'dining', label: 'Furniture' },
  { id: 'decor', label: 'Decoration' },
  { id: 'kitchen', label: 'Cookware' },
];

/**
 * The inside of a restaurant: a floor plan sized from the property, where the player
 * buys, places, moves and sells furniture and kitchen equipment.
 */
@Component({
  selector: 'app-interior-view',
  template: `
    @if (restaurant(); as r) {
      <div class="interior">
        <div class="room">
          <div
            #canvasHost
            class="canvas"
            tabindex="0"
            role="application"
            aria-roledescription="floor plan"
            aria-label="Restaurant floor plan. Arrow keys move the cursor, Enter places or picks up an item, Delete sells the item under the cursor, Escape cancels."
            aria-describedby="room-status"
            (keydown)="onKey($event)"
            (pointerleave)="cursor.set(null)"
          ></div>
          <p id="room-status" class="status" aria-live="polite">{{ status() }}</p>
        </div>

        <aside class="shop">
          <dl class="stats">
            <dt>Seats</dt><dd>{{ stats().seats }}</dd>
            <dt>Kitchen</dt><dd>{{ stats().kitchenCapacity }} pizzas/h</dd>
            <dt>Atmosphere</dt><dd><meter min="0" max="3" [value]="stats().decor" aria-label="Atmosphere"></meter></dd>
            <dt>Room</dt><dd>{{ size().cols }} × {{ size().rows }} squares</dd>
          </dl>
          <div class="tabs" role="tablist" aria-label="Shop">
            @for (t of tabs; track t.id) {
              <button type="button" role="tab" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button>
            }
          </div>
          <ul class="items" role="tabpanel">
            @for (it of items(); track it.id) {
              <li>
                <button
                  type="button"
                  class="item"
                  [attr.aria-pressed]="mode().kind === 'buy' && $any(mode()).itemId === it.id"
                  [disabled]="cash() < price(it)"
                  (click)="startBuy(it.id)"
                >
                  <b>{{ it.name }}</b> · {{ money(price(it)) }}<br />
                  <small>{{ describe(it) }} · {{ it.w }}×{{ it.h }}</small>
                </button>
              </li>
            }
          </ul>
          @if (selected(); as s) {
            <div class="selected">
              <b>{{ s.name }}</b>
              <div class="row">
                <button type="button" class="small" (click)="startMove()">Move</button>
                <button type="button" class="small secondary" (click)="sell()">Sell for {{ money(s.refund) }}</button>
              </div>
            </div>
          }
        </aside>
      </div>
    }
  `,
  styles: `
    .interior { display: grid; grid-template-columns: auto 260px; gap: 16px; align-items: start; }
    .canvas { border-radius: 8px; overflow: hidden; cursor: crosshair; max-width: 70vw; }
    .canvas:focus-visible { outline: 3px solid #f4a261; outline-offset: 2px; }
    .status { margin: 6px 0 0; min-height: 1.4em; }
    .shop { display: grid; gap: 8px; }
    .stats { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; }
    .stats dt { font-weight: 600; }
    .stats dd { margin: 0; }
    .tabs { display: flex; gap: 4px; }
    .tabs button { padding: 4px 8px; background: transparent; color: var(--ink); border-color: var(--line); font-size: 0.85rem; }
    .tabs button[aria-selected='true'] { background: var(--ink); color: var(--cream); }
    .items { list-style: none; padding: 0; margin: 0; max-height: 44dvh; overflow: auto; display: grid; gap: 4px; }
    .item { width: 100%; text-align: left; background: var(--panel); color: var(--ink); border-color: var(--line); font-weight: 400; padding: 6px 8px; }
    .item[aria-pressed='true'] { border-color: var(--tomato); background: var(--cream); }
    .selected { background: var(--cream); padding: 8px; border-radius: 8px; display: grid; gap: 6px; }
    .row { display: flex; gap: 6px; }
    .small { padding: 2px 8px; font-size: 0.85rem; }
    @media (max-width: 900px) { .interior { grid-template-columns: 1fr; } .canvas { max-width: 100%; } }
  `,
})
export class InteriorViewComponent {
  private readonly game = inject(GameService);
  readonly restaurantId = input.required<number>();

  protected readonly tabs = TABS;
  protected readonly tab = signal<ItemCategory>('dining');
  protected readonly mode = signal<Mode>({ kind: 'select' });
  protected readonly cursor = signal<{ x: number; y: number } | null>(null);
  protected readonly selectedIndex = signal<number | null>(null);
  protected readonly message = signal('');

  private readonly host = viewChild<ElementRef<HTMLDivElement>>('canvasHost');
  private app: Application | null = null;
  private room: Graphics | null = null;
  private furniture: Graphics | null = null;
  private board: Container | null = null;
  private pixi: typeof import('pixi.js') | null = null;

  protected readonly restaurant = computed(
    () => (this.game.state()?.restaurants.find((r) => r.id === this.restaurantId()) ?? null) as Restaurant | null,
    { equal: () => false },
  );
  private readonly lot = computed(() => {
    const r = this.restaurant();
    return r ? (this.game.state()?.cities.find((c) => c.id === r.cityId)?.lots[r.lotId] ?? null) : null;
  });
  protected readonly size = computed(() => roomSize(this.lot() ?? { w: 2, h: 2 }));
  protected readonly stats = computed(() => {
    const r = this.restaurant();
    const lot = this.lot();
    return r && lot ? roomStats(r.layout, lot) : roomStats([], { w: 2, h: 2 });
  });
  protected readonly cash = computed(() => this.game.human()?.cash ?? 0);
  private readonly col = computed(() => cityDef(this.restaurant()?.cityId ?? 'rome').costOfLiving);
  protected readonly items = computed(() => CATALOG.filter((c) => c.category === this.tab()));
  protected readonly selected = computed(() => {
    const i = this.selectedIndex();
    const p = i === null ? null : this.restaurant()?.layout[i];
    if (!p) return null;
    const it = catalogItem(p.itemId);
    return { name: it.name, refund: it.price * this.col() * SELL_BACK };
  });
  protected readonly status = computed(() => {
    const m = this.mode();
    if (this.message()) return this.message();
    if (m.kind === 'buy') return `Placing: ${catalogItem(m.itemId).name}. Click a free spot (${catalogItem(m.itemId).category === 'kitchen' ? 'kitchen' : 'dining room'}).`;
    if (m.kind === 'move') return 'Click where the item should go.';
    return 'Pick an item from the shop, or click furniture to move or sell it.';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init().catch((err) => console.error('Failed to start restaurant view', err));
    });
    destroyRef.onDestroy(() => this.app?.destroy({ removeView: true }, { children: true }));
    effect(() => {
      const r = this.restaurant();
      this.cursor();
      this.mode();
      this.selectedIndex();
      if (r) this.redraw(r);
    });
  }

  private async init(): Promise<void> {
    const PIXI = await import('pixi.js');
    this.pixi = PIXI;
    const { cols, rows } = this.size();
    const app = new PIXI.Application();
    await app.init({ width: cols * CELL, height: WALL + rows * CELL, background: 0x3e2a1c, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
    app.canvas.setAttribute('aria-hidden', 'true');
    app.canvas.style.maxWidth = '100%';
    app.canvas.style.height = 'auto';
    this.host()?.nativeElement.appendChild(app.canvas);
    this.app = app;
    this.room = new PIXI.Graphics();
    this.furniture = new PIXI.Graphics();
    this.board = new PIXI.Container();
    app.stage.addChild(this.room, this.board, this.furniture);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    const toCell = (gx: number, gy: number) => ({ x: Math.floor(gx / CELL), y: Math.floor((gy - WALL) / CELL) });
    app.stage.on('pointermove', (e) => {
      const c = toCell(e.global.x, e.global.y);
      const cur = this.cursor();
      if (!cur || cur.x !== c.x || cur.y !== c.y) this.cursor.set(c);
    });
    app.stage.on('pointerdown', (e) => this.activate(toCell(e.global.x, e.global.y)));
    const r = this.restaurant();
    if (r) {
      drawRoom(this.room, cols, rows, this.game.state()?.players.find((p) => p.id === r.ownerId)?.color ?? 0xe63946);
      this.redraw(r);
    }
  }

  private redraw(r: Restaurant): void {
    const g = this.furniture;
    const lot = this.lot();
    if (!g || !lot) return;
    g.clear();
    r.layout.forEach((p, i) => {
      if (this.mode().kind === 'move' && (this.mode() as { index: number }).index === i) return;
      drawItem(g, p);
      if (i === this.selectedIndex()) {
        const it = catalogItem(p.itemId);
        g.rect(p.x * CELL + 1, WALL + p.y * CELL + 1, it.w * CELL - 2, it.h * CELL - 2).stroke({ width: 3, color: 0xffd166 });
      }
    });
    // Ghost preview of the item being placed or moved.
    const cur = this.cursor();
    const ghost = this.ghostItem();
    if (cur && ghost) {
      const ok = canPlace(r.layout, lot, ghost, cur.x, cur.y, this.mode().kind === 'move' ? (this.mode() as { index: number }).index : -1);
      drawItem(g, { itemId: ghost, x: cur.x, y: cur.y }, 0.6);
      const it = catalogItem(ghost);
      g.rect(cur.x * CELL, WALL + cur.y * CELL, it.w * CELL, it.h * CELL).fill({ color: ok ? 0x2a9d8f : 0xe63946, alpha: 0.3 });
    } else if (cur && cur.y >= 0) {
      g.rect(cur.x * CELL, WALL + cur.y * CELL, CELL, CELL).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
    }
    this.drawBoard(r);
  }

  /** Chalkboard on the back wall listing the menu with prices. */
  private drawBoard(r: Restaurant): void {
    const PIXI = this.pixi;
    const board = this.board;
    if (!PIXI || !board) return;
    board.removeChildren().forEach((c) => c.destroy());
    const { cols } = this.size();
    const W = cols * CELL;
    const bw = Math.min(W - 140, 260);
    const bx = (W - bw) / 2;
    const bg = new PIXI.Graphics().roundRect(bx, 6, bw, WALL - 16, 4).fill(0x2f3e36).stroke({ width: 4, color: 0x8b5a2b });
    board.addChild(bg);
    const recipes = this.game.state()?.recipes ?? [];
    const lines = r.menu.slice(0, 6).map((m) => `${recipes.find((x) => x.id === m.recipeId)?.name ?? '?'} ${formatMoney(m.price)}`);
    const text: Text = new PIXI.Text({
      text: lines.length ? lines.join('   ') : 'Menu coming soon',
      style: { fontFamily: 'Georgia, serif', fontSize: 12, fill: 0xf1faee, wordWrap: true, wordWrapWidth: bw - 16, align: 'center', lineHeight: 15 },
    });
    text.position.set(bx + 8, 12);
    board.addChild(text);
  }

  private ghostItem(): string | null {
    const m = this.mode();
    if (m.kind === 'buy') return m.itemId;
    if (m.kind === 'move') return this.restaurant()?.layout[m.index]?.itemId ?? null;
    return null;
  }

  private activate(cell: { x: number; y: number }): void {
    const r = this.restaurant();
    if (!r) return;
    this.message.set('');
    const m = this.mode();
    if (m.kind === 'buy') {
      if (!this.game.placeItem(r.id, m.itemId, cell.x, cell.y)) this.message.set(this.cash() < this.price(catalogItem(m.itemId)) ? 'Not enough cash.' : 'That doesn’t fit there.');
      return;
    }
    if (m.kind === 'move') {
      if (this.game.moveItem(r.id, m.index, cell.x, cell.y)) {
        this.mode.set({ kind: 'select' });
        this.selectedIndex.set(null);
      } else {
        this.message.set('That doesn’t fit there.');
      }
      return;
    }
    const i = itemAt(r.layout, cell.x, cell.y);
    this.selectedIndex.set(i >= 0 ? i : null);
  }

  protected startBuy(itemId: string): void {
    this.selectedIndex.set(null);
    this.message.set('');
    this.mode.set({ kind: 'buy', itemId });
    this.host()?.nativeElement.focus();
    if (!this.cursor()) this.cursor.set({ x: 0, y: catalogItem(itemId).category === 'kitchen' ? 0 : 2 });
  }

  protected startMove(): void {
    const i = this.selectedIndex();
    if (i === null) return;
    this.mode.set({ kind: 'move', index: i });
    this.host()?.nativeElement.focus();
  }

  protected sell(): void {
    const i = this.selectedIndex();
    const r = this.restaurant();
    if (i === null || !r) return;
    this.game.sellItem(r.id, i);
    this.selectedIndex.set(null);
  }

  protected onKey(ev: KeyboardEvent): void {
    const cur = this.cursor() ?? { x: 0, y: 0 };
    const { cols, rows } = this.size();
    let { x, y } = cur;
    switch (ev.key) {
      case 'ArrowLeft': x = Math.max(0, x - 1); break;
      case 'ArrowRight': x = Math.min(cols - 1, x + 1); break;
      case 'ArrowUp': y = Math.max(0, y - 1); break;
      case 'ArrowDown': y = Math.min(rows - 1, y + 1); break;
      case 'Enter': case ' ': this.activate(cur); break;
      case 'Delete': case 'Backspace': {
        const r = this.restaurant();
        const i = r ? itemAt(r.layout, cur.x, cur.y) : -1;
        if (i >= 0) {
          this.selectedIndex.set(i);
          this.sell();
        }
        break;
      }
      case 'Escape':
        if (this.mode().kind === 'select') return;
        this.mode.set({ kind: 'select' });
        break;
      default: return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    this.cursor.set({ x, y });
  }

  protected price(it: CatalogItem): number {
    return it.price * this.col();
  }

  protected describe(it: CatalogItem): string {
    const parts: string[] = [];
    if (it.seats) parts.push(`${it.seats} seats`);
    if (it.ovenCapacity) parts.push(`${it.ovenCapacity} pizzas/h`);
    if (it.counter) parts.push('feeds 2 ovens');
    if (it.fridge) parts.push('halves spoilage');
    if (it.dishwasher) parts.push('+15% waiter speed');
    if (it.ambience) parts.push(`+${it.ambience} atmosphere`);
    return parts.join(', ');
  }

  protected money(n: number): string {
    return formatMoney(n);
  }
}
