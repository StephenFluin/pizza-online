import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { PortraitComponent } from '../characters/portrait';
import { GameService } from '../game/game.service';
import { ROLE_LABEL, staffLook } from '../game/staff';
import { UiService } from '../game/ui.service';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';

/** A staff matter that needs the owner's decision; the clock waits until it's answered. */
@Component({
  selector: 'app-incident-screen',
  imports: [PortraitComponent],
  template: `
    <div class="incident">
      @if (event(); as e) {
        @if (person(); as p) {
          <article class="card" aria-labelledby="incident-title" aria-describedby="incident-text">
            <app-portrait [cacheKey]="'staff-' + p.staff.id" [look]="look()" [background]="faceColor" [size]="120" [alt]="p.staff.name" />
            <div>
              <h3 id="incident-title">{{ p.staff.name }} <small>{{ role() }} at {{ p.restaurant }}</small></h3>
              <p id="incident-text" class="text">{{ e.text }}</p>
              <div class="choices">
                @for (o of e.options; track $index) {
                  <button type="button" class="choice" (click)="choose($index)">{{ o }}</button>
                }
              </div>
            </div>
          </article>
        }
        @if (pending() > 1) {<p class="more">{{ pending() - 1 }} more matter{{ pending() === 2 ? '' : 's' }} waiting.</p>}
      } @else {
        <p>All staff matters are settled.</p>
        <button type="button" (click)="ui.close()">Back to work</button>
      }
      @if (outcome()) {<p class="outcome" role="status">{{ outcome() }}</p>}
    </div>
  `,
  styles: `
    .incident { display: grid; gap: 12px; justify-items: center; align-content: center; min-height: 100%; }
    .card { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start; max-width: 640px; background: #fffaf0; border: 3px solid var(--wood); border-radius: 8px; padding: 16px; box-shadow: 0 6px 18px #0003; }
    h3 { margin: 0 0 6px; } h3 small { font-weight: 400; color: #555; }
    .text { font-size: 1.1rem; margin: 0 0 12px; }
    .choices { display: grid; gap: 6px; }
    .choice { text-align: left; font-weight: 400; background: #fff; color: var(--ink); border-color: var(--ink-soft); }
    .outcome { background: var(--lcd); color: var(--lcd-text); font-family: var(--font-lcd); font-size: 1.3rem; padding: 6px 12px; border-radius: 3px; }
    .more { margin: 0; }
    @media (max-width: 600px) { .card { grid-template-columns: 1fr; justify-items: center; } }
  `,
})
export class IncidentScreenComponent {
  private readonly game = inject(GameService);
  protected readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);
  protected readonly outcome = signal('');
  protected readonly faceColor = 0x8d99ae;

  protected readonly event = computed(() => this.game.state()?.staffEvents[0] ?? null, { equal: () => false });
  protected readonly pending = computed(() => this.game.state()?.staffEvents.length ?? 0);
  protected readonly person = computed(() => {
    const e = this.event();
    const r = e ? this.game.state()?.restaurants.find((x) => x.id === e.restaurantId) : null;
    const staff = r?.staff.find((x) => x.id === e?.staffId);
    return r && staff ? { restaurant: r.name, staff } : null;
  });
  protected readonly look = computed(() => staffLook(this.person()!.staff));
  protected readonly role = computed(() => ROLE_LABEL[this.person()?.staff.role ?? 'cook']);

  private readonly lines = computed<LcdLine[]>(() => [{ label: 'Staff matter' }, { label: 'Waiting', value: String(this.pending()) }]);
  private readonly tools = computed<Tool[]>(() =>
    (this.event()?.options ?? []).map((o, i) => ({ id: `choice-${i}`, label: o.split(' ').slice(0, 2).join(' '), icon: [ICONS.save, ICONS.person, ICONS.back][i], action: () => this.choose(i) })),
  );

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }

  protected choose(i: number): void {
    this.outcome.set(this.game.resolveIncident(i));
    if (this.pending() === 0) setTimeout(() => this.ui.dialog()?.kind === 'incident' && this.ui.close(), 1600);
  }
}
