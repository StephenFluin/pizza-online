import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { GameService } from '../game/game.service';
import { Recipe } from '../game/model';
import { UiService } from '../game/ui.service';
import { CookbookComponent } from '../pizza/cookbook';
import { PizzaDesignerComponent } from '../pizza/pizza-designer';
import { BankDialogComponent } from './bank-dialog';
import { FinancePanelComponent } from './finance-panel';
import { NewsDialogComponent } from './news-dialog';
import { RestaurantsDialogComponent } from './restaurants-dialog';
import { SavesDialogComponent } from './saves-dialog';
import { WorldDialogComponent } from './world-dialog';

const TITLES: Record<string, string> = {
  cookbook: 'Cook book',
  designer: 'Pizza designer',
  world: 'World',
  bank: 'Bank',
  saves: 'Save & load',
  restaurants: 'Your restaurants',
  finances: 'Finances',
  news: 'News',
};

/** A single native modal dialog that shows whichever screen the UiService asks for. */
@Component({
  selector: 'app-dialog-host',
  imports: [CookbookComponent, PizzaDesignerComponent, WorldDialogComponent, BankDialogComponent, SavesDialogComponent, RestaurantsDialogComponent, FinancePanelComponent, NewsDialogComponent],
  template: `
    <dialog #dlg aria-labelledby="dialog-title" (close)="onNativeClose()" (cancel)="onNativeClose()">
      @if (ui.dialog(); as d) {
        <header>
          <h2 id="dialog-title">{{ title() }}</h2>
          <button type="button" class="secondary" (click)="ui.close()" aria-label="Close dialog">✕</button>
        </header>
        @switch (d.kind) {
          @case ('cookbook') {
            <app-cookbook />
          }
          @case ('world') {
            <app-world-dialog />
          }
          @case ('bank') {
            <app-bank-dialog />
          }
          @case ('restaurants') {
            <app-restaurants-dialog />
          }
          @case ('finances') {
            <app-finance-panel />
          }
          @case ('news') {
            <app-news-dialog />
          }
          @case ('saves') {
            <app-saves-dialog />
          }
          @case ('designer') {
            <app-pizza-designer [recipe]="d.recipe" (saved)="saveRecipe($event)" (cancelled)="ui.open({ kind: 'cookbook' })" />
          }
        }
      }
    </dialog>
  `,
  styles: `
    dialog { border: none; border-radius: 12px; padding: 16px; background: var(--panel); color: var(--ink); max-width: min(900px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); width: max-content; }
    dialog::backdrop { background: #0009; }
    header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 12px; }
    header h2 { margin: 0; }
    header button { padding: 2px 10px; }
  `,
})
export class DialogHostComponent {
  protected readonly ui = inject(UiService);
  private readonly game = inject(GameService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected readonly title = computed(() => TITLES[this.ui.dialog()?.kind ?? ''] ?? '');

  constructor() {
    effect(() => {
      const open = this.ui.dialog() !== null;
      const el = this.dlg().nativeElement;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
    });
  }

  protected onNativeClose(): void {
    if (this.ui.dialog()) this.ui.close();
  }

  protected saveRecipe(recipe: Recipe): void {
    this.game.saveRecipe(recipe);
    this.ui.open({ kind: 'cookbook' });
  }
}
