import { Component, computed, input, output } from '@angular/core';
import { cityDef } from '../game/data';
import { Restaurant } from '../game/model';
import { ICONS, Tool } from '../shell/shell.service';

/**
 * The pizzeria switcher used on every screen about one of the player's
 * pizzerias: previous, a drop-down of all of them, next. The same Prev shop
 * and Next shop buttons go in the tool grid via `shopCycleTools`.
 */
@Component({
  selector: 'app-shop-picker',
  template: `
    <div class="picker" role="group" aria-label="Pizzeria">
      <button type="button" class="step" (click)="step(-1)" [disabled]="shops().length < 2" aria-label="Previous pizzeria" title="Previous pizzeria">‹</button>
      <label>
        <span class="sr-only">Pizzeria</span>
        <select [value]="selected()" (change)="picked.emit(+$any($event.target).value)">
          @for (s of shops(); track s.id) {
            <option [value]="s.id" [selected]="s.id === selected()">{{ s.name }}{{ manyCities() ? ' (' + city(s.cityId) + ')' : '' }}</option>
          }
        </select>
      </label>
      <button type="button" class="step" (click)="step(1)" [disabled]="shops().length < 2" aria-label="Next pizzeria" title="Next pizzeria">›</button>
    </div>
  `,
  styles: `
    .picker { display: inline-flex; align-items: stretch; gap: 0; }
    select { font: inherit; padding: 4px 6px; height: 100%; border: 2px solid var(--wood); border-left: 0; border-right: 0; background: #fffaf0; color: var(--ink); max-width: 260px; }
    .step { padding: 0 10px; font-size: 1.2rem; line-height: 1; background: var(--wood); border-color: var(--wood); color: var(--cream); }
    .step:first-child { border-radius: 6px 0 0 6px; }
    .step:last-child { border-radius: 0 6px 6px 0; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class ShopPickerComponent {
  readonly shops = input.required<readonly Pick<Restaurant, 'id' | 'name' | 'cityId'>[]>();
  readonly selected = input.required<number>();
  readonly picked = output<number>();

  protected readonly manyCities = computed(() => new Set(this.shops().map((s) => s.cityId)).size > 1);

  protected step(delta: number): void {
    const next = cycleShop(this.shops().map((s) => s.id), this.selected(), delta);
    if (next !== null) this.picked.emit(next);
  }

  protected city(id: string): string {
    return cityDef(id).name;
  }
}

/** The pizzeria `delta` places along the list, wrapping round. */
export function cycleShop(ids: readonly number[], current: number | null | undefined, delta: number): number | null {
  if (ids.length === 0) return null;
  const i = Math.max(0, ids.indexOf(current ?? -1));
  return ids[(i + delta + ids.length) % ids.length];
}

/** Prev shop and Next shop for the tool grid, the same on every screen about one pizzeria. */
export function shopCycleTools(ids: readonly number[], current: number | null | undefined, go: (id: number) => void): Tool[] {
  const step = (delta: number) => () => {
    const id = cycleShop(ids, current, delta);
    if (id !== null) go(id);
  };
  return [
    { id: 'prev-shop', label: 'Prev shop', icon: ICONS.left, disabled: ids.length < 2, action: step(-1) },
    { id: 'next-shop', label: 'Next shop', icon: ICONS.right, disabled: ids.length < 2, action: step(1) },
  ];
}
