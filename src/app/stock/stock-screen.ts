import { Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { INGREDIENTS, INGREDIENT_CATEGORIES, ingredient } from '../game/data';
import { GameService } from '../game/game.service';
import { IngredientCategory, formatMoney } from '../game/model';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { Vendor, cityVendors, daysOfSupply, vendorPrice } from '../game/vendors';
import { MAX_RESTOCK_DAYS, forecastGuests, forecastUsage, freshDays, restockTargets } from '../game/simulation';
import { BULK_DISCOUNT, BULK_UNITS, warehouseIn } from '../game/warehouse';
import { ARGUMENTS, Argument, PATIENCE, Terms, argue, contractMinimum, dailyListPrice, deliveryCost, openingTerms, relationOf, salesRep } from '../game/contracts';
import { PortraitComponent } from '../characters/portrait';
import { ShopPickerComponent, shopCycleTools } from '../screens/shop-picker';

type View = { kind: 'overview' } | { kind: 'vendors'; category: IngredientCategory } | { kind: 'order'; vendorId: string };

const AMOUNT_STEP = 10;

/**
 * Stock purchasing in the original's three steps: pick a category, pick one of
 * its vendors, then fill in the large order table (price, amount, projected
 * stock and days of supply for every ingredient).
 */
@Component({
  selector: 'app-stock-screen',
  imports: [PortraitComponent, ShopPickerComponent],
  template: `
    @if (restaurant(); as r) {
      <div class="stock">
        <header class="head">
          <app-shop-picker [shops]="mine()" [selected]="r.id" (picked)="selectRestaurant($event)" />
          <button type="button" class="secondary small" (click)="ui.open({ kind: 'warehouse', cityId: r.cityId })">{{ hasWarehouse() ? 'Warehouse' : 'Rent a warehouse' }}</button>
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
              <p class="forecast">{{ forecastText() }}</p>
              <table class="ledger">
                <thead><tr><th scope="col">Ingredient</th><th scope="col">Stock</th><th scope="col">Quality</th><th scope="col">Use a day</th><th scope="col">Days</th>@if (r.autoRestock) {<th scope="col">Restock to</th>}</tr></thead>
                <tbody>
                  @for (row of overview(); track row.id) {
                    <tr [class.low]="row.days !== null && row.days < 2">
                      <th scope="row">{{ row.name }}</th>
                      <td>{{ row.stock }}</td>
                      <td>{{ row.quality ?? '—' }}</td>
                      <td>{{ row.perDay }}</td>
                      <td class="days">{{ row.days ?? '—' }}</td>
                      @if (r.autoRestock) {<td [attr.title]="row.capped ? 'Kept to ' + row.fresh + ' days so it doesn’t spoil' : null">{{ row.target ?? '—' }}{{ row.capped ? '*' : '' }}</td>}
                    </tr>
                  } @empty {
                    <tr><td [attr.colspan]="r.autoRestock ? 6 : 5">No stock. Choose a category above to order from a vendor.</td></tr>
                  }
                </tbody>
              </table>
              @if (r.autoRestock && anyCapped()) {
                <p class="note">* Perishable: kept to as many days as it stays fresh. A fridge in the kitchen doubles that.</p>
              }

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

              <h3>Supply contracts</h3>
              <ul class="orders">
                @for (c of contracts(); track c.id) {
                  <li>
                    <span><b>{{ c.vendor }}</b> · {{ c.units }} units a day · {{ money(c.cost) }} a day ({{ pct(c.discount) }} off) · {{ c.daysLeft }} days left</span>
                    <button type="button" class="small secondary" (click)="cancelContract(c.id, c.penalty)">Cancel ({{ money(c.penalty) }})</button>
                  </li>
                } @empty {
                  <li>No contracts. Pick a category, then a vendor, and choose “Daily contract” to get a locked-in price with a discount.</li>
                }
              </ul>

              <label class="check">
                <input type="checkbox" [checked]="r.autoRestock" (change)="setAutoRestock($any($event.target).checked)" />
                Standing order: each morning, top every menu ingredient up to
                <input class="qty" type="number" min="1" [max]="maxDays" step="1" [value]="r.restockDays" (change)="setDays($any($event.target).valueAsNumber)" aria-label="Days of stock to keep" />
                days of expected use from your preferred vendor
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
                <div class="modes" role="radiogroup" aria-label="Kind of purchase">
                  <button type="button" role="radio" class="small" [class.secondary]="buyMode() !== 'once'" [attr.aria-checked]="buyMode() === 'once'" (click)="setMode('once')">One-off order</button>
                  <button type="button" role="radio" class="small" [class.secondary]="buyMode() !== 'contract'" [attr.aria-checked]="buyMode() === 'contract'" (click)="setMode('contract')">Daily contract</button>
                  <span class="hint">{{ buyMode() === 'once' ? 'Delivered once, tomorrow morning, at this week’s prices.' : 'Delivered every morning at a locked-in, negotiated price. Amounts are per day.' }}</span>
                </div>
                <!-- Totals and the main action sit above the long ingredient table so they're always in view. -->
                @if (buyMode() === 'contract') {
                  @if (talk(); as t) {
                    <section class="talk" aria-labelledby="talk-title">
                      <div class="rep">
                        @if (rep(); as rp) {
                          <app-portrait [cacheKey]="'rep-' + v.id" [look]="rp.look" [background]="repColor" [size]="72" alt="" />
                          <div>
                            <h4 id="talk-title">{{ rp.name }}</h4>
                            <small>Sales, {{ v.name }}</small>
                            <p class="line" role="status">“{{ t.line }}”</p>
                            <label class="patience">Patience <meter min="0" [max]="patienceMax" [value]="patienceMax - t.strain" low="2" high="4" optimum="6" aria-label="Sales rep's patience"></meter></label>
                          </div>
                        }
                      </div>
                      <table class="terms">
                        <caption>The offer</caption>
                        <tbody>
                          <tr><th scope="row">Daily delivery at list price</th><td>{{ money2(t.terms.dailyValue) }}</td></tr>
                          <tr><th scope="row">Discount</th><td>{{ pct(t.terms.discount) }}</td></tr>
                          <tr><th scope="row">Delivery fee</th><td>{{ t.terms.fee ? money(t.terms.fee) + ' a day' : 'none' }}</td></tr>
                          <tr class="total"><th scope="row">You pay</th><td>{{ money2(perDay(t.terms)) }} a day</td></tr>
                          <tr><th scope="row">Length</th><td>{{ t.terms.term }} days</td></tr>
                          <tr><th scope="row">Penalty for cancelling</th><td>{{ money(t.terms.penalty) }}</td></tr>
                          <tr><th scope="row">Over the whole deal</th><td>{{ money(perDay(t.terms) * t.terms.term) }}</td></tr>
                          <tr [class.good]="saving(t.terms) > 0" [class.bad]="saving(t.terms) < 0"><th scope="row">Against buying at list price</th><td>{{ saving(t.terms) >= 0 ? 'saves ' + money2(saving(t.terms)) : 'costs ' + money2(-saving(t.terms)) + ' more' }} a day</td></tr>
                        </tbody>
                      </table>
                      <div class="args" role="group" aria-label="Haggle">
                        @for (a of arguments; track a.id) {
                          <button type="button" class="small secondary" (click)="haggle(a.id)" [disabled]="t.ended">{{ a.label }}</button>
                        }
                      </div>
                      <div class="foot">
                        <button type="button" class="secondary" (click)="talk.set(null)">{{ t.ended ? 'Hang up' : 'Walk away' }}</button>
                        <button type="button" (click)="sign()" [disabled]="t.ended">Sign the contract</button>
                      </div>
                    </section>
                  } @else {
                    <div class="foot">
                      <button type="button" class="secondary" (click)="fillUsage()">Match daily use</button>
                      <span>List price <b>{{ money2(orderTotal()) }}</b> a day @if (orderTotal() > 0 && orderTotal() < contractMin(v)) {<span class="warn">contracts start at {{ money(contractMin(v)) }} a day</span>}</span>
                      <button type="button" class="secondary" (click)="amounts.set({})">Clear</button>
                      <button type="button" (click)="startTalk()" [disabled]="orderTotal() === 0">Talk terms with {{ rep()?.name }}</button>
                    </div>
                  }
                } @else {
                  <div class="foot">
                    @if (hasWarehouse()) {
                      <label class="dest"><input type="checkbox" [checked]="toWarehouse()" (change)="toWarehouse.set($any($event.target).checked)" /> Deliver to the {{ cityName() }} warehouse
                        @if (toWarehouse() && orderUnits() >= bulkUnits) {<span class="bulk">bulk discount {{ bulkPct }}%</span>}
                      </label>
                    }
                    <span>Total <b>{{ money2(orderTotal() * (toWarehouse() && orderUnits() >= bulkUnits ? 1 - bulkPct / 100 : 1)) }}</b> @if (orderTotal() > 0 && orderTotal() < v.minimumOrder) {<span class="warn">below the minimum order</span>}</span>
                    <button type="button" class="secondary" (click)="amounts.set({})">Clear</button>
                    <button type="button" (click)="order()" [disabled]="orderTotal() === 0">Order for tomorrow</button>
                  </div>
                }
                @if (message()) {<p role="status" class="msg">{{ message() }}</p>}
                @if (!talk()) {
                  <table class="ledger order">
                    <thead>
                      <tr><th scope="col">Ingredient</th><th scope="col">Price</th><th scope="col">{{ buyMode() === 'contract' ? 'Per day' : 'Amount' }}</th><th scope="col">{{ buyMode() === 'contract' ? 'Used a day' : 'Stock' }}</th><th scope="col">{{ buyMode() === 'contract' ? 'Covers' : 'Days' }}</th></tr>
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
                          @if (buyMode() === 'contract') {
                            <td>{{ row.price === null ? '' : row.perDay }}</td>
                            <td>{{ row.price === null || !row.perDay ? '' : pct(row.amount / row.perDay) }}</td>
                          } @else {
                            <td>{{ row.price === null ? '' : row.projected }}</td>
                            <td>{{ row.price === null ? '' : (row.days ?? '—') }}</td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                }
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
    .ledger tr.low td.days { color: var(--tomato); font-weight: 700; }
    .ledger tr.unavailable { color: #999; }
    .amount { white-space: nowrap; }
    .amount input { width: 70px; font: inherit; text-align: right; padding: 0 4px; }
    .tiny { padding: 0 8px; font-size: 1rem; }
    .orders { list-style: none; padding: 0; margin: 0 0 8px; }
    .orders li { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--line); }
    .small { padding: 2px 10px; font-size: 0.85rem; }
    .check { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .qty { width: 56px; font: inherit; }
    .forecast { margin: 0 0 6px; }
    .note { margin: 4px 0 0; font-size: 0.85rem; color: #555; }
    .vendors { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
    .vendor { width: 100%; display: grid; gap: 4px; text-align: left; background: #fffaf0; color: var(--ink); border: 2px solid var(--line); font-weight: 400; padding: 10px; }
    .vendor:hover { border-color: var(--wood); }
    .tag { justify-self: start; background: var(--basil); color: #fff; font-size: 0.75rem; padding: 0 6px; border-radius: 3px; }
    .foot { display: flex; gap: 12px; align-items: center; justify-content: flex-end; flex-wrap: wrap; margin: 8px 0; }
    .msg { margin: 0 0 8px; font-weight: 600; }
    .warn { color: var(--tomato); margin-left: 6px; }
    .dest { display: flex; gap: 6px; align-items: center; margin-right: auto; }
    .modes { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
    .hint { font-size: 0.85rem; color: #555; }
    .talk { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; margin-top: 12px; padding: 10px; background: #fffaf0; border: 2px solid var(--wood); border-radius: 8px; }
    .talk .rep { display: flex; gap: 10px; align-items: flex-start; }
    .talk h4 { margin: 0; }
    .talk .line { margin: 6px 0; font-style: italic; }
    .talk .args, .talk .foot { grid-column: 1 / -1; }
    .args { display: flex; flex-wrap: wrap; gap: 6px; }
    .terms { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
    .terms caption { text-align: left; font-weight: 700; }
    .terms th { text-align: left; font-weight: 400; }
    .terms td { text-align: right; }
    .terms th, .terms td { padding: 2px 4px; border-top: 1px solid var(--line); }
    .terms tr.total { font-weight: 700; }
    .terms tr.good td { color: #2d6a2d; font-weight: 700; }
    .terms tr.bad td { color: var(--tomato); font-weight: 700; }
    .patience { font-size: 0.85rem; display: flex; gap: 6px; align-items: center; }
    @media (max-width: 700px) { .talk { grid-template-columns: 1fr; } }
    .bulk { background: var(--basil); color: #fff; font-size: 0.75rem; padding: 0 6px; border-radius: 3px; }
  `,
})
export class StockScreenComponent {
  protected readonly game = inject(GameService);
  private readonly shell = inject(ShellService);
  protected readonly ui = inject(UiService);
  readonly restaurantId = input<number | undefined>(undefined);

  protected readonly categories = INGREDIENT_CATEGORIES;
  protected readonly step = AMOUNT_STEP;
  protected readonly view = signal<View>({ kind: 'overview' });
  protected readonly amounts = signal<Record<string, number>>({});
  protected readonly message = signal('');
  protected readonly buyMode = signal<'once' | 'contract'>('once');
  protected readonly arguments = ARGUMENTS;
  protected readonly patienceMax = PATIENCE;
  protected readonly repColor = 0x6a994e;
  /** A negotiation in progress with the vendor's sales rep. */
  protected readonly talk = signal<{ vendorId: string; items: Record<string, number>; terms: Terms; used: Argument[]; strain: number; line: string; ended: boolean } | null>(null);

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
  /** Expected use a day, from the demand forecast (the same figures the standing order works from). */
  private readonly usage = computed(() => {
    const st = this.game.state();
    const r = this.restaurant();
    return st && r ? forecastUsage(st, r) : {};
  });
  private readonly targets = computed(() => {
    const st = this.game.state();
    const r = this.restaurant();
    return st && r ? restockTargets(st, r) : {};
  });
  protected readonly maxDays = MAX_RESTOCK_DAYS;
  protected readonly forecastText = computed(() => {
    const st = this.game.state();
    const r = this.restaurant();
    if (!st || !r) return '';
    const f = forecastGuests(st, r);
    if (r.menu.length === 0) return 'The menu is empty, so nothing is needed.';
    if (r.closedDays) return 'Closed for repairs: nothing is needed until it reopens.';
    const who = f.assumedStaff ? 'a cook and a waiter' : 'your staff, kitchen and seats';
    return f.capacity < f.demand
      ? `About ${f.demand} guests a day want to come, but ${who} can serve about ${f.capacity}, so the standing order plans for ${f.guests}.`
      : `Expect about ${f.guests} guests a day (${who} could serve about ${f.capacity}).`;
  });
  protected readonly anyCapped = computed(() => this.overview().some((x) => x.capped));

  protected readonly overview = computed(() => {
    const r = this.restaurant();
    if (!r) return [];
    const usage = this.usage();
    const ids = new Set([...Object.keys(r.stock), ...Object.keys(usage)]);
    return INGREDIENTS.filter((i) => ids.has(i.id)).map((i) => {
      const stock = Math.floor(r.stock[i.id] ?? 0);
      const perDay = usage[i.id] ?? 0;
      const fresh = freshDays(r, i.id);
      return { id: i.id, name: i.name, stock, quality: r.stockQuality[i.id] ?? null, perDay: Math.ceil(perDay), days: daysOfSupply(stock, perDay), target: this.targets()[i.id] ?? null, fresh, capped: perDay > 0 && fresh < r.restockDays };
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
      return { id: i.id, name: i.name, price: vendorPrice(v, i.id, st.day), amount, projected, perDay: Math.ceil(usage[i.id] ?? 0), days: daysOfSupply(projected, usage[i.id] ?? 0) };
    });
  });
  protected readonly bulkUnits = BULK_UNITS;
  protected readonly bulkPct = Math.round(BULK_DISCOUNT * 100);
  protected readonly toWarehouse = signal(false);
  protected readonly hasWarehouse = computed(() => {
    const me = this.game.human();
    const r = this.restaurant();
    return !!(me && r && warehouseIn(me, r.cityId));
  });
  protected readonly rep = computed(() => {
    const v = this.vendor();
    const st = this.game.state();
    return v && st ? salesRep(v, st.seed) : null;
  });
  protected readonly contracts = computed(() => {
    const me = this.game.human();
    const r = this.restaurant();
    if (!me || !r) return [];
    return (me.contracts ?? [])
      .filter((c) => c.restaurantId === r.id)
      .map((c) => ({
        id: c.id,
        vendor: this.allVendors().find((v) => v.id === c.vendorId)?.name ?? 'Vendor',
        units: Object.values(c.items).reduce((n, x) => n + x, 0),
        cost: deliveryCost(c, me),
        discount: c.discount,
        daysLeft: c.daysLeft,
        penalty: c.penalty,
      }));
  });
  protected readonly orderUnits = computed(() => Object.values(this.amounts()).reduce((n, x) => n + x, 0));
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
    tools.push(...shopCycleTools(this.mine().map((r) => r.id), this.restaurant()?.id, (id) => this.selectRestaurant(id)));
    if (this.view().kind === 'order') {
      const talk = this.talk();
      if (this.buyMode() === 'once') tools.push({ id: 'order', label: 'Order', icon: ICONS.save, disabled: this.orderTotal() === 0, action: () => this.order() });
      else if (talk) tools.push({ id: 'sign', label: 'Sign', icon: ICONS.pencil, disabled: talk.ended, action: () => this.sign() });
      else tools.push({ id: 'talk', label: 'Talk terms', icon: ICONS.phone, disabled: this.orderTotal() === 0, action: () => this.startTalk() });
    }
    tools.push({ id: 'back', label: 'Back', icon: ICONS.back, action: () => this.back() });
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
    this.talk.set(null);
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
    const error = this.game.placeOrder(r.id, v.id, this.amounts(), this.toWarehouse() && this.hasWarehouse());
    if (error) {
      this.message.set(error);
    } else {
      this.message.set(`Order placed with ${v.name}: delivery ${this.toWarehouse() && this.hasWarehouse() ? 'to the warehouse ' : ''}tomorrow morning.`);
      this.amounts.set({});
    }
  }

  protected setMode(mode: 'once' | 'contract'): void {
    this.buyMode.set(mode);
    this.amounts.set({});
    this.talk.set(null);
    this.message.set('');
  }

  /** Fills the daily amounts with what the restaurant used yesterday. */
  protected fillUsage(): void {
    const amounts: Record<string, number> = {};
    for (const row of this.orderRows()) if (row.price !== null && row.perDay > 0) amounts[row.id] = row.perDay;
    this.amounts.set(amounts);
    if (!Object.keys(amounts).length) this.message.set('Nothing on your menu uses this vendor’s ingredients yet.');
  }

  protected perDay(t: Terms): number {
    const me = this.game.human();
    return me ? deliveryCost(t, me) : 0;
  }

  /** Daily saving against paying list price for the same delivery (negative when the deal costs more). */
  protected saving(t: Terms): number {
    const me = this.game.human();
    return me ? deliveryCost({ dailyValue: t.dailyValue, discount: 0, fee: 0 }, me) - deliveryCost(t, me) : 0;
  }

  protected startTalk(): void {
    const st = this.game.state();
    const me = this.game.human();
    const v = this.vendor();
    const rep = this.rep();
    if (!st || !me || !v || !rep) return;
    this.message.set('');
    if ((relationOf(me, v.id).sulkUntil ?? 0) > st.day) {
      this.message.set(`${rep.name} isn’t taking your calls today. Try again tomorrow.`);
      return;
    }
    const items = Object.fromEntries(Object.entries(this.amounts()).filter(([, n]) => n > 0));
    const value = dailyListPrice(st, v, items);
    if (!value) return;
    if (value < contractMinimum(v)) {
      this.message.set(`${v.name} only signs contracts worth ${formatMoney(contractMinimum(v))} a day or more.`);
      return;
    }
    const terms = openingTerms(st, me, v, value);
    const regular = relationOf(me, v.id).contracts > 0;
    const line = regular
      ? `Good to hear from you again! For a regular, I can do ${this.pct(terms.discount)} off over ${terms.term} days.`
      : `Glad you called. For a new customer I can offer ${this.pct(terms.discount)} off for ${terms.term} days. Have a look at the terms.`;
    this.talk.set({ vendorId: v.id, items, terms, used: [], strain: 0, line, ended: false });
  }

  protected haggle(arg: Argument): void {
    const t = this.talk();
    const st = this.game.state();
    const me = this.game.human();
    const v = this.vendor();
    const rep = this.rep();
    if (!t || t.ended || !st || !me || !v || !rep) return;
    const reply = argue(st, me, v, rep, t.terms, arg, t.used, t.strain);
    const ended = !!reply.ended;
    this.talk.set({ ...t, terms: reply.terms, used: [...t.used, arg], strain: Math.min(PATIENCE, t.strain + reply.strain), line: reply.text, ended });
    if (ended) this.game.sulk(v.id);
  }

  protected sign(): void {
    const t = this.talk();
    const r = this.restaurant();
    const v = this.vendor();
    if (!t || t.ended || !r || !v) return;
    const error = this.game.signContract(r.id, v.id, t.items, t.terms);
    if (error) {
      this.message.set(error);
      return;
    }
    this.talk.set(null);
    this.amounts.set({});
    this.message.set(`Contract signed with ${v.name}. The first delivery arrives tomorrow morning.`);
  }

  protected cancelContract(id: number, penalty: number): void {
    if (confirm(`Cancel this contract? You'll pay a penalty of ${formatMoney(penalty)}.`)) this.game.cancelContract(id);
  }

  protected contractMin(v: Vendor): number {
    return contractMinimum(v);
  }

  protected pct(n: number): string {
    return `${Math.round(n * 100)}%`;
  }

  protected setAutoRestock(on: boolean): void {
    const r = this.restaurant();
    if (r) this.game.updateRestaurant(r.id, (x) => (x.autoRestock = on));
  }

  protected setDays(n: number): void {
    const r = this.restaurant();
    if (r && Number.isFinite(n)) this.game.updateRestaurant(r.id, (x) => (x.restockDays = Math.max(1, Math.min(MAX_RESTOCK_DAYS, Math.round(n)))));
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
