import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { reportTools } from './reports';
import { shopCycleTools } from './shop-nav';
import { netWorth, rankOf } from '../game/awards';
import { cityDef } from '../game/data';
import { GameService } from '../game/game.service';
import { DayStats, Restaurant, formatDate, formatMoney } from '../game/model';

type Tab = 'restaurant' | 'chain' | 'rivals';
type Metric = 'revenue' | 'customers' | 'turnedAway' | 'reputation';

const METRICS: { id: Metric; label: string }[] = [
  { id: 'revenue', label: 'Takings' },
  { id: 'customers', label: 'Guests' },
  { id: 'turnedAway', label: 'Turned away' },
  { id: 'reputation', label: 'Reputation' },
];

const CHART_W = 600;
const CHART_H = 180;
const PAD = 36;

const sum = (days: DayStats[], f: (d: DayStats) => number) => days.reduce((n, d) => n + f(d), 0);

/** Statistics: a restaurant's last month as a curve, its week in numbers, and comparisons across shops and chains. */
@Component({
  selector: 'app-stats-screen',
  template: `
    <div class="tabs" role="tablist" aria-label="Statistics">
      <button
        type="button"
        role="tab"
        [attr.aria-selected]="tab() === 'restaurant'"
        (click)="tab.set('restaurant')"
      >
        Restaurant
      </button>
      <button
        type="button"
        role="tab"
        [attr.aria-selected]="tab() === 'chain'"
        (click)="tab.set('chain')"
      >
        Your chain
      </button>
      <button
        type="button"
        role="tab"
        [attr.aria-selected]="tab() === 'rivals'"
        (click)="tab.set('rivals')"
      >
        All chains
      </button>
    </div>

    @switch (tab()) {
      @case ('restaurant') {
        @if (restaurant(); as r) {
          <div class="bar">
            <div class="metrics" role="radiogroup" aria-label="Show on the curve">
              @for (m of metrics; track m.id) {
                <button
                  type="button"
                  role="radio"
                  class="small"
                  [class.secondary]="metric() !== m.id"
                  [attr.aria-checked]="metric() === m.id"
                  (click)="metric.set(m.id)"
                >
                  {{ m.label }}
                </button>
              }
            </div>
          </div>

          <figure class="chart">
            <svg
              [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH"
              role="img"
              [attr.aria-label]="chartLabel()"
            >
              @for (g of curve().grid; track g.y) {
                <line
                  [attr.x1]="pad"
                  [attr.x2]="chartW - 8"
                  [attr.y1]="g.y"
                  [attr.y2]="g.y"
                  class="grid"
                />
                <text [attr.x]="pad - 4" [attr.y]="g.y + 4" text-anchor="end">{{ g.label }}</text>
              }
              @for (b of curve().bars; track b.x) {
                <rect
                  [attr.x]="b.x"
                  [attr.y]="b.y"
                  [attr.width]="b.w"
                  [attr.height]="b.h"
                  [class.week]="b.week"
                />
              }
              <polyline [attr.points]="curve().line" class="line" />
              <text [attr.x]="pad" [attr.y]="chartH - 4">{{ curve().first }}</text>
              <text [attr.x]="chartW - 8" [attr.y]="chartH - 4" text-anchor="end">
                {{ curve().last }}
              </text>
            </svg>
            <figcaption>{{ chartLabel() }}. The last seven days are highlighted.</figcaption>
          </figure>

          <div class="cols">
            <table>
              <caption>
                The week’s takings
              </caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Guests</th>
                  <th scope="col">Lost</th>
                  <th scope="col">Takings</th>
                  <th scope="col">Food</th>
                  <th scope="col">Margin</th>
                </tr>
              </thead>
              <tbody>
                @for (d of week(); track d.day) {
                  <tr>
                    <th scope="row">{{ shortDate(d.day) }}</th>
                    <td>{{ d.capacity === 0 && d.customers === 0 ? 'closed' : d.customers }}</td>
                    <td>{{ d.turnedAway }}</td>
                    <td>{{ money(d.revenue) }}</td>
                    <td>{{ money(d.foodCost) }}</td>
                    <td [class.neg]="d.revenue - d.foodCost < 0">
                      {{ money(d.revenue - d.foodCost) }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">No finished days yet.</td>
                  </tr>
                }
              </tbody>
              @if (week().length) {
                <tfoot>
                  <tr>
                    <th scope="row">Week</th>
                    <td>{{ weekTotals().customers }}</td>
                    <td>{{ weekTotals().turnedAway }}</td>
                    <td>{{ money(weekTotals().revenue) }}</td>
                    <td>{{ money(weekTotals().foodCost) }}</td>
                    <td>{{ money(weekTotals().revenue - weekTotals().foodCost) }}</td>
                  </tr>
                </tfoot>
              }
            </table>

            <table>
              <caption>
                Pizzas sold this week
              </caption>
              <thead>
                <tr>
                  <th scope="col">Pizza</th>
                  <th scope="col">Sold</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                @for (p of pizzas(); track p.name) {
                  <tr>
                    <th scope="row">{{ p.name }}</th>
                    <td>{{ p.sold }}</td>
                    <td>
                      <meter
                        min="0"
                        max="1"
                        [value]="p.share"
                        [attr.aria-label]="p.name + ' share of sales'"
                      ></meter>
                      {{ pct(p.share) }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3">Nothing sold yet this week.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p>You don’t own a restaurant yet.</p>
        }
      }

      @case ('chain') {
        <table class="wide">
          <caption>
            Your restaurants over the last seven days
          </caption>
          <thead>
            <tr>
              <th scope="col">Restaurant</th>
              <th scope="col">Guests</th>
              <th scope="col">Lost</th>
              <th scope="col">Takings</th>
              <th scope="col">Margin</th>
              <th scope="col">Per guest</th>
              <th scope="col">Reputation</th>
              <th scope="col">Popularity</th>
              <th scope="col">Stars</th>
              <th scope="col">Seats / staff</th>
            </tr>
          </thead>
          <tbody>
            @for (row of chain(); track row.id) {
              <tr [class.best]="row.best" [class.worst]="row.worst">
                <th scope="row">
                  {{ row.name }}<br /><small>{{ row.city }}</small>
                </th>
                <td>{{ row.customers }}</td>
                <td>{{ row.lost }}</td>
                <td>{{ money(row.revenue) }}</td>
                <td [class.neg]="row.margin < 0">{{ money(row.margin) }}</td>
                <td>{{ money(row.perGuest) }}</td>
                <td>{{ pct(row.reputation) }}</td>
                <td>{{ row.popularity }}</td>
                <td>{{ stars(row.stars) }}</td>
                <td>{{ row.seats }} / {{ row.staff }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="10">You don’t own a restaurant yet.</td>
              </tr>
            }
          </tbody>
        </table>
        @if (chain().length > 1) {
          <p class="hint">
            Your best earner this week is highlighted in green, the weakest in red.
          </p>
        }
      }

      @case ('rivals') {
        <table class="wide">
          <caption>
            Every chain, yesterday
          </caption>
          <thead>
            <tr>
              <th scope="col">Owner</th>
              <th scope="col">Restaurants</th>
              <th scope="col">Cities</th>
              <th scope="col">Guests</th>
              <th scope="col">Takings</th>
              <th scope="col">Avg reputation</th>
              <th scope="col">Net worth</th>
              <th scope="col">Rank</th>
            </tr>
          </thead>
          <tbody>
            @for (row of chains(); track row.id) {
              <tr [class.me]="row.me">
                <th scope="row">{{ row.name }}</th>
                <td>{{ row.shops }}</td>
                <td>{{ row.cities }}</td>
                <td>{{ row.customers }}</td>
                <td>{{ money(row.revenue) }}</td>
                <td>{{ pct(row.reputation) }}</td>
                <td>{{ money(row.worth) }}</td>
                <td class="wrap">{{ row.rank }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    }
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 10px;
    }
    .tabs button {
      background: #ddd2bb;
      color: var(--ink);
      border: 2px solid var(--wood);
    }
    .tabs button[aria-selected='true'] {
      background: var(--wood);
      color: var(--cream);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }
    .metrics {
      display: flex;
      gap: 4px;
    }
    .small {
      padding: 2px 8px;
      font-size: 0.85rem;
    }
    .chart {
      margin: 10px 0;
      background: var(--lcd);
      border-radius: 6px;
      padding: 6px;
    }
    .chart svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .chart text {
      fill: var(--lcd-dim);
      font: 11px var(--font-lcd);
    }
    .chart .grid {
      stroke: #ffffff22;
    }
    .chart rect {
      fill: #8a6a2a;
    }
    .chart rect.week {
      fill: var(--lcd-text);
    }
    .chart .line {
      fill: none;
      stroke: #f4a261;
      stroke-width: 2;
    }
    figcaption {
      color: var(--lcd-dim);
      font-size: 0.8rem;
      padding: 0 4px;
    }
    .cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 16px;
      align-items: start;
    }
    td,
    th {
      white-space: nowrap;
    }
    thead th,
    td.wrap {
      white-space: normal;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    caption {
      text-align: left;
      font-weight: 700;
      font-family: Georgia, serif;
      font-size: 1.05rem;
      padding-bottom: 4px;
    }
    th,
    td {
      padding: 3px 6px;
      border-top: 1px solid var(--line);
      text-align: right;
    }
    th[scope='row'],
    thead th:first-child {
      text-align: left;
      font-weight: 400;
    }
    thead th {
      font-size: 0.8rem;
      text-transform: uppercase;
      color: #555;
    }
    tfoot th,
    tfoot td {
      font-weight: 700;
    }
    .wide {
      overflow-x: auto;
      display: block;
      font-size: 0.92rem;
    }
    .wide th,
    .wide td {
      padding: 3px 4px;
    }
    tr.best {
      background: #dcefd5;
    }
    tr.worst {
      background: #f6d9d2;
    }
    tr.me {
      background: var(--cream);
      font-weight: 700;
    }
    .neg {
      color: var(--tomato);
    }
    meter {
      width: 70px;
      vertical-align: middle;
    }
    .hint {
      font-size: 0.85rem;
      color: #555;
    }
    .link {
      background: none;
      border: 0;
      padding: 0;
      color: var(--ink);
      text-decoration: underline;
      cursor: pointer;
      font: inherit;
    }
  `,
})
export class StatsScreenComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);

  protected readonly metrics = METRICS;
  protected readonly chartW = CHART_W;
  protected readonly chartH = CHART_H;
  protected readonly pad = PAD;
  protected readonly tab = signal<Tab>('restaurant');
  protected readonly metric = signal<Metric>('revenue');

  protected readonly mine = computed(() => {
    const me = this.game.human();
    return (this.game.state()?.restaurants ?? []).filter((r) => r.ownerId === me?.id);
  });
  private readonly chosenId = this.ui.shopId;
  protected readonly restaurant = computed<Restaurant | null>(() => {
    const list = this.mine();
    return list.find((r) => r.id === this.chosenId()) ?? list[0] ?? null;
  });

  private readonly history = computed(() => (this.restaurant()?.history ?? []).slice(-30));
  protected readonly week = computed(() => this.history().slice(-7).reverse());
  protected readonly weekTotals = computed(() => {
    const w = this.week();
    return {
      customers: sum(w, (d) => d.customers),
      turnedAway: sum(w, (d) => d.turnedAway),
      revenue: sum(w, (d) => d.revenue),
      foodCost: sum(w, (d) => d.foodCost),
    };
  });

  protected readonly pizzas = computed(() => {
    const st = this.game.state();
    const r = this.restaurant();
    if (!st || !r) return [];
    const totals = new Map<string, number>();
    // Finished days keep their sales tallies; today's sales so far count too.
    const days = [...this.history().slice(-7), r.today];
    for (const d of days) {
      for (const [id, n] of Object.entries(d.sold ?? {})) totals.set(id, (totals.get(id) ?? 0) + n);
      if (d === r.today)
        for (const [id, s] of Object.entries(d.pizzas ?? {}))
          totals.set(id, (totals.get(id) ?? 0) + s.sold);
    }
    const all = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals]
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({
        name: st.recipes.find((x) => x.id === id)?.name ?? 'Old recipe',
        sold: n,
        share: all ? n / all : 0,
      }))
      .sort((a, b) => b.sold - a.sold);
  });

  protected readonly chartLabel = computed(() => {
    const label = METRICS.find((m) => m.id === this.metric())?.label ?? '';
    return `${label} per day over the last ${this.history().length} days at ${this.restaurant()?.name ?? ''}`;
  });

  protected readonly curve = computed(() => {
    const days = this.history();
    const metric = this.metric();
    const value = (d: DayStats) => (metric === 'reputation' ? d.reputation * 100 : d[metric]);
    const values = days.map(value);
    const top = Math.max(metric === 'reputation' ? 100 : 1, ...values);
    const n = Math.max(days.length, 7);
    const plotW = CHART_W - PAD - 8;
    const plotH = CHART_H - 28;
    const step = plotW / n;
    const y = (v: number) => 8 + plotH - (v / top) * plotH;
    const fmt = (v: number) =>
      metric === 'revenue'
        ? formatMoney(v)
        : metric === 'reputation'
          ? `${Math.round(v)}%`
          : String(Math.round(v));
    const bars = values.map((v, i) => ({
      x: PAD + i * step + step * 0.15,
      y: y(v),
      w: step * 0.7,
      h: Math.max(0, 8 + plotH - y(v)),
      week: i >= values.length - 7,
    }));
    const line = values.map((v, i) => `${PAD + i * step + step / 2},${y(v)}`).join(' ');
    const grid = [0, 0.5, 1].map((f) => ({ y: y(top * f), label: fmt(top * f) }));
    return {
      bars,
      line,
      grid,
      first: days.length ? formatDate(days[0].day) : '',
      last: days.length ? formatDate(days[days.length - 1].day) : '',
    };
  });

  protected readonly chain = computed(() => {
    const st = this.game.state();
    if (!st) return [];
    const rows = this.mine().map((r) => {
      const w = (r.history ?? []).slice(-7);
      const customers = sum(w, (d) => d.customers);
      const revenue = sum(w, (d) => d.revenue);
      return {
        id: r.id,
        name: r.name,
        city: cityDef(r.cityId).name,
        customers,
        lost: sum(w, (d) => d.turnedAway),
        revenue,
        margin: revenue - sum(w, (d) => d.foodCost),
        perGuest: customers ? revenue / customers : 0,
        reputation: r.reputation,
        popularity: Math.round(r.popularity.total),
        stars: r.stars ?? 0,
        seats: r.seats,
        staff: r.staff.length,
        best: false,
        worst: false,
      };
    });
    if (rows.length > 1) {
      const sorted = [...rows].sort((a, b) => b.margin - a.margin);
      sorted[0].best = true;
      sorted[sorted.length - 1].worst = true;
    }
    return rows;
  });

  protected readonly chains = computed(() => {
    const st = this.game.state();
    if (!st) return [];
    return st.players
      .map((p) => {
        const shops = st.restaurants.filter((r) => r.ownerId === p.id);
        const worth = netWorth(st, p);
        return {
          id: p.id,
          name: p.name,
          me: p.isHuman,
          shops: shops.length,
          cities: new Set(shops.map((r) => r.cityId)).size,
          customers: sum(
            shops.map((r) => r.lastDay),
            (d) => d.customers,
          ),
          revenue: sum(
            shops.map((r) => r.lastDay),
            (d) => d.revenue,
          ),
          reputation: shops.length ? shops.reduce((n, r) => n + r.reputation, 0) / shops.length : 0,
          worth,
          rank: rankOf(worth).title,
        };
      })
      .sort((a, b) => b.worth - a.worth);
  });

  private readonly lines = computed<LcdLine[]>(() => {
    const r = this.restaurant();
    const w = this.weekTotals();
    return [
      { label: 'Statistics' },
      { label: r?.name ?? '' },
      { label: 'Week guests', value: String(w.customers) },
      { label: 'Week takings', value: formatMoney(w.revenue) },
    ];
  });
  private readonly tools = computed<Tool[]>(() => [
    ...reportTools(this.ui, 'stats'),
    ...shopCycleTools(
      this.mine().map((r) => r.id),
      this.restaurant()?.id,
      (id) => this.open(id),
    ),
    {
      id: 'back',
      label: 'Back',
      icon: ICONS.back,
      action: () =>
        this.game.dayReport() !== null ? this.ui.open({ kind: 'report' }) : this.ui.close(),
    },
  ]);

  constructor() {
    inject(DestroyRef).onDestroy(
      inject(ShellService).register(this, { lines: this.lines, tools: this.tools }),
    );
  }

  protected open(id: number): void {
    this.chosenId.set(id);
    this.tab.set('restaurant');
  }

  protected shortDate(day: number): string {
    return formatDate(day).replace(/ \d{4}$/, '');
  }

  protected money(n: number): string {
    return formatMoney(n);
  }

  protected pct(f: number): string {
    return `${Math.round(f * 100)}%`;
  }

  protected stars(n: number): string {
    return n ? '★'.repeat(n) : '–';
  }
}
