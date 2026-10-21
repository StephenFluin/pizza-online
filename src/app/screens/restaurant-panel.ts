import { Component, computed, inject, input, signal } from '@angular/core';
import { INGREDIENTS, cityDef, ingredient } from '../game/data';
import { GameService } from '../game/game.service';
import { UiService } from '../game/ui.service';
import { Restaurant, formatMoney } from '../game/model';
import { recipeCost, recipeQuality } from '../game/recipes';

type Tab = 'overview' | 'staff' | 'menu' | 'stock';

const DECOR_NAMES = ['Bare', 'Cosy', 'Stylish', 'Luxurious'];

/** Management panel for one of the player's restaurants. */
@Component({
  selector: 'app-restaurant-panel',
  template: `
    @let r = restaurant();
    @if (r) {
      <h2 id="rest-title">{{ r.name }}</h2>
      <div class="tabs" role="tablist" aria-labelledby="rest-title">
        @for (t of tabs; track t.id) {
          <button
            type="button"
            role="tab"
            [id]="'tab-' + t.id"
            [attr.aria-selected]="tab() === t.id"
            [attr.aria-controls]="'tabpanel-' + t.id"
            [attr.tabindex]="tab() === t.id ? 0 : -1"
            (click)="tab.set(t.id)"
            (keydown)="tabKey($event)"
          >
            {{ t.label }}
          </button>
        }
      </div>

      <div
        role="tabpanel"
        [id]="'tabpanel-' + tab()"
        [attr.aria-labelledby]="'tab-' + tab()"
        class="tabpanel"
      >
        @switch (tab()) {
          @case ('overview') {
            @if (setup(); as s) {
              <div class="warn" role="status">
                <p>{{ s.text }}</p>
                <button type="button" class="small" (click)="s.run()">{{ s.label }}</button>
              </div>
            }
            <div class="buttons">
              <button type="button" (click)="ui.open({ kind: 'interior', restaurantId: r.id })">
                View inside
              </button>
              <button
                type="button"
                class="secondary"
                (click)="ui.open({ kind: 'capacity', restaurantId: r.id })"
              >
                Capacity
              </button>
              <button
                type="button"
                class="secondary"
                (click)="ui.open({ kind: 'stats', restaurantId: r.id })"
              >
                Statistics
              </button>
            </div>
            <dl>
              <dt>Reputation</dt>
              <dd>
                <meter
                  min="0"
                  max="1"
                  [value]="r.reputation"
                  [attr.aria-label]="'Reputation'"
                ></meter>
                {{ pct(r.reputation) }} · {{ stars() }}
              </dd>
              <dt>Popularity</dt>
              <dd>
                <b>{{ signed(r.popularity.total) }}</b> points
              </dd>
              <dt>Yesterday</dt>
              <dd>{{ r.lastDay.customers }} guests · {{ money(r.lastDay.revenue) }}</dd>
              <dt>Turned away</dt>
              <dd>{{ r.lastDay.turnedAway }}</dd>
              <dt>Today so far</dt>
              <dd>{{ r.today.customers }} guests · {{ money(r.today.revenue) }}</dd>
              <dt>Staff</dt>
              <dd>{{ cooks() }} cooks, {{ waiters() }} waiters</dd>
              <dt>Seats</dt>
              <dd>{{ r.seats }}</dd>
              <dt>Kitchen</dt>
              <dd>{{ r.kitchenCapacity }} pizzas/hour</dd>
              <dt>Atmosphere</dt>
              <dd>{{ decorName() }}</dd>
              <dt>Premises</dt>
              <dd>{{ r.owned ? 'Owned' : 'Rented' }}</dd>
            </dl>
            <table class="pop">
              <caption>
                Popularity breakdown
              </caption>
              <tbody>
                <tr>
                  <th scope="row">
                    Waiting time ({{ r.popularity.waitMinutes }} of
                    {{ r.popularity.expectedMinutes }} min)
                  </th>
                  <td>{{ signed(r.popularity.waiting) }}</td>
                </tr>
                <tr>
                  <th scope="row">Menu choice</th>
                  <td>{{ signed(r.popularity.menu) }}</td>
                </tr>
                <tr>
                  <th scope="row">Advertising</th>
                  <td>{{ signed(r.popularity.advertising) }}</td>
                </tr>
                <tr>
                  <th scope="row">Star rating</th>
                  <td>{{ signed(r.popularity.stars) }}</td>
                </tr>
                <tr>
                  <th scope="row">Demand met</th>
                  <td>{{ signed(r.popularity.fulfilment) }}</td>
                </tr>
                @if (r.popularity.prestige) {
                  <tr>
                    <th scope="row">Mayor’s favour and awards</th>
                    <td>{{ signed(r.popularity.prestige) }}</td>
                  </tr>
                }
                @if (r.popularity.supervision) {
                  <tr>
                    <th scope="row">Owner stretched too thin</th>
                    <td>{{ signed(r.popularity.supervision) }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <button type="button" class="secondary close" (click)="close()">
              Close this pizzeria down
            </button>
          }
          @case ('staff') {
            <p>
              {{ cooks() }} cooks, {{ waiters() }} waiters{{
                hasManager() ? ' and a manager' : ''
              }}. Payroll {{ money(payroll()) }} a month.
            </p>
            <button type="button" (click)="ui.open({ kind: 'staff', restaurantId: r.id })">
              Manage staff
            </button>
          }
          @case ('menu') {
            <ul class="rows">
              @for (row of menuRows(); track row.recipe.id) {
                <li>
                  <label class="check">
                    <input
                      type="checkbox"
                      [checked]="row.price !== null"
                      (change)="toggleMenu(row.recipe.id, $any($event.target).checked)"
                    />
                    <span
                      ><b>{{ row.recipe.name }}</b> · quality {{ pct(row.quality) }} · cost
                      {{ money2(row.cost) }}</span
                    >
                  </label>
                  @if (row.price !== null) {
                    <label class="price">
                      <span class="sr-only">Price of {{ row.recipe.name }}</span>
                      $<input
                        type="number"
                        min="1"
                        max="99"
                        step="0.5"
                        [value]="row.price"
                        (change)="setPrice(row.recipe.id, $any($event.target).valueAsNumber)"
                      />
                    </label>
                  }
                </li>
              }
            </ul>
          }
          @case ('stock') {
            <p>{{ stockSummary() }}</p>
            <p>
              {{
                r.autoRestock
                  ? 'A standing order keeps ' +
                    r.restockDays +
                    ' day' +
                    (r.restockDays === 1 ? '' : 's') +
                    ' of expected use in stock, topped up each morning.'
                  : 'No standing order: stock only arrives when you order it.'
              }}
            </p>
            <button type="button" (click)="ui.open({ kind: 'stock', restaurantId: r.id })">
              Buy stock
            </button>
          }
        }
      </div>
    }
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .tabs button {
      padding: 4px 10px;
      background: transparent;
      color: var(--ink);
      border-color: var(--line);
    }
    .tabs button[aria-selected='true'] {
      background: var(--ink);
      color: var(--cream);
      border-color: var(--ink);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      margin: 0 0 12px;
    }
    dt {
      font-weight: 600;
    }
    dd {
      margin: 0;
    }
    .rows {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .rows li {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
      border-top: 1px solid var(--line);
    }
    .small {
      padding: 2px 8px;
      font-size: 0.85rem;
    }
    .check {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .price input,
    .qty {
      width: 64px;
      font: inherit;
      padding: 2px 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 0.9rem;
    }
    th,
    td {
      text-align: left;
      padding: 3px 4px;
      border-top: 1px solid var(--line);
    }
    .buttons {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .pop {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 0.9rem;
    }
    .pop caption {
      text-align: left;
      font-weight: 600;
    }
    .pop th {
      text-align: left;
      font-weight: 400;
    }
    .pop td {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .pop th,
    .pop td {
      border-top: 1px solid var(--line);
      padding: 2px 0;
    }
    .warn {
      background: #fff0c2;
      border-left: 4px solid #b7791f;
      padding: 6px 8px;
      margin-bottom: 8px;
    }
    .warn p {
      margin: 0 0 4px;
    }
    .buttons {
      margin-bottom: 10px;
    }
    .close {
      margin-top: 8px;
      display: block;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class RestaurantPanelComponent {
  protected readonly game = inject(GameService);
  readonly restaurantId = input.required<number>();
  /** Re-evaluates on every state change because the state is mutated in place. */
  protected readonly restaurant = computed(
    () => this.game.state()!.restaurants.find((r) => r.id === this.restaurantId()) as Restaurant,
    { equal: () => false },
  );

  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'staff', label: 'Staff' },
    { id: 'menu', label: 'Menu' },
    { id: 'stock', label: 'Stock' },
  ];
  protected readonly tab = signal<Tab>('overview');
  protected readonly ingredients = INGREDIENTS;

  protected readonly col = computed(() => cityDef(this.restaurant().cityId).costOfLiving);
  protected readonly cooks = computed(
    () => this.restaurant().staff.filter((s) => s.role === 'cook').length,
  );
  protected readonly waiters = computed(
    () => this.restaurant().staff.filter((s) => s.role === 'waiter').length,
  );
  protected readonly ui = inject(UiService);
  protected readonly decorName = computed(
    () => DECOR_NAMES[Math.min(3, Math.floor(this.restaurant().decor))],
  );
  protected readonly hasManager = computed(() =>
    this.restaurant().staff.some((s) => s.role === 'manager'),
  );
  protected readonly payroll = computed(() =>
    this.restaurant().staff.reduce((n, s) => n + s.wagePerMonth, 0),
  );
  /** The first thing stopping the restaurant from serving, with a button that goes to the fix. */
  protected readonly setup = computed<{ text: string; label: string; run: () => void } | null>(
    () => {
      const r = this.restaurant();
      const staff = () => this.ui.open({ kind: 'staff', restaurantId: r.id });
      const inside = () => this.ui.open({ kind: 'interior', restaurantId: r.id });
      if (this.cooks() === 0 && this.waiters() === 0)
        return {
          text: 'Hire a cook and a waiter before this pizzeria can serve anyone.',
          label: 'Hire staff',
          run: staff,
        };
      if (this.cooks() === 0)
        return {
          text: 'There’s nobody to bake the pizzas. Hire a cook.',
          label: 'Hire a cook',
          run: staff,
        };
      if (this.waiters() === 0)
        return {
          text: 'There’s nobody to serve the tables. Hire a waiter.',
          label: 'Hire a waiter',
          run: staff,
        };
      if (r.kitchenCapacity === 0)
        return {
          text: 'The kitchen needs an oven and a prep counter.',
          label: 'Furnish the kitchen',
          run: inside,
        };
      if (r.seats === 0)
        return {
          text: 'There are no tables and chairs for guests.',
          label: 'Buy furniture',
          run: inside,
        };
      if (r.menu.length === 0)
        return {
          text: 'The menu is empty.',
          label: 'Choose pizzas',
          run: () => this.tab.set('menu'),
        };
      if (!r.autoRestock && Object.keys(r.stock).length === 0)
        return {
          text: 'The pantry is empty and there’s no standing order.',
          label: 'Buy stock',
          run: () => this.ui.open({ kind: 'stock', restaurantId: r.id }),
        };
      return null;
    },
  );
  protected readonly menuRows = computed(() => {
    const st = this.game.state();
    const r = this.restaurant();
    return (st?.recipes ?? [])
      .filter((x) => x.ownerId === null || x.ownerId === r.ownerId)
      .map((recipe) => ({
        recipe,
        price: r.menu.find((m) => m.recipeId === recipe.id)?.price ?? null,
        quality: recipeQuality(recipe),
        cost: recipeCost(recipe) * this.col(),
      }));
  });

  protected toggleMenu(recipeId: string, on: boolean): void {
    this.game.updateRestaurant(this.restaurant().id, (r) => {
      r.menu = on
        ? [...r.menu, { recipeId, price: Math.round(8 * this.col()) }]
        : r.menu.filter((m) => m.recipeId !== recipeId);
    });
  }

  protected setPrice(recipeId: string, price: number): void {
    if (!Number.isFinite(price) || price <= 0) return;
    this.game.updateRestaurant(this.restaurant().id, (r) => {
      const item = r.menu.find((m) => m.recipeId === recipeId);
      if (item) item.price = Math.min(99, price);
    });
  }

  protected readonly stockSummary = computed(() => {
    const r = this.restaurant();
    const units = Math.floor(Object.values(r.stock).reduce((n, x) => n + x, 0));
    const kinds = Object.keys(r.stock).length;
    return kinds ? `${units} units of ${kinds} ingredients in stock.` : 'The pantry is empty.';
  });

  protected close(): void {
    if (confirm(`Close ${this.restaurant().name}? Staff will be let go.`))
      this.game.closeRestaurant(this.restaurant().id);
  }

  protected tabKey(ev: KeyboardEvent): void {
    const i = this.tabs.findIndex((t) => t.id === this.tab());
    const next = ev.key === 'ArrowRight' ? i + 1 : ev.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    const t = this.tabs[(next + this.tabs.length) % this.tabs.length];
    this.tab.set(t.id);
    (ev.currentTarget as HTMLElement).parentElement
      ?.querySelector<HTMLElement>(`#tab-${t.id}`)
      ?.focus();
    ev.preventDefault();
  }

  protected readonly stars = computed(() => {
    const n = this.restaurant().popularity.starCount;
    return n ? '★'.repeat(n) + '☆'.repeat(5 - n) : 'no stars yet';
  });

  protected signed(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }

  protected pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  protected money(n: number): string {
    return formatMoney(n);
  }

  protected money2(n: number): string {
    return `$${n.toFixed(2)}`;
  }

  protected readonly ingredientName = (id: string) => ingredient(id).name;
}
