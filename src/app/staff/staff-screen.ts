import { Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { PortraitComponent } from '../characters/portrait';
import { cityDef } from '../game/data';
import { GameService } from '../game/game.service';
import { ManagerSettings, Staff, StaffRole, formatMoney } from '../game/model';
import { COURSES, Course, ROLE_LABEL, ROLE_STAT, activeManager, defaultManagerSettings, effectiveSkill, staffLook } from '../game/staff';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';

type Filter = StaffRole | 'all';

/** Staff for one restaurant: the team, the city's job market, training and pay. */
@Component({
  selector: 'app-staff-screen',
  imports: [PortraitComponent],
  template: `
    @if (restaurant(); as r) {
      <div class="staff">
        <header class="head">
          <label>Restaurant
            <select [value]="r.id" (change)="chosenId.set(+$any($event.target).value)">
              @for (x of mine(); track x.id) {<option [value]="x.id">{{ x.name }}</option>}
            </select>
          </label>
          <div class="filters" role="radiogroup" aria-label="Show">
            @for (f of filters; track f.id) {
              <button type="button" role="radio" class="plate" [attr.aria-checked]="filter() === f.id" (click)="filter.set(f.id)">{{ f.label }}</button>
            }
          </div>
        </header>

        <section class="manager" aria-labelledby="manager-title">
          <h3 id="manager-title">Manager</h3>
          @if (manager(); as mgr) {
            @let ms = settings()!;
            <p><b>{{ mgr.name }}</b> runs {{ r.name }} for you (management {{ mgr.management }}).</p>
            <div class="settings">
              <label class="check"><input type="checkbox" [checked]="ms.hire" (change)="set({ hire: $any($event.target).checked })" /> Hire cooks and waiters when we're short</label>
              <div class="sub" [class.off]="!ms.hire">
                <label>At least <input type="number" min="0" max="6" [value]="ms.minCooks" (change)="setNumber('minCooks', $any($event.target).valueAsNumber, 0, 6)" [disabled]="!ms.hire" aria-label="Minimum cooks" /> cooks</label>
                <label>and <input type="number" min="0" max="6" [value]="ms.minWaiters" (change)="setNumber('minWaiters', $any($event.target).valueAsNumber, 0, 6)" [disabled]="!ms.hire" aria-label="Minimum waiters" /> waiters</label>
                <label>paying up to <input class="wide" type="number" min="500" max="20000" step="100" [value]="ms.maxWage" (change)="setNumber('maxWage', $any($event.target).valueAsNumber, 500, 20000)" [disabled]="!ms.hire" aria-label="Highest monthly wage" /> a month</label>
              </div>
              <label class="check"><input type="checkbox" [checked]="ms.shopping" (change)="set({ shopping: $any($event.target).checked })" /> Do the shopping (top up menu ingredients each morning)</label>
              <label class="check"><input type="checkbox" [checked]="ms.prices" (change)="set({ prices: $any($event.target).checked })" /> Adjust prices (up when busy, down when quiet)</label>
              <label class="check"><input type="checkbox" [checked]="ms.incidents" (change)="set({ incidents: $any($event.target).checked })" /> Handle late arrivals, sick days and petty theft without asking me</label>
            </div>
          } @else if (managerAway()) {
            <p>Your manager is away at the moment, so nothing is delegated until they're back.</p>
          } @else {
            <p>No manager. Hire one from the job market below to delegate hiring, shopping, pricing and day-to-day staff matters.</p>
          }
        </section>

        <div class="cols">
          <section aria-labelledby="team-title">
            <h3 id="team-title">Your team ({{ team().length }})</h3>
            <ul class="people">
              @for (s of team(); track s.id) {
                <li class="person" [class.away]="!!s.course || !!s.daysAway">
                  <app-portrait [cacheKey]="'staff-' + s.id" [look]="look(s)" [background]="teamColor" [size]="56" alt="" />
                  <div class="info">
                    <b>{{ s.name }}</b> <span class="role">{{ roleLabel(s.role) }}</span>
                    <div class="bars">
                      <span>{{ statName(s.role) }}</span><meter min="0" max="100" [value]="mainStat(s)" [attr.aria-label]="statName(s.role)"></meter><span>{{ mainStat(s) }}</span>
                      <span>Motivation</span><meter min="0" max="100" low="35" high="65" optimum="100" [value]="s.motivation" aria-label="Motivation"></meter><span>{{ s.motivation }}</span>
                    </div>
                    <small>{{ money(s.wagePerMonth) }}/month · works at {{ pct(effective(s)) }}
                      @if (s.course) { · on a course, {{ s.course.daysLeft }} days left }
                      @if (s.daysAway) { · off sick, {{ s.daysAway }} days }
                    </small>
                    <div class="actions">
                      <button type="button" class="tiny" (click)="training.set(training() === s.id ? null : s.id)" [disabled]="!!s.course" [attr.aria-expanded]="training() === s.id">Train</button>
                      <button type="button" class="tiny secondary" (click)="game.raise(r.id, s.id, 0.1)">Raise 10%</button>
                      <button type="button" class="tiny secondary" (click)="fire(s)">Fire</button>
                    </div>
                    @if (training() === s.id) {
                      <ul class="courses">
                        @for (c of coursesFor(s); track c.name) {
                          <li>
                            <button type="button" class="tiny" (click)="train(s, c)" [disabled]="s[c.stat] >= c.maxStat || cash() < cost(c)">
                              {{ c.name }} · +{{ c.gain }} {{ c.stat }} · {{ c.days }} days · {{ money(cost(c)) }}
                            </button>
                          </li>
                        }
                      </ul>
                    }
                  </div>
                </li>
              } @empty {
                <li class="empty">Nobody here yet. Hire from the job market.</li>
              }
            </ul>
          </section>

          <section aria-labelledby="market-title">
            <h3 id="market-title">Looking for work in {{ cityName() }}</h3>
            <ul class="people">
              @for (s of market(); track s.id) {
                <li class="person">
                  <app-portrait [cacheKey]="'staff-' + s.id" [look]="look(s)" [background]="marketColor" [size]="56" alt="" />
                  <div class="info">
                    <b>{{ s.name }}</b> <span class="role">{{ roleLabel(s.role) }}</span>
                    <small>{{ statName(s.role) }} {{ mainStat(s) }} · intelligence {{ s.intelligence }} · trust {{ s.trustworthiness }} · {{ s.role === 'cook' ? s.pizzasPerDay + ' pizzas a day' : 'personality ' + s.personality }}</small>
                    <small>Wants {{ money(s.wagePerMonth) }}/month</small>
                    <div class="actions"><button type="button" class="tiny" (click)="hire(s)">Hire</button></div>
                  </div>
                </li>
              } @empty {
                <li class="empty">Nobody suitable this week. New people arrive every Monday.</li>
              }
            </ul>
          </section>
        </div>
        <p role="status" class="msg">{{ message() }}</p>
      </div>
    } @else {
      <p>Open a restaurant first, then hire its staff here.</p>
    }
  `,
  styles: `
    .staff { display: grid; gap: 10px; }
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 10px; }
    .head select { font: inherit; padding: 4px; margin-left: 6px; }
    .filters { display: flex; gap: 6px; flex-wrap: wrap; }
    .plate { font-family: var(--font-lcd); font-size: 1.2rem; text-transform: uppercase; padding: 2px 10px; color: #2b1d0e; font-weight: 400;
      background: linear-gradient(180deg, #ffe08a, #e0b23c); border: 3px solid; border-color: #b07a2a #5c3a12 #5c3a12 #b07a2a; border-radius: 2px; }
    .plate[aria-checked='true'] { background: linear-gradient(180deg, #fff3c4, #f2c14e); outline: 2px solid #7a4a1c; }
    .manager { background: #fffaf0; border: 2px solid var(--line); padding: 8px 10px; }
    .manager p { margin: 0 0 6px; }
    .settings { display: grid; gap: 4px; }
    .check { display: flex; gap: 6px; align-items: center; }
    .sub { display: flex; flex-wrap: wrap; gap: 4px 10px; padding-left: 24px; font-size: 0.9rem; }
    .sub.off { opacity: 0.5; }
    .sub input { width: 52px; font: inherit; padding: 0 4px; }
    .sub input.wide { width: 80px; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
    h3 { margin: 0 0 6px; }
    .people { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .person { display: grid; grid-template-columns: 56px 1fr; gap: 8px; background: #fffaf0; border: 2px solid var(--line); padding: 6px; }
    .person.away { opacity: 0.75; }
    .info { display: grid; gap: 3px; min-width: 0; }
    .role { font-size: 0.8rem; background: var(--ink); color: var(--cream); padding: 0 6px; border-radius: 3px; }
    .bars { display: grid; grid-template-columns: auto 1fr auto; gap: 2px 6px; align-items: center; font-size: 0.8rem; }
    .bars meter { width: 100%; }
    .actions { display: flex; gap: 4px; flex-wrap: wrap; }
    .tiny { padding: 1px 8px; font-size: 0.8rem; }
    .courses { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
    .courses button { width: 100%; text-align: left; }
    .empty { padding: 8px; }
    .msg { margin: 0; min-height: 1.3em; }
    @container (max-width: 700px) { .cols { grid-template-columns: 1fr; } }
    :host { display: block; container-type: inline-size; }
  `,
})
export class StaffScreenComponent {
  protected readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);
  readonly restaurantId = input<number | undefined>(undefined);

  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'cook', label: 'Cooks' },
    { id: 'waiter', label: 'Waiters' },
    { id: 'manager', label: 'Managers' },
  ];
  protected readonly teamColor = 0x8d99ae;
  protected readonly marketColor = 0xc9ada7;
  protected readonly filter = signal<Filter>('all');
  protected readonly training = signal<number | null>(null);
  protected readonly message = signal('');

  protected readonly mine = computed(() => {
    const me = this.game.human();
    return (this.game.state()?.restaurants ?? []).filter((r) => r.ownerId === me?.id);
  }, { equal: () => false });
  protected readonly chosenId = linkedSignal(() => this.restaurantId() ?? null);
  protected readonly restaurant = computed(() => {
    const list = this.mine();
    return list.find((r) => r.id === this.chosenId()) ?? list[0] ?? null;
  }, { equal: () => false });
  protected readonly manager = computed(() => {
    const r = this.restaurant();
    return r ? (activeManager(r) ?? null) : null;
  });
  protected readonly managerAway = computed(() => !!this.restaurant()?.staff.some((s) => s.role === 'manager'));
  protected readonly settings = computed(() => {
    const r = this.restaurant();
    return r && this.manager() ? { ...defaultManagerSettings(cityDef(r.cityId).costOfLiving), ...r.managerSettings } : null;
  });
  protected readonly cityName = computed(() => cityDef(this.restaurant()?.cityId ?? 'rome').name);
  private readonly col = computed(() => cityDef(this.restaurant()?.cityId ?? 'rome').costOfLiving);
  protected readonly cash = computed(() => this.game.human()?.cash ?? 0);
  private readonly matches = (s: Staff) => this.filter() === 'all' || s.role === this.filter();
  protected readonly team = computed(() => (this.restaurant()?.staff ?? []).filter(this.matches));
  protected readonly market = computed(() => {
    const r = this.restaurant();
    return r ? this.game.applicantsFor(r).filter(this.matches) : [];
  });

  private readonly lines = computed<LcdLine[]>(() => {
    const r = this.restaurant();
    if (!r) return [{ label: 'Staff' }];
    const count = (role: StaffRole) => r.staff.filter((s) => s.role === role).length;
    const payroll = r.staff.reduce((n, s) => n + s.wagePerMonth, 0);
    const motivation = r.staff.length ? Math.round(r.staff.reduce((n, s) => n + s.motivation, 0) / r.staff.length) : 0;
    return [
      { label: 'Staff' },
      { label: r.name },
      { label: 'Cooks', value: String(count('cook')) },
      { label: 'Waiters', value: String(count('waiter')) },
      { label: 'Manager', value: count('manager') ? 'Yes' : 'No' },
      { label: 'Payroll', value: formatMoney(payroll) },
      { label: 'Motivation', value: String(motivation) },
    ];
  });
  private readonly tools = computed<Tool[]>(() => {
    const list = this.mine();
    const i = list.findIndex((r) => r.id === this.restaurant()?.id);
    const f = this.filter();
    return [
      { id: 'all', label: 'All staff', icon: ICONS.staff, pressed: f === 'all', action: () => this.filter.set('all') },
      { id: 'cook', label: 'Cooks', icon: ICONS.pizza, pressed: f === 'cook', action: () => this.filter.set('cook') },
      { id: 'waiter', label: 'Waiters', icon: ICONS.restaurant, pressed: f === 'waiter', action: () => this.filter.set('waiter') },
      { id: 'manager', label: 'Managers', icon: ICONS.person, pressed: f === 'manager', action: () => this.filter.set('manager') },
      { id: 'prev', label: 'Prev shop', icon: ICONS.left, disabled: list.length < 2, action: () => this.chosenId.set(list[(i - 1 + list.length) % list.length].id) },
      { id: 'next', label: 'Next shop', icon: ICONS.right, disabled: list.length < 2, action: () => this.chosenId.set(list[(i + 1) % list.length].id) },
      { id: 'phone', label: 'Agency', icon: ICONS.phone, action: () => this.ui.open({ kind: 'phone' }) },
      { id: 'back', label: 'Back', icon: ICONS.back, action: () => (this.game.dayReport() !== null ? this.ui.open({ kind: 'report' }) : this.ui.close()) },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }

  protected set(change: Partial<ManagerSettings>): void {
    const r = this.restaurant();
    if (r) this.game.updateManagerSettings(r.id, change);
  }

  protected setNumber(key: 'minCooks' | 'minWaiters' | 'maxWage', value: number, min: number, max: number): void {
    if (Number.isFinite(value)) this.set({ [key]: Math.max(min, Math.min(max, Math.round(value))) });
  }

  protected look(s: Staff) {
    return staffLook(s);
  }

  protected roleLabel(role: StaffRole): string {
    return ROLE_LABEL[role];
  }

  protected statName(role: StaffRole): string {
    const stat = ROLE_STAT[role];
    return stat[0].toUpperCase() + stat.slice(1);
  }

  protected mainStat(s: Staff): number {
    return s[ROLE_STAT[s.role]];
  }

  protected effective(s: Staff): number {
    return effectiveSkill(s) / Math.max(0.01, s[ROLE_STAT[s.role]] / 100);
  }

  protected coursesFor(s: Staff): Course[] {
    return COURSES.filter((c) => c.stat === ROLE_STAT[s.role] || c.stat === 'management');
  }

  protected cost(c: Course): number {
    return c.cost * this.col();
  }

  protected hire(s: Staff): void {
    const r = this.restaurant();
    if (!r) return;
    const error = this.game.hire(r.id, s);
    this.message.set(error ?? `${s.name} starts tomorrow as ${ROLE_LABEL[s.role].toLowerCase()}.`);
  }

  protected fire(s: Staff): void {
    const r = this.restaurant();
    if (r && confirm(`Let ${s.name} go?`)) {
      this.game.fire(r.id, s.id);
      this.message.set(`${s.name} has left.`);
    }
  }

  protected train(s: Staff, c: Course): void {
    const r = this.restaurant();
    if (r && this.game.train(r.id, s.id, c)) {
      this.message.set(`${s.name} is off on the ${c.name} course for ${c.days} days.`);
      this.training.set(null);
    }
  }

  protected pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  protected money(n: number): string {
    return formatMoney(n);
  }
}
