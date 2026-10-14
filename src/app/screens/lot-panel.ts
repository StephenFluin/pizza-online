import { Component, computed, inject } from '@angular/core';
import { ingredient } from '../game/data';
import { GameService } from '../game/game.service';
import { formatMoney } from '../game/model';
import { RestaurantPanelComponent } from './restaurant-panel';

/** Details for the selected lot: rent/buy an empty lot, manage your own restaurant or inspect a rival's. */
@Component({
  selector: 'app-lot-panel',
  imports: [RestaurantPanelComponent],
  template: `
    @if (lot(); as lot) {
      <section class="panel" aria-label="Selected location">
        @if (restaurant(); as r) {
          @if (r.ownerId === game.human()?.id) {
            <app-restaurant-panel [restaurantId]="r.id" />
          } @else {
            <h2>{{ r.name }}</h2>
            <p>A rival pizzeria run by {{ ownerName(r.ownerId) }}.</p>
            <dl>
              <dt>Reputation</dt><dd>{{ pct(r.reputation) }}</dd>
              <dt>Yesterday</dt><dd>{{ r.lastDay.customers }} guests</dd>
            </dl>
          }
        } @else {
          <h2>Lot in {{ district()?.name }}</h2>
          <dl>
            <dt>Seats</dt><dd>{{ lot.seats }}</dd>
            <dt>Rent</dt><dd>{{ money(lot.rentPerMonth) }} / month</dd>
            <dt>Price</dt><dd>{{ money(lot.purchasePrice) }}</dd>
          </dl>
          <div class="actions">
            <button type="button" (click)="open(false)" [disabled]="cash() < lot.rentPerMonth">Rent</button>
            <button type="button" (click)="open(true)" [disabled]="cash() < lot.purchasePrice">Buy</button>
          </div>
        }
        @if (district(); as d) {
          <h3>District: {{ d.name }}</h3>
          <dl>
            <dt>Residents</dt><dd>{{ d.population.toLocaleString('en-US') }}</dd>
            <dt>Wealth</dt><dd>{{ wealthLabel() }}</dd>
            <dt>Loves</dt><dd>{{ favourites() }}</dd>
            <dt>Dislikes</dt><dd>{{ dislikes() }}</dd>
          </dl>
        }
        <button type="button" class="secondary" (click)="game.selectLot(null)">Back to overview</button>
      </section>
    } @else {
      <section class="panel" aria-labelledby="overview-title">
        <h2 id="overview-title">Your pizzerias</h2>
        <ul class="lots">
          @for (r of mine(); track r.id) {
            <li><button type="button" class="link" (click)="game.selectLot(r.lotId)">{{ r.name }} · {{ r.lastDay.customers }} guests yesterday</button></li>
          } @empty {
            <li>None yet. Drag the map and click an empty lot (with a sign), or pick one below.</li>
          }
        </ul>
        <h3>Available lots</h3>
        <ul class="lots">
          @for (l of freeLots(); track l.id) {
            <li><button type="button" class="link" (click)="game.selectLot(l.id)">{{ districtName(l.district) }} · {{ l.seats }} seats · {{ money(l.rentPerMonth) }}/mo</button></li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 0 12px; }
    dt { font-weight: 600; }
    dd { margin: 0; }
    .actions { display: flex; gap: 8px; margin-bottom: 8px; }
    .lots { list-style: none; padding: 0; margin: 0; max-height: 36vh; overflow: auto; }
    .lots li + li { border-top: 1px solid var(--line); }
  `,
})
export class LotPanelComponent {
  protected readonly game = inject(GameService);
  protected readonly lot = this.game.selectedLot;
  protected readonly restaurant = this.game.selectedRestaurant;
  protected readonly cash = computed(() => this.game.human()?.cash ?? 0);
  protected readonly district = computed(() => {
    const lot = this.lot();
    return lot ? (this.game.city()?.districts[lot.district] ?? null) : null;
  });
  protected readonly wealthLabel = computed(() => {
    const w = this.district()?.wealth ?? 0;
    return w > 0.7 ? 'Wealthy' : w > 0.4 ? 'Comfortable' : 'Modest';
  });
  private readonly rankedTastes = computed(() =>
    Object.entries(this.district()?.tastes ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ingredient(id).name),
  );
  protected readonly favourites = computed(() => this.rankedTastes().slice(0, 3).join(', '));
  protected readonly dislikes = computed(() => this.rankedTastes().slice(-2).join(', '));
  protected readonly freeLots = computed(() => (this.game.city()?.lots ?? []).filter((l) => l.restaurantId === null));
  protected readonly mine = computed(() => {
    const st = this.game.state();
    const me = this.game.human();
    return (st?.restaurants ?? []).filter((r) => r.ownerId === me?.id && r.cityId === st?.currentCityId);
  });

  protected open(buy: boolean): void {
    const lot = this.lot();
    if (lot) this.game.openRestaurant(lot.id, buy);
  }

  protected ownerName(id: number): string {
    return this.game.state()?.players.find((p) => p.id === id)?.name ?? 'a rival';
  }

  protected money(n: number): string {
    return formatMoney(n);
  }

  protected pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  protected districtName(id: number): string {
    return this.game.city()?.districts[id]?.name ?? '';
  }
}
