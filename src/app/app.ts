import { Component, afterNextRender, effect, inject, isDevMode, untracked } from '@angular/core';
import { GameService } from './game/game.service';
import { UiService } from './game/ui.service';
import { GameScreenComponent } from './screens/game-screen';
import { NewGameComponent } from './screens/new-game';

@Component({
  imports: [NewGameComponent, GameScreenComponent],
  selector: 'app-root',
  template: `
    @if (game.state()) {
      <app-game-screen />
    } @else {
      <app-new-game />
    }
  `,
})
export class App {
  protected readonly game = inject(GameService);

  constructor() {
    // Leaving a game closes whatever screen was open, except the ones the title screen uses itself.
    const ui = inject(UiService);
    effect(() => {
      const inGame = !!this.game.state();
      untracked(() => {
        const kind = ui.dialog()?.kind;
        if (!inGame && kind && kind !== 'saves' && kind !== 'highscores') ui.close();
      });
    });
    // Expose the game in dev builds for debugging from the console: `pizza.state()`.
    afterNextRender(() => {
      if (isDevMode()) (globalThis as unknown as { pizza: GameService }).pizza = this.game;
    });
  }
}
