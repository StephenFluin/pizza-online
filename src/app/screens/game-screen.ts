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
    @media (max-width: 760px) {
      :host { height: auto; }
      .frame { grid-template-columns: 1fr; grid-template-rows: 70dvh auto; padding: 8px; }
    }
  `,
})
export class GameScreenComponent {
  protected readonly game = inject(GameService);
  protected readonly ui = inject(UiService);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.game.startLoop()));
    // When a trading day ends, show the full-screen report.
    // A decided game goes to the ending screen.
    effect(() => {
      const done = !!this.game.state()?.outcome;
      untracked(() => {
        if (done && this.ui.dialog()?.kind !== 'ending') this.ui.open({ kind: 'ending' });
      });
    });
    // Staff matters waiting for an answer, then the pizza contest, take over the screen.
    effect(() => {
      const st = this.game.state();
      const waiting = (st?.staffEvents.length ?? 0) > 0;
      const contest = st?.contest?.phase === 'entry';
      const ringing = (st?.phoneQueue?.length ?? 0) > 0;
      untracked(() => {
        const open = this.ui.dialog()?.kind;
        if (this.game.speed() !== 0 || this.game.dayReport() !== null) return;
        if (waiting && open !== 'incident') this.ui.open({ kind: 'incident' });
        else if (!waiting && contest && open !== 'contest' && open !== 'cookbook' && open !== 'designer') this.ui.open({ kind: 'contest' });
        else if (!waiting && !contest && ringing && open !== 'phone') this.ui.open({ kind: 'phone' });
      });
    });
    effect(() => {
      const pending = this.game.dayReport() !== null;
      untracked(() => {
        if (pending) this.ui.open({ kind: 'report' });
        else if (this.ui.dialog()?.kind === 'report') this.ui.close();
      });
    });
  }
}
