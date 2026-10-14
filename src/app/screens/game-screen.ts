import { Component, DestroyRef, afterNextRender, computed, inject } from '@angular/core';
import { GameService } from '../game/game.service';
import { formatDate } from '../game/model';
import { UiService } from '../game/ui.service';
import { CityMapComponent } from '../map/city-map';
import { DialogHostComponent } from './dialog-host';
import { HudComponent } from './hud';
import { LotPanelComponent } from './lot-panel';
import { ToolbarComponent } from './toolbar';

/** Main game screen in the classic layout: status bar, full-screen city, info card and icon toolbar. */
@Component({
  selector: 'app-game-screen',
  imports: [HudComponent, CityMapComponent, LotPanelComponent, ToolbarComponent, DialogHostComponent],
  template: `
    <app-hud />
    <div class="stage">
      <app-city-map class="map" />
      @if (outcome(); as o) {
        <div class="outcome" role="alert">
          {{ o === 'won' ? 'Congratulations! Your chain is the most popular in every city.' : 'Bankrupt! The bank has closed your business.' }}
        </div>
      }
      @if (game.selectedLot()) {
        <aside class="card" aria-label="Selected location">
          <app-lot-panel />
        </aside>
      }
      <button type="button" class="ticker" (click)="ui.open({ kind: 'news' })" aria-label="Open the news log">
        <span class="when">{{ latest()?.when }}</span> {{ latest()?.text }}
      </button>
    </div>
    <app-toolbar />
    <app-dialog-host />
  `,
  styles: `
    :host { display: grid; grid-template-rows: auto 1fr auto; height: 100dvh; }
    .outcome { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 4; background: var(--cream); color: var(--ink); padding: 8px 16px; font-weight: 700; border-radius: 8px; box-shadow: 0 4px 16px #0006; }
    .stage { position: relative; min-height: 0; }
    .map { position: absolute; inset: 0; }
    .card { position: absolute; top: 12px; right: 12px; width: min(380px, calc(100% - 24px)); max-height: calc(100% - 80px); overflow: auto; z-index: 3; box-shadow: 0 6px 24px #0006; border-radius: 10px; }
    .ticker { position: absolute; left: 12px; bottom: 12px; right: 72px; text-align: left; background: #1d3557e6; color: var(--cream); border: 1px solid #c9a227; font-weight: 400; padding: 6px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 2; }
    .when { color: #f4d58d; font-weight: 700; }
    @media (max-width: 640px) {
      .card { top: auto; bottom: 64px; max-height: 55%; }
    }
  `,
})
export class GameScreenComponent {
  protected readonly game = inject(GameService);
  protected readonly ui = inject(UiService);
  protected readonly outcome = computed(() => this.game.state()?.outcome ?? null);
  protected readonly latest = computed(() => {
    const m = this.game.state()?.messages.at(-1);
    return m ? { when: formatDate(m.day), text: m.text } : null;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.game.startLoop()));
  }
}
