import { Component, computed, inject } from '@angular/core';
import { GameService } from '../game/game.service';
import { DAYS_PER_MONTH, formatMoney } from '../game/model';

/** Income and expenses for the current month, grouped by category. */
@Component({
  selector: 'app-finance-panel',
  template: `
    <section aria-labelledby="fin-title" class="fin">
      <h3 id="fin-title">This month</h3>
      <table>
        <caption class="sr-only">Income and expenses this month</caption>
        <tbody>
          @for (row of rows(); track row.label) {
            <tr>
              <th scope="row">{{ row.label }}</th>
              <td [class.neg]="row.amount < 0">{{ money(row.amount) }}</td>
            </tr>
          } @empty {
            <tr><td colspan="2">No transactions yet.</td></tr>
          }
        </tbody>
        <tfoot>
          <tr><th scope="row">Net</th><td [class.neg]="net() < 0">{{ money(net()) }}</td></tr>
        </tfoot>
      </table>
    </section>
  `,
  styles: `
    .fin { min-width: min(360px, 80vw); }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-weight: 400; }
    td { text-align: right; font-variant-numeric: tabular-nums; }
    th, td { padding: 3px 0; border-top: 1px solid var(--line); }
    tfoot th, tfoot td { font-weight: 700; }
    .neg { color: var(--tomato); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class FinancePanelComponent {
  private readonly game = inject(GameService);

  protected readonly rows = computed(() => {
    const day = this.game.state()?.day ?? 0;
    const monthStart = day - (day % DAYS_PER_MONTH);
    const totals = new Map<string, number>();
    for (const e of this.game.human()?.ledger ?? []) {
      if (e.day >= monthStart) totals.set(e.label, (totals.get(e.label) ?? 0) + e.amount);
    }
    return [...totals].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  });
  protected readonly net = computed(() => this.rows().reduce((n, r) => n + r.amount, 0));

  protected money(n: number): string {
    return formatMoney(n);
  }
}
