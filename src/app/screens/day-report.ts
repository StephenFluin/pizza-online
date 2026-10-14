import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { GameService } from '../game/game.service';
import { formatDate, formatMoney } from '../game/model';
import { RestaurantReview, reviewCompany } from '../game/report';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';

/**
 * Full-screen end-of-day report: every restaurant at a glance, and a detailed
 * review of the selected one explaining what worked and what didn't.
 */
@Component({
  selector: 'app-day-report',
  template: `
    <div class="report">
      <header class="head">
        <h2>End of day · {{ date() }}</h2>
        <div class="totals" aria-label="Company totals">
          <span><b>{{ totals().guests }}</b> guests</span>
          <span><b>{{ totals().lost }}</b> turned away</span>
          <span><b>{{ money(totals().revenue) }}</b> takings</span>
          <span [class.neg]="totals().profit < 0"><b>{{ money(totals().profit) }}</b> profit</span>
        </div>
      </header>

      <div class="body">
        <ul class="list" aria-label="Your restaurants">
          @for (r of reviews(); track r.id) {
            <li>
              <button type="button" class="row" [attr.aria-current]="selected()?.id === r.id" (click)="selectedId.set(r.id)">
                <span class="name">{{ r.name }}</span>
                <span class="city">{{ r.city }}</span>
                <span class="nums">{{ r.day.customers }} guests · <b [class.neg]="r.profit < 0">{{ money(r.profit) }}</b></span>
                <svg class="spark" viewBox="0 0 70 20" aria-hidden="true">
                  <polyline [attr.points]="spark(r)" />
                </svg>
                @if (problems(r) > 0) {
                  <span class="badge" [attr.aria-label]="problems(r) + ' problems'">{{ problems(r) }}</span>
                }
              </button>
            </li>
          }
        </ul>

        @if (selected(); as r) {
          <section class="detail" [attr.aria-label]="'Review of ' + r.name">
            <h3>{{ r.name }} <small>{{ r.city }}</small></h3>
            <div class="kpis">
              <div><span>Guests</span><b>{{ r.day.customers }}</b></div>
              <div><span>Turned away</span><b>{{ r.day.turnedAway }}</b></div>
              <div><span>Takings</span><b>{{ money(r.day.revenue) }}</b></div>
              <div><span>Ingredients</span><b>{{ money(r.day.foodCost) }}</b></div>
              <div><span>Rent + wages</span><b>{{ money(r.overhead) }}</b></div>
              <div><span>Profit</span><b [class.neg]="r.profit < 0">{{ money(r.profit) }}</b></div>
              <div><span>Capacity used</span><b>{{ pct(r.utilisation) }}</b></div>
              <div><span>Reputation</span><b>{{ pct(r.reputation) }} <small [class.neg]="r.reputationTrend < 0">{{ trend(r.reputationTrend) }}</small></b></div>
            </div>

            <h4>What happened <button type="button" class="link-btn" (click)="ui.open({ kind: 'capacity', restaurantId: r.id })">See what limits this restaurant</button></h4>
            <ul class="findings">
              @for (f of r.findings; track $index) {
                <li [class]="f.tone"><span class="icon" aria-hidden="true">{{ f.tone === 'good' ? '▲' : f.tone === 'bad' ? '▼' : '•' }}</span><span class="sr-only">{{ toneLabel(f.tone) }}: </span>{{ f.text }}</li>
              }
            </ul>

            <h4>Pizzas</h4>
            <table>
              <thead><tr><th scope="col">Pizza</th><th scope="col">Price</th><th scope="col">Wanted</th><th scope="col">Sold</th><th scope="col">Takings</th><th scope="col">Margin</th></tr></thead>
              <tbody>
                @for (p of r.pizzas; track p.recipeId) {
                  <tr>
                    <th scope="row">{{ p.name }}</th>
                    <td>{{ money(p.price) }}</td>
                    <td>{{ p.ordered }}</td>
                    <td>{{ p.sold }}</td>
                    <td>{{ money(p.revenue) }}</td>
                    <td>{{ p.sold ? pct(p.margin) : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>

            @if (r.week.length > 1) {
              <h4>Last {{ r.week.length }} days</h4>
              <div class="bars" role="img" [attr.aria-label]="weekLabel(r)">
                @for (w of r.week; track w.day) {
                  <div class="bar" [style.--h]="barHeight(r, w.guests)" [class.loss]="w.profit < 0" [attr.title]="w.guests + ' guests, ' + money(w.profit)">
                    <span>{{ w.guests }}</span>
                  </div>
                }
              </div>
            }
          </section>
        }
      </div>

      <footer class="foot">
        <label class="check"><input type="checkbox" [checked]="game.reportEachDay()" (change)="game.reportEachDay.set($any($event.target).checked)" /> Show this report every evening</label>
        <button type="button" class="continue" (click)="continue()">Next day</button>
      </footer>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .report { height: 100%; display: grid; grid-template-rows: auto 1fr auto; gap: 10px; padding: 14px; background: #f3efe6; border: 4px solid var(--wood-dark); }
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px; border-bottom: 3px double var(--wood); padding-bottom: 6px; }
    h2 { margin: 0; font-family: Georgia, serif; font-size: 1.6rem; }
    .totals { display: flex; gap: 16px; flex-wrap: wrap; font-variant-numeric: tabular-nums; }
    .neg { color: var(--tomato); }
    .body { display: grid; grid-template-columns: 280px 1fr; gap: 14px; min-height: 0; }
    .list { list-style: none; margin: 0; padding: 0; overflow: auto; display: grid; gap: 6px; align-content: start; }
    .row { position: relative; width: 100%; display: grid; grid-template-columns: 1fr 70px; grid-template-areas: 'name spark' 'city spark' 'nums spark'; text-align: left; gap: 0 8px;
      background: #fffaf0; color: var(--ink); border: 2px solid var(--line); font-weight: 400; padding: 6px 8px; }
    .row[aria-current='true'] { border-color: var(--wood); background: #fff3d6; }
    .name { grid-area: name; font-weight: 700; }
    .city { grid-area: city; font-size: 0.85rem; }
    .nums { grid-area: nums; font-size: 0.9rem; }
    .spark { grid-area: spark; width: 70px; height: 40px; align-self: center; }
    .spark polyline { fill: none; stroke: var(--wood); stroke-width: 2; }
    .badge { position: absolute; top: -6px; right: -6px; background: var(--tomato); color: #fff; border-radius: 999px; min-width: 22px; text-align: center; font-size: 0.8rem; font-weight: 700; padding: 1px 6px; }
    .detail { overflow: auto; background: #fffaf0; border: 2px solid var(--line); padding: 12px; min-height: 0; }
    h3 { margin: 0 0 8px; } h3 small { font-weight: 400; color: #555; }
    .link-btn { background: none; border: none; color: var(--ink-soft); text-decoration: underline; font-size: 0.85rem; text-transform: none; letter-spacing: 0; padding: 0 0 0 8px; font-weight: 400; }
    h4 { margin: 14px 0 6px; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; }
    .kpis div { background: var(--lcd); color: var(--lcd-text); font-family: var(--font-lcd); padding: 4px 8px; border-radius: 2px; display: grid; }
    .kpis span { font-size: 1rem; color: var(--lcd-dim); text-transform: uppercase; }
    .kpis b { font-size: 1.5rem; font-weight: 400; }
    .kpis .neg { color: #ff6b5b; }
    .findings { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .findings li { display: flex; gap: 8px; padding: 5px 8px; border-left: 4px solid; background: #fff; }
    .findings .good { border-color: #2b8a3e; } .findings .good .icon { color: #2b8a3e; }
    .findings .bad { border-color: var(--tomato); } .findings .bad .icon { color: var(--tomato); }
    .findings .tip { border-color: #b7791f; } .findings .tip .icon { color: #b7791f; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 4px 6px; border-top: 1px solid var(--line); }
    td { text-align: right; } thead th:not(:first-child) { text-align: right; }
    .bars { display: flex; gap: 6px; align-items: flex-end; height: 120px; padding-top: 16px; }
    .bar { flex: 1; height: calc(var(--h) * 100%); min-height: 4px; background: var(--wood-light); position: relative; border-radius: 2px 2px 0 0; }
    .bar.loss { background: var(--tomato); }
    .bar span { position: absolute; top: -18px; left: 0; right: 0; text-align: center; font-size: 0.8rem; }
    .foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .check { display: flex; gap: 6px; align-items: center; }
    .continue { font-size: 1.1rem; padding: 10px 22px; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    @media (max-width: 800px) { .body { grid-template-columns: 1fr; } .list { max-height: 30dvh; } }
  `,
})
export class DayReportComponent {
  protected readonly game = inject(GameService);
  protected readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);

  protected readonly reviews = computed(() => {
    const st = this.game.state();
    return st ? reviewCompany(st) : [];
  });
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => {
    const list = this.reviews();
    // Default to the restaurant with the most problems.
    return list.find((r) => r.id === this.selectedId()) ?? [...list].sort((a, b) => this.problems(b) - this.problems(a))[0] ?? null;
  });
  protected readonly date = computed(() => formatDate(this.game.dayReport() ?? this.game.state()?.day ?? 0));
  protected readonly totals = computed(() =>
    this.reviews().reduce(
      (t, r) => ({ guests: t.guests + r.day.customers, lost: t.lost + r.day.turnedAway, revenue: t.revenue + r.day.revenue, profit: t.profit + r.profit }),
      { guests: 0, lost: 0, revenue: 0, profit: 0 },
    ),
  );

  private readonly lines = computed<LcdLine[]>(() => {
    const t = this.totals();
    return [
      { label: 'Day report' },
      { label: 'Restaurants', value: String(this.reviews().length) },
      { label: 'Guests', value: String(t.guests) },
      { label: 'Lost', value: String(t.lost) },
      { label: 'Takings', value: formatMoney(t.revenue) },
      { label: 'Profit', value: formatMoney(t.profit) },
    ];
  });
  private readonly tools = computed<Tool[]>(() => {
    const list = this.reviews();
    const i = list.findIndex((r) => r.id === this.selected()?.id);
    const sel = this.selected();
    return [
      { id: 'continue', label: 'Next day', icon: ICONS.sun, action: () => this.continue() },
      { id: 'prev', label: 'Previous', icon: ICONS.up, disabled: list.length < 2, action: () => this.selectedId.set(list[(i - 1 + list.length) % list.length].id) },
      { id: 'next', label: 'Next', icon: ICONS.down, disabled: list.length < 2, action: () => this.selectedId.set(list[(i + 1) % list.length].id) },
      { id: 'view', label: 'View inside', icon: ICONS.restaurant, disabled: !sel, action: () => sel && this.ui.open({ kind: 'interior', restaurantId: sel.id }) },
      { id: 'staff', label: 'Staff', icon: ICONS.staff, action: () => this.ui.open({ kind: 'staff', restaurantId: sel?.id }) },
      { id: 'capacity', label: 'Capacity', icon: ICONS.zoom, disabled: !sel, action: () => sel && this.ui.open({ kind: 'capacity', restaurantId: sel.id }) },
      { id: 'stock', label: 'Stock', icon: ICONS.box, disabled: !sel, action: () => sel && this.ui.open({ kind: 'stock', restaurantId: sel.id }) },
      { id: 'finances', label: 'Finances', icon: ICONS.chart, action: () => this.ui.open({ kind: 'finances' }) },
      { id: 'stats', label: 'Statistics', icon: ICONS.chart, action: () => this.ui.open({ kind: 'stats', restaurantId: sel?.id }) },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }

  protected continue(): void {
    this.ui.close();
    this.game.continueDay();
  }

  protected problems(r: RestaurantReview): number {
    return r.findings.filter((f) => f.tone === 'bad').length;
  }

  protected spark(r: RestaurantReview): string {
    const w = r.week;
    if (w.length < 2) return '';
    const max = Math.max(1, ...w.map((x) => x.guests));
    return w.map((x, i) => `${(i / (w.length - 1)) * 68 + 1},${19 - (x.guests / max) * 18}`).join(' ');
  }

  protected barHeight(r: RestaurantReview, guests: number): number {
    return guests / Math.max(1, ...r.week.map((w) => w.guests));
  }

  protected weekLabel(r: RestaurantReview): string {
    return `Guests per day: ${r.week.map((w) => w.guests).join(', ')}`;
  }

  protected toneLabel(tone: string): string {
    return tone === 'good' ? 'Working' : tone === 'bad' ? 'Problem' : 'Tip';
  }

  protected trend(v: number): string {
    const pts = Math.round(v * 100);
    return pts === 0 ? '' : `${pts > 0 ? '+' : ''}${pts}`;
  }

  protected pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  protected money(n: number): string {
    return formatMoney(n);
  }
}
