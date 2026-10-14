import { Component, computed, inject, signal } from '@angular/core';
import { cityDef } from '../game/data';
import { GameService } from '../game/game.service';
import { formatMoney } from '../game/model';
import { UiService } from '../game/ui.service';
import { RestaurantPanelComponent } from './restaurant-panel';

/** All of the player's restaurants across the world, with the management panel for the chosen one. */
@Component({
  selector: 'app-restaurants-dialog',
  imports: [RestaurantPanelComponent],
  template: `
    <div class="layout">
      <ul class="list" aria-label="Your restaurants">
        @for (r of mine(); track r.id) {
          <li>
            <button type="button" class="link" [attr.aria-current]="selectedId() === r.id" (click)="selectedId.set(r.id)">
              <b>{{ r.name }}</b><br />
              {{ city(r.cityId) }} · {{ r.lastDay.customers }} guests · {{ money(r.lastDay.revenue) }}
            </button>
          </li>
        } @empty {
          <li>You don't own any restaurants yet. Find an empty lot with a sign on the city map.</li>
        }
      </ul>
      @if (selected(); as r) {
        <div class="detail">
          <app-restaurant-panel [restaurantId]="r.id" />
          <button type="button" class="secondary" (click)="showOnMap(r.cityId, r.lotId)">Show on map</button>
        </div>
      }
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 240px minmax(320px, 1fr); gap: 16px; min-width: min(720px, 85vw); }
    .list { list-style: none; padding: 0; margin: 0; max-height: 70dvh; overflow: auto; }
    .list li + li { border-top: 1px solid var(--line); }
    .list button[aria-current='true'] { background: var(--cream); }
    .detail { display: grid; gap: 8px; align-content: start; }
    @media (max-width: 700px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class RestaurantsDialogComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  protected readonly mine = computed(() => {
    const me = this.game.human();
    return (this.game.state()?.restaurants ?? []).filter((r) => r.ownerId === me?.id);
  });
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => {
    const list = this.mine();
    return list.find((r) => r.id === this.selectedId()) ?? list[0] ?? null;
  });

  protected city(id: string): string {
    return cityDef(id).name;
  }

  protected money(n: number): string {
    return formatMoney(n);
  }

  protected showOnMap(cityId: string, lotId: number): void {
    if (this.game.state()?.currentCityId !== cityId) this.game.travel(cityId);
    this.game.selectLot(lotId);
    this.ui.close();
  }
}
