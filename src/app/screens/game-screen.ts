import { Component, inject } from '@angular/core';
import { GameService } from '../game/game.service';
import { CityMapComponent } from '../map/city-map';
import { HudComponent } from './hud';
import { LotPanelComponent } from './lot-panel';

@Component({
  selector: 'app-game-screen',
  imports: [HudComponent, CityMapComponent, LotPanelComponent],
  template: `
    <app-hud />
    <div class="body">
      <app-city-map class="map" />
      <aside class="side">
        <app-lot-panel />
        <section class="panel news" aria-live="polite" aria-labelledby="news-title">
          <h2 id="news-title">News</h2>
          @for (m of messages(); track $index) {
            <p>{{ m.text }}</p>
          }
        </section>
      </aside>
    </div>
  `,
  styles: `
    :host { display: grid; grid-template-rows: auto 1fr; height: 100dvh; }
    .body { display: grid; grid-template-columns: 1fr 340px; min-height: 0; }
    .map { min-height: 0; }
    .side { overflow: auto; background: var(--paper); padding: 12px; display: grid; gap: 12px; align-content: start; }
    .news p { margin: 0 0 6px; }
    @media (max-width: 760px) {
      .body { grid-template-columns: 1fr; grid-template-rows: 55dvh auto; }
      .side { overflow: visible; }
      :host { height: auto; }
    }
  `,
})
export class GameScreenComponent {
  private readonly game = inject(GameService);
  protected readonly messages = () => (this.game.state()?.messages ?? []).slice(-6).reverse();
}
