import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { GameService } from '../game/game.service';
import { HighScore, careerSummary, listHighScores, recordHighScore } from '../game/highscores';
import { formatMoney } from '../game/model';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { HighScoresComponent } from './high-scores';

/** The end of a career: how it went, and where it lands in the high-score table. */
@Component({
  selector: 'app-ending-screen',
  imports: [HighScoresComponent],
  template: `
    @if (summary(); as s) {
      <div class="end" [class.won]="s.outcome === 'Won'" [class.lost]="s.outcome === 'Bankrupt'">
        <h3>{{ headline() }}</h3>
        <p class="lead">{{ text() }}</p>
        <dl>
          <dt>Owner</dt>
          <dd>{{ s.name }}</dd>
          <dt>Ended</dt>
          <dd>{{ s.date }}</dd>
          <dt>Difficulty</dt>
          <dd>{{ s.difficulty }}</dd>
          <dt>Net worth</dt>
          <dd>{{ money(s.netWorth) }}</dd>
          <dt>Rank</dt>
          <dd>{{ s.rank }}</dd>
          <dt>Awards</dt>
          <dd>{{ s.awards }}</dd>
          <dt>Score</dt>
          <dd>
            <b>{{ s.score.toLocaleString('en-US') }}</b>
          </dd>
        </dl>
        <p class="place">
          {{
            place()
              ? 'That’s number ' + place() + ' in the high scores!'
              : 'Not quite enough for the high scores this time.'
          }}
        </p>
        <app-high-scores [highlight]="s" />
        <button type="button" (click)="toTitle()">Back to the title screen</button>
      </div>
    }
  `,
  styles: `
    .end {
      display: grid;
      gap: 10px;
      max-width: 640px;
      margin: 0 auto;
      text-align: center;
      justify-items: center;
    }
    h3 {
      font-family: Georgia, serif;
      font-size: 2rem;
      margin: 0;
    }
    .won h3 {
      color: #b07a2a;
    }
    .lost h3 {
      color: var(--tomato);
    }
    .lead {
      margin: 0;
      font-size: 1.1rem;
    }
    dl {
      display: grid;
      grid-template-columns: auto auto;
      gap: 2px 16px;
      margin: 0;
      text-align: left;
    }
    dt {
      font-weight: 600;
    }
    dd {
      margin: 0;
    }
    .place {
      margin: 0;
      font-weight: 700;
    }
  `,
})
export class EndingScreenComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);

  protected readonly summary = signal<HighScore | null>(null);
  protected readonly place = signal(0);
  protected readonly headline = computed(
    () =>
      ({
        Won: 'You built a pizza empire!',
        Bankrupt: 'Bankrupt!',
        Retired: 'Time to hang up the apron',
      })[this.summary()?.outcome ?? 'Retired'],
  );
  protected readonly text = computed(
    () =>
      ({
        Won: 'Your chain is the most popular in every city. The whole world knows your pizza.',
        Bankrupt: 'The bank has called in its debts and the ovens have gone cold.',
        Retired:
          'You’ve handed over the keys and retired to a life of eating other people’s pizza.',
      })[this.summary()?.outcome ?? 'Retired'],
  );

  private readonly lines = computed<LcdLine[]>(() => [
    { label: 'Game over' },
    { label: 'Score', value: (this.summary()?.score ?? 0).toLocaleString('en-US') },
  ]);
  private readonly tools = computed<Tool[]>(() => [
    { id: 'title', label: 'Title', icon: ICONS.back, action: () => this.toTitle() },
  ]);

  constructor() {
    inject(DestroyRef).onDestroy(
      this.shell.register(this, { lines: this.lines, tools: this.tools }),
    );
    const st = this.game.state();
    if (!st) return;
    const summary = careerSummary(st);
    this.summary.set(summary);
    // Record each career once, even if the screen is opened again.
    if (!st.scoreRecorded) {
      this.place.set(recordHighScore(summary));
      this.game.mutate((s) => (s.scoreRecorded = true));
    } else {
      this.place.set(
        listHighScores().findIndex((h) => h.name === summary.name && h.score === summary.score) + 1,
      );
    }
  }

  protected toTitle(): void {
    this.ui.close();
    this.game.quit();
  }

  protected money(n: number): string {
    return formatMoney(n);
  }
}
