import { Component, DestroyRef, computed, inject } from '@angular/core';
import { cityDef } from '../game/data';
import { GameService } from '../game/game.service';
import { formatMoney } from '../game/model';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { RestaurantPanelComponent } from './restaurant-panel';
import { shopCycleTools } from './shop-nav';

/**
 * All of the player's pizzerias: an overview of every one, and the management
 * panel for the current one. Prev shop and Next shop in the tool grid change
 * which one, as on every other screen about a single pizzeria.
 */
@Component({
  selector: 'app-restaurants-dialog',
  imports: [RestaurantPanelComponent],
  template: `
    @if (selected(); as r) {
      <div class="layout">
        <ol class="list" aria-label="All your pizzerias">
          @for (x of mine(); track x.id) {
            <li [attr.aria-current]="x.id === r.id ? 'true' : null">
              <b>{{ x.name }}</b
              ><br />
              {{ city(x.cityId) }} · {{ x.lastDay.customers }} guests ·
              {{ money(x.lastDay.revenue) }}
            </li>
          }
        </ol>
        <div class="detail">
          <app-restaurant-panel [restaurantId]="r.id" />
        </div>
      </div>
    } @else {
      <p>You don't own any pizzerias yet. Find an empty lot outlined in yellow on the city map.</p>
    }
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 16px;
    }
    .list {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 70dvh;
      overflow: auto;
    }
    .list li {
      padding: 6px 8px;
      border-top: 1px solid var(--line);
    }
    .list li[aria-current='true'] {
      background: #fff3d6;
      box-shadow: inset 4px 0 0 var(--wood);
    }
    .detail {
      display: grid;
      gap: 8px;
      align-content: start;
    }
    @media (max-width: 700px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class RestaurantsDialogComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  protected readonly mine = computed(() => {
    const me = this.game.human();
    return (this.game.state()?.restaurants ?? []).filter((r) => r.ownerId === me?.id);
  });
  protected readonly selected = computed(() => {
    const list = this.mine();
    return list.find((r) => r.id === this.ui.shopId()) ?? list[0] ?? null;
  });

  private readonly lines = computed<LcdLine[]>(() => {
    const r = this.selected();
    return [
      { label: 'Your pizzerias', value: String(this.mine().length) },
      ...(r ? [{ label: r.name }, { label: city(r.cityId) }] : []),
    ];
  });
  private readonly tools = computed<Tool[]>(() => {
    const r = this.selected();
    return [
      {
        id: 'map',
        label: 'Show on map',
        icon: ICONS.zoom,
        disabled: !r,
        action: () => r && this.showOnMap(r.cityId, r.lotId),
      },
      ...shopCycleTools(
        this.mine().map((x) => x.id),
        r?.id,
        (id) => this.ui.shopId.set(id),
      ),
      {
        id: 'back',
        label: 'Back',
        icon: ICONS.back,
        action: () =>
          this.game.dayReport() !== null ? this.ui.open({ kind: 'report' }) : this.ui.close(),
      },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(
      inject(ShellService).register(this, { lines: this.lines, tools: this.tools }),
    );
  }

  protected city(id: string): string {
    return city(id);
  }

  protected money(n: number): string {
    return formatMoney(n);
  }

  private showOnMap(cityId: string, lotId: number): void {
    if (this.game.state()?.currentCityId !== cityId) this.game.travel(cityId);
    this.game.selectLot(lotId);
    this.ui.close();
  }
}

function city(id: string): string {
  return cityDef(id).name;
}
