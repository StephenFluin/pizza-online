import { Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { INGREDIENTS, INGREDIENT_CATEGORIES, ingredient } from '../game/data';
import { GameService } from '../game/game.service';
import { IngredientCategory, formatMoney } from '../game/model';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { Vendor, cityVendors, dailyUsage, daysOfSupply, vendorPrice } from '../game/vendors';

type View = { kind: 'overview' } | { kind: 'vendors'; category: IngredientCategory } | { kind: 'order'; vendorId: string };

const AMOUNT_STEP = 10;

/**
 * Stock purchasing in the original's three steps: pick a category, pick one of
 * its vendors, then fill in the large order table (price, amount, projected
 * stock and days of supply for every ingredient).
 */
@Component({
  selector: 'app-stock-screen',
  template: `
    @if (restaurant(); as r) {
      <div class="stock">
        <header class="head">
          <label>Restaurant
            <select [value]="r.id" (change)="selectRestaurant(+$any($event.target).value)">
              @for (x of mine(); track x.id) {
                <option [value]="x.id">{{ x.name }}</option>
              }
            </select>
          </label>
          <nav class="cats" aria-label="Categories">
            @for (c of categories; track c.id) {
              <button type="button" class="plate" [attr.aria-pressed]="activeCategory() === c.id" (click)="openCategory(c.id)">{{ c.label }}</button>
            }
          </nav>
        </header>

        @switch (view().kind) {
          @case ('overview') {
            <section aria-labelledby="stock-title">
              <h3 id="stock-title">Current stock</h3>
              <table class="ledger">
                <thead><tr><th scope="col">Ingredient</th><th scope="col">Stock</th><th scope="col">Quality</th><th scope="col">Per day</th><th scope="col">Days</th></tr></thead>
                <tbody>
                  @for (row of overview(); track row.id) {
                    <tr [class.low]="row.days !== null && row.days < 2">
                      <th scope="row">{{ row.name }}</th>
                      <td>{{ row.stock }}</td>
                      <td>{{ row.quality ?? '—' }}</td>
                      <td>{{ row.perDay }}</td>
                      <td>{{ row.days ?? '—' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5">No stock. Choose a category above to order from a vendor.</td></tr>
                  }
                </tbody>
              </table>

              <h3>Deliveries</h3>
              <ul class="orders">
                @for (o of pendingOrders(); track o.id) {
                  <li>
                    <span><b>{{ o.vendor }}</b> · {{ o.units }} units · {{ money(o.total) }} · arrives {{ o.when }}</span>
                    <button type="button" class="small secondary" (click)="game.cancelOrder(o.id)">Cancel</button>
                  </li>
                } @empty {
                  <li>No deliveries on the way.</li>
                }
              </ul>

              <label class="check">
                <input type="checkbox" [checked]="r.autoRestock" (change)="setAutoRestock($any($event.target).checked)" />
                Standing order: top every menu ingredient up to
                <input class="qty" type="number" min="10" max="800" step="10" [value]="r.restockTarget" (change)="setTarget($any($event.target).valueAsNumber)" aria-label="Restock target in units" />
                units each morning from your preferred vendor
              </label>
            </section>
          }
          @case ('vendors') {
            <section aria-labelledby="vendors-title">
              <h3 id="vendors-title">{{ categoryLabel() }} suppliers in {{ cityName() }}</h3>
              <ul class="vendors">
                @for (v of vendors(); track v.id) {
                  <li>
                    <button type="button" class="vendor" (click)="openVendor(v.id)">
                      <b>{{ v.name }}</b>
                      @if (r.preferredVendors[v.category] === v.id) {<span class="tag">Preferred</span>}
                      <span>Quality <meter min="0" max="100" [value]="v.quality" [attr.aria-label]="'Quality ' + v.quality"></meter> {{ v.quality }}</span>
                      <span>Delivers on time {{ onTime(v) }}% · minimum order {{ money(v.minimumOrder) }}</span>
                      <span>Stocks {{ stocked(v) }} of {{ itemsIn(v.category) }} items · so far {{ money(spent(v)) }}</span>
                    </button>
                  </li>
                }
              </ul>
            </section>
          }
          @case ('order') {
            @if (vendor(); as v) {
              <section aria-labelledby="order-title">
                <h3 id="order-title">{{ v.name }} <small>quality {{ v.quality }} · minimum order {{ money(v.minimumOrder) }}</small></h3>
                <table class="ledger order">
                  <thead>
                    <tr><th scope="col">Ingredient</th><th scope="col">Price</th><th scope="col">Amount</th><th scope="col">Stock</th><th scope="col">Days</th></tr>
                  </thead>
                  <tbody>
                    @for (row of orderRows(); track row.id) {
                      <tr [class.unavailable]="row.price === null">
                        <th scope="row">{{ row.name }}</th>
                        <td>{{ row.price === null ? '------' : money2(row.price) }}</td>
                        <td class="amount">
                          @if (row.price !== null) {
                            <button type="button" class="tiny" (click)="adjust(row.id, -step)" [attr.aria-label]="'Less ' + row.name">−</button>
                            <input type="number" min="0" max="9990" [step]="step" [value]="row.amount" (change)="setAmount(row.id, $any($event.target).valueAsNumber)" [attr.aria-label]="'Amount of ' + row.name" />
                            <button type="button" class="tiny" (click)="adjust(row.id, step)" [attr.aria-label]="'More ' + row.name">+</button>
                          }
                        </td>
                        <td>{{ row.price === null ? '' : row.projected }}</td>
                        <td>{{ row.price === null ? '' : (row.days ?? '—') }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
                <div class="foot">
                  <span>Total <b>{{ money2(orderTotal()) }}</b> @if (orderTotal() > 0 && orderTotal() < v.minimumOrder) {<span class="warn">below the minimum order</span>}</span>
                  <button type="button" class="secondary" (click)="amounts.set({})">Clear</button>
                  <button type="button" (click)="order()" [disabled]="orderTotal() === 0">Order for tomorrow</button>
                </div>
                @if (message()) {<p role="status">{{ message() }}</p>}
              </section>
            }
          }
        }
      </div>
    } @else {
      <p>You need a restaurant before you can buy stock.</p>
    }
  `,
  styles: `
    .stock { display: grid; gap: 12px; }
    .head { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; justify-content: space-between; }
    .head select { font: inherit; padding: 4px; margin-left: 6px; }
    .cats { display: flex; gap: 8px; flex-wrap: wrap; }
    .plate { font-family: var(--font-lcd); font-size: 1.25rem; text-transform: uppercase; padding: 2px 12px; color: #2b1d0e; font-weight: 400;
      background: linear-gradient(180deg, #ffe08a, #e0b23c); border: 3px solid; border-color: #b07a2a #5c3a12 #5c3a12 #b07a2a; border-radius: 2px; }
    .plate[aria-pressed='true'] { background: linear-gradient(180deg, #fff3c4, #f2c14e); outline: 2px solid #7a4a1c; }
    h3 { margin: 4px 0 8px; } h3 small { font-weight: 400; color: #555; }
    .ledger { width: 100%; border-collapse: collapse; font-family: var(--font-lcd); font-size: 1.2rem; background: #fffaf0; }
    .ledger th, .ledger td { padding: 2px 8px; border-bottom: 1px solid var(--line); text-align: right; }
    .ledger th[scope='row'], .ledger thead th:first-child { text-align: left; }
    .ledger thead th { background: #2b1d14; color: var(--lcd-text); font-weight: 400; text-transform: uppercase; }
    .ledger tr.low td:last-child { color: var(--tomato); font-weight: 700; }
    .ledger tr.unavailable { color: #999; }
    .amount { white-space: nowrap; }
    .amount input { width: 70px; font: inherit; text-align: right; padding: 0 4px; }
    .tiny { padding: 0 8px; font-size: 1rem; }
    .orders { list-style: none; padding: 0; margin: 0 0 8px; }
    .orders li { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--line); }
    .small { padding: 2px 10px; font-size: 0.85rem; }
    .check { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .qty { width: 70px; font: inherit; }
    .vendors { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
    .vendor { width: 100%; display: grid; gap: 4px; text-align: left; background: #fffaf0; color: var(--ink); border: 2px solid var(--line); font-weight: 400; padding: 10px; }
    .vendor:hover { border-color: var(--wood); }
    .tag { justify-self: start; background: var(--basil); color: #fff; font-size: 0.75rem; padding: 0 6px; border-radius: 3px; }
    .foot { display: flex; gap: 12px; align-items: center; justify-content: flex-end; flex-wrap: wrap; margin-top: 8px; }
    .warn { color: var(--tomato); margin-left: 6px; }
  `,
})
export class StockScreenComponent {
  protected readonly game = inject(GameService);
  private readonly shell = inject(ShellService);
  private readonly ui = inject(UiService);
  readonly restaurantId = input<number | undefined>(undefined);

  protected readonly categories = INGREDIENT_CATEGORIES;
  protected readonly step = AMOUNT_STEP;
  protected readonly view = signal<View>({ kind: 'overview' });
  protected readonly amounts = signal<Record<string, number>>({});
  protected readonly message = signal('');

  protected readonly mine = computed(() => {
    const me = this.game.human();
    return (this.game.state()?.restaurants ?? []).filter((r) => r.ownerId === me?.id);
  }, { equal: () => false });
  private readonly chosenId = linkedSignal(() => this.restaurantId() ?? null);
  protected readonly restaurant = computed(() => {
    const list = this.mine();
    return list.find((r) => r.id === this.chosenId()) ?? list[0] ?? null;
  }, { equal: () => false });
  protected readonly cityName = computed(() => this.game.state()?.cities.find((c) => c.id === this.restaurant()?.cityId)?.name ?? '');
  private readonly allVendors = computed(() => {
    const st = this.game.state();
    const r = this.restaurant();
    return st && r ? cityVendors(r.cityId, st.seed) : [];
  });
  protected readonly activeCategory = computed<IngredientCategory | null>(() => {
    const v = this.view();
    if (v.kind === 'vendors') return v.category;
    if (v.kind === 'order') return this.vendor()?.category ?? null;
    return null;
  });
  protected readonly categoryLabel = computed(() => INGREDIENT_CATEGORIES.find((c) => c.id === this.activeCategory())?.label ?? '');
  protected readonly vendors = computed(() => this.allVendors().filter((v) => v.category === this.activeCategory()));
  protected readonly vendor = computed(() => {
    const v = this.view();
    return v.kind === 'order' ? (this.allVendors().find((x) => x.id === v.vendorId) ?? null) : null;
  });
  private readonly usage = computed(() => {
    const st = this.game.state();
    const r = this.restaurant();
    return st && r ? dailyUsage(st, r) : {};
  });

  protected readonly overview = computed(() => {
    const r = this.restaurant();
    if (!r) return [];
    const usage = this.usage();
    const ids = new Set([...Object.keys(r.stock), ...Object.keys(usage)]);
    return INGREDIENTS.filter((i) => ids.has(i.id)).map((i) => {
      const stock = Math.floor(r.stock[i.id] ?? 0);
      const perDay = usage[i.id] ?? 0;
      return { id: i.id, name: i.name, stock, quality: r.stockQuality[i.id] ?? null, perDay: Math.ceil(perDay), days: daysOfSupply(stock, perDay) };
    });
  });

  protected readonly pendingOrders = computed(() => {
    const st = this.game.state();
    const r = this.restaurant();
    if (!st || !r) return [];
    return st.orders
      .filter((o) => o.restaurantId === r.id)
      .map((o) => ({
        id: o.id,
        vendor: this.allVendors().find((v) => v.id === o.vendorId)?.name ?? 'Vendor',
        units: Object.values(o.items).reduce((n, x) => n + x, 0),
        total: o.total,
        when: o.deliverDay === st.day + 1 ? 'tomorrow' : `day ${o.deliverDay + 1}`,
      }));
  });

  protected readonly orderRows = computed(() => {
    const v = this.vendor();
    const r = this.restaurant();
    const st = this.game.state();
    if (!v || !r || !st) return [];
    const usage = this.usage();
    const amounts = this.amounts();
    // Units already ordered and on their way count towards projected stock.
    const incoming: Record<string, number> = {};
    for (const o of st.orders.filter((x) => x.restaurantId === r.id)) for (const [id, n] of Object.entries(o.items)) incoming[id] = (incoming[id] ?? 0) + n;
    return INGREDIENTS.filter((i) => i.category === v.category).map((i) => {
      const amount = amounts[i.id] ?? 0;
      const projected = Math.floor((r.stock[i.id] ?? 0) + (incoming[i.id] ?? 0) + amount);
      return { id: i.id, name: i.name, price: vendorPrice(v, i.id, st.day), amount, projected, days: daysOfSupply(projected, usage[i.id] ?? 0) };
    });
  });
  protected readonly orderTotal = computed(() => this.orderRows().reduce((n, row) => n + (row.price ?? 0) * row.amount, 0));

  private readonly lines = computed<LcdLine[]>(() => {
    const r = this.restaurant();
    const v = this.view();
    const lines: LcdLine[] = [{ label: 'Stock' }, { label: r?.name ?? '' }];
    if (v.kind === 'vendors') lines.push({ label: this.categoryLabel() }, { label: 'Pick a vendor' });
    if (v.kind === 'order') {
      const vendor = this.vendor();
      lines.push({ label: vendor?.name ?? '' }, { label: 'Quality', value: String(vendor?.quality ?? '') }, { label: 'Order', value: formatMoney(this.orderTotal()) });
    }
    if (v.kind === 'overview') lines.push({ label: 'Deliveries', value: String(this.pendingOrders().length) });
    return lines;
  });
  private readonly tools = computed<Tool[]>(() => {
    const cat = this.activeCategory();
    const icons: Record<IngredientCategory, string> = { vegetables: ICONS.plus, meat: ICONS.box, fruit: ICONS.sun, cheese: ICONS.pizza };
    const tools: Tool[] = INGREDIENT_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: icons[c.id], pressed: cat === c.id, action: () => this.openCategory(c.id) }));
    const list = this.mine();
    const i = list.findIndex((r) => r.id === this.restaurant()?.id);
    tools.push(
      { id: 'prev', label: 'Prev shop', icon: ICONS.left, disabled: list.length < 2, action: () => this.selectRestaurant(list[(i - 1 + list.length) % list.length].id) },
      { id: 'next', label: 'Next shop', icon: ICONS.right, disabled: list.length < 2, action: () => this.selectRestaurant(list[(i + 1) % list.length].id) },
    );
    if (this.view().kind === 'order') tools.push({ id: 'order', label: 'Order', icon: ICONS.save, disabled: this.orderTotal() === 0, action: () => this.order() });
    tools.push({ id: 'back', label: this.view().kind === 'overview' ? 'Close' : 'Back', icon: ICONS.back, action: () => this.back() });
    return tools;
  });

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }

  protected selectRestaurant(id: number): void {
    this.chosenId.set(id);
    this.amounts.set({});
  }

  protected openCategory(category: IngredientCategory): void {
    this.view.set({ kind: 'vendors', category });
    this.message.set('');
  }

  protected openVendor(vendorId: string): void {
    this.view.set({ kind: 'order', vendorId });
    this.amounts.set({});
    this.message.set('');
  }

  private back(): void {
    const v = this.view();
    if (v.kind === 'order') this.view.set({ kind: 'vendors', category: this.vendor()?.category ?? 'vegetables' });
    else if (v.kind === 'vendors') this.view.set({ kind: 'overview' });
    else this.close();
  }

  private close(): void {
    // Return to a pending day report if there is one, otherwise to the city.
    if (this.game.dayReport() !== null) this.ui.open({ kind: 'report' });
    else this.ui.close();
  }

  protected onTime(v: Vendor): number {
    return Math.round(100 - v.missChance * 100);
  }

  protected adjust(id: string, delta: number): void {
    this.setAmount(id, (this.amounts()[id] ?? 0) + delta);
  }

  protected setAmount(id: string, n: number): void {
    const amount = Number.isFinite(n) ? Math.max(0, Math.min(9990, Math.round(n))) : 0;
    this.amounts.update((a) => ({ ...a, [id]: amount }));
  }

  protected order(): void {
    const r = this.restaurant();
    const v = this.vendor();
    if (!r || !v) return;
    const error = this.game.placeOrder(r.id, v.id, this.amounts());
    if (error) {
      this.message.set(error);
    } else {
      this.message.set(`Order placed with ${v.name}: delivery tomorrow morning.`);
      this.amounts.set({});
    }
  }

  protected setAutoRestock(on: boolean): void {
    const r = this.restaurant();
    if (r) this.game.updateRestaurant(r.id, (x) => (x.autoRestock = on));
  }

  protected setTarget(n: number): void {
    const r = this.restaurant();
    if (r && Number.isFinite(n)) this.game.updateRestaurant(r.id, (x) => (x.restockTarget = Math.max(10, Math.min(800, Math.round(n)))));
  }

  protected stocked(v: Vendor): number {
    return Object.keys(v.priceLevels).length;
  }

  protected itemsIn(category: IngredientCategory): number {
    return INGREDIENTS.filter((i) => i.category === category).length;
  }

  protected spent(v: Vendor): number {
    return this.game.state()?.vendorSpend[v.id] ?? 0;
  }

  protected money(n: number): string {
    return formatMoney(n);
  }

  protected money2(n: number): string {
    return `$${n.toFixed(2)}`;
  }

  protected readonly ingredientName = (id: string) => ingredient(id).name;
}
