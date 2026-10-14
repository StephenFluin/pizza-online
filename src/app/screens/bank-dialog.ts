import { Component, computed, inject } from '@angular/core';
import { cityDef } from '../game/data';
import { AD_OPTIONS, GameService } from '../game/game.service';
import { AdKind, formatMoney } from '../game/model';

/** Loans and advertising campaigns. */
@Component({
  selector: 'app-bank-dialog',
  template: `
    <p class="hint">Loans are arranged by phoning the bank.</p>
    <section aria-labelledby="ads-title">
      <h3 id="ads-title">Advertising in {{ cityName() }}</h3>
      <ul class="ads">
        @for (opt of options(); track opt.kind) {
          <li>
            <span><b>{{ opt.label }}</b> · {{ opt.days }} days · +{{ opt.boost * 100 }}% attraction</span>
            <button type="button" class="small" (click)="game.advertise(opt.kind, cityId())" [disabled]="cash() < opt.cost">{{ money(opt.cost) }}</button>
          </li>
        }
      </ul>
      @if (running().length) {
        <p>Running: {{ running() }}</p>
      }
    </section>
  `,
  styles: `
    .hint { margin: 0 0 8px; }
    .ads { list-style: none; padding: 0; margin: 0; min-width: min(460px, 80vw); }
    .ads li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--line); }
    .small { padding: 2px 8px; font-size: 0.85rem; }
  `,
})
export class BankDialogComponent {
  protected readonly game = inject(GameService);
  protected readonly cash = computed(() => this.game.human()?.cash ?? 0);
  protected readonly cityId = computed(() => this.game.state()?.currentCityId ?? 'rome');
  protected readonly cityName = computed(() => cityDef(this.cityId()).name);
  protected readonly options = computed(() => {
    const col = cityDef(this.cityId()).costOfLiving;
    return (Object.keys(AD_OPTIONS) as AdKind[]).map((kind) => ({ kind, ...AD_OPTIONS[kind], cost: AD_OPTIONS[kind].cost * col }));
  });
  protected readonly running = computed(() =>
    (this.game.human()?.ads ?? [])
      .filter((a) => a.cityId === this.cityId())
      .map((a) => `${AD_OPTIONS[a.kind].label} (${a.daysLeft} days left)`)
      .join(', '),
  );

  protected money(n: number): string {
    return formatMoney(n);
  }
}
