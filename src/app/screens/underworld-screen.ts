import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { cityDef } from '../game/data';
import { GameService } from '../game/game.service';
import { formatDate, formatMoney } from '../game/model';
import { statsOf } from '../game/owner-stats';
import { UiService } from '../game/ui.service';
import { BLACK_MARKET, JOB_TEXT, JobOffer, SABOTAGE, SabotageKind, hireFee, inJail, protectionFee } from '../game/underworld';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';

/** Back-street dealings in the current city: debts, protection, sabotage goods, rivals and the boss's jobs. */
@Component({
  selector: 'app-underworld-screen',
  template: `
    <div class="uw">
      <section class="box status" aria-labelledby="uw-status">
        <h3 id="uw-status">Your standing in {{ city() }}</h3>
        <ul>
          <li>Loan shark: {{ me()?.shark ? money(me()!.shark!.owed) + ' owed, due ' + due() + (me()!.shark!.strikes ? ' (' + me()!.shark!.strikes + ' strike' + (me()!.shark!.strikes === 1 ? '' : 's') + ')' : '') : 'nothing owed' }}</li>
          <li>Protection: {{ protectedHere() ? 'paying ' + money(fee()) + ' a week' : 'none' }}</li>
          <li>Police record: {{ me()?.record ?? 0 }} offence{{ (me()?.record ?? 0) === 1 ? '' : 's' }}@if (jailed()) {<b> · in jail until {{ jailEnd() }}</b>}</li>
        </ul>
        <button type="button" class="small secondary" (click)="ui.open({ kind: 'phone' })">Phone the back streets</button>
      </section>

      <div class="cols">
        <section class="box" aria-labelledby="uw-sabotage">
          <h3 id="uw-sabotage">Teach a rival a lesson</h3>
          @if (rivals().length) {
            <label>Target
              <select [value]="targetId()" (change)="targetId.set(+$any($event.target).value)">
                @for (r of rivals(); track r.id) {<option [value]="r.id">{{ r.name }}</option>}
              </select>
            </label>
            <ul class="goods">
              @for (g of goods(); track g.kind) {
                <li>
                  <span><b>{{ g.label }}</b> · {{ g.effect }}<br /><small>You have {{ g.have }}</small></span>
                  <span class="acts">
                    <button type="button" class="small" (click)="sabotage(g.kind, false)" [disabled]="!g.have || jailed()">Do it yourself ({{ ownChance() }}%)</button>
                    <button type="button" class="small secondary" (click)="sabotage(g.kind, true)" [disabled]="cash() < g.fee || jailed()">Hire the family ({{ money(g.fee) }})</button>
                  </span>
                </li>
              }
            </ul>
            <p class="hint">Doing it yourself depends on your dexterity; your courage keeps you from getting caught. The family almost never fails and is rarely traced back to you.</p>
          } @else {
            <p>No rival restaurants in {{ city() }}.</p>
          }
        </section>

        <section class="box" aria-labelledby="uw-jobs">
          <h3 id="uw-jobs">Jobs from the family</h3>
          @if (me()?.job; as job) {
            <div class="active">
              <b>Current job: {{ jobTitle(job.type) }}</b>
              <p>{{ jobStatus() }}</p>
            </div>
          }
          <ul class="jobs">
            @for (o of offers(); track o.id) {
              <li>
                <b>{{ jobTitle(o.type) }}</b> <small>· risk {{ pct(o.risk) }}</small>
                <p>{{ describe(o) }}</p>
                <button type="button" class="small" (click)="take(o)" [disabled]="!!me()?.job || jailed()">Take the job</button>
              </li>
            } @empty {
              <li>No work right now. The family has jobs for owners with restaurants in town, fresh each week.</li>
            }
          </ul>
        </section>
      </div>
      <p role="status" class="msg">{{ message() }}</p>
    </div>
  `,
  styles: `
    .uw { display: grid; gap: 10px; }
    .box { background: #f1ede4; border: 2px solid #8d99ae; padding: 8px 10px; }
    .status { background: #2b2d42; color: #edf2f4; border-color: #1d1e2c; }
    .status ul { margin: 0 0 8px; padding-left: 18px; }
    .box h3 { margin: 0 0 6px; font-size: 1rem; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; align-items: start; }
    label select { font: inherit; padding: 2px 4px; margin-left: 6px; }
    .goods, .jobs { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
    .goods li { display: grid; gap: 4px; padding: 6px 0; border-top: 1px solid #ccc; }
    .acts { display: flex; gap: 6px; flex-wrap: wrap; }
    .jobs li { padding: 6px 0; border-top: 1px solid #ccc; }
    .jobs p, .active p { margin: 4px 0; font-size: 0.9rem; }
    .active { background: #fff3d6; padding: 6px; border-radius: 4px; }
    .small { padding: 2px 10px; font-size: 0.85rem; }
    .hint { font-size: 0.8rem; color: #555; margin: 6px 0 0; }
    .msg { margin: 0; min-height: 1.3em; font-weight: 700; }
  `,
})
export class UnderworldScreenComponent {
  private readonly game = inject(GameService);
  protected readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);
  protected readonly message = signal('');

  protected readonly me = computed(() => this.game.human(), { equal: () => false });
  private readonly cityId = computed(() => this.game.state()?.currentCityId ?? 'rome');
  protected readonly city = computed(() => cityDef(this.cityId()).name);
  protected readonly cash = computed(() => this.game.human()?.cash ?? 0);
  protected readonly jailed = computed(() => {
    const st = this.game.state();
    return !!st && inJail(st, this.game.human());
  });
  protected readonly jailEnd = computed(() => formatDate(this.me()?.jailUntil ?? 0));
  protected readonly due = computed(() => formatDate(this.me()?.shark?.dueDay ?? 0));
  protected readonly protectedHere = computed(() => !!this.game.state()?.protection?.[this.cityId()]);
  protected readonly fee = computed(() => {
    const st = this.game.state();
    const me = this.game.human();
    return st && me ? protectionFee(st, me, this.cityId()) : 0;
  });
  protected readonly rivals = computed(() => {
    const st = this.game.state();
    const me = this.game.human();
    return (st?.restaurants ?? []).filter((r) => r.cityId === this.cityId() && r.ownerId !== me?.id);
  }, { equal: () => false });
  protected readonly targetId = linkedSignal(() => this.rivals()[0]?.id ?? 0);
  protected readonly goods = computed(() => {
    const day = this.game.state()?.day ?? 0;
    return BLACK_MARKET.map((b) => ({
      kind: b.kind,
      label: SABOTAGE[b.kind].label,
      effect: SABOTAGE[b.kind].effect,
      have: this.me()?.blackMarket?.[b.kind] ?? 0,
      fee: hireFee(this.cityId(), b.kind, day),
    }));
  });
  protected readonly ownChance = computed(() => Math.round(Math.max(5, Math.min(95, (0.45 + (statsOf(this.me()).dexterity - 50) / 150) * 100))));
  protected readonly offers = computed(() => this.game.state()?.jobOffers?.[this.cityId()] ?? []);
  protected readonly jobStatus = computed(() => {
    const job = this.me()?.job;
    if (!job) return '';
    if (job.type === 'delivery') {
      return job.cityId !== this.cityId()
        ? `It's in ${cityDef(job.cityId).name}.`
        : job.stage === 'pickup' ? 'Go to the city map and click the building with the parcel before closing time.' : 'Now click the building with the red flag to drop it off.';
    }
    return `It pays out on ${formatDate(job.dueDay)}.`;
  });

  private readonly lines = computed<LcdLine[]>(() => [
    { label: 'Back streets' },
    { label: this.city() },
    { label: 'Owed', value: this.me()?.shark ? formatMoney(this.me()!.shark!.owed) : '—' },
    { label: 'Record', value: String(this.me()?.record ?? 0) },
    { label: 'Job', value: this.me()?.job ? JOB_TEXT[this.me()!.job!.type].title.split(' ').slice(-1)[0] : '—' },
  ]);
  private readonly tools = computed<Tool[]>(() => [
    { id: 'phone', label: 'Phone', icon: ICONS.phone, action: () => this.ui.open({ kind: 'phone' }) },
    { id: 'map', label: 'City map', icon: ICONS.world, action: () => this.ui.close() },
    { id: 'back', label: 'Back', icon: ICONS.back, action: () => (this.game.dayReport() !== null ? this.ui.open({ kind: 'report' }) : this.ui.close()) },
  ]);

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }

  protected sabotage(kind: SabotageKind, hire: boolean): void {
    this.message.set(this.game.sabotage(this.targetId(), kind, hire));
  }

  protected take(o: JobOffer): void {
    const error = this.game.acceptJob(o);
    this.message.set(error ?? (o.type === 'delivery' ? 'Deal. The parcel is marked on your city map.' : 'Deal. The family will be in touch.'));
  }

  protected jobTitle(type: JobOffer['type']): string {
    return JOB_TEXT[type].title;
  }

  protected describe(o: JobOffer): string {
    return JOB_TEXT[o.type].describe(o);
  }

  protected pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  protected money(n: number): string {
    return formatMoney(n);
  }
}
