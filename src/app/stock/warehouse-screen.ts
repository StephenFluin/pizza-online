import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { CITIES, INGREDIENTS, cityDef, ingredient } from '../game/data';
import { GameService } from '../game/game.service';
import { formatMoney } from '../game/model';
import { UiService } from '../game/ui.service';
import {
  BULK_DISCOUNT,
  BULK_UNITS,
  SHIPPING_DAYS,
  SHIPPING_PER_UNIT,
  WAREHOUSE_SIZES,
  WarehouseSize,
  used,
  warehouseIn,
  warehouseRent,
} from '../game/warehouse';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';

/** A city's warehouse: rent one, see its stock, set who gets supplied first, ship to other cities. */
@Component({
  selector: 'app-warehouse-screen',
  template: `
    <div class="wh">
      <header class="head">
        <label
          >City
          <select [value]="cityId()" (change)="cityId.set($any($event.target).value)">
            @for (c of cities; track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </label>
      </header>

      @if (warehouse(); as w) {
        <section class="box" aria-labelledby="wh-title">
          <h3 id="wh-title">{{ sizes[w.size].label }} in {{ cityName() }}</h3>
          <p>
            {{ usedUnits() }} of {{ capacity() }} units used · rent {{ money(rent()) }} a month ·
            cold storage keeps stock three times longer
          </p>
          <meter min="0" [max]="capacity()" [value]="usedUnits()" aria-label="Space used"></meter>
          <p class="hint">
            Order from vendors with “Deliver to warehouse” on the stock screen.
            {{ bulkUnits }} units or more in one order get {{ bulkPct }}% off.
          </p>
        </section>

        <div class="cols">
          <section class="box" aria-labelledby="whstock-title">
            <h3 id="whstock-title">Stock</h3>
            <table class="ledger">
              <thead>
                <tr>
                  <th scope="col">Ingredient</th>
                  <th scope="col">Units</th>
                  <th scope="col">Quality</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.id) {
                  <tr>
                    <th scope="row">{{ row.name }}</th>
                    <td>{{ row.units }}</td>
                    <td>{{ row.quality }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3">Empty.</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>

          <section class="box" aria-labelledby="prio-title">
            <h3 id="prio-title">Supplies restaurants in this order</h3>
            <ol class="prio">
              @for (r of priority(); track r.id; let i = $index; let last = $last) {
                <li>
                  <span>{{ r.name }}</span>
                  <button
                    type="button"
                    class="tiny"
                    (click)="game.movePriority(cityId(), r.id, -1)"
                    [disabled]="i === 0"
                    [attr.aria-label]="'Move ' + r.name + ' up'"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    class="tiny"
                    (click)="game.movePriority(cityId(), r.id, 1)"
                    [disabled]="last"
                    [attr.aria-label]="'Move ' + r.name + ' down'"
                  >
                    ▼
                  </button>
                </li>
              } @empty {
                <li>No restaurants in {{ cityName() }} yet.</li>
              }
            </ol>
            <p class="hint">
              Each morning every restaurant is topped up to its restock target before any standing
              order buys from vendors.
            </p>

            <h3>Ship to another city</h3>
            @if (otherWarehouses().length) {
              <div class="ship">
                <select
                  [value]="shipItem()"
                  (change)="shipItem.set($any($event.target).value)"
                  aria-label="Ingredient to ship"
                >
                  @for (row of rows(); track row.id) {
                    <option [value]="row.id">{{ row.name }}</option>
                  }
                </select>
                <input
                  type="number"
                  min="1"
                  [value]="shipUnits()"
                  (change)="shipUnits.set($any($event.target).valueAsNumber)"
                  aria-label="Units to ship"
                />
                <select
                  [value]="shipTo()"
                  (change)="shipTo.set($any($event.target).value)"
                  aria-label="Destination"
                >
                  @for (c of otherWarehouses(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
                <button type="button" class="tiny" (click)="doShip()" [disabled]="!rows().length">
                  Ship
                </button>
              </div>
              <p class="hint">
                Freight costs {{ money2(shippingPerUnit) }} a unit and takes
                {{ shippingDays }} days.
              </p>
            } @else {
              <p class="hint">Rent a warehouse in another city to ship stock between them.</p>
            }
          </section>
        </div>
        <button type="button" class="secondary" (click)="giveUp()">Give up this warehouse</button>
      } @else {
        <section class="box" aria-labelledby="rent-title">
          <h3 id="rent-title">Rent a warehouse in {{ cityName() }}</h3>
          <p>
            A warehouse takes bulk deliveries at a discount, keeps stock fresh for longer, and
            supplies your restaurants here each morning.
          </p>
          <ul class="sizes">
            @for (s of sizeList; track s.id) {
              <li>
                <b>{{ s.label }}</b> · {{ s.capacity }} units · {{ money(rentFor(s.id)) }} a month
                <button
                  type="button"
                  class="tiny"
                  (click)="takeLease(s.id)"
                  [disabled]="cash() < rentFor(s.id)"
                >
                  Rent
                </button>
              </li>
            }
          </ul>
        </section>
      }
      <p role="status" class="msg">{{ message() }}</p>
    </div>
  `,
  styles: `
    .wh {
      display: grid;
      gap: 10px;
    }
    .head select {
      font: inherit;
      padding: 4px;
      margin-left: 6px;
    }
    .box {
      background: #fffaf0;
      border: 2px solid var(--line);
      padding: 8px 10px;
    }
    .box h3 {
      margin: 0 0 6px;
      font-size: 1rem;
    }
    .box p {
      margin: 0 0 6px;
    }
    meter {
      width: 100%;
    }
    .hint {
      font-size: 0.85rem;
      color: #555;
    }
    .cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 10px;
      align-items: start;
    }
    .ledger {
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font-lcd);
      font-size: 1.15rem;
    }
    .ledger th,
    .ledger td {
      padding: 1px 6px;
      border-bottom: 1px solid var(--line);
      text-align: right;
    }
    .ledger th[scope='row'],
    .ledger thead th:first-child {
      text-align: left;
    }
    .ledger thead th {
      background: #2b1d14;
      color: var(--lcd-text);
      font-weight: 400;
    }
    .prio {
      margin: 0 0 6px;
      padding-left: 20px;
      display: grid;
      gap: 3px;
    }
    .prio li span {
      margin-right: 6px;
    }
    .tiny {
      padding: 0 8px;
      font-size: 0.85rem;
    }
    .ship {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .ship input {
      width: 80px;
      font: inherit;
    }
    .ship select {
      font: inherit;
    }
    .sizes {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .msg {
      margin: 0;
      min-height: 1.3em;
    }
  `,
})
export class WarehouseScreenComponent {
  protected readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);
  readonly startCity = input<string | undefined>(undefined);

  protected readonly cities = CITIES;
  protected readonly sizes = WAREHOUSE_SIZES;
  protected readonly sizeList = (Object.keys(WAREHOUSE_SIZES) as WarehouseSize[]).map((id) => ({
    id,
    ...WAREHOUSE_SIZES[id],
  }));
  protected readonly bulkUnits = BULK_UNITS;
  protected readonly bulkPct = Math.round(BULK_DISCOUNT * 100);
  protected readonly shippingDays = SHIPPING_DAYS;
  protected readonly shippingPerUnit = SHIPPING_PER_UNIT;

  protected readonly cityId = linkedSignal(
    () => this.startCity() ?? this.game.state()?.currentCityId ?? 'rome',
  );
  protected readonly cityName = computed(() => cityDef(this.cityId()).name);
  protected readonly message = signal('');
  protected readonly cash = computed(() => this.game.human()?.cash ?? 0);
  protected readonly warehouse = computed(
    () => {
      this.game.state();
      const me = this.game.human();
      return me ? warehouseIn(me, this.cityId()) : null;
    },
    { equal: () => false },
  );
  protected readonly capacity = computed(() =>
    this.warehouse() ? WAREHOUSE_SIZES[this.warehouse()!.size].capacity : 0,
  );
  protected readonly usedUnits = computed(() => (this.warehouse() ? used(this.warehouse()!) : 0));
  protected readonly rent = computed(() =>
    this.warehouse() ? warehouseRent(this.warehouse()!) : 0,
  );
  protected readonly rows = computed(() => {
    const w = this.warehouse();
    if (!w) return [];
    return INGREDIENTS.filter((i) => (w.stock[i.id] ?? 0) >= 1).map((i) => ({
      id: i.id,
      name: i.name,
      units: Math.floor(w.stock[i.id]),
      quality: w.stockQuality[i.id] ?? '—',
    }));
  });
  protected readonly priority = computed(() => {
    const w = this.warehouse();
    const st = this.game.state();
    if (!w || !st) return [];
    const mine = st.restaurants.filter(
      (r) => r.ownerId === this.game.human()?.id && r.cityId === w.cityId,
    );
    // Restaurants not yet in the list (opened today) go last until the next morning.
    return [
      ...w.priority
        .map((id) => mine.find((r) => r.id === id))
        .filter((r): r is NonNullable<typeof r> => !!r),
      ...mine.filter((r) => !w.priority.includes(r.id)),
    ];
  });
  protected readonly otherWarehouses = computed(() => {
    const me = this.game.human();
    return CITIES.filter((c) => c.id !== this.cityId() && me && warehouseIn(me, c.id));
  });
  protected readonly shipItem = linkedSignal(() => this.rows()[0]?.id ?? '');
  protected readonly shipTo = linkedSignal(() => this.otherWarehouses()[0]?.id ?? '');
  protected readonly shipUnits = signal(100);

  private readonly lines = computed<LcdLine[]>(() => [
    { label: 'Warehouse' },
    { label: this.cityName() },
    { label: 'Space', value: this.warehouse() ? `${this.usedUnits()}/${this.capacity()}` : 'none' },
    { label: 'Rent', value: this.warehouse() ? formatMoney(this.rent()) : '—' },
  ]);
  private readonly tools = computed<Tool[]>(() => [
    { id: 'stock', label: 'Stock', icon: ICONS.box, action: () => this.ui.open({ kind: 'stock' }) },
    {
      id: 'back',
      label: 'Back',
      icon: ICONS.back,
      action: () =>
        this.game.dayReport() !== null ? this.ui.open({ kind: 'report' }) : this.ui.close(),
    },
  ]);

  constructor() {
    inject(DestroyRef).onDestroy(
      this.shell.register(this, { lines: this.lines, tools: this.tools }),
    );
  }

  protected rentFor(size: WarehouseSize): number {
    return warehouseRent({ size, cityId: this.cityId() });
  }

  protected takeLease(size: WarehouseSize): void {
    this.message.set(
      this.game.rentWarehouse(this.cityId(), size)
        ? `Warehouse rented in ${this.cityName()}.`
        : 'Could not rent the warehouse.',
    );
  }

  protected giveUp(): void {
    if (confirm(`Give up the ${this.cityName()} warehouse? Anything still inside is lost.`)) {
      this.game.closeWarehouse(this.cityId());
      this.message.set('Warehouse given up.');
    }
  }

  protected doShip(): void {
    const error = this.game.shipStock(
      this.cityId(),
      this.shipTo(),
      this.shipItem(),
      Math.max(1, Math.round(this.shipUnits() || 0)),
    );
    this.message.set(
      error ??
        `On its way to ${cityDef(this.shipTo()).name}: ${ingredient(this.shipItem()).name}, arriving in ${SHIPPING_DAYS} days.`,
    );
  }

  protected money(n: number): string {
    return formatMoney(n);
  }

  protected money2(n: number): string {
    return `$${n.toFixed(2)}`;
  }
}
