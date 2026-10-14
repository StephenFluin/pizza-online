import { Component, computed, inject } from '@angular/core';
import { GameService } from '../game/game.service';
import { RANKS, netWorth, rankOf } from '../game/awards';
import { cityDef } from '../game/data';
import { InsuranceType, POLICIES, insured, premium } from '../game/insurance';
import { DAYS_PER_MONTH, formatMoney } from '../game/model';
import { UiService } from '../game/ui.service';

/** Income and expenses for the current month, grouped by category. */
@Component({
  selector: 'app-finance-panel',
  template: `
    <section aria-labelledby="fin-title" class="fin">
      <div class="head">
        <h3 id="fin-title">This month</h3>
        <span class="links">
          <button type="button" class="secondary small" (click)="ui.open({ kind: 'stats' })">Statistics</button>
          <button type="button" class="secondary small" (click)="ui.open({ kind: 'research' })">Market research</button>
        </span>
      </div>
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

    <section aria-labelledby="loans-title" class="fin">
      <h3 id="loans-title">Loans and insurance</h3>
      <ul class="awards">
        @for (l of loans(); track l.id) {
          <li>{{ money(l.principal) }} loan: {{ money(l.remaining) }} left, {{ l.monthsLeft }} of {{ l.termMonths }} months to go</li>
        } @empty {
          <li>No loans. Phone the bank to borrow.</li>
        }
      </ul>
      <ul class="awards">
        @for (p of policies(); track p.label) {
          <li>{{ p.label }}: {{ p.on ? 'covered, ' + money(p.premium) + ' a month' : 'not insured' }}</li>
        }
      </ul>
      <p class="hint">Arrange cover by phoning your insurance broker.</p>
    </section>

    @if (status(); as st) {
      <section aria-labelledby="status-title" class="fin">
        <h3 id="status-title">Standing</h3>
        <p class="rank"><b>{{ st.rank }}</b> · net worth {{ money(st.worth) }}</p>
        @if (st.next; as n) {
          <p>Next: {{ n.title }} at {{ money(n.netWorth) }} <meter min="0" max="1" [value]="st.progress" aria-label="Progress to the next rank"></meter></p>
        }
        <h3>Awards</h3>
        <ul class="awards">
          @for (a of st.awards; track $index) {<li>🏆 {{ a.title }} {{ a.year }}, {{ a.city }}</li>} @empty {<li>No awards yet. The mayors present them at the end of each year.</li>}
        </ul>
        @if (st.favour.length) {
          <h3>Mayors’ favour</h3>
          <ul class="awards">
            @for (f of st.favour; track f.city) {<li>{{ f.city }}: {{ f.value }} / 200</li>}
          </ul>
        }
      </section>
    }
  `,
  styles: `
    .fin { min-width: min(360px, 80vw); margin-bottom: 16px; }
    .rank { font-size: 1.1rem; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .small { padding: 2px 8px; font-size: 0.85rem; }
    .links { display: flex; gap: 6px; }
    .awards { margin: 0 0 6px; padding-left: 18px; }
    .hint { margin: 0; font-size: 0.85rem; color: #555; }
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
  protected readonly ui = inject(UiService);

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

  protected readonly loans = computed(() => this.game.human()?.loans ?? []);
  protected readonly policies = computed(() => {
    const st = this.game.state();
    const me = this.game.human();
    if (!st || !me) return [];
    return (Object.keys(POLICIES) as InsuranceType[]).map((t) => ({ label: POLICIES[t].label, on: insured(me, t), premium: premium(st, me, t) }));
  });

  protected readonly status = computed(() => {
    const st = this.game.state();
    const me = this.game.human();
    if (!st || !me) return null;
    const worth = netWorth(st, me);
    const rank = rankOf(worth);
    const prev = RANKS[rank.index].netWorth;
    const progress = rank.next ? Math.max(0, Math.min(1, (worth - Math.max(0, prev)) / (rank.next.netWorth - Math.max(0, prev)))) : 1;
    return {
      rank: rank.title,
      worth,
      next: rank.next,
      progress,
      awards: (me.awards ?? []).map((a) => ({ ...a, city: cityDef(a.cityId).name })).reverse(),
      favour: Object.entries(me.favour ?? {}).filter(([, v]) => v > 0).map(([id, v]) => ({ city: cityDef(id).name, value: Math.round(v) })),
    };
  });

  protected money(n: number): string {
    return formatMoney(n);
  }
}
