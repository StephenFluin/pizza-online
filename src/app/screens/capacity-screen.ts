import { Component, DestroyRef, computed, inject } from '@angular/core';
import { CapacityReport, restaurantCapacity } from '../game/capacity';
import { GameService } from '../game/game.service';
import { Popularity, Restaurant } from '../game/model';
import { shopCycleTools } from './shop-nav';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';

const POPULARITY_ROWS: { key: keyof Popularity; label: string }[] = [
  { key: 'waiting', label: 'Waiting time' },
  { key: 'menu', label: 'Menu choice' },
  { key: 'advertising', label: 'Advertising' },
  { key: 'stars', label: 'Star rating' },
  { key: 'fulfilment', label: 'Demand met' },
  { key: 'prestige', label: 'Mayor & awards' },
  { key: 'supervision', label: 'Owner’s attention' },
];

/**
 * What limits a restaurant: demand against the capacity of its seating, stock,
 * cooks, ovens and waiters, plus the popularity behind the demand.
 */
@Component({
  selector: 'app-capacity-screen',
  template: `
    @if (restaurant(); as r) {
      @let rep = report()!;
      <div class="cap">
        <header class="head">
          <p class="verdict" [class.ok]="rep.limitedBy === 'popularity'" role="status">{{ verdict() }}</p>
        </header>

        <section class="board" aria-labelledby="cap-title">
          <h3 id="cap-title">Capacity <small>guests per day</small></h3>
          <div class="row demand-row">
            <span class="name">Demand</span>
            <div class="track"><div class="bar demand" [style.width.%]="pct(rep.demand)"></div></div>
            <span class="num">{{ rep.demand }}</span>
          </div>
          @for (c of rep.constraints; track c.id) {
            <div class="row" [class.limit]="rep.limitedBy === c.id">
              <span class="name">{{ c.label }}</span>
              <div class="track">
                <div class="bar cap-bar" [style.width.%]="pct(c.perDay)"></div>
                <div class="marker" [style.left.%]="pct(rep.demand)" aria-hidden="true"></div>
              </div>
              <span class="num">{{ c.perDay }}</span>
              <span class="detail">{{ c.detail }}@if (c.perDay < rep.demand) { · <b>{{ c.fix }}</b>}</span>
            </div>
          }
        </section>

        <div class="cols">
          <section class="panel-box" aria-labelledby="yesterday-title">
            <h3 id="yesterday-title">Yesterday</h3>
            <dl>
              <dt>Guests served</dt><dd>{{ r.lastDay.customers }}</dd>
              <dt>Lost: kitchen</dt><dd>{{ r.lastDay.lostKitchen }}</dd>
              <dt>Lost: waiters</dt><dd>{{ r.lastDay.lostFloor }}</dd>
              <dt>Lost: seats full</dt><dd>{{ r.lastDay.lostSeats }}</dd>
              <dt>Lost: out of stock</dt><dd>{{ r.lastDay.noStock }}</dd>
            </dl>
          </section>

          <section class="panel-box" aria-labelledby="pop-title">
            <h3 id="pop-title">Popularity <small>{{ signed(r.popularity.total) }} points</small></h3>
            <ul class="pop">
              @for (p of popularityRows(); track p.label) {
                <li>
                  <span>{{ p.label }}</span>
                  <div class="split" aria-hidden="true">
                    <div class="neg"><div [style.width.%]="p.value < 0 ? popPct(p.value) : 0"></div></div>
                    <div class="pos"><div [style.width.%]="p.value > 0 ? popPct(p.value) : 0"></div></div>
                  </div>
                  <b>{{ signed(p.value) }}</b>
                </li>
              }
            </ul>
          </section>

          <section class="panel-box" aria-labelledby="groups-title">
            <h3 id="groups-title">Popularity with customers</h3>
            <div class="groups">
              @for (g of rep.groups; track g.id) {
                <div class="group" [attr.title]="g.label + ': ' + g.liking + ' (' + share(g.share) + ' of locals)'">
                  <div class="column"><div class="fill" [style.height.%]="g.liking"></div></div>
                  <span class="glabel">{{ g.label }}</span>
                  <span class="gshare">{{ share(g.share) }}</span>
                </div>
              }
            </div>
            <p class="note">Bars show how much each group likes its favourite pizza on your menu; percentages are each group's share of local residents.</p>
          </section>
        </div>
      </div>
    } @else {
      <p>Open a restaurant to see its capacity.</p>
    }
  `,
  styles: `
    .cap { display: grid; gap: 12px; }
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
    .head select { font: inherit; padding: 4px; margin-left: 6px; }
    .verdict { margin: 0; padding: 6px 12px; background: #fff0c2; border-left: 5px solid #b7791f; font-weight: 700; }
    .verdict.ok { background: #e7f5e9; border-color: #2b8a3e; }
    .board { background: #1b1f1d; color: #e9ecef; border: 4px solid var(--steel-dark); border-radius: 4px; padding: 10px 14px; display: grid; gap: 6px; }
    .board h3 { margin: 0 0 4px; font-family: var(--font-lcd); font-weight: 400; font-size: 1.5rem; color: var(--lcd-text); text-transform: uppercase; }
    .board h3 small { font-size: 1rem; color: var(--lcd-dim); }
    .row { display: grid; grid-template-columns: 130px 1fr 50px; grid-template-areas: 'name track num' '. detail detail'; gap: 2px 10px; align-items: center; padding: 3px 4px; border-radius: 3px; }
    .row.limit { background: #5c1a1b; outline: 2px solid #ff6b5b; }
    .name { grid-area: name; font-family: var(--font-lcd); font-size: 1.25rem; text-transform: uppercase; color: var(--lcd-text); }
    .track { grid-area: track; position: relative; height: 16px; background: #2f3532; border-radius: 2px; overflow: hidden; }
    .bar { height: 100%; border-radius: 2px; }
    .bar.demand { background: repeating-linear-gradient(90deg, #f2c14e 0 6px, #d9a52f 6px 12px); }
    .bar.cap-bar { background: linear-gradient(180deg, #74c69d, #2d6a4f); }
    .row.limit .bar.cap-bar { background: linear-gradient(180deg, #ff8a7a, #b3261e); }
    .marker { position: absolute; top: -2px; bottom: -2px; width: 2px; background: #f2c14e; }
    .num { grid-area: num; text-align: right; font-family: var(--font-lcd); font-size: 1.3rem; color: #fff; }
    .detail { grid-area: detail; font-size: 0.8rem; color: #ced4da; }
    .detail b { color: #ffd166; font-weight: 400; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; align-items: start; }
    .panel-box { background: #fffaf0; border: 2px solid var(--line); padding: 8px 10px; }
    .panel-box h3 { margin: 0 0 6px; font-size: 1rem; } .panel-box h3 small { font-weight: 400; color: #555; }
    dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; margin: 0; }
    dt { font-weight: 400; } dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 700; }
    .pop { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 0.85rem; }
    .pop li { display: grid; grid-template-columns: 1fr 90px 34px; gap: 6px; align-items: center; }
    .pop b { text-align: right; }
    .split { display: grid; grid-template-columns: 1fr 1fr; height: 10px; background: #eee; }
    .split .neg { display: flex; justify-content: flex-end; }
    .split .neg div { background: var(--tomato); } .split .pos div { background: #2b8a3e; height: 100%; }
    .groups { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; align-items: end; height: 150px; }
    .group { display: grid; grid-template-rows: 1fr auto auto; justify-items: center; height: 100%; text-align: center; }
    .column { width: 22px; height: 100%; background: #e9ecef; display: flex; align-items: flex-end; border-radius: 2px; }
    .fill { width: 100%; background: linear-gradient(180deg, #f4a261, #e76f51); border-radius: 2px; }
    .glabel { font-size: 0.7rem; line-height: 1.1; }
    .gshare { font-size: 0.7rem; color: #555; }
    .note { margin: 6px 0 0; font-size: 0.75rem; color: #555; }
  `,
})
export class CapacityScreenComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);

  protected readonly mine = computed(() => {
    const me = this.game.human();
    return (this.game.state()?.restaurants ?? []).filter((r) => r.ownerId === me?.id);
  }, { equal: () => false });
  private readonly chosenId = this.ui.shopId;
  protected readonly restaurant = computed<Restaurant | null>(() => {
    const list = this.mine();
    return list.find((r) => r.id === this.chosenId()) ?? list[0] ?? null;
  }, { equal: () => false });
  protected readonly report = computed<CapacityReport | null>(() => {
    const st = this.game.state();
    const r = this.restaurant();
    return st && r ? restaurantCapacity(st, r) : null;
  });
  /** Scale for the bars: the biggest number on screen fills the track. */
  private readonly scale = computed(() => {
    const rep = this.report();
    return rep ? Math.max(1, rep.demand, ...rep.constraints.map((c) => c.perDay)) : 1;
  });
  protected readonly verdict = computed(() => {
    const rep = this.report();
    if (!rep) return '';
    if (rep.limitedBy === 'popularity') {
      return `Limited by popularity: about ${rep.demand} guests a day want to come and you could serve ${rep.servable}. More popularity would bring more guests.`;
    }
    const c = rep.constraints.find((x) => x.id === rep.limitedBy)!;
    return `Limited by ${c.label.toLowerCase()}: about ${rep.demand} guests a day want to come, but your ${c.label.toLowerCase()} can only handle ${c.perDay}. ${c.fix}`;
  });
  protected readonly popularityRows = computed(() => {
    const p = this.restaurant()?.popularity;
    return p ? POPULARITY_ROWS.map((row) => ({ label: row.label, value: p[row.key] as number })) : [];
  });

  private readonly lines = computed<LcdLine[]>(() => {
    const rep = this.report();
    const r = this.restaurant();
    if (!rep || !r) return [{ label: 'Capacity' }];
    const limit = rep.limitedBy === 'popularity' ? 'Popularity' : rep.constraints.find((c) => c.id === rep.limitedBy)!.label;
    return [
      { label: 'Capacity' },
      { label: r.name },
      { label: 'Demand', value: String(rep.demand) },
      { label: 'Can serve', value: String(rep.servable) },
      { label: 'Limit:' },
      { label: limit },
      { label: 'Popularity', value: this.signed(r.popularity.total) },
    ];
  });
  private readonly tools = computed<Tool[]>(() => {
    const r = this.restaurant();
    const id = r?.id;
    return [
      { id: 'room', label: 'View inside', icon: ICONS.restaurant, disabled: !r, action: () => id !== undefined && this.ui.open({ kind: 'interior', restaurantId: id }) },
      { id: 'staff', label: 'Staff', icon: ICONS.staff, disabled: !r, action: () => this.ui.open({ kind: 'staff', restaurantId: id }) },
      { id: 'stock', label: 'Stock', icon: ICONS.box, disabled: !r, action: () => this.ui.open({ kind: 'stock', restaurantId: id }) },
      { id: 'ads', label: 'Advertise', icon: ICONS.megaphone, action: () => this.ui.open({ kind: 'bank' }) },
      ...shopCycleTools(this.mine().map((x) => x.id), id, (next) => this.chosenId.set(next)),
      { id: 'back', label: 'Back', icon: ICONS.back, action: () => (this.game.dayReport() !== null ? this.ui.open({ kind: 'report' }) : this.ui.close()) },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }

  protected pct(n: number): number {
    return Math.min(100, (n / this.scale()) * 100);
  }

  protected popPct(v: number): number {
    return Math.min(100, (Math.abs(v) / 40) * 100);
  }

  protected share(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  protected signed(n: number): string {
    return n > 0 ? `+${n}` : String(n);
  }
}
