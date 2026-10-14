import { Component, inject } from '@angular/core';
import { Dialog, MapOverlay, UiService } from '../game/ui.service';

interface Tool {
  id: string;
  label: string;
  /** SVG path data on a 24×24 grid. */
  icon: string;
  dialog?: Dialog;
}

const TOOLS: Tool[] = [
  { id: 'phone', label: 'Phone', dialog: { kind: 'phone' }, icon: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z' },
  { id: 'restaurants', label: 'Restaurants', dialog: { kind: 'restaurants' }, icon: 'M3 10h18l-2-6H5zM4 10v10h16V10M9 20v-5h6v5M3 10c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0' },
  { id: 'cookbook', label: 'Cook book', dialog: { kind: 'cookbook' }, icon: 'M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z' },
  { id: 'finances', label: 'Finances', dialog: { kind: 'finances' }, icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'ads', label: 'Advertising', dialog: { kind: 'bank' }, icon: 'M3 11v2l13 5V6zM16 9a3 3 0 0 1 0 6M6 13l1 6h3l-1-5' },
  { id: 'world', label: 'World', dialog: { kind: 'world' }, icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18' },
  { id: 'news', label: 'News', dialog: { kind: 'news' }, icon: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 13h7M7 16h4' },
  { id: 'saves', label: 'Disk', dialog: { kind: 'saves' }, icon: 'M5 3h12l3 3v15H4V3zM8 3v5h8V3M7 21v-7h10v7' },
];

const OVERLAYS: { id: MapOverlay; label: string }[] = [
  { id: 'none', label: 'Plain map' },
  { id: 'districts', label: 'Districts' },
  { id: 'wealth', label: 'Wealth' },
  { id: 'competition', label: 'Competition' },
];

/** The icon toolbar along the bottom of the city view, as in the classic game. */
@Component({
  selector: 'app-toolbar',
  template: `
    <nav class="toolbar" aria-label="Game tools">
      @for (t of tools; track t.id) {
        <button type="button" class="tool" (click)="open(t)" [attr.title]="t.label">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="t.icon" /></svg>
          <span>{{ t.label }}</span>
        </button>
      }
      <label class="overlay">
        <span>Map view</span>
        <select [value]="ui.overlay()" (change)="ui.overlay.set($any($event.target).value)">
          @for (o of overlays; track o.id) {
            <option [value]="o.id">{{ o.label }}</option>
          }
        </select>
      </label>
    </nav>
  `,
  styles: `
    .toolbar { display: flex; gap: 4px; padding: 6px 8px; background: linear-gradient(#5a3e2b, #3e2a1c); border-top: 3px solid #c9a227; overflow-x: auto; align-items: stretch; }
    .tool { display: grid; justify-items: center; gap: 2px; min-width: 68px; padding: 4px 6px; background: #2b1d14; border: 2px solid #8a6a3a; color: #fdf6e3; font-size: 0.75rem; font-weight: 600; }
    .tool:hover { background: #4a3322; border-color: #c9a227; }
    .tool svg { width: 26px; height: 26px; fill: none; stroke: #f4d58d; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .overlay { display: grid; gap: 2px; margin-left: auto; color: #fdf6e3; font-size: 0.75rem; font-weight: 600; align-content: center; }
    .overlay select { font: inherit; font-size: 0.85rem; padding: 4px; }
  `,
})
export class ToolbarComponent {
  protected readonly ui = inject(UiService);
  protected readonly tools = TOOLS;
  protected readonly overlays = OVERLAYS;

  protected open(t: Tool): void {
    if (t.dialog) this.ui.open(t.dialog);
  }
}
