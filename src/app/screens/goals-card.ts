import { Component, computed, inject, signal } from '@angular/core';
import { GameService } from '../game/game.service';
import { OPEN_MINUTE } from '../game/model';
import { UiService } from '../game/ui.service';

interface Goal {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  action: { label: string; run: () => void };
}

/**
 * A short checklist on the city map that walks a new owner through the first
 * steps (a pizzeria, staff, the clock) and then a few ways to grow, each with
 * a button that goes straight to the right screen.
 */
@Component({
  selector: 'app-goals-card',
  template: `
    @if (visible()) {
      <section class="goals" [class.folded]="folded()" aria-labelledby="goals-title">
        <header>
          <h2 id="goals-title">{{ heading() }} <small>{{ doneCount() }}/{{ goals().length }}</small></h2>
          <button type="button" class="icon" (click)="folded.set(!folded())" [attr.aria-expanded]="!folded()" [attr.aria-label]="folded() ? 'Show goals' : 'Fold goals'">{{ folded() ? '▸' : '▾' }}</button>
          <button type="button" class="icon" (click)="dismiss()" aria-label="Hide the goals for this game" title="Hide for this game">✕</button>
        </header>
        @if (!folded()) {
          <ol>
            @for (g of goals(); track g.id) {
              <li [class.done]="g.done" [class.next]="g.id === next()?.id">
                <span class="tick" aria-hidden="true">{{ g.done ? '✓' : '' }}</span>
                <div>
                  <b>{{ g.title }}</b><span class="sr-only">{{ g.done ? ' (done)' : '' }}</span>
                  @if (g.id === next()?.id) {
                    <p>{{ g.hint }}</p>
                    <button type="button" class="small" (click)="g.action.run()">{{ g.action.label }}</button>
                  }
                </div>
              </li>
            }
          </ol>
        }
      </section>
    }
  `,
  styles: `
    .goals { width: 270px; background: #fffaf0f2; color: var(--ink); border: 3px solid var(--wood); border-radius: 8px; box-shadow: 0 6px 18px #0006; font-size: 0.9rem; }
    header { display: flex; align-items: center; gap: 4px; padding: 4px 6px 4px 10px; background: linear-gradient(180deg, #e8dcc0, #cdb98e); border-radius: 5px 5px 0 0; }
    .folded header { border-radius: 5px; }
    h2 { margin: 0; flex: 1; font-family: Georgia, serif; font-size: 1rem; }
    h2 small { font-family: system-ui, sans-serif; font-weight: 400; color: #555; }
    .icon { padding: 0 6px; background: transparent; color: var(--ink); border: 0; font-size: 1rem; }
    ol { list-style: none; margin: 0; padding: 6px 10px 8px; display: grid; gap: 4px; }
    li { display: grid; grid-template-columns: 18px 1fr; gap: 6px; align-items: start; }
    .tick { width: 16px; height: 16px; border: 2px solid var(--wood); border-radius: 3px; display: grid; place-items: center; font-size: 0.75rem; line-height: 1; margin-top: 2px; }
    li.done { color: #6b6b6b; }
    li.done b { text-decoration: line-through; font-weight: 400; }
    li.done .tick { background: #2a9d8f; border-color: #2a9d8f; color: #fff; }
    li.next .tick { border-color: var(--tomato); }
    p { margin: 2px 0 4px; }
    .small { padding: 2px 10px; font-size: 0.85rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class GoalsCardComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  protected readonly folded = signal(false);

  protected readonly goals = computed<Goal[]>(() => {
    const st = this.game.state();
    const me = this.game.human();
    if (!st || !me) return [];
    const mine = st.restaurants.filter((r) => r.ownerId === me.id);
    const staffed = mine.find((r) => r.staff.some((s) => s.role === 'cook') && r.staff.some((s) => s.role === 'waiter'));
    const unstaffed = mine.find((r) => r !== staffed) ?? mine[0];
    return [
      {
        id: 'shop',
        title: 'Open your first pizzeria',
        hint: 'Lots outlined in yellow are free. Click one on the map, then call its realtor to rent or buy it.',
        done: mine.length > 0,
        action: { label: 'Show free lots', run: () => this.ui.markers.update((m) => new Set([...m, 'locations'])) },
      },
      {
        id: 'staff',
        title: 'Hire a cook and a waiter',
        hint: 'A pizzeria needs at least one of each before it can serve anyone.',
        done: !!staffed,
        action: { label: 'Hire staff', run: () => this.ui.open({ kind: 'staff', restaurantId: unstaffed?.id }) },
      },
      {
        id: 'clock',
        title: 'Start the clock',
        hint: 'The game is paused. Press ▶ under the date; doors open at 11:00. Pause any time with ❚❚.',
        done: st.day > 0 || st.minute > OPEN_MINUTE - 60,
        action: { label: 'Start the day', run: () => this.game.speed.set(1) },
      },
      {
        id: 'recipe',
        title: 'Create a pizza of your own',
        hint: 'House pizzas that suit the locals sell better than the classics. Market research shows what each group likes.',
        done: st.recipes.some((r) => r.ownerId === me.id),
        action: { label: 'Open the cook book', run: () => this.ui.open({ kind: 'cookbook' }) },
      },
      {
        id: 'ads',
        title: 'Advertise',
        hint: 'Posters, papers, radio and TV bring in guests who haven’t heard of you yet.',
        done: me.ads.length > 0 || me.ledger.some((e) => e.label === 'Advertising'),
        action: { label: 'Plan an advert', run: () => this.ui.open({ kind: 'bank' }) },
      },
      {
        id: 'second',
        title: 'Open a second pizzeria',
        hint: 'Market research shows which districts nobody serves well yet.',
        done: mine.length > 1,
        action: { label: 'Market research', run: () => this.ui.open({ kind: 'research' }) },
      },
    ];
  });
  protected readonly next = computed(() => this.goals().find((g) => !g.done) ?? null);
  protected readonly doneCount = computed(() => this.goals().filter((g) => g.done).length);
  protected readonly heading = computed(() => (this.goals().slice(0, 3).every((g) => g.done) ? 'Growing your chain' : 'Getting started'));
  protected readonly visible = computed(() => !this.game.state()?.goalsDismissed && this.next() !== null);

  protected dismiss(): void {
    this.game.mutate((st) => (st.goalsDismissed = true));
  }
}
