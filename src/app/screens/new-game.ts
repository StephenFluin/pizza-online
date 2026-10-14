import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { PortraitComponent } from '../characters/portrait';
import { CHARACTERS, PERKS, character } from '../game/characters';
import { CITIES } from '../game/data';
import { GameService } from '../game/game.service';
import { listSlots } from '../game/saves';
import { UiService } from '../game/ui.service';
import { DialogHostComponent } from './dialog-host';

/** Title screen: pick a character from the cast, then a starting city. */
@Component({
  selector: 'app-new-game',
  imports: [DialogHostComponent, PortraitComponent],
  template: `
    <main class="title">
      <h1>Pizza <span>Online</span></h1>
      <p class="tag">Choose who will build the world's favourite pizza chain.</p>

      <div class="layout">
        <section class="cast" aria-labelledby="cast-title">
          <h2 id="cast-title" class="sr-only">Characters</h2>
          <div class="grid" role="radiogroup" aria-labelledby="cast-title">
            @for (c of cast; track c.id) {
              <button
                type="button"
                role="radio"
                class="card"
                [attr.aria-checked]="chosen().id === c.id"
                [style.--accent]="hex(c.color)"
                (click)="choose(c.id)"
              >
                <app-portrait [cacheKey]="'char-' + c.id" [look]="c.look" [background]="c.color" [size]="88" alt="" />
                <span class="name">{{ c.name }}</span>
              </button>
            }
          </div>
        </section>

        <form class="details" (submit)="start($event)" aria-labelledby="hero-name">
          @let c = chosen();
          <app-portrait [cacheKey]="'char-' + c.id" [look]="c.look" [background]="c.color" [size]="160" [alt]="'Portrait of ' + c.name" />
          <h2 id="hero-name">{{ c.name }}</h2>
          <p class="from">from {{ c.hometown }}</p>
          <p>{{ c.bio }}</p>
          <p class="perk"><b>{{ perk().label }}:</b> {{ perk().description }}</p>

          <label for="player-name">Name on the sign (optional)</label>
          <input id="player-name" name="player-name" autocomplete="nickname" [placeholder]="c.name" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="24" />

          <label for="start-city">Starting city</label>
          <select id="start-city" name="start-city" [value]="cityId()" (change)="cityId.set($any($event.target).value)">
            @for (city of cities; track city.id) {
              <option [value]="city.id">{{ city.name }}</option>
            }
          </select>

          <button type="submit">Open for business</button>
          @if (hasSaves()) {
            <button type="button" class="secondary" (click)="ui.open({ kind: 'saves' })">Load a saved game</button>
          }
        </form>
      </div>
      @if (ui.dialog()) {
        <div class="overlay"><app-dialog-host /></div>
      }
      <p class="credit">An open-source, browser-only homage to the 1994 classic <i>Pizza Tycoon</i>. All characters are original.</p>
    </main>
  `,
  styles: `
    .title { min-height: 100dvh; padding: 24px 16px; display: grid; gap: 8px; justify-items: center; align-content: start; }
    h1 { font-size: clamp(2.2rem, 7vw, 4rem); margin: 0; color: var(--cream); }
    h1 span { color: var(--tomato-light); }
    .tag { color: var(--cream); margin: 0 0 12px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; width: min(1100px, 100%); align-items: start; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }
    .card { display: grid; justify-items: center; gap: 4px; padding: 8px 4px; background: #ffffff14; border: 3px solid transparent; color: var(--cream); font-weight: 600; }
    .card:hover { background: #ffffff26; }
    .card[aria-checked='true'] { border-color: var(--accent); background: #ffffff33; }
    .name { font-size: 0.8rem; text-align: center; }
    .details { display: grid; gap: 6px; background: var(--panel); color: var(--ink); padding: 16px; border-radius: 12px; justify-items: stretch; }
    .details app-portrait { justify-self: center; }
    .details h2 { margin: 4px 0 0; text-align: center; }
    .details p { margin: 0; }
    .from { text-align: center; font-style: italic; }
    .perk { background: var(--cream); border-left: 4px solid var(--tomato); padding: 6px 8px; }
    label { font-weight: 600; margin-top: 4px; }
    input, select { font: inherit; padding: 8px; border: 2px solid var(--ink-soft); border-radius: 6px; }
    .credit { color: var(--cream); font-size: 0.85rem; margin-top: 16px; }
    .overlay { position: fixed; inset: 0; z-index: 10; padding: 16px; background: #000a; display: grid; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class NewGameComponent {
  private readonly game = inject(GameService);
  protected readonly ui = inject(UiService);
  protected readonly cast = CHARACTERS;
  protected readonly cities = CITIES;
  protected readonly chosenId = signal(CHARACTERS[0].id);
  protected readonly chosen = computed(() => character(this.chosenId()));
  protected readonly perk = computed(() => PERKS[this.chosen().perk]);
  protected readonly name = signal('');
  protected readonly cityId = signal('rome');
  /** Read after render: saves live in localStorage, which doesn't exist during prerendering. */
  protected readonly hasSaves = signal(false);

  constructor() {
    afterNextRender(() => this.hasSaves.set(listSlots().some((s) => s.savedAt)));
  }

  protected choose(id: string): void {
    this.chosenId.set(id);
  }

  protected start(ev: Event): void {
    ev.preventDefault();
    this.game.newGame(this.name(), this.cityId(), this.chosenId());
  }

  protected hex(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
}
