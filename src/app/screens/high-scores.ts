import { Component, input, signal } from '@angular/core';
import { HighScore, listHighScores } from '../game/highscores';

/** The high-score table kept in this browser. */
@Component({
  selector: 'app-high-scores',
  template: `
    <table class="scores">
      <caption>
        High scores
      </caption>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Owner</th>
          <th scope="col">Score</th>
          <th scope="col">Rank</th>
          <th scope="col">Result</th>
          <th scope="col">Level</th>
          <th scope="col">Ended</th>
        </tr>
      </thead>
      <tbody>
        @for (h of scores(); track $index; let i = $index) {
          <tr [class.me]="h.name === highlight()?.name && h.score === highlight()?.score">
            <td>{{ i + 1 }}</td>
            <th scope="row">{{ h.name }}</th>
            <td>{{ h.score.toLocaleString('en-US') }}</td>
            <td>{{ h.rank }}</td>
            <td>{{ h.outcome }}</td>
            <td>{{ h.difficulty }}</td>
            <td>{{ h.date }}</td>
          </tr>
        } @empty {
          <tr>
            <td colspan="7">No finished careers yet.</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    .scores {
      width: 100%;
      border-collapse: collapse;
      background: var(--lcd);
      color: var(--lcd-text);
      font-family: var(--font-lcd);
      font-size: 1.15rem;
    }
    caption {
      font-family: var(--font-lcd);
      font-size: 1.4rem;
      color: inherit;
      background: var(--lcd);
      padding: 4px;
      text-transform: uppercase;
    }
    th,
    td {
      padding: 2px 8px;
      text-align: left;
      font-weight: 400;
    }
    thead th {
      color: var(--lcd-dim);
      text-transform: uppercase;
    }
    tr.me {
      background: #4a3a10;
    }
  `,
})
export class HighScoresComponent {
  readonly highlight = input<HighScore | null>(null);
  protected readonly scores = signal(listHighScores());
}
