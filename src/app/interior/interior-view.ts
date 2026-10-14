import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import type { Application, Container, Graphics } from 'pixi.js';
import { cityDef } from '../game/data';
import { CUSTOMER_GROUPS } from '../game/pizza-stats';
import { SELL_BACK, StoreKind, canPlace, catalogItem, floorType, itemAt, roomSize, roomStats, seatingPlan, store } from '../game/furniture';
import { GameService } from '../game/game.service';
import { CLOSE_MINUTE, OPEN_MINUTE, Restaurant, formatMoney } from '../game/model';
import { UiService } from '../game/ui.service';
import { ArtCacheService } from '../shell/art-cache.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { CELL, WALL, drawItem, drawItemAt, drawRoom } from './interior-art';

/** What clicking on the floor plan does. */
type Mode = { kind: 'select' } | { kind: 'place'; itemId: string } | { kind: 'move'; index: number };

/**
 * The inside of a restaurant, full screen: a floor plan on a fine grid whose
 * size comes from the property, a storage tray of pieces bought from the stores,
 * and tools to place, move, put away and sell them. Guests sit at the tables
 * while the restaurant is open.
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
            aria-label="Restaurant floor plan. Arrow keys move the cursor, Enter places or picks up a piece, Delete puts the piece under the cursor back into storage, Escape cancels."
            aria-describedby="room-status"
            (keydown)="onKey($event)"
            (pointerleave)="cursor.set(null)"
          ></div>
          <p id="room-status" class="status" aria-live="polite">{{ status() }}</p>
        </div>

        <div class="tray">
          <section aria-labelledby="storage-title">
          <h3 id="storage-title">Storage</h3>
          <ul class="stored">
            @for (s of stored(); track s.itemId) {
              <li>
                <button type="button" class="piece" [attr.aria-pressed]="placingId() === s.itemId" (click)="startPlace(s.itemId)">
                  @if (preview(s.itemId); as src) {<img [src]="src" alt="" />} @else {<span class="ph"></span>}
                  <span><b>{{ s.name }}</b><br /><small>{{ s.store }} · ×{{ s.count }}</small></span>
                </button>
                <button type="button" class="tiny secondary" (click)="sellOne(s.itemId)" [attr.aria-label]="'Sell one ' + s.name + ' for ' + money(s.refund)">Sell</button>
              </li>
            } @empty {
              <li class="empty">Nothing in storage. Visit the stores to buy furniture and equipment.</li>
            }
          </ul>
          </section>
          @if (selected(); as s) {
            <section class="selected" aria-label="Selected piece">
              <b>{{ s.name }}</b>
              <small>{{ s.store }} · quality {{ s.quality }}</small>
              <div class="row">
                <button type="button" class="tiny" (click)="startMove()">Move</button>
                <button type="button" class="tiny secondary" (click)="putAway()">Put away</button>
              </div>
            </section>
          }
          <section aria-labelledby="look-title">
            <h3 id="look-title">Who likes the look</h3>
            <ul class="appeal">
              @for (g of appeal(); track g.id) {
                <li><span>{{ g.label }}</span><meter min="0" max="9" [value]="g.value" [attr.aria-label]="g.label"></meter></li>
              }
            </ul>
          </section>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; height: 100%; }
    .interior { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 8px; height: 100%; min-height: 460px; }
    .room { display: grid; grid-template-rows: minmax(0, 1fr) auto; min-height: 0; min-width: 0; }
    .canvas { position: relative; min-height: 280px; border-radius: 6px; overflow: hidden; cursor: crosshair; background: #3e2a1c; }
    .canvas:focus-visible { outline: 3px solid #f4a261; outline-offset: 2px; }
    .status { margin: 4px 0 0; min-height: 1.4em; }
    /* Storage, the selected piece and style appeal sit in a strip under the room. */
    .tray { display: flex; gap: 14px; align-items: flex-start; overflow-x: auto; padding-bottom: 4px; }
    .tray section { flex: none; }
    h3 { margin: 0 0 4px; font-size: 0.9rem; }
    .stored { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px; }
    .stored li { display: grid; gap: 2px; }
    .piece { display: grid; grid-template-columns: 40px auto; gap: 6px; align-items: center; text-align: left; background: #fffaf0; color: var(--ink); border: 2px solid var(--line); font-weight: 400; padding: 3px 6px; font-size: 0.85rem; }
    .piece[aria-pressed='true'] { border-color: var(--tomato); background: #fff3d6; }
    .piece img, .ph { width: 40px; height: 40px; object-fit: contain; }
    .empty { font-size: 0.85rem; max-width: 260px; }
    .tiny { padding: 0 8px; font-size: 0.8rem; }
    .selected { background: #fff3d6; padding: 6px; border-radius: 6px; display: grid; gap: 4px; }
    .row { display: flex; gap: 6px; }
    .appeal { list-style: none; margin: 0; padding: 0; font-size: 0.8rem; display: grid; grid-template-columns: auto 60px auto 60px; gap: 2px 6px; align-items: center; }
    .appeal li { display: contents; }
    .appeal meter { width: 60px; }
  `,
})
export class InteriorViewComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly art = inject(ArtCacheService);
  private readonly shell = inject(ShellService);
  readonly restaurantId = input.required<number>();

  protected readonly mode = signal<Mode>({ kind: 'select' });
  protected readonly cursor = signal<{ x: number; y: number } | null>(null);
  protected readonly selectedIndex = signal<number | null>(null);
  protected readonly message = signal('');

  private readonly host = viewChild<ElementRef<HTMLDivElement>>('canvasHost');
  private app: Application | null = null;
  private world: Container | null = null;
  private room: Graphics | null = null;
  private furniture: Graphics | null = null;
  private people: Graphics | null = null;
  private board: Container | null = null;
  private pixi: typeof import('pixi.js') | null = null;
  private drawnFloor = '';

  protected readonly restaurant = computed(
    () => (this.game.state()?.restaurants.find((r) => r.id === this.restaurantId()) ?? null) as Restaurant | null,
    { equal: () => false },
  );
  private readonly lot = computed(() => {
    const r = this.restaurant();
    return r ? (this.game.state()?.cities.find((c) => c.id === r.cityId)?.lots[r.lotId] ?? null) : null;
  });
  private readonly size = computed(() => roomSize(this.lot() ?? { w: 2, h: 2 }));
  protected readonly stats = computed(() => {
    const r = this.restaurant();
    const lot = this.lot();
    return r && lot ? roomStats(r.layout, lot, r.floorId) : null;
  });
  private readonly col = computed(() => cityDef(this.restaurant()?.cityId ?? 'rome').costOfLiving);
  protected readonly appeal = computed(() => CUSTOMER_GROUPS.map((g) => ({ ...g, value: this.stats()?.groupAppeal[g.id] ?? 0 })));

  protected readonly stored = computed(() => {
    const counts = new Map<string, number>();
    for (const id of this.restaurant()?.storage ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts].map(([itemId, count]) => {
      const it = catalogItem(itemId);
      return { itemId, count, name: it.name, store: store(it.storeId).name, refund: it.price * this.col() * SELL_BACK };
    });
  });
  protected readonly placingId = computed(() => {
    const m = this.mode();
    return m.kind === 'place' ? m.itemId : null;
  });
  protected readonly selected = computed(() => {
    const i = this.selectedIndex();
    const p = i === null ? null : this.restaurant()?.layout[i];
    if (!p) return null;
    const it = catalogItem(p.itemId);
    return { name: it.name, store: store(it.storeId).name, quality: it.quality };
  });
  protected readonly status = computed(() => {
    if (this.message()) return this.message();
    const m = this.mode();
    if (m.kind === 'place') return `Placing ${catalogItem(m.itemId).name}: click a free spot. Chairs only seat guests when they stand against a table.`;
    if (m.kind === 'move') return 'Click where the piece should go.';
    return 'Click a piece to move or store it, or choose something from storage to place.';
  });

  private readonly lines = computed<LcdLine[]>(() => {
    const r = this.restaurant();
    const s = this.stats();
    if (!r || !s) return [];
    return [
      { label: r.name },
      { label: 'Seats', value: String(s.seats) },
      { label: 'Kitchen', value: `${Math.round(s.kitchenCapacity)}/h` },
      { label: 'Atmosphere', value: s.decor.toFixed(1) },
      { label: 'Floor', value: floorType(r.floorId).name.split(' ')[0] },
      { label: 'Storage', value: String(r.storage.length) },
      { label: 'Guests today', value: String(r.today.customers) },
    ];
  });
  private readonly tools = computed<Tool[]>(() => {
    const id = this.restaurantId();
    const shop = (kind: StoreKind) => () => this.ui.open({ kind: 'shop', restaurantId: id, storeKind: kind });
    const sel = this.selectedIndex() !== null;
    return [
      { id: 'furniture', label: 'Furniture', icon: ICONS.shop, action: shop('furniture') },
      { id: 'floors', label: 'Flooring', icon: ICONS.box, action: shop('flooring') },
      { id: 'extras', label: 'Extras', icon: ICONS.sun, action: shop('extras') },
      { id: 'kitchen', label: 'Kitchen', icon: ICONS.pizza, action: shop('kitchen') },
      { id: 'move', label: 'Move', icon: ICONS.right, disabled: !sel, pressed: this.mode().kind === 'move', action: () => this.startMove() },
      { id: 'capacity', label: 'Capacity', icon: ICONS.chart, action: () => this.ui.open({ kind: 'capacity', restaurantId: id }) },
      { id: 'stock', label: 'Stock', icon: ICONS.box, action: () => this.ui.open({ kind: 'stock', restaurantId: id }) },
      { id: 'manage', label: 'Staff', icon: ICONS.staff, action: () => this.ui.open({ kind: 'staff', restaurantId: id }) },
      { id: 'back', label: 'Back', icon: ICONS.back, action: () => (this.game.dayReport() !== null ? this.ui.open({ kind: 'report' }) : this.ui.close()) },
    ];
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
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

  protected preview(itemId: string): string | null {
    const it = catalogItem(itemId);
    const w = it.w * CELL;
    const h = it.h * CELL;
    return this.art.get(`item-${itemId}`, w, h, (PIXI) => {
      const g = new PIXI.Graphics();
      drawItemAt(g, it, 0, 0);
      return g;
    });
  }

  private async init(): Promise<void> {
    const PIXI = await import('pixi.js');
    this.pixi = PIXI;
    const el = this.host()?.nativeElement;
    if (!el) return;
    const app = new PIXI.Application();
    await app.init({ resizeTo: el, background: 0x3e2a1c, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
    app.canvas.setAttribute('aria-hidden', 'true');
    app.canvas.style.position = 'absolute';
    app.canvas.style.inset = '0';
    el.appendChild(app.canvas);
    this.app = app;
    this.world = new PIXI.Container();
    this.room = new PIXI.Graphics();
    this.board = new PIXI.Container();
    this.furniture = new PIXI.Graphics();
    this.people = new PIXI.Graphics();
    this.world.addChild(this.room, this.board, this.furniture, this.people);
    app.stage.addChild(this.world);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointermove', (e) => {
      const c = this.toCell(e.global.x, e.global.y);
      const cur = this.cursor();
      if (!cur || cur.x !== c.x || cur.y !== c.y) this.cursor.set(c);
    });
    app.stage.on('pointerdown', (e) => this.activate(this.toCell(e.global.x, e.global.y)));
    app.ticker.add(() => {
      this.fit();
      this.drawPeople();
    });
    const r = this.restaurant();
    if (r) this.redraw(r);
  }

  /** Scales the room to fill the available space. */
  private fit(): void {
    const app = this.app;
    const w = this.world;
    if (!app || !w) return;
    const { cols, rows } = this.size();
    const roomW = cols * CELL;
    const roomH = WALL + rows * CELL;
    const scale = Math.min(app.screen.width / roomW, app.screen.height / roomH);
    w.scale.set(scale);
    w.position.set((app.screen.width - roomW * scale) / 2, (app.screen.height - roomH * scale) / 2);
  }

  private toCell(sx: number, sy: number): { x: number; y: number } {
    const w = this.world;
    if (!w) return { x: -1, y: -1 };
    const lx = (sx - w.position.x) / w.scale.x;
    const ly = (sy - w.position.y) / w.scale.y;
    return { x: Math.floor(lx / CELL), y: Math.floor((ly - WALL) / CELL) };
  }

  private redraw(r: Restaurant): void {
    const g = this.furniture;
    const lot = this.lot();
    if (!g || !lot || !this.room) return;
    const { cols, rows } = this.size();
    const floorKey = `${r.floorId}:${cols}x${rows}`;
    if (floorKey !== this.drawnFloor) {
      this.drawnFloor = floorKey;
      this.room.clear();
      drawRoom(this.room, cols, rows, this.game.state()?.players.find((p) => p.id === r.ownerId)?.color ?? 0xe63946, floorType(r.floorId));
    }
    g.clear();
    const moving = this.mode().kind === 'move' ? (this.mode() as { index: number }).index : -1;
    const { seatedChairs } = seatingPlan(r.layout);
    const occupied = this.occupiedChairs(r, seatedChairs);
    r.layout.forEach((p, i) => {
      if (i === moving) return;
      drawItem(g, p, 1, occupied.has(i));
      if (i === this.selectedIndex()) {
        const it = catalogItem(p.itemId);
        g.rect(p.x * CELL, WALL + p.y * CELL, it.w * CELL, it.h * CELL).stroke({ width: 3, color: 0xffd166 });
      }
    });
    const cur = this.cursor();
    const ghost = this.ghostItem();
    if (cur && ghost) {
      const ok = canPlace(r.layout, lot, ghost, cur.x, cur.y, moving);
      drawItem(g, { itemId: ghost, x: cur.x, y: cur.y }, 0.65);
      const it = catalogItem(ghost);
      g.rect(cur.x * CELL, WALL + cur.y * CELL, it.w * CELL, it.h * CELL).fill({ color: ok ? 0x2a9d8f : 0xe63946, alpha: 0.3 });
    } else if (cur && cur.y >= 0 && cur.x >= 0) {
      g.rect(cur.x * CELL, WALL + cur.y * CELL, CELL, CELL).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
    }
    this.drawBoard(r);
  }

  /** Which seated chairs have a guest, from how busy the restaurant is this hour. */
  private occupiedChairs(r: Restaurant, seated: Set<number>): Set<number> {
    const minute = this.game.state()?.minute ?? 0;
    const result = new Set<number>();
    if (minute < OPEN_MINUTE || minute >= CLOSE_MINUTE || seated.size === 0) return result;
    const hours = Math.max(1, (minute - OPEN_MINUTE) / 60);
    const fullness = Math.min(1, r.today.customers / hours / Math.max(1, r.seats * 1.5));
    const hour = Math.floor(minute / 60);
    for (const i of seated) if (((i * 7919 + hour * 104729) % 100) / 100 < fullness) result.add(i);
    return result;
  }

  /** A waiter walking between the hatch and the tables, and a cook at the ovens. */
  private drawPeople(): void {
    const g = this.people;
    const r = this.restaurant();
    if (!g || !r) return;
    g.clear();
    const minute = this.game.state()?.minute ?? 0;
    if (minute < OPEN_MINUTE || minute >= CLOSE_MINUTE) return;
    const { cols, rows } = this.size();
    const t = performance.now() / 1000;
    const tables = r.layout.filter((p) => catalogItem(p.itemId).maxChairs || catalogItem(p.itemId).seats);
    const hatch = { x: (cols * CELL) / 2, y: WALL + 7 * CELL + 10 };
    const target = tables.length ? tables[Math.floor(t / 4) % tables.length] : null;
    if (target && r.staff.some((s) => s.role === 'waiter')) {
      const it = catalogItem(target.itemId);
      const tx = (target.x + it.w / 2) * CELL;
      const ty = WALL + (target.y + it.h + 0.8) * CELL;
      const k = (Math.sin(((t % 4) / 4) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      const x = hatch.x + (tx - hatch.x) * k;
      const y = hatch.y + (ty - hatch.y) * k;
      g.circle(x, y, 8).fill(0xffffff).stroke({ width: 2, color: 0x1d3557 });
      g.circle(x, y - 2, 5).fill(0xe9b98f);
      if (k > 0.5) g.circle(x + 9, y - 6, 5).fill(0xe2b46c).circle(x + 9, y - 6, 3.5).fill(0xc8371f);
    }
    if (r.staff.some((s) => s.role === 'cook')) {
      const cx = CELL * 3 + Math.sin(t * 0.8) * CELL * Math.min(6, cols / 4);
      const cy = WALL + 4 * CELL;
      g.circle(cx, cy, 8).fill(0xffffff).stroke({ width: 2, color: 0x868e96 });
      g.circle(cx, cy - 3, 5).fill(0xf1c27d);
      g.rect(cx - 5, cy - 11, 10, 4).fill(0xffffff);
    }
    void rows;
  }

  /** Chalkboard on the back wall listing the menu with prices. */
  private drawBoard(r: Restaurant): void {
    const PIXI = this.pixi;
    const board = this.board;
    if (!PIXI || !board) return;
    board.removeChildren().forEach((c) => c.destroy());
    const W = this.size().cols * CELL;
    const bw = Math.min(W - 180, 360);
    const bx = (W - bw) / 2;
    board.addChild(new PIXI.Graphics().roundRect(bx, 6, bw, WALL - 18, 4).fill(0x2f3e36).stroke({ width: 4, color: 0x8b5a2b }));
    const recipes = this.game.state()?.recipes ?? [];
    const lines = r.menu.slice(0, 8).map((m) => `${recipes.find((x) => x.id === m.recipeId)?.name ?? '?'} ${formatMoney(m.price)}`);
    const text = new PIXI.Text({
      text: lines.length ? lines.join('   ') : 'Menu coming soon',
      style: { fontFamily: 'Georgia, serif', fontSize: 12, fill: 0xf1faee, wordWrap: true, wordWrapWidth: bw - 16, align: 'center', lineHeight: 15 },
    });
    text.position.set(bx + 8, 12);
    board.addChild(text);
  }

  private ghostItem(): string | null {
    const m = this.mode();
    if (m.kind === 'place') return m.itemId;
    if (m.kind === 'move') return this.restaurant()?.layout[m.index]?.itemId ?? null;
    return null;
  }

  private activate(cell: { x: number; y: number }): void {
    const r = this.restaurant();
    if (!r) return;
    this.message.set('');
    const m = this.mode();
    if (m.kind === 'place') {
      const index = r.storage.indexOf(m.itemId);
      if (index < 0 || !this.game.placeFromStorage(r.id, index, cell.x, cell.y)) {
        this.message.set(catalogItem(m.itemId).storeId && this.isKitchen(m.itemId) ? 'Kitchen equipment goes behind the counter line.' : 'That doesn’t fit there.');
        return;
      }
      // Keep placing the same kind while there are more in storage.
      if (!this.restaurant()?.storage.includes(m.itemId)) this.mode.set({ kind: 'select' });
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

  private isKitchen(itemId: string): boolean {
    return store(catalogItem(itemId).storeId).kind === 'kitchen';
  }

  protected startPlace(itemId: string): void {
    this.selectedIndex.set(null);
    this.message.set('');
    this.mode.set(this.placingId() === itemId ? { kind: 'select' } : { kind: 'place', itemId });
    this.host()?.nativeElement.focus();
  }

  protected startMove(): void {
    const i = this.selectedIndex();
    if (i === null) return;
    this.mode.set({ kind: 'move', index: i });
    this.host()?.nativeElement.focus();
  }

  protected putAway(): void {
    const i = this.selectedIndex();
    const r = this.restaurant();
    if (i === null || !r) return;
    this.game.putAway(r.id, i);
    this.selectedIndex.set(null);
    this.mode.set({ kind: 'select' });
  }

  protected sellOne(itemId: string): void {
    const r = this.restaurant();
    const index = r?.storage.indexOf(itemId) ?? -1;
    if (r && index >= 0) this.game.sellStored(r.id, index);
  }

  protected onKey(ev: KeyboardEvent): void {
    const cur = this.cursor() ?? { x: 0, y: 7 };
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
          this.putAway();
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

  protected money(n: number): string {
    return formatMoney(n);
  }
}
