import { Component, computed, inject } from '@angular/core';
import { GameService, GameSpeed } from '../game/game.service';
import { formatDate, formatMoney, formatTime } from '../game/model';

@Component({
  selector: 'app-hud',
  template: `
    <header class="hud">
      <strong class="city">{{ game.city()?.name }}</strong>
      <span>{{ date() }}</span>
      <span aria-live="off">{{ time() }}</span>
      <span class="cash" [class.negative]="(game.human()?.cash ?? 0) < 0">{{ cash() }}</span>
      <div class="speed" role="group" aria-label="Game speed">
        @for (s of speeds; track s.value) {
          <button type="button" [attr.aria-pressed]="game.speed() === s.value" (click)="game.speed.set(s.value)" [attr.aria-label]="s.label">
            {{ s.icon }}
          </button>
        }
      </div>
    </header>
  `,
  styles: `
    .hud { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 8px 16px; background: var(--ink); color: var(--cream); }
    .city { font-size: 1.1rem; }
    .cash { font-variant-numeric: tabular-nums; font-weight: 700; color: #b7efc5; }
    .cash.negative { color: #ffb3b3; }
    .speed { margin-left: auto; display: flex; gap: 4px; }
    .speed button { min-width: 40px; padding: 4px 8px; background: transparent; color: var(--cream); border: 1px solid var(--cream); }
    .speed button[aria-pressed='true'] { background: var(--cream); color: var(--ink); }
  `,
})
export class HudComponent {
  protected readonly game = inject(GameService);
  protected readonly speeds: { value: GameSpeed; icon: string; label: string }[] = [
    { value: 0, icon: '❚❚', label: 'Pause' },
    { value: 1, icon: '▶', label: 'Normal speed' },
    { value: 2, icon: '▶▶', label: 'Double speed' },
    { value: 4, icon: '▶▶▶', label: 'Fast speed' },
  ];
  protected readonly date = computed(() => formatDate(this.game.state()?.day ?? 0));
  protected readonly time = computed(() => formatTime(this.game.state()?.minute ?? 0));
  protected readonly cash = computed(() => formatMoney(this.game.human()?.cash ?? 0));
}
