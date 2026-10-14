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
        >{{ t.label }}</button>
      }
    </div>

    <div role="tabpanel" [id]="'tabpanel-' + tab()" [attr.aria-labelledby]="'tab-' + tab()" class="tabpanel">
      @switch (tab()) {
        @case ('overview') {
          <dl>
            <dt>Reputation</dt><dd><meter min="0" max="1" [value]="r.reputation" [attr.aria-label]="'Reputation'"></meter> {{ pct(r.reputation) }}</dd>
            <dt>Yesterday</dt><dd>{{ r.lastDay.customers }} guests · {{ money(r.lastDay.revenue) }}</dd>
            <dt>Turned away</dt><dd>{{ r.lastDay.turnedAway }}</dd>
            <dt>Today so far</dt><dd>{{ r.today.customers }} guests · {{ money(r.today.revenue) }}</dd>
            <dt>Staff</dt><dd>{{ cooks() }} cooks, {{ waiters() }} waiters</dd>
            <dt>Seats</dt><dd>{{ r.seats }}</dd>
            <dt>Kitchen</dt><dd>{{ r.kitchenCapacity }} pizzas/hour</dd>
            <dt>Atmosphere</dt><dd>{{ decorName() }}</dd>
            <dt>Premises</dt><dd>{{ r.owned ? 'Owned' : 'Rented' }}</dd>
          </dl>
          @if (warning(); as w) {
            <p class="warn" role="status">{{ w }}</p>
          }
          <button type="button" (click)="ui.open({ kind: 'interior', restaurantId: r.id })">View restaurant</button>
          <button type="button" class="secondary close" (click)="close()">Close restaurant</button>
        }
        @case ('staff') {
          <h3>Employees</h3>
          @if (r.staff.length === 0) {
            <p>Nobody works here yet.</p>
          }
          <ul class="rows">
            @for (s of r.staff; track s.id) {
              <li>
                <span><b>{{ s.name }}</b> · {{ s.role }} · skill {{ pct(s.skill) }} · {{ money(s.wagePerMonth) }}/mo</span>
                <button type="button" class="secondary small" (click)="game.fire(r.id, s.id)" [attr.aria-label]="'Fire ' + s.name">Fire</button>
              </li>
            }
          </ul>
          <h3>Applicants</h3>
          <ul class="rows">
            @for (s of applicants(); track s.id) {
              <li>
                <span><b>{{ s.name }}</b> · {{ s.role }} · skill {{ pct(s.skill) }} · {{ money(s.wagePerMonth) }}/mo</span>
                <button type="button" class="small" (click)="game.hire(r.id, s)" [attr.aria-label]="'Hire ' + s.name">Hire</button>
              </li>
            } @empty {
              <li>No applicants this week.</li>
            }
          </ul>
        }
        @case ('menu') {
          <ul class="rows">
            @for (row of menuRows(); track row.recipe.id) {
              <li>
                <label class="check">
                  <input type="checkbox" [checked]="row.price !== null" (change)="toggleMenu(row.recipe.id, $any($event.target).checked)" />
                  <span><b>{{ row.recipe.name }}</b> · quality {{ pct(row.quality) }} · cost {{ money2(row.cost) }}</span>
                </label>
                @if (row.price !== null) {
                  <label class="price">
                    <span class="sr-only">Price of {{ row.recipe.name }}</span>
                    $<input type="number" min="1" max="99" step="0.5" [value]="row.price" (change)="setPrice(row.recipe.id, $any($event.target).valueAsNumber)" />
                  </label>
                }
              </li>
            }
          </ul>
        }
        @case ('stock') {
          <label class="check">
            <input type="checkbox" [checked]="r.autoRestock" (change)="setAutoRestock($any($event.target).checked)" />
            Restock automatically each morning to
            <input class="qty" type="number" min="5" max="500" step="5" [value]="r.restockTarget" (change)="setTarget($any($event.target).valueAsNumber)" aria-label="Restock target portions" />
            portions
          </label>
          <table>
            <caption class="sr-only">Ingredient stock</caption>
            <thead><tr><th scope="col">Ingredient</th><th scope="col">Stock</th><th scope="col">Price</th><th scope="col"><span class="sr-only">Buy</span></th></tr></thead>
            <tbody>
              @for (i of ingredients; track i.id) {
                <tr>
                  <th scope="row">{{ i.name }}</th>
                  <td>{{ stockOf(i.id) }}</td>
                  <td>{{ money2(i.cost * col()) }}</td>
                  <td><button type="button" class="small" (click)="game.buy(r.id, i.id, 20)" [attr.aria-label]="'Buy 20 ' + i.name">+20</button></td>
                </tr>
              }
            </tbody>
          </table>
        }
      }
    </div>
    }
  `,
  styles: `
    .tabs { display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; }
    .tabs button { padding: 4px 10px; background: transparent; color: var(--ink); border-color: var(--line); }
    .tabs button[aria-selected='true'] { background: var(--ink); color: var(--cream); border-color: var(--ink); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 0 12px; }
    dt { font-weight: 600; }
    dd { margin: 0; }
    .rows { list-style: none; padding: 0; margin: 0; }
    .rows li { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 6px 0; border-top: 1px solid var(--line); }
    .small { padding: 2px 8px; font-size: 0.85rem; }
    .check { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .price input, .qty { width: 64px; font: inherit; padding: 2px 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.9rem; }
    th, td { text-align: left; padding: 3px 4px; border-top: 1px solid var(--line); }
    .warn { background: #fff0c2; border-left: 4px solid #b7791f; padding: 6px 8px; }
    .close { margin-top: 8px; display: block; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
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
  protected readonly cooks = computed(() => this.restaurant().staff.filter((s) => s.role === 'cook').length);
  protected readonly waiters = computed(() => this.restaurant().staff.filter((s) => s.role === 'waiter').length);
  protected readonly ui = inject(UiService);
  protected readonly decorName = computed(() => DECOR_NAMES[Math.min(3, Math.floor(this.restaurant().decor))]);
  protected readonly applicants = computed(() => this.game.applicantsFor(this.restaurant()));
  protected readonly warning = computed(() => {
    const r = this.restaurant();
    if (this.cooks() === 0 || this.waiters() === 0) return 'You need at least one cook and one waiter to serve guests.';
    if (r.kitchenCapacity === 0) return 'Your kitchen needs an oven and a prep counter. Open the restaurant view to buy them.';
    if (r.seats === 0) return 'There are no tables. Open the restaurant view to buy some.';
    if (r.menu.length === 0) return 'Your menu is empty.';
    if (!r.autoRestock && Object.keys(r.stock).length === 0) return 'Your pantry is empty. Buy ingredients in the Stock tab.';
    return null;
  });
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

  protected stockOf(id: string): number {
    return Math.floor(this.restaurant().stock[id] ?? 0);
  }

  protected toggleMenu(recipeId: string, on: boolean): void {
    this.game.updateRestaurant(this.restaurant().id, (r) => {
      r.menu = on ? [...r.menu, { recipeId, price: Math.round(8 * this.col()) }] : r.menu.filter((m) => m.recipeId !== recipeId);
    });
  }

  protected setPrice(recipeId: string, price: number): void {
    if (!Number.isFinite(price) || price <= 0) return;
    this.game.updateRestaurant(this.restaurant().id, (r) => {
      const item = r.menu.find((m) => m.recipeId === recipeId);
      if (item) item.price = Math.min(99, price);
    });
  }

  protected setAutoRestock(on: boolean): void {
    this.game.updateRestaurant(this.restaurant().id, (r) => (r.autoRestock = on));
  }

  protected setTarget(n: number): void {
    if (!Number.isFinite(n)) return;
    this.game.updateRestaurant(this.restaurant().id, (r) => (r.restockTarget = Math.max(5, Math.min(500, Math.round(n)))));
  }

  protected close(): void {
    if (confirm(`Close ${this.restaurant().name}? Staff will be let go.`)) this.game.closeRestaurant(this.restaurant().id);
  }

  protected tabKey(ev: KeyboardEvent): void {
    const i = this.tabs.findIndex((t) => t.id === this.tab());
    const next = ev.key === 'ArrowRight' ? i + 1 : ev.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    const t = this.tabs[(next + this.tabs.length) % this.tabs.length];
    this.tab.set(t.id);
    (ev.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>(`#tab-${t.id}`)?.focus();
    ev.preventDefault();
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
