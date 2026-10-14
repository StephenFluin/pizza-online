import { Component, afterNextRender, inject, isDevMode } from '@angular/core';
import { GameService } from './game/game.service';
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
    // Expose the game in dev builds for debugging from the console: `pizza.state()`.
    afterNextRender(() => {
      if (isDevMode()) (globalThis as unknown as { pizza: GameService }).pizza = this.game;
    });
  }
}
