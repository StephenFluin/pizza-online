import { Component, computed, inject } from '@angular/core';
import { ingredient } from '../game/data';
import { GameService } from '../game/game.service';
import { formatMoney } from '../game/model';

/** Details for the selected lot and its district. */
@Component({
  selector: 'app-lot-panel',
  template: `
    @if (lot(); as lot) {
      <section class="panel" aria-labelledby="lot-title">
        <h2 id="lot-title">Lot in {{ district()?.name }}</h2>
        <dl>
          <dt>Seats</dt><dd>{{ lot.seats }}</dd>
          <dt>Rent</dt><dd>{{ money(lot.rentPerMonth) }} / month</dd>
          <dt>Price</dt><dd>{{ money(lot.purchasePrice) }}</dd>
        </dl>
        @if (district(); as d) {
          <h3>District</h3>
          <dl>
            <dt>Residents</dt><dd>{{ d.population.toLocaleString('en-US') }}</dd>
            <dt>Wealth</dt><dd>{{ wealthLabel() }}</dd>
            <dt>Loves</dt><dd>{{ favourites() }}</dd>
          </dl>
        }
        <button type="button" class="secondary" (click)="game.selectLot(null)">Close</button>
      </section>
    } @else {
      <section class="panel hint">
        <h2>Find a location</h2>
        <p>Drag the map to look around and click an empty lot (with a sign) to see its rent and neighbourhood.</p>
        <h3>Available lots</h3>
        <ul class="lots">
          @for (l of freeLots(); track l.id) {
            <li><button type="button" class="link" (click)="game.selectLot(l.id)">{{ districtName(l.district) }} · {{ l.seats }} seats · {{ money(l.rentPerMonth) }}</button></li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 0 12px; }
    dt { font-weight: 600; }
    dd { margin: 0; }
    .lots { list-style: none; padding: 0; margin: 0; max-height: 40vh; overflow: auto; }
    .lots li + li { border-top: 1px solid var(--line); }
  `,
})
export class LotPanelComponent {
  protected readonly game = inject(GameService);
  protected readonly lot = this.game.selectedLot;
  protected readonly district = computed(() => {
    const lot = this.lot();
    return lot ? (this.game.city()?.districts[lot.district] ?? null) : null;
  });
  protected readonly wealthLabel = computed(() => {
    const w = this.district()?.wealth ?? 0;
    return w > 0.7 ? 'Wealthy' : w > 0.4 ? 'Comfortable' : 'Modest';
  });
  protected readonly favourites = computed(() => {
    const d = this.district();
    if (!d) return '';
    return Object.entries(d.tastes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => ingredient(id).name)
      .join(', ');
  });
  protected readonly freeLots = computed(() => (this.game.city()?.lots ?? []).filter((l) => l.restaurantId === null));

  protected money(n: number): string {
    return formatMoney(n);
  }

  protected districtName(id: number): string {
    return this.game.city()?.districts[id]?.name ?? '';
  }
}
