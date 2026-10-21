import { Component, computed, inject } from '@angular/core';
import { GameService, GameSpeed } from '../game/game.service';
import { formatDate, formatMoney, formatTime } from '../game/model';
import { ShellService, Tool } from './shell.service';

/** Fixed places for the navigation tools in the bottom row of the grid. */
const NAV_SLOTS: Record<string, number> = { 'prev-shop': 6, 'next-shop': 7, back: 8 };

/**
 * Right-hand column of the classic frame: an amber LCD info panel framed by
 * steel corner brackets, and a brass panel holding a 3×3 grid of tool buttons.
 */
@Component({
  selector: 'app-shell-side',
  template: `
    <section class="lcd-bezel" aria-label="Status">
      <span class="corner tl" aria-hidden="true"></span
      ><span class="corner tr" aria-hidden="true"></span>
      <span class="corner bl" aria-hidden="true"></span
      ><span class="corner br" aria-hidden="true"></span>
      <div class="lcd lcd-text">
        <p class="clock">{{ clock() }}</p>
        @if (inGame()) {
          <div class="speed" role="group" aria-label="Game speed">
            @for (s of speeds; track s) {
              <button
                type="button"
                [attr.aria-pressed]="speed() === s"
                (click)="game.speed.set(s)"
                [attr.aria-label]="s === 0 ? 'Pause' : 'Run at ' + s + 'x speed'"
                [attr.title]="s === 0 ? 'Pause the clock' : 'Run the clock at ' + s + '× speed'"
              >
                {{ s === 0 ? '❚❚' : '▶' + (s > 1 ? s : '') }}
              </button>
            }
            <span class="state" aria-live="polite">{{ speed() === 0 ? 'Paused' : '' }}</span>
          </div>
        }
        @for (l of lines(); track $index) {
          @if (l.value === undefined) {
            <p>{{ l.label }}</p>
          } @else {
            <p class="pair">
              <span>{{ l.label }}</span
              ><span>{{ l.value }}</span>
            </p>
          }
        }
        <p class="money" [class.neg]="cash() < 0">{{ money() }}</p>
      </div>
    </section>
    <nav class="tools" aria-label="Tools">
      @for (t of slots(); track $index) {
        @if (t) {
          <button
            type="button"
            class="tool bevel"
            [attr.aria-label]="t.label"
            [attr.title]="t.label"
            [attr.aria-pressed]="t.pressed ?? null"
            [disabled]="t.disabled ?? false"
            (click)="t.action()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="t.icon" /></svg>
            <span class="label" [class.long]="longWord(t.label)">{{ t.label }}</span>
          </button>
        } @else {
          <span class="tool bevel empty" aria-hidden="true"></span>
        }
      }
    </nav>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: 1fr auto;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
      min-height: 0;
      min-width: 0;
    }
    .lcd-bezel {
      position: relative;
      padding: 10px;
      background: #1a1a1a;
      border: 3px solid var(--steel-dark);
      border-radius: 4px;
      min-height: 0;
      display: grid;
    }
    .corner {
      position: absolute;
      width: 18px;
      height: 18px;
      border: 5px solid var(--steel);
    }
    .tl {
      top: -4px;
      left: -4px;
      border-right: 0;
      border-bottom: 0;
    }
    .tr {
      top: -4px;
      right: -4px;
      border-left: 0;
      border-bottom: 0;
    }
    .bl {
      bottom: -4px;
      left: -4px;
      border-right: 0;
      border-top: 0;
    }
    .br {
      bottom: -4px;
      right: -4px;
      border-left: 0;
      border-top: 0;
    }
    .lcd {
      background: var(--lcd);
      padding: 8px 10px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .lcd p {
      margin: 0;
    }
    .clock {
      text-align: center;
      margin-bottom: 4px !important;
    }
    .speed {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
    }
    .speed button {
      font: inherit;
      font-size: 0.85em;
      line-height: 1;
      padding: 2px 6px;
      min-width: 2.2em;
      background: #0b0b0b;
      color: var(--lcd-dim);
      border: 1px solid #5a4a1a;
      border-radius: 2px;
      font-weight: 400;
    }
    .speed button[aria-pressed='true'] {
      background: var(--lcd-text);
      color: #1a1a1a;
      border-color: var(--lcd-text);
    }
    .speed .state {
      min-width: 4.5em;
      font-size: 0.85em;
      color: #ff9b5b;
    }
    .pair {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }
    .pair span:first-child {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pair span:last-child {
      text-align: right;
    }
    .money {
      margin-top: auto !important;
      text-align: center;
      padding-top: 6px;
    }
    .money.neg {
      color: #ff6b5b;
    }
    .tools {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding: 12px;
      border-radius: 6px;
      background: linear-gradient(160deg, var(--brass-light), var(--brass) 40%, var(--brass-dark));
      border: 3px solid var(--brass-dark);
      box-shadow: inset 0 0 0 2px #ffffff55;
    }
    .tool {
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 2px;
      padding: 4px;
      border-radius: 3px;
      color: #20262c;
      font-weight: 700;
    }
    .tool:hover:not(:disabled) {
      filter: brightness(1.08);
    }
    .tool:active:not(:disabled),
    .tool[aria-pressed='true'] {
      border-color: var(--steel-dark) var(--steel-light) var(--steel-light) var(--steel-dark);
      filter: brightness(0.92);
    }
    .tool:disabled {
      opacity: 0.45;
    }
    .tool svg {
      width: 60%;
      max-width: 34px;
      fill: none;
      stroke: #2b3036;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .label {
      font-size: 0.6rem;
      line-height: 1.05;
      text-align: center;
      text-transform: uppercase;
      max-width: 100%;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    /* Labels wrap between words; a single long word gets smaller type instead of breaking. */
    .label.long {
      font-size: 0.5rem;
    }
    .empty {
      opacity: 0.6;
    }
  `,
})
export class ShellSideComponent {
  private readonly shell = inject(ShellService);
  protected readonly game = inject(GameService);
  protected readonly speeds: GameSpeed[] = [0, 1, 2, 4];
  protected readonly speed = this.game.speed;
  protected readonly inGame = computed(() => !!this.game.state() && !this.game.state()?.outcome);
  protected readonly lines = computed(() => this.shell.active()?.lines() ?? []);
  /**
   * The 3×3 grid. The bottom row is for getting around, the same on every
   * screen: Prev shop, Next shop, Back. Other tools fill the grid in order.
   */
  protected readonly slots = computed(() => {
    const grid: (Tool | null)[] = Array.from({ length: 9 }, () => null);
    const rest: Tool[] = [];
    for (const t of this.shell.active()?.tools() ?? []) {
      const at = NAV_SLOTS[t.id];
      if (at !== undefined && !grid[at]) grid[at] = t;
      else rest.push(t);
    }
    for (const t of rest) {
      const free = grid.indexOf(null);
      if (free >= 0) grid[free] = t;
    }
    return grid;
  });
  protected readonly clock = computed(() => {
    const st = this.game.state();
    return st ? `${formatDate(st.day)}  ${formatTime(st.minute)}` : '';
  });
  protected readonly cash = computed(() => this.game.human()?.cash ?? 0);

  protected longWord(label: string): boolean {
    return label.split(' ').some((w) => w.length > 8);
  }
  protected readonly money = computed(() => formatMoney(this.cash()));
}
