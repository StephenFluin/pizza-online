import { Component, inject } from '@angular/core';
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
}
