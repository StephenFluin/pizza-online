import { Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { cityDef } from '../game/data';
import { CATALOG, CatalogItem, FLOORS, FloorType, STORES, StoreKind, diningCells, floorType, store } from '../game/furniture';
import { GameService } from '../game/game.service';
import { Restaurant, formatMoney } from '../game/model';
import { CUSTOMER_GROUPS } from '../game/pizza-stats';
import { UiService } from '../game/ui.service';
import { ArtCacheService } from '../shell/art-cache.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { CELL, drawFloor, drawItemAt } from './interior-art';

const KINDS: { id: StoreKind; label: string }[] = [
  { id: 'furniture', label: 'Furniture' },
  { id: 'flooring', label: 'Flooring' },
  { id: 'extras', label: 'Extras' },
  { id: 'kitchen', label: 'Kitchen' },
];

/** Preview scale: store pictures are drawn larger than on the floor plan. */
const PREVIEW = 2;

/**
 * The furniture stores: pick a kind of store, then one of its shops, then buy
 * pieces into the restaurant's storage (or lay a new floor) from large previews.
 */
@Component({
  selector: 'app-store-screen',
  template: `
    @if (restaurant(); as r) {
      <div class="stores">
        <nav class="kinds" aria-label="Kind of store">
          @for (k of kinds; track k.id) {
            <button type="button" class="plate" [attr.aria-pressed]="kind() === k.id" (click)="selectKind(k.id)">{{ k.label }}</button>
          }
        </nav>
        <ul class="fronts" aria-label="Stores">
          @for (s of storesOfKind(); track s.id) {
            <li>
              <button type="button" class="front" [attr.aria-current]="storeId() === s.id" [style.--c1]="hex(s.colors[0])" [style.--c2]="hex(s.colors[1])" (click)="storeId.set(s.id)">
                <span class="awning" aria-hidden="true"></span>
                <b>{{ s.name }}</b>
                <small>quality {{ s.quality }} · {{ s.style }}</small>
              </button>
            </li>
          }
        </ul>

        @if (current(); as s) {
          @if (s.kind !== 'kitchen') {
            <p class="likes">Style appeals most to: {{ topGroups(s.id) }}</p>
          }
          @if (kind() === 'flooring') {
            <ul class="cards">
              @for (f of floors(); track f.id) {
                <li class="card">
                  @if (floorImage(f); as src) {<img [src]="src" alt="" class="pic floor" />} @else {<span class="pic ph"></span>}
                  <b>{{ f.name }}</b>
                  <span>{{ money2(f.pricePerCell * col()) }} per square · quality {{ f.quality }}</span>
                  <span>Whole dining room: <b>{{ money(floorCost(f)) }}</b></span>
                  @if (r.floorId === f.id) {
                    <span class="tag">Your current floor</span>
                  } @else {
                    <button type="button" (click)="layFloor(f.id)" [disabled]="cash() < floorCost(f)">Lay this floor</button>
                  }
                </li>
              }
            </ul>
          } @else {
            <ul class="cards">
              @for (it of items(); track it.id) {
                <li class="card">
                  @if (itemImage(it); as src) {<img [src]="src" alt="" class="pic" />} @else {<span class="pic ph"></span>}
                  <b>{{ it.name }}</b>
                  <span>{{ describe(it) }}</span>
                  <span>{{ money(price(it)) }} · {{ it.w }}×{{ it.h }} squares</span>
                  <div class="qty">
                    <button type="button" class="tiny" (click)="changeQty(it.id, -1)" [attr.aria-label]="'One fewer ' + it.name">−</button>
                    <span>{{ qty(it.id) }}</span>
                    <button type="button" class="tiny" (click)="changeQty(it.id, 1)" [attr.aria-label]="'One more ' + it.name">+</button>
                    <button type="button" class="buy" (click)="buy(it)" [disabled]="cash() < price(it) * qty(it.id)">Buy {{ money(price(it) * qty(it.id)) }}</button>
                  </div>
                </li>
              }
            </ul>
          }
        }
        <p role="status" class="msg">{{ message() }}</p>
      </div>
    }
  `,
  styles: `
    .stores { display: grid; gap: 10px; }
    .kinds { display: flex; gap: 8px; flex-wrap: wrap; }
    .plate { font-family: var(--font-lcd); font-size: 1.25rem; text-transform: uppercase; padding: 2px 12px; color: #2b1d0e; font-weight: 400;
      background: linear-gradient(180deg, #ffe08a, #e0b23c); border: 3px solid; border-color: #b07a2a #5c3a12 #5c3a12 #b07a2a; border-radius: 2px; }
    .plate[aria-pressed='true'] { background: linear-gradient(180deg, #fff3c4, #f2c14e); outline: 2px solid #7a4a1c; }
    .fronts { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
    .front { width: 100%; display: grid; gap: 2px; text-align: left; padding: 0 0 8px; overflow: hidden; background: #fffaf0; color: var(--ink); border: 2px solid var(--line); font-weight: 400; }
    .front b, .front small { padding: 0 8px; }
    .front[aria-current='true'] { border-color: var(--wood); box-shadow: 0 0 0 2px var(--wood); }
    .awning { height: 14px; background: repeating-linear-gradient(90deg, var(--c1) 0 14px, var(--c2) 14px 28px); margin-bottom: 4px; }
    .likes { margin: 0; }
    .cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .card { display: grid; gap: 4px; align-content: start; background: #fffaf0; border: 2px solid var(--line); padding: 10px; }
    .pic { width: 100%; height: 130px; object-fit: contain; background: radial-gradient(circle, #f3efe6, #d9d2c3); border-radius: 4px; }
    .pic.floor { object-fit: cover; }
    .ph { display: block; }
    .qty { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .tiny { padding: 0 8px; }
    .buy { margin-left: auto; padding: 4px 10px; }
    .tag { justify-self: start; background: var(--basil); color: #fff; font-size: 0.8rem; padding: 1px 6px; border-radius: 3px; }
    .msg { margin: 0; min-height: 1.3em; }
  `,
})
export class StoreScreenComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly art = inject(ArtCacheService);
  private readonly shell = inject(ShellService);
  readonly restaurantId = input.required<number>();
  readonly storeKind = input<StoreKind>('furniture');

  protected readonly kinds = KINDS;
  protected readonly kind = linkedSignal(() => this.storeKind());
  protected readonly storeId = linkedSignal(() => STORES.find((s) => s.kind === this.kind())?.id ?? '');
  protected readonly message = signal('');
  private readonly quantities = signal<Record<string, number>>({});

  protected readonly restaurant = computed(
    () => (this.game.state()?.restaurants.find((r) => r.id === this.restaurantId()) ?? null) as Restaurant | null,
    { equal: () => false },
  );
  private readonly lot = computed(() => {
    const r = this.restaurant();
    return r ? (this.game.state()?.cities.find((c) => c.id === r.cityId)?.lots[r.lotId] ?? null) : null;
  });
  protected readonly cash = computed(() => this.game.human()?.cash ?? 0);
  protected readonly col = computed(() => cityDef(this.restaurant()?.cityId ?? 'rome').costOfLiving);
  protected readonly storesOfKind = computed(() => STORES.filter((s) => s.kind === this.kind()));
  protected readonly current = computed(() => STORES.find((s) => s.id === this.storeId()) ?? null);
  protected readonly items = computed(() => CATALOG.filter((c) => c.storeId === this.storeId()));
  protected readonly floors = computed(() => FLOORS.filter((f) => f.storeId === this.storeId()));

  private readonly lines = computed<LcdLine[]>(() => {
    const s = this.current();
    const r = this.restaurant();
    return [
      { label: 'Stores' },
      { label: r?.name ?? '' },
      { label: s?.name ?? '' },
      { label: 'Quality', value: String(s?.quality ?? '') },
      { label: 'In storage', value: String(r?.storage.length ?? 0) },
      { label: 'Floor', value: floorType(r?.floorId).name.split(' ')[0] },
    ];
  });
  private readonly tools = computed<Tool[]>(() => {
    const list = this.storesOfKind();
    const i = list.findIndex((s) => s.id === this.storeId());
    return [
      ...KINDS.map((k) => ({ id: k.id, label: k.label, icon: { furniture: ICONS.shop, flooring: ICONS.box, extras: ICONS.sun, kitchen: ICONS.pizza }[k.id], pressed: this.kind() === k.id, action: () => this.selectKind(k.id) })),
      { id: 'prev', label: 'Prev store', icon: ICONS.left, disabled: list.length < 2, action: () => this.storeId.set(list[(i - 1 + list.length) % list.length].id) },
      { id: 'next', label: 'Next store', icon: ICONS.right, disabled: list.length < 2, action: () => this.storeId.set(list[(i + 1) % list.length].id) },
      { id: 'room', label: 'Restaurant', icon: ICONS.restaurant, action: () => this.ui.open({ kind: 'interior', restaurantId: this.restaurantId() }) },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }

  protected selectKind(k: StoreKind): void {
    this.kind.set(k);
    this.message.set('');
  }

  protected itemImage(it: CatalogItem): string | null {
    const w = it.w * CELL * PREVIEW + 20;
    const h = it.h * CELL * PREVIEW + 20;
    return this.art.get(`store-${it.id}`, w, h, (PIXI) => {
      const g = new PIXI.Graphics();
      g.scale.set(PREVIEW);
      drawItemAt(g, it, 5, 5);
      return g;
    });
  }

  protected floorImage(f: FloorType): string | null {
    return this.art.get(`floor-${f.id}`, 200, 130, (PIXI) => {
      const g = new PIXI.Graphics();
      drawFloor(g, f, 0, 0, 200, 130);
      return g;
    });
  }

  protected topGroups(storeId: string): string {
    const s = store(storeId);
    return CUSTOMER_GROUPS.map((g) => ({ label: g.label.toLowerCase(), v: s.ratings[g.id] }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((g) => g.label)
      .join(', ');
  }

  protected qty(id: string): number {
    return this.quantities()[id] ?? 1;
  }

  protected changeQty(id: string, delta: number): void {
    this.quantities.update((q) => ({ ...q, [id]: Math.max(1, Math.min(20, (q[id] ?? 1) + delta)) }));
  }

  protected price(it: CatalogItem): number {
    return it.price * this.col();
  }

  protected floorCost(f: FloorType): number {
    const lot = this.lot();
    return lot ? f.pricePerCell * diningCells(lot) * this.col() : 0;
  }

  protected buy(it: CatalogItem): void {
    const n = this.qty(it.id);
    if (this.game.buyToStorage(this.restaurantId(), it.id, n)) this.message.set(`${n} × ${it.name} delivered to storage. Place them in the restaurant view.`);
    else this.message.set('Not enough cash.');
  }

  protected layFloor(id: string): void {
    if (this.game.layFloor(this.restaurantId(), id)) this.message.set(`New floor laid: ${floorType(id).name}.`);
    else this.message.set('Not enough cash.');
  }

  protected describe(it: CatalogItem): string {
    const parts: string[] = [];
    if (it.maxChairs) parts.push(`seats up to ${it.maxChairs} with chairs`);
    if (it.kind === 'chair') parts.push('one seat when placed against a table');
    if (it.seats) parts.push(`${it.seats} seats`);
    if (it.ovenCapacity) parts.push(`bakes ${it.ovenCapacity} pizzas an hour`);
    if (it.counter) parts.push('feeds two ovens');
    if (it.fridge) parts.push('halves spoilage');
    if (it.dishwasher) parts.push('waiters 15% faster');
    if (it.ambience) parts.push(`atmosphere +${it.ambience}`);
    return parts.join(', ') || 'decoration';
  }

  protected hex(c: number): string {
    return `#${c.toString(16).padStart(6, '0')}`;
  }

  protected money(n: number): string {
    return formatMoney(n);
  }

  protected money2(n: number): string {
    return `$${n.toFixed(2)}`;
  }
}
