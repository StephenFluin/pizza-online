import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { GameService } from '../game/game.service';
import { Recipe } from '../game/model';
import { cityTaste, parseRecipe, recipeCost, recipeQuality, tasteLabel } from '../game/recipes';
import { UiService } from '../game/ui.service';
import { cityDef } from '../game/data';

/** Lists standard and player-made recipes with import/export. */
@Component({
  selector: 'app-cookbook',
  template: `
    <div class="toolbar">
      <button type="button" (click)="create()">New pizza</button>
      <label class="import">
        <span class="as-button secondary">Import recipe…</span>
        <input
          type="file"
          accept=".json,application/json"
          (change)="importFile($event)"
          class="sr-only"
        />
      </label>
    </div>
    @if (error(); as e) {
      <p role="alert" class="error">{{ e }}</p>
    }
    <table>
      <caption class="sr-only">
        Recipes
      </caption>
      <thead>
        <tr>
          <th scope="col">Pizza</th>
          <th scope="col">Quality</th>
          <th scope="col">Cost</th>
          <th scope="col">{{ cityName() }}</th>
          <th scope="col"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.recipe.id) {
          <tr>
            <th scope="row">
              {{ row.recipe.name }}
              @if (row.own) {
                <small>(yours)</small>
              }
            </th>
            <td>{{ row.quality }}%</td>
            <td>\${{ row.cost.toFixed(2) }}</td>
            <td>{{ row.taste }}</td>
            <td class="actions">
              @if (row.own) {
                <button
                  type="button"
                  class="small"
                  (click)="edit(row.recipe)"
                  [attr.aria-label]="'Edit ' + row.recipe.name"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="small secondary"
                  (click)="exportRecipe(row.recipe)"
                  [attr.aria-label]="'Export ' + row.recipe.name"
                >
                  Export
                </button>
                <button
                  type="button"
                  class="small secondary"
                  (click)="remove(row.recipe)"
                  [attr.aria-label]="'Delete ' + row.recipe.name"
                >
                  Delete
                </button>
              } @else {
                <button
                  type="button"
                  class="small secondary"
                  (click)="copy(row.recipe)"
                  [attr.aria-label]="'Make a copy of ' + row.recipe.name"
                >
                  Copy
                </button>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    .toolbar {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
    }
    .as-button {
      display: inline-block;
      border: 2px solid var(--tomato);
      color: var(--tomato);
      border-radius: 6px;
      padding: 8px 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .import:focus-within .as-button {
      outline: 3px solid #f4a261;
      outline-offset: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      text-align: left;
      padding: 6px 4px;
      border-top: 1px solid var(--line);
    }
    tbody th {
      font-weight: 600;
    }
    .actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .small {
      padding: 2px 8px;
      font-size: 0.85rem;
    }
    .error {
      color: var(--tomato);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class CookbookComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  protected readonly error = signal<string | null>(null);

  protected readonly cityName = computed(() => this.game.city()?.name ?? 'City');

  private readonly lines = computed<LcdLine[]>(() => {
    const rows = this.rows();
    return [
      { label: 'Cook book' },
      { label: 'Classics', value: String(rows.filter((r) => !r.own).length) },
      { label: 'Your pizzas', value: String(rows.filter((r) => r.own).length) },
    ];
  });
  private readonly tools = computed<Tool[]>(() => [
    { id: 'new', label: 'New pizza', icon: ICONS.plus, action: () => this.create() },
    {
      id: 'research',
      label: 'Tastes',
      icon: ICONS.zoom,
      action: () => this.ui.open({ kind: 'research', page: 'taste' }),
    },
    {
      id: 'back',
      label: 'Back',
      icon: ICONS.back,
      action: () =>
        this.game.dayReport() !== null ? this.ui.open({ kind: 'report' }) : this.ui.close(),
    },
  ]);

  constructor() {
    inject(DestroyRef).onDestroy(
      inject(ShellService).register(this, { lines: this.lines, tools: this.tools }),
    );
  }
  protected readonly rows = computed(() => {
    const st = this.game.state();
    const me = this.game.human();
    const districts = this.game.city()?.districts ?? [];
    const col = cityDef(st?.currentCityId ?? 'rome').costOfLiving;
    return (st?.recipes ?? [])
      .filter((r) => r.ownerId === null || r.ownerId === me?.id)
      .map((recipe) => ({
        recipe,
        own: recipe.ownerId !== null,
        quality: Math.round(recipeQuality(recipe) * 100),
        cost: recipeCost(recipe) * col,
        taste: tasteLabel(cityTaste(recipe, districts)),
      }));
  });

  protected create(): void {
    this.ui.open({
      kind: 'designer',
      isNew: true,
      recipe: { id: '', name: 'My pizza', ownerId: null, sauce: true, cheese: true, toppings: [] },
    });
  }

  protected edit(recipe: Recipe): void {
    this.ui.open({ kind: 'designer', isNew: false, recipe });
  }

  protected copy(recipe: Recipe): void {
    this.ui.open({
      kind: 'designer',
      isNew: true,
      recipe: {
        ...structuredClone(recipe),
        id: '',
        ownerId: null,
        name: `${recipe.name} (mine)`.slice(0, 32),
      },
    });
  }

  protected remove(recipe: Recipe): void {
    if (confirm(`Delete ${recipe.name}? It will be taken off every menu.`))
      this.game.deleteRecipe(recipe.id);
  }

  protected exportRecipe(recipe: Recipe): void {
    const { name, sauce, cheese, toppings } = recipe;
    const blob = new Blob([JSON.stringify({ name, sauce, cheese, toppings }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'pizza'}.pizza.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  protected async importFile(ev: Event): Promise<void> {
    const inputEl = ev.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    try {
      const parsed = parseRecipe(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid');
      this.game.saveRecipe({ ...parsed, id: '', ownerId: null });
      this.error.set(null);
    } catch {
      this.error.set(`${file.name} is not a valid recipe file.`);
    }
  }
}
