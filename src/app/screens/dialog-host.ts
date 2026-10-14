import { Component, DestroyRef, computed, inject } from '@angular/core';
import { GameService } from '../game/game.service';
import { Recipe } from '../game/model';
import { UiService } from '../game/ui.service';
import { InteriorViewComponent } from '../interior/interior-view';
import { CookbookComponent } from '../pizza/cookbook';
import { PizzaDesignerComponent } from '../pizza/pizza-designer';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { BankDialogComponent } from './bank-dialog';
import { DayReportComponent } from './day-report';
import { FinancePanelComponent } from './finance-panel';
import { NewsDialogComponent } from './news-dialog';
import { PhoneDialogComponent } from './phone-dialog';
import { RestaurantsDialogComponent } from './restaurants-dialog';
import { SavesDialogComponent } from './saves-dialog';
import { WorldDialogComponent } from './world-dialog';

const TITLES: Record<string, string> = {
  cookbook: 'Cook book',
  designer: 'Pizza designer',
  world: 'World',
  bank: 'Advertising',
  saves: 'Disk',
  restaurants: 'Your restaurants',
  finances: 'Finances',
  news: 'News',
  phone: 'Telephone',
  report: 'End of day',
};

/**
 * Shows whichever view the UiService asks for as a full screen filling the main
 * area of the classic frame (not a popup over the map). Views that don't define
 * their own info panel and tools get a title and a Back button.
 */
@Component({
  selector: 'app-dialog-host',
  imports: [
    CookbookComponent,
    PizzaDesignerComponent,
    WorldDialogComponent,
    BankDialogComponent,
    SavesDialogComponent,
    RestaurantsDialogComponent,
    FinancePanelComponent,
    NewsDialogComponent,
    PhoneDialogComponent,
    InteriorViewComponent,
    DayReportComponent,
  ],
  template: `
    @if (ui.dialog(); as d) {
      @if (d.kind === 'report') {
        <app-day-report />
      } @else {
        <section class="sheet" [attr.aria-label]="title()">
          <header class="title">
            <h2>{{ title() }}</h2>
            <button type="button" class="back" (click)="back()">Back</button>
          </header>
          <div class="content">
            @switch (d.kind) {
              @case ('cookbook') { <app-cookbook /> }
              @case ('world') { <app-world-dialog /> }
              @case ('bank') { <app-bank-dialog /> }
              @case ('restaurants') { <app-restaurants-dialog /> }
              @case ('finances') { <app-finance-panel /> }
              @case ('interior') { <app-interior-view [restaurantId]="d.restaurantId" /> }
              @case ('phone') { <app-phone-dialog /> }
              @case ('news') { <app-news-dialog /> }
              @case ('saves') { <app-saves-dialog /> }
              @case ('designer') {
                <app-pizza-designer [recipe]="d.recipe" (saved)="saveRecipe($event)" (cancelled)="ui.open({ kind: 'cookbook' })" />
              }
            }
          </div>
        </section>
      }
    }
  `,
  styles: `
    :host { display: block; height: 100%; }
    .sheet { height: 100%; display: grid; grid-template-rows: auto 1fr; background: #f3efe6; border: 4px solid var(--wood-dark); color: var(--ink); }
    .title { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 6px 12px; background: linear-gradient(180deg, #e8dcc0, #cdb98e); border-bottom: 3px solid var(--wood); }
    .title h2 { margin: 0; font-family: Georgia, serif; font-size: 1.4rem; }
    .back { padding: 4px 14px; }
    .content { overflow: auto; padding: 14px; min-height: 0; }
  `,
})
export class DialogHostComponent {
  protected readonly ui = inject(UiService);
  private readonly game = inject(GameService);
  private readonly shell = inject(ShellService);

  protected readonly title = computed(() => {
    const d = this.ui.dialog();
    if (d?.kind === 'interior') return this.game.state()?.restaurants.find((r) => r.id === d.restaurantId)?.name ?? 'Restaurant';
    return TITLES[d?.kind ?? ''] ?? '';
  });

  // Fallback info panel and tools for screens that don't register their own.
  private readonly lines = computed<LcdLine[]>(() => [{ label: this.title() }]);
  private readonly tools = computed<Tool[]>(() => [{ id: 'back', label: 'Back', icon: ICONS.back, action: () => this.back() }]);

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }

  protected back(): void {
    const d = this.ui.dialog();
    // The designer returns to the cook book; while a day report is pending, screens return to it.
    if (d?.kind === 'designer') this.ui.open({ kind: 'cookbook' });
    else if (this.game.dayReport() !== null) this.ui.open({ kind: 'report' });
    else this.ui.close();
  }

  protected saveRecipe(recipe: Recipe): void {
    this.game.saveRecipe(recipe);
    this.ui.open({ kind: 'cookbook' });
  }
}
