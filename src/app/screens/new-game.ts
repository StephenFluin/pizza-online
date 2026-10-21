import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { PortraitComponent } from '../characters/portrait';
import { CHARACTERS, CharacterStats, STAT_LABELS, character } from '../game/characters';
import { CITIES } from '../game/data';
import { DIFFICULTIES, DifficultyId } from '../game/difficulty';
import { GameService } from '../game/game.service';
import { formatMoney } from '../game/model';
import { listSlots } from '../game/saves';
import { UiService } from '../game/ui.service';
import { DialogHostComponent } from './dialog-host';

const SLOT_COUNT = 4;

/** Rough continent outlines for the city picker (0..1 map coordinates). */
const CONTINENTS: number[][] = [
  [0.05, 0.2, 0.18, 0.12, 0.32, 0.15, 0.33, 0.3, 0.27, 0.38, 0.22, 0.47, 0.17, 0.45, 0.1, 0.33],
  [0.25, 0.5, 0.33, 0.52, 0.38, 0.62, 0.34, 0.82, 0.3, 0.86, 0.28, 0.7],
  [0.44, 0.18, 0.58, 0.14, 0.6, 0.3, 0.52, 0.36, 0.45, 0.32],
  [0.45, 0.4, 0.58, 0.38, 0.62, 0.55, 0.55, 0.78, 0.5, 0.72, 0.46, 0.55],
  [0.58, 0.12, 0.88, 0.14, 0.92, 0.3, 0.84, 0.42, 0.72, 0.48, 0.62, 0.38],
  [0.8, 0.62, 0.92, 0.64, 0.94, 0.78, 0.84, 0.8, 0.78, 0.72],
];

/**
 * New game in the original's layout: cycle through the cast with the arrows
 * beside the stat box, see the character's photo, choose who runs each of the
 * four companies (you and three computer rivals), then pick a starting city.
 */
@Component({
  selector: 'app-new-game',
  imports: [DialogHostComponent, PortraitComponent],
  template: `
    <main class="title wood">
      <h1>Pizza <span>Online</span></h1>

      @if (step() === 'cast') {
        <div class="select">
          <section class="column" aria-label="Character">
            <button
              type="button"
              class="arrow bevel"
              (click)="cycle(-1)"
              aria-label="Previous character"
            >
              ▲
            </button>
            <div class="statbox lcd-text" aria-live="polite">
              @if (renaming()) {
                <label class="sr-only" for="rename">Company owner's name</label>
                <input
                  id="rename"
                  class="rename"
                  maxlength="24"
                  [value]="names()[active()]"
                  (input)="rename($any($event.target).value)"
                  (keydown.enter)="renaming.set(false)"
                  (blur)="renaming.set(false)"
                />
              } @else if (active() === 0) {
                <button
                  type="button"
                  class="name"
                  (click)="renaming.set(true)"
                  [attr.aria-label]="'Rename ' + displayName(active())"
                >
                  {{ displayName(active()) }}
                </button>
              } @else {
                <p class="name static">{{ displayName(active()) }}</p>
              }
              <dl>
                @for (s of statLabels; track s.key) {
                  <div class="stat" [attr.title]="s.effect || null">
                    <dt>{{ s.label }}</dt>
                    <dd>{{ statValue(s.key) }}</dd>
                  </div>
                }
              </dl>
            </div>
            <button
              type="button"
              class="arrow bevel"
              (click)="cycle(1)"
              aria-label="Next character"
            >
              ▼
            </button>
          </section>

          <section class="column photo" aria-label="Photo">
            <div class="frame">
              <app-portrait
                [cacheKey]="'char-' + chosen().id"
                [look]="chosen().look"
                [background]="chosen().color"
                [size]="180"
                [alt]="'Portrait of ' + chosen().name"
              />
            </div>
            <p class="from">{{ chosen().name }}, from {{ chosen().hometown }}</p>
            <p class="bio">{{ chosen().bio }}</p>
            <button type="button" class="start" (click)="step.set('city')">Start</button>
            @if (hasSaves()) {
              <button type="button" class="secondary load" (click)="ui.open({ kind: 'saves' })">
                Load a saved game
              </button>
            }
            <button type="button" class="secondary load" (click)="ui.open({ kind: 'highscores' })">
              High scores
            </button>
          </section>

          <section class="column" aria-labelledby="companies-title">
            <h2 id="companies-title" class="lcd-text">Companies</h2>
            <ol class="slots">
              @for (id of slots(); track $index; let i = $index) {
                <li>
                  <button
                    type="button"
                    class="slot"
                    [attr.aria-pressed]="active() === i"
                    (click)="active.set(i)"
                  >
                    <app-portrait
                      [cacheKey]="'char-' + id"
                      [look]="look(id)"
                      [background]="color(id)"
                      [size]="44"
                      alt=""
                    />
                    <span>
                      <b>{{ displayName(i) }}</b
                      ><br />
                      <small>{{ i === 0 ? 'Human' : 'Computer' }}</small>
                    </span>
                  </button>
                </li>
              }
            </ol>
            <p class="hint">
              Choose a company, then use the arrows to pick who runs it. Click the name to rename
              your owner.
            </p>
          </section>
        </div>
      } @else {
        <section class="cities" aria-labelledby="city-title">
          <h2 id="city-title" class="lcd-text">Choose your starting city</h2>
          <svg viewBox="0 0 600 300" class="map" aria-hidden="true">
            <rect width="600" height="300" fill="#1d4e89" />
            @for (poly of continents; track $index) {
              <polygon [attr.points]="poly" fill="#6a994e" stroke="#386641" stroke-width="2" />
            }
            @for (c of cities; track c.id) {
              <circle
                [attr.cx]="c.wx * 600"
                [attr.cy]="c.wy * 300"
                [attr.r]="c.id === cityId() ? 9 : 6"
                [attr.fill]="c.id === cityId() ? '#ffd166' : '#fdf6e3'"
                stroke="#1d3557"
                stroke-width="2"
              />
            }
          </svg>
          <div class="city-list" role="radiogroup" aria-label="Starting city">
            @for (c of cities; track c.id) {
              <button
                type="button"
                role="radio"
                class="city"
                [attr.aria-checked]="cityId() === c.id"
                (click)="cityId.set(c.id)"
              >
                {{ c.name }}
              </button>
            }
          </div>
          <div class="levels" role="radiogroup" aria-label="Difficulty">
            @for (d of difficulties; track d.id) {
              <button
                type="button"
                role="radio"
                class="city"
                [attr.aria-checked]="level() === d.id"
                (click)="level.set(d.id)"
                [attr.title]="d.description"
              >
                {{ d.label }}
              </button>
            }
          </div>
          <p class="level-note">{{ levelNote() }}</p>
          <div class="go">
            <button type="button" class="secondary" (click)="step.set('cast')">Back</button>
            <button type="button" class="start" (click)="start()">
              Open for business in {{ cityName() }}
            </button>
          </div>
        </section>
      }
      @if (ui.dialog()) {
        <div class="overlay"><app-dialog-host /></div>
      }
      <p class="credit">
        An open-source, browser-only homage to the 1994 classic <i>Pizza Tycoon</i>. All characters
        are original.
      </p>
    </main>
  `,
  styles: `
    .title {
      min-height: 100dvh;
      padding: 18px 16px;
      display: grid;
      gap: 12px;
      justify-items: center;
      align-content: start;
    }
    h1 {
      font-size: clamp(2rem, 6vw, 3.4rem);
      margin: 0;
      color: var(--cream);
      text-shadow: 2px 2px 0 #0008;
    }
    h1 span {
      color: #ffd166;
    }
    .select {
      display: grid;
      grid-template-columns: minmax(220px, 280px) minmax(220px, 300px) minmax(220px, 280px);
      gap: 16px;
      align-items: start;
      width: min(920px, 100%);
    }
    .column {
      display: grid;
      gap: 8px;
      justify-items: stretch;
    }
    .arrow {
      font-size: 1.2rem;
      padding: 2px;
      color: #2b3036;
      font-weight: 700;
      justify-self: center;
      width: 70px;
      border-radius: 4px;
    }
    .statbox {
      background: var(--lcd);
      padding: 10px 12px;
      border: 4px solid var(--steel-dark);
      border-radius: 4px;
      box-shadow: inset 0 0 0 2px #000;
    }
    .name,
    .rename {
      font: inherit;
      color: #ffd166;
      background: none;
      border: none;
      padding: 0;
      text-transform: uppercase;
      text-align: left;
      width: 100%;
      font-size: 1.5rem;
      text-decoration: underline dotted;
      cursor: text;
    }
    .name.static {
      text-decoration: none;
      margin: 0;
      cursor: default;
    }
    .rename {
      background: #222;
      border-bottom: 2px solid #ffd166;
      text-decoration: none;
    }
    dl {
      margin: 6px 0 0;
    }
    .stat {
      display: flex;
      justify-content: space-between;
    }
    dt,
    dd {
      margin: 0;
    }
    .photo {
      justify-items: center;
      text-align: center;
    }
    .frame {
      padding: 10px;
      background: linear-gradient(145deg, var(--brass-light), var(--brass) 45%, var(--brass-dark));
      border-radius: 4px;
      box-shadow: 0 4px 12px #0007;
    }
    .from {
      margin: 0;
      color: var(--cream);
      font-weight: 700;
    }
    .bio {
      margin: 0;
      color: var(--cream);
      font-size: 0.9rem;
    }
    .start {
      font-size: 1.15rem;
      padding: 10px 26px;
    }
    .load {
      justify-self: center;
    }
    button.secondary {
      background: #fff8ec;
      border-color: #fff8ec;
      color: #9b2c1f;
    }
    h2.lcd-text {
      margin: 0;
      background: var(--lcd);
      padding: 4px 10px;
      border: 3px solid var(--steel-dark);
    }
    .slots {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .slot {
      width: 100%;
      display: flex;
      gap: 8px;
      align-items: center;
      text-align: left;
      background: #f5ecd9;
      color: #2b1d0e;
      border: 3px solid #8a6a3a;
      font-weight: 400;
      padding: 4px 8px;
    }
    .slot[aria-pressed='true'] {
      border-color: #ffd166;
      background: #fff8e1;
      box-shadow: 0 0 0 2px #7a4a1c;
    }
    .hint {
      color: var(--cream);
      font-size: 0.85rem;
      margin: 0;
    }
    .cities {
      display: grid;
      gap: 10px;
      width: min(760px, 100%);
      justify-items: center;
    }
    .map {
      width: 100%;
      border: 4px solid var(--wood-dark);
      border-radius: 4px;
    }
    .city-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
    }
    .city {
      background: #f5ecd9;
      color: #2b1d0e;
      border: 2px solid #8a6a3a;
      font-weight: 400;
      padding: 4px 10px;
    }
    .city[aria-checked='true'] {
      background: #ffd166;
      border-color: #7a4a1c;
      font-weight: 700;
    }
    .go {
      display: flex;
      gap: 10px;
    }
    .levels {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .level-note {
      color: var(--cream);
      margin: 0;
    }
    .credit {
      color: var(--cream);
      font-size: 0.85rem;
      margin: 6px 0 0;
    }
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 10;
      padding: 16px;
      background: #000a;
      display: grid;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    @media (max-width: 820px) {
      .select {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class NewGameComponent {
  private readonly game = inject(GameService);
  protected readonly ui = inject(UiService);
  protected readonly statLabels = STAT_LABELS;
  protected readonly cities = CITIES;
  protected readonly continents = CONTINENTS.map((poly) =>
    poly.map((v, i) => (i % 2 === 0 ? v * 600 : v * 300)).join(' '),
  );

  protected readonly step = signal<'cast' | 'city'>('cast');
  /** Character id running each company; slot 0 is the player. */
  protected readonly slots = signal<string[]>(CHARACTERS.slice(0, SLOT_COUNT).map((c) => c.id));
  /** Custom names per slot ('' = the character's own name). */
  protected readonly names = signal<string[]>(Array(SLOT_COUNT).fill(''));
  protected readonly active = signal(0);
  protected readonly renaming = signal(false);
  protected readonly cityId = signal('rome');
  protected readonly difficulties = DIFFICULTIES;
  protected readonly level = signal<DifficultyId>('normal');
  protected readonly levelNote = computed(
    () => DIFFICULTIES.find((d) => d.id === this.level())?.description ?? '',
  );
  protected readonly chosen = computed(() => character(this.slots()[this.active()]));
  protected readonly cityName = computed(
    () => CITIES.find((c) => c.id === this.cityId())?.name ?? '',
  );
  /** Read after render: saves live in localStorage, which doesn't exist during prerendering. */
  protected readonly hasSaves = signal(false);

  constructor() {
    afterNextRender(() => this.hasSaves.set(listSlots().some((s) => s.savedAt)));
  }

  /** Steps the active company's character through the cast, skipping ones another company already has. */
  protected cycle(delta: number): void {
    const taken = new Set(this.slots().filter((_, i) => i !== this.active()));
    let index = CHARACTERS.findIndex((c) => c.id === this.slots()[this.active()]);
    do index = (index + delta + CHARACTERS.length) % CHARACTERS.length;
    while (taken.has(CHARACTERS[index].id));
    const id = CHARACTERS[index].id;
    this.slots.update((s) => s.map((x, i) => (i === this.active() ? id : x)));
    this.names.update((n) => n.map((x, i) => (i === this.active() ? '' : x)));
  }

  protected rename(value: string): void {
    this.names.update((n) => n.map((x, i) => (i === this.active() ? value : x)));
  }

  protected displayName(slot: number): string {
    return this.names()[slot].trim() || character(this.slots()[slot]).name;
  }

  protected statValue(key: keyof CharacterStats): string {
    const v = this.chosen().stats[key];
    return key === 'money' ? formatMoney(v) : String(v);
  }

  protected look(id: string) {
    return character(id).look;
  }

  protected color(id: string): number {
    return character(id).color;
  }

  protected start(): void {
    const [me, ...rivals] = this.slots();
    this.game.newGame(this.names()[0], this.cityId(), me, undefined, rivals, this.level());
  }
}
