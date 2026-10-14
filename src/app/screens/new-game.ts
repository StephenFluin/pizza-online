import { Component, afterNextRender, inject, signal } from '@angular/core';
import { CITIES } from '../game/data';
import { GameService } from '../game/game.service';
import { UiService } from '../game/ui.service';
import { DialogHostComponent } from './dialog-host';
import { listSlots } from '../game/saves';

@Component({
  selector: 'app-new-game',
  imports: [DialogHostComponent],
  template: `
    <main class="title">
      <h1>Pizza <span>Online</span></h1>
      <p class="tag">Build the world's favourite pizza chain, one slice at a time.</p>
      <form (submit)="start($event)">
        <label for="player-name">Your name</label>
        <input id="player-name" name="player-name" autocomplete="nickname" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="24" />

        <label for="start-city">Starting city</label>
        <select id="start-city" name="start-city" [value]="cityId()" (change)="cityId.set($any($event.target).value)">
          @for (c of cities; track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>

        <button type="submit">Open for business</button>
        @if (hasSaves()) {
          <button type="button" class="secondary" (click)="ui.open({ kind: 'saves' })">Load a saved game</button>
        }
      </form>
      <app-dialog-host />
      <p class="credit">An open-source, browser-only homage to the 1994 classic <i>Pizza Tycoon</i>.</p>
    </main>
  `,
  styles: `
    .title { min-height: 100dvh; display: grid; place-content: center; text-align: center; padding: 16px; gap: 8px; }
    h1 { font-size: clamp(2.5rem, 8vw, 5rem); margin: 0; color: var(--cream); letter-spacing: 0.02em; }
    h1 span { color: var(--tomato-light); }
    .tag { color: var(--cream); margin: 0 0 24px; }
    form { display: grid; gap: 8px; background: var(--panel); color: var(--ink); padding: 24px; border-radius: 12px; width: min(360px, 100%); margin: 0 auto; text-align: left; }
    label { font-weight: 600; }
    input, select { font: inherit; padding: 8px; border: 2px solid var(--ink-soft); border-radius: 6px; margin-bottom: 8px; }
    .credit { color: var(--cream); font-size: 0.85rem; margin-top: 24px; }
  `,
})
export class NewGameComponent {
  private readonly game = inject(GameService);
  protected readonly ui = inject(UiService);
  /** Read after render: saves live in localStorage, which doesn't exist during prerendering. */
  protected readonly hasSaves = signal(false);
  protected readonly cities = CITIES;
  protected readonly name = signal('');
  protected readonly cityId = signal('rome');

  constructor() {
    afterNextRender(() => this.hasSaves.set(listSlots().some((s) => s.savedAt)));
  }

  protected start(ev: Event): void {
    ev.preventDefault();
    this.game.newGame(this.name(), this.cityId());
  }
}
