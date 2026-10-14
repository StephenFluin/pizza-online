import { Component, DestroyRef, afterNextRender, computed, effect, inject, untracked } from '@angular/core';
import { GameService } from '../game/game.service';
import { UiService } from '../game/ui.service';
import { ShellSideComponent } from '../shell/shell-side';
import { CityScreenComponent } from './city-screen';
import { DialogHostComponent } from './dialog-host';

/**
 * The classic frame: a wooden surround with the active full-screen view on the
 * left and the info panel plus 3×3 tool grid on the right. The city view stays
 * mounted underneath other screens so its map keeps its position and zoom.
 */
@Component({
  selector: 'app-game-screen',
  imports: [CityScreenComponent, DialogHostComponent, ShellSideComponent],
  template: `
    <div class="frame wood">
      <main class="viewport">
        <app-city-screen class="layer" [class.hidden]="!!ui.dialog()" [attr.inert]="ui.dialog() ? '' : null" />
        @if (ui.dialog()) {
          <app-dialog-host class="layer" />
        }
        @if (outcome(); as o) {
          <div class="outcome" role="alert">
            {{ o === 'won' ? 'Congratulations! Your chain is the most popular in every city.' : 'Bankrupt! The bank has closed your business.' }}
          </div>
        }
      </main>
      <app-shell-side class="side" />
    </div>
  `,
  styles: `
    :host { display: block; height: 100dvh; }
    .frame { height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) clamp(220px, 26vw, 320px); gap: 14px; padding: 14px; }
    .viewport { position: relative; min-height: 0; min-width: 0; box-shadow: inset 0 0 0 3px #00000055, 0 0 0 3px var(--wood-dark); }
    .layer { position: absolute; inset: 0; }
    /* Hidden but still laid out, so PixiJS keeps the right canvas size. */
    .hidden { visibility: hidden; }
    .side { min-height: 0; }
    .outcome { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 4; background: var(--cream); color: var(--ink); padding: 8px 16px; font-weight: 700; border-radius: 8px; box-shadow: 0 4px 16px #0006; }
    @media (max-width: 760px) {
      :host { height: auto; }
      .frame { grid-template-columns: 1fr; grid-template-rows: 70dvh auto; padding: 8px; }
    }
  `,
})
export class GameScreenComponent {
  protected readonly game = inject(GameService);
  protected readonly ui = inject(UiService);
  protected readonly outcome = computed(() => this.game.state()?.outcome ?? null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.game.startLoop()));
    // When a trading day ends, show the full-screen report.
    effect(() => {
      if (this.game.dayReport() !== null) untracked(() => this.ui.open({ kind: 'report' }));
    });
  }
}
