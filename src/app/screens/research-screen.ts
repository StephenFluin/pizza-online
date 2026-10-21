import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { cityDef, ingredient } from '../game/data';
import { GameService } from '../game/game.service';
import { CustomerGroup, District, formatMoney } from '../game/model';
import { conditions, trendNotes } from '../game/newspaper';
import { CUSTOMER_GROUPS, GROUP_TASTES, cachedPizzaStats } from '../game/pizza-stats';
import { districtAppetite } from '../game/simulation';

type Page = 'area' | 'taste' | 'competitors' | 'trends';

const PAGES: { id: Page; label: string }[] = [
  { id: 'area', label: 'Districts' },
  { id: 'taste', label: 'Customer taste' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'trends', label: 'Trends' },
];

const FLAVOURS = ['fat', 'sweet', 'salty', 'hot'] as const;
const FLAVOUR_LABELS: Record<(typeof FLAVOURS)[number], string> = {
  fat: 'Rich',
  sweet: 'Sweet',
  salty: 'Salty',
  hot: 'Hot',
};
const VALUES = [
  { id: 'appearance', label: 'looks' },
  { id: 'refinement', label: 'fine ingredients' },
  { id: 'normality', label: 'a sensible pizza' },
  { id: 'trend', label: 'what’s in fashion' },
  { id: 'imitation', label: 'familiar classics' },
] as const;

const wealthLabel = (w: number) => (w > 0.7 ? 'wealthy' : w > 0.4 ? 'comfortable' : 'modest');
const groupLabel = (g: CustomerGroup) => CUSTOMER_GROUPS.find((x) => x.id === g)?.label ?? g;

/** Market research for the current city: districts, what each kind of customer likes, the competition and the trends. */
@Component({
  selector: 'app-research-screen',
  template: `
    <div class="tabs" role="tablist" aria-label="Market research">
      @for (p of pages; track p.id) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="page() === p.id"
          (click)="page.set(p.id)"
        >
          {{ p.label }}
        </button>
      }
    </div>
    <p class="intro">
      Research for <b>{{ cityName() }}</b
      >. Travel to another city to research it.
    </p>

    @switch (page()) {
      @case ('area') {
        <table class="wide">
          <caption>
            Districts and their appetite for pizza (meals a day)
          </caption>
          <thead>
            <tr>
              <th scope="col">District</th>
              <th scope="col">Residents</th>
              <th scope="col">Wealth</th>
              <th scope="col">Mostly</th>
              <th scope="col">Pizzerias</th>
              <th scope="col">Yours</th>
              <th scope="col">Rivals’</th>
              <th scope="col">Unserved</th>
            </tr>
          </thead>
          <tbody>
            @for (d of districts(); track d.id) {
              <tr [class.chosen]="d.id === districtId()">
                <th scope="row">
                  <button
                    type="button"
                    class="link"
                    (click)="districtId.set(d.id)"
                    [attr.aria-pressed]="d.id === districtId()"
                  >
                    {{ d.name }}
                  </button>
                </th>
                <td>{{ d.population.toLocaleString('en-US') }}</td>
                <td>{{ d.wealth }}</td>
                <td class="wrap">{{ d.mostly }}</td>
                <td>{{ d.shops }}</td>
                <td>{{ d.mine }}</td>
                <td>{{ d.rivals }}</td>
                <td [class.hot]="d.opening">{{ d.unserved }}</td>
              </tr>
            }
          </tbody>
        </table>
        <p class="hint">
          “Unserved” counts residents who fancy a pizza but find nothing in town worth going out
          for. The hottest openings are highlighted.
        </p>

        @if (district(); as d) {
          <section class="card" aria-labelledby="district-title">
            <h3 id="district-title">{{ d.name }}</h3>
            <div class="cols">
              <div>
                <h4>Who lives here</h4>
                <ul class="bars">
                  @for (g of mix(); track g.id) {
                    <li>
                      <span>{{ g.label }}</span
                      ><span class="bar"><span [style.width.%]="g.bar * 100"></span></span
                      ><span>{{ pct(g.share) }}</span>
                    </li>
                  }
                </ul>
              </div>
              <dl>
                <dt>Wealth</dt>
                <dd>{{ wealth(d.wealth) }}</dd>
                <dt>Patience</dt>
                <dd>{{ d.serviceMinutes }} minutes for a pizza</dd>
                <dt>Menu</dt>
                <dd>likes {{ d.desiredStandard }} classics and {{ d.desiredOwn }} house pizzas</dd>
                <dt>Loves</dt>
                <dd>{{ loves() }}</dd>
                <dt>Avoids</dt>
                <dd>{{ avoids() }}</dd>
              </dl>
            </div>
          </section>
        }
      }

      @case ('taste') {
        <table>
          <caption>
            What each kind of customer likes in a pizza
          </caption>
          <thead>
            <tr>
              <th scope="col">Customers</th>
              @for (f of flavours; track f) {
                <th scope="col">{{ flavourLabel(f) }}</th>
              }
              <th scope="col">Also cares about</th>
            </tr>
          </thead>
          <tbody>
            @for (g of tastes(); track g.id) {
              <tr>
                <th scope="row">{{ g.label }}</th>
                @for (v of g.flavours; track $index) {
                  <td>
                    <span class="taste" [class.up]="v >= 50">{{ v >= 50 ? '▲' : '▽' }}</span>
                    {{ v }}%
                  </td>
                }
                <td class="wrap">{{ g.values }}</td>
              </tr>
            }
          </tbody>
        </table>
        <p class="hint">
          Percentages are how strong each flavour should be. Match a group’s flavours and the pizza
          wins them over.
        </p>

        <table class="matrix">
          <caption>
            How your pizzas go down with each group here
          </caption>
          <thead>
            <tr>
              <th scope="col">Pizza</th>
              @for (g of groups; track g.id) {
                <th scope="col">{{ g.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of matrix(); track row.id) {
              <tr>
                <th scope="row">
                  {{ row.name }}
                  @if (row.onMenu) {
                    <small> · on a menu here</small>
                  }
                </th>
                @for (v of row.scores; track $index) {
                  <td [class.good]="v >= 70" [class.poor]="v < 50">{{ v }}</td>
                }
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="groups.length + 1">Your cook book is empty.</td>
              </tr>
            }
          </tbody>
        </table>
      }

      @case ('competitors') {
        <div class="cols">
          <section aria-labelledby="turnover-title">
            <h3 id="turnover-title">Takings here, last seven days</h3>
            <ul class="bars">
              @for (o of owners(); track o.id) {
                <li [class.me]="o.me">
                  <span>{{ o.name }}</span
                  ><span class="bar"><span [style.width.%]="o.turnoverShare * 100"></span></span
                  ><span>{{ money(o.turnover) }}</span>
                </li>
              }
            </ul>
          </section>
          <section aria-labelledby="share-title">
            <h3 id="share-title">Market share, yesterday’s guests</h3>
            <ul class="bars">
              @for (o of owners(); track o.id) {
                <li [class.me]="o.me">
                  <span>{{ o.name }}</span
                  ><span class="bar"><span [style.width.%]="o.share * 100"></span></span
                  ><span>{{ pct(o.share) }}</span>
                </li>
              }
            </ul>
          </section>
        </div>
        <table class="wide">
          <caption>
            Every pizzeria in
            {{
              cityName()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Pizzeria</th>
              <th scope="col">District</th>
              <th scope="col">Seats</th>
              <th scope="col">Pizzas</th>
              <th scope="col">Prices</th>
              <th scope="col">Stars</th>
              <th scope="col">Guests</th>
              <th scope="col">Best seller</th>
            </tr>
          </thead>
          <tbody>
            @for (r of shops(); track r.id) {
              <tr [class.me]="r.me">
                <th scope="row">
                  {{ r.name }}<br /><small>{{ r.owner }}</small>
                </th>
                <td>{{ r.district }}</td>
                <td>{{ r.seats }}</td>
                <td>{{ r.pizzas }}</td>
                <td>{{ r.prices }}</td>
                <td>{{ r.stars }}</td>
                <td>{{ r.guests }}</td>
                <td class="wrap">{{ r.best }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">Nobody sells pizza here yet.</td>
              </tr>
            }
          </tbody>
        </table>
      }

      @case ('trends') {
        <div class="cols">
          <section aria-labelledby="economy-title">
            <h3 id="economy-title">Economy</h3>
            <p>
              <meter
                min="-1"
                max="1"
                low="-0.2"
                high="0.2"
                optimum="1"
                [value]="economy().value"
                aria-label="Economy"
              ></meter>
              {{ economy().label }}
            </p>
            <p>{{ economy().demand }}</p>
            @if (economy().occasion; as o) {
              <p>{{ o }}</p>
            }
            <h3>Ingredients in the news</h3>
            <ul>
              @for (t of trends(); track t) {
                <li>{{ t }}</li>
              } @empty {
                <li>No fads at the moment.</li>
              }
            </ul>
          </section>
          <section aria-labelledby="charts-title">
            <h3 id="charts-title">Pizza charts</h3>
            <ol>
              @for (c of charts(); track $index) {
                <li>
                  <b>{{ c.recipeName }}</b> ({{ c.owner }}), {{ c.sold }} sold
                </li>
              } @empty {
                <li>The first charts come out at the end of the week.</li>
              }
            </ol>
            <h3>Town favourites</h3>
            <p>{{ townLoves() }}</p>
            <h3>Least wanted</h3>
            <p>{{ townAvoids() }}</p>
          </section>
        </div>
      }
    }
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
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
    .intro {
      margin: 8px 0;
    }
    .cols + table {
      margin-top: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
      margin-bottom: 8px;
    }
    caption {
      text-align: left;
      font-weight: 700;
      font-family: Georgia, serif;
      font-size: 1.05rem;
      padding-bottom: 4px;
    }
    .wide th,
    .wide td {
      padding: 3px 4px;
    }
    th,
    td {
      padding: 3px 5px;
      border-top: 1px solid var(--line);
      text-align: right;
      white-space: nowrap;
    }
    th[scope='row'],
    thead th:first-child {
      text-align: left;
      font-weight: 400;
    }
    thead th {
      font-size: 0.78rem;
      text-transform: uppercase;
      color: #555;
      white-space: normal;
    }
    td.wrap {
      white-space: normal;
      text-align: left;
    }
    .wide {
      display: block;
      overflow-x: auto;
      font-size: 0.92rem;
    }
    tr.chosen,
    tr.me {
      background: var(--cream);
    }
    tr.me {
      font-weight: 700;
    }
    td.hot {
      background: #dcefd5;
      font-weight: 700;
    }
    .matrix td.good {
      background: #dcefd5;
    }
    .matrix td.poor {
      background: #f6d9d2;
    }
    .taste {
      color: #a33;
    }
    .taste.up {
      color: #2d6a2d;
    }
    .hint {
      font-size: 0.85rem;
      color: #555;
      margin: 0 0 12px;
    }
    .card {
      background: #fffaf0;
      border: 2px solid var(--wood);
      border-radius: 8px;
      padding: 10px 14px;
    }
    .card h3 {
      margin: 0 0 6px;
      font-family: Georgia, serif;
    }
    h4 {
      margin: 0 0 4px;
    }
    .cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      align-items: start;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 3px 10px;
      margin: 0;
    }
    dt {
      font-weight: 600;
    }
    dd {
      margin: 0;
    }
    .bars {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 4px;
    }
    .bars li {
      display: grid;
      grid-template-columns: 9em 1fr 4.5em;
      gap: 6px;
      align-items: center;
    }
    .bars li > span:last-child {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .bars li.me {
      font-weight: 700;
    }
    .bar {
      height: 12px;
      background: #e6dcc6;
      border-radius: 3px;
      overflow: hidden;
    }
    .bar > span {
      display: block;
      height: 100%;
      background: var(--tomato);
    }
    meter {
      width: 120px;
      vertical-align: middle;
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
export class ResearchScreenComponent {
  private readonly game = inject(GameService);
  readonly startDistrict = input<number | undefined>(undefined);

  protected readonly pages = PAGES;
  protected readonly flavours = FLAVOURS;
  protected readonly groups = CUSTOMER_GROUPS;
  readonly startPage = input<Page | undefined>(undefined);
  protected readonly page = linkedSignal<Page>(() => this.startPage() ?? 'area');
  protected readonly districtId = linkedSignal(() => this.startDistrict() ?? 0);

  private readonly city = computed(() => this.game.city());
  protected readonly cityName = computed(
    () => cityDef(this.game.state()?.currentCityId ?? 'rome').name,
  );
  private readonly appetite = computed(() => {
    const st = this.game.state();
    return st ? districtAppetite(st, st.currentCityId) : [];
  });

  protected readonly districts = computed(() => {
    const st = this.game.state();
    const city = this.city();
    const me = this.game.human();
    if (!st || !city || !me) return [];
    const appetite = this.appetite();
    const unserved = appetite.map((a) => a.unserved).sort((a, b) => b - a);
    const threshold = unserved[Math.min(2, unserved.length - 1)] ?? Infinity;
    return city.districts.map((d) => {
      const a = appetite.find((x) => x.districtId === d.id);
      let mine = 0;
      let rivals = 0;
      for (const [owner, n] of a?.byOwner ?? []) {
        if (owner === me.id) mine += n;
        else rivals += n;
      }
      return {
        id: d.id,
        name: d.name,
        population: d.population,
        wealth: wealthLabel(d.wealth),
        mostly: this.topGroups(d, 2),
        shops: st.restaurants.filter(
          (r) => r.cityId === city.id && city.lots[r.lotId]?.district === d.id,
        ).length,
        mine: Math.round(mine),
        rivals: Math.round(rivals),
        unserved: Math.round(a?.unserved ?? 0),
        opening: (a?.unserved ?? 0) >= threshold,
      };
    });
  });

  protected readonly district = computed<District | null>(
    () => this.city()?.districts.find((d) => d.id === this.districtId()) ?? null,
  );
  protected readonly mix = computed(() => {
    const d = this.district();
    if (!d) return [];
    const top = Math.max(0.01, ...CUSTOMER_GROUPS.map((g) => d.groupMix[g.id] ?? 0));
    return CUSTOMER_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      share: d.groupMix[g.id] ?? 0,
      bar: (d.groupMix[g.id] ?? 0) / top,
    })).sort((a, b) => b.share - a.share);
  });
  private readonly ranked = computed(() =>
    Object.entries(this.district()?.tastes ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([id, v]) => ({ name: ingredient(id).name.toLowerCase(), v })),
  );
  protected readonly loves = computed(
    () =>
      this.ranked()
        .filter((t) => t.v > 0.1)
        .slice(0, 5)
        .map((t) => t.name)
        .join(', ') || 'nothing in particular',
  );
  protected readonly avoids = computed(
    () =>
      this.ranked()
        .filter((t) => t.v < -0.1)
        .slice(-4)
        .reverse()
        .map((t) => t.name)
        .join(', ') || 'nothing in particular',
  );

  protected readonly tastes = computed(() =>
    CUSTOMER_GROUPS.map((g) => {
      const t = GROUP_TASTES[g.id];
      const values = VALUES.filter((v) => t[v.id] >= 0.1).map((v) => v.label);
      return {
        id: g.id,
        label: g.label,
        flavours: FLAVOURS.map((f) => t[f]),
        values: values.join(', ') || 'mostly the flavour',
      };
    }),
  );

  protected readonly matrix = computed(() => {
    const st = this.game.state();
    const me = this.game.human();
    const city = this.city();
    if (!st || !me || !city) return [];
    const onMenu = new Set(
      st.restaurants
        .filter((r) => r.ownerId === me.id && r.cityId === city.id)
        .flatMap((r) => r.menu.map((m) => m.recipeId)),
    );
    return st.recipes
      .filter((r) => r.ownerId === me.id || r.ownerId === null)
      .map((r) => {
        const stats = cachedPizzaStats(r, city.districts);
        return {
          id: r.id,
          name: r.name,
          onMenu: onMenu.has(r.id),
          scores: CUSTOMER_GROUPS.map((g) => Math.round(stats.groups[g.id])),
        };
      })
      .sort((a, b) => Number(b.onMenu) - Number(a.onMenu));
  });

  protected readonly owners = computed(() => {
    const st = this.game.state();
    if (!st) return [];
    const here = st.restaurants.filter((r) => r.cityId === st.currentCityId);
    const rows = st.players
      .map((p) => {
        const shops = here.filter((r) => r.ownerId === p.id);
        return {
          id: p.id,
          name: p.name,
          me: p.isHuman,
          turnover: shops.reduce(
            (n, r) => n + (r.history ?? []).slice(-7).reduce((m, d) => m + d.revenue, 0),
            0,
          ),
          guests: shops.reduce((n, r) => n + r.lastDay.customers, 0),
        };
      })
      .filter((o) => o.me || o.turnover > 0 || here.some((r) => r.ownerId === o.id));
    const top = Math.max(1, ...rows.map((o) => o.turnover));
    const guests = Math.max(
      1,
      rows.reduce((n, o) => n + o.guests, 0),
    );
    return rows
      .map((o) => ({ ...o, turnoverShare: o.turnover / top, share: o.guests / guests }))
      .sort((a, b) => b.turnover - a.turnover);
  });

  protected readonly shops = computed(() => {
    const st = this.game.state();
    const city = this.city();
    if (!st || !city) return [];
    return st.restaurants
      .filter((r) => r.cityId === city.id)
      .map((r) => {
        const owner = st.players.find((p) => p.id === r.ownerId);
        const prices = r.menu.map((m) => m.price);
        const best = Object.entries(r.lastDay.pizzas ?? {}).sort(
          (a, b) => b[1].sold - a[1].sold,
        )[0];
        return {
          id: r.id,
          name: r.name,
          owner: owner?.name ?? '',
          me: !!owner?.isHuman,
          district: city.districts[city.lots[r.lotId]?.district]?.name ?? '',
          seats: r.seats,
          pizzas: r.menu.length,
          prices: prices.length
            ? `${formatMoney(Math.min(...prices))}–${formatMoney(Math.max(...prices))}`
            : '–',
          stars: r.stars ? '★'.repeat(r.stars) : '–',
          guests: r.lastDay.customers,
          best:
            best && best[1].sold > 0
              ? (st.recipes.find((x) => x.id === best[0])?.name ?? '–')
              : '–',
        };
      })
      .sort((a, b) => b.guests - a.guests);
  });

  protected readonly economy = computed(() => {
    const st = this.game.state();
    if (!st) return { value: 0, label: '', demand: '', occasion: null as string | null };
    const c = conditions(st, st.currentCityId);
    const e = c.economy;
    const label =
      e > 0.4
        ? 'Booming'
        : e > 0.1
          ? 'Growing'
          : e > -0.1
            ? 'Steady'
            : e > -0.4
              ? 'Tightening'
              : 'In a slump';
    const demand = `Demand for eating out is ${e >= 0 ? 'up' : 'down'} about ${Math.round(Math.abs(e) * 15)}% on normal.`;
    const occasion =
      c.boostDays > 0 && c.demandBoost !== 0
        ? `${c.demandBoost > 0 ? 'A special occasion adds' : 'The weather costs'} about ${Math.round(Math.abs(c.demandBoost) * 100)}% for ${c.boostDays} more day${c.boostDays === 1 ? '' : 's'}.`
        : null;
    return { value: e, label, demand, occasion };
  });
  protected readonly trends = computed(() => {
    const st = this.game.state();
    return st ? trendNotes(st, st.currentCityId) : [];
  });
  protected readonly charts = computed(() => {
    const st = this.game.state();
    return st?.charts?.[st.currentCityId] ?? [];
  });
  private readonly townTastes = computed(() => {
    const city = this.city();
    if (!city) return [];
    const pop = city.districts.reduce((n, d) => n + d.population, 0) || 1;
    const totals = new Map<string, number>();
    for (const d of city.districts)
      for (const [id, v] of Object.entries(d.tastes))
        totals.set(id, (totals.get(id) ?? 0) + (v * d.population) / pop);
    return [...totals].sort((a, b) => b[1] - a[1]).map(([id]) => ingredient(id).name.toLowerCase());
  });
  protected readonly townLoves = computed(() => this.townTastes().slice(0, 6).join(', '));
  protected readonly townAvoids = computed(() => this.townTastes().slice(-4).reverse().join(', '));

  private topGroups(d: District, n: number): string {
    return CUSTOMER_GROUPS.map((g) => ({
      label: groupLabel(g.id).toLowerCase(),
      v: d.groupMix[g.id] ?? 0,
    }))
      .sort((a, b) => b.v - a.v)
      .slice(0, n)
      .map((g) => g.label)
      .join(', ');
  }

  protected flavourLabel(f: (typeof FLAVOURS)[number]): string {
    return FLAVOUR_LABELS[f];
  }

  protected wealth(w: number): string {
    return wealthLabel(w);
  }

  protected pct(f: number): string {
    return `${Math.round(f * 100)}%`;
  }

  protected money(n: number): string {
    return formatMoney(n);
  }
}
