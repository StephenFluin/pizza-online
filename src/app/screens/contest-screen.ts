import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { PortraitComponent } from '../characters/portrait';
import { JUDGES } from '../game/awards';
import { cityDef } from '../game/data';
import { GameService } from '../game/game.service';
import { Recipe } from '../game/model';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';

/** The annual pizza contest: choose an entry, then the five judges score every chain's pizza. */
@Component({
  selector: 'app-contest-screen',
  imports: [PortraitComponent],
  template: `
    @if (contest(); as c) {
      <div class="contest">
        <header>
          <h3>International Pizza Contest {{ c.year }}, {{ city() }}</h3>
          <ul class="judges" aria-label="Judges">
            @for (j of judges; track j.name; let i = $index) {
              <li>
                <app-portrait
                  [cacheKey]="'judge-' + i"
                  [look]="j.look"
                  [background]="judgeColor"
                  [size]="64"
                  alt=""
                />
                <b>{{ j.name }}</b
                ><small>{{ j.title }}</small>
              </li>
            }
          </ul>
        </header>

        @if (c.phase === 'entry') {
          <section aria-labelledby="entry-title">
            <h4 id="entry-title">Choose your entry</h4>
            <p>
              The chef likes finely chopped, good-looking pizzas; the critic wants a balanced
              flavour; the scientist a sensible, not too heavy pizza; the blogger something
              fashionable and pretty; the grandmother a classic with herbs.
            </p>
            <div class="recipes" role="radiogroup" aria-label="Recipe">
              @for (r of recipes(); track r.id) {
                <button
                  type="button"
                  role="radio"
                  class="recipe"
                  [attr.aria-checked]="chosenId() === r.id"
                  (click)="chosenId.set(r.id)"
                >
                  {{ r.name }}
                  @if (r.ownerId === null) {
                    <small> (classic)</small>
                  }
                </button>
              }
            </div>
            <button type="button" class="go" (click)="enter()" [disabled]="!chosen()">
              Present {{ chosen()?.name ?? 'your pizza' }} to the judges
            </button>
          </section>
        } @else {
          <table class="results">
            <caption>
              Results
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Chain</th>
                <th scope="col">Pizza</th>
                @for (j of judges; track j.name) {
                  <th scope="col">{{ j.name.split(' ')[0] }}</th>
                }
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (e of c.entries; track e.playerId; let i = $index) {
                <tr [class.mine]="e.playerId === meId()" [class.winner]="i === 0">
                  <td>{{ i + 1 }}</td>
                  <th scope="row">{{ owner(e.playerId) }}</th>
                  <td>{{ e.recipe.name }}</td>
                  @for (s of e.scores; track $index) {
                    <td>{{ s }}</td>
                  }
                  <td>
                    <b>{{ e.total }}</b>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <p class="verdict" role="status">{{ verdict() }}</p>
          <button type="button" class="go" (click)="done()">Back to business</button>
        }
      </div>
    } @else {
      <p>There is no contest running right now. It's held every autumn.</p>
    }
  `,
  styles: `
    .contest {
      display: grid;
      gap: 12px;
    }
    h3 {
      margin: 0 0 8px;
      font-family: Georgia, serif;
      font-size: 1.5rem;
    }
    .judges {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .judges li {
      display: grid;
      justify-items: center;
      text-align: center;
      width: 110px;
      font-size: 0.85rem;
    }
    .judges small {
      color: #555;
    }
    h4 {
      margin: 0 0 6px;
    }
    .recipes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 8px 0;
    }
    .recipe {
      background: #fffaf0;
      color: var(--ink);
      border: 2px solid var(--line);
      font-weight: 400;
      padding: 4px 10px;
    }
    .recipe[aria-checked='true'] {
      border-color: var(--tomato);
      background: #fff3d6;
      font-weight: 700;
    }
    .go {
      justify-self: start;
      font-size: 1.05rem;
      padding: 8px 18px;
    }
    .results {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    .results caption {
      text-align: left;
      font-weight: 700;
    }
    .results th,
    .results td {
      padding: 4px 6px;
      border-bottom: 1px solid var(--line);
      text-align: left;
    }
    .results tr.mine {
      background: #fff3d6;
    }
    .results tr.winner td:last-child {
      color: var(--basil);
    }
    .verdict {
      font-size: 1.1rem;
      margin: 0;
    }
  `,
})
export class ContestScreenComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);
  protected readonly judges = JUDGES;
  protected readonly judgeColor = 0xe9c46a;

  protected readonly contest = computed(() => this.game.state()?.contest ?? null, {
    equal: () => false,
  });
  protected readonly city = computed(() => cityDef(this.contest()?.cityId ?? 'rome').name);
  protected readonly meId = computed(() => this.game.human()?.id ?? 0);
  protected readonly recipes = computed(() =>
    (this.game.state()?.recipes ?? []).filter(
      (r) => r.ownerId === null || r.ownerId === this.meId(),
    ),
  );
  protected readonly chosenId = signal<string | null>(null);
  protected readonly chosen = computed<Recipe | null>(() => {
    const list = this.recipes();
    return (
      list.find((r) => r.id === this.chosenId()) ?? list.find((r) => r.ownerId !== null) ?? null
    );
  });
  protected readonly verdict = computed(() => {
    const c = this.contest();
    if (!c || c.phase !== 'judged') return '';
    const place = c.entries.findIndex((e) => e.playerId === this.meId()) + 1;
    return place === 1
      ? 'You won! $25,000 in prize money, and every city is talking about your pizza.'
      : `You came ${['', 'first', 'second', 'third', 'fourth'][place] ?? place + 'th'}. Better luck next year.`;
  });

  private readonly lines = computed<LcdLine[]>(() => [
    { label: 'Pizza contest' },
    { label: this.city() },
    { label: 'Entry', value: this.chosen()?.name ?? '—' },
  ]);
  private readonly tools = computed<Tool[]>(() =>
    this.contest()?.phase === 'judged'
      ? [{ id: 'done', label: 'Continue', icon: ICONS.sun, action: () => this.done() }]
      : [
          {
            id: 'enter',
            label: 'Present',
            icon: ICONS.save,
            disabled: !this.chosen(),
            action: () => this.enter(),
          },
          {
            id: 'cookbook',
            label: 'Cook book',
            icon: ICONS.book,
            action: () => this.ui.open({ kind: 'cookbook' }),
          },
        ],
  );

  constructor() {
    inject(DestroyRef).onDestroy(
      this.shell.register(this, { lines: this.lines, tools: this.tools }),
    );
  }

  protected enter(): void {
    const r = this.chosen();
    if (r) this.game.enterContest(r);
  }

  protected owner(id: number): string {
    return this.game.state()?.players.find((p) => p.id === id)?.name ?? '';
  }

  protected done(): void {
    this.game.finishContest();
    this.ui.close();
  }
}
