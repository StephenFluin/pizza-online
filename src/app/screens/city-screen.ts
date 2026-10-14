import { Component, DestroyRef, computed, inject } from '@angular/core';
import { netWorth, rankOf } from '../game/awards';
import { GameService } from '../game/game.service';
import { MapMarker, MapOverlay, UiService } from '../game/ui.service';
import { CityMapComponent } from '../map/city-map';
import { ICONS, LcdLine, ShellService, Tool } from '../shell/shell.service';
import { LotPanelComponent } from './lot-panel';
import { GoalsCardComponent } from './goals-card';

const MARKERS: { id: MapMarker; label: string; hint: string }[] = [
  { id: 'player', label: 'Player', hint: 'Mark your own pizzerias' },
  { id: 'range', label: 'Range', hint: 'Shade the area each pizzeria draws guests from' },
  { id: 'locations', label: 'Locations', hint: 'Outline the empty lots you can rent or buy' },
  { id: 'properties', label: 'Properties', hint: 'Mark every pizzeria in town, in its owner’s colour' },
];

const TABS: { id: MapOverlay; label: string }[] = [
  { id: 'none', label: 'Map' },
  { id: 'districts', label: 'Districts' },
  { id: 'control', label: 'Control' },
];

const SEASONS = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'];

/** The city view: marker buttons and folder tabs over the map, with the info card for the selected lot. */
@Component({
  selector: 'app-city-screen',
  imports: [CityMapComponent, LotPanelComponent, GoalsCardComponent],
  template: `
    <div class="markers" role="group" aria-label="Show on map">
      @for (m of markers; track m.id) {
        <button type="button" class="plate" [attr.aria-pressed]="ui.markers().has(m.id)" [attr.title]="m.hint" (click)="ui.toggleMarker(m.id)"><span class="led" aria-hidden="true"></span>{{ m.label }}</button>
      }
    </div>
    <div class="folder">
      <div class="tabs" role="tablist" aria-label="Map view">
        @for (t of tabs; track t.id; let i = $index) {
          <button type="button" role="tab" class="tab" [style.--i]="i" [attr.aria-selected]="ui.overlay() === t.id" (click)="ui.overlay.set(t.id)">{{ t.label }}</button>
        }
      </div>
      <div class="sheet">
        <app-city-map class="map" />
        @if (game.selectedLot()) {
          <aside class="card" aria-label="Selected location">
            <app-lot-panel />
          </aside>
        } @else {
          <app-goals-card class="goals" />
        }
        <button type="button" class="ticker" (click)="ui.open({ kind: 'news' })" title="Open the newspaper and all messages"><span class="news-tag">News ▸</span> {{ latest() }}</button>
      </div>
    </div>
  `,
  styles: `
    :host { display: grid; grid-template-rows: auto 1fr; gap: 10px; height: 100%; min-height: 0;
      background: radial-gradient(circle at 30% 20%, #f3efe6, #d9d2c3); padding: 12px; border: 4px solid var(--wood-dark); }
    .markers { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .plate { font-family: var(--font-lcd); font-size: 1.3rem; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 6px; color: #2b1d0e;
      background: linear-gradient(180deg, #ffe08a, #e0b23c); border: 3px solid; border-color: #b07a2a #5c3a12 #5c3a12 #b07a2a; box-shadow: 0 0 0 3px #7a4a1c; border-radius: 2px; }
    .plate[aria-pressed='true'] { background: linear-gradient(180deg, #fff3c4, #f2c14e); box-shadow: 0 0 0 3px #7a4a1c, inset 0 0 0 2px #fff8; }
    /* A lamp on each plate shows whether that marker is switched on. */
    .led { display: inline-block; width: 0.55em; height: 0.55em; border-radius: 50%; margin-right: 0.4em; vertical-align: 0.1em; background: #6b4a1a; box-shadow: inset 0 1px 1px #0006; }
    .plate[aria-pressed='true'] .led { background: #3ddc84; box-shadow: 0 0 6px #3ddc84; }
    .news-tag { background: var(--lcd-text); color: #1a1a1a; padding: 0 6px; margin-right: 6px; border-radius: 2px; }
    .folder { position: relative; display: grid; grid-template-rows: auto 1fr; min-height: 0; }
    .tabs { display: flex; gap: 0; padding-left: 8px; }
    .tab { font-family: var(--font-lcd); font-size: 1.2rem; text-transform: uppercase; color: #1d1d1d; padding: 2px 18px; margin-right: -6px;
      background: linear-gradient(180deg, #d8d8d8, #a9a9a9); border: 2px solid #6d6d6d; border-bottom: none; border-radius: 6px 6px 0 0; font-weight: 400; }
    .tab[aria-selected='true'] { background: #e9e9e9; position: relative; z-index: 1; }
    .sheet { position: relative; min-height: 0; background: #e9e9e9; border: 2px solid #6d6d6d; padding: 10px; box-shadow: 6px 6px 0 #9a9a9a, 12px 12px 0 #7d7d7d; margin-right: 12px; margin-bottom: 12px; }
    .map { position: absolute; inset: 10px; }
    .goals { position: absolute; top: 18px; left: 64px; z-index: 3; }
    .card { position: absolute; top: 18px; right: 18px; width: min(360px, calc(100% - 36px)); max-height: calc(100% - 80px); overflow: auto; z-index: 3; box-shadow: 0 6px 24px #0008; border-radius: 6px; }
    .ticker { position: absolute; left: 18px; bottom: 18px; right: 72px; text-align: left; font-family: var(--font-lcd); font-size: 1.15rem; background: #0b0b0be0; color: var(--lcd-text);
      border: 2px solid var(--steel-dark); font-weight: 400; padding: 2px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; z-index: 2; border-radius: 2px; }
    @media (max-width: 700px) { .markers { grid-template-columns: repeat(2, 1fr); } .plate { font-size: 1.05rem; } }
  `,
})
export class CityScreenComponent {
  protected readonly game = inject(GameService);
  protected readonly ui = inject(UiService);
  private readonly shell = inject(ShellService);
  protected readonly markers = MARKERS;
  protected readonly tabs = TABS;

  protected readonly latest = computed(() => this.game.lastJobMessage() ?? this.game.state()?.messages.at(-1)?.text ?? '');

  private readonly lines = computed<LcdLine[]>(() => {
    const st = this.game.state();
    const me = this.game.human();
    if (!st || !me) return [];
    const month = Math.floor(st.day / 30) % 12;
    return [
      { label: this.game.city()?.name ?? '' },
      { label: `In ${SEASONS[month]}` },
      { label: me.name },
      { label: rankOf(netWorth(st, me)).title },
      { label: 'Restaurants', value: String(st.restaurants.filter((r) => r.ownerId === me.id).length) },
      { label: 'Recipes', value: String(st.recipes.filter((r) => r.ownerId === null || r.ownerId === me.id).length) },
      { label: 'Loan', value: me.loan ? `$${Math.round(me.loan / 1000)}k` : 'None' },
      { label: 'District:' },
      { label: this.ui.hoverDistrict() ?? '—' },
    ];
  });

  private readonly tools = computed<Tool[]>(() => {
    return [
      { id: 'restaurants', label: 'Pizzerias', icon: ICONS.restaurant, action: () => this.ui.open({ kind: 'restaurants' }) },
      { id: 'staff', label: 'Staff', icon: ICONS.staff, action: () => this.ui.open({ kind: 'staff' }) },
      { id: 'stock', label: 'Stock', icon: ICONS.box, action: () => this.ui.open({ kind: 'stock' }) },
      { id: 'cookbook', label: 'Cook book', icon: ICONS.book, action: () => this.ui.open({ kind: 'cookbook' }) },
      { id: 'ads', label: 'Advertise', icon: ICONS.megaphone, action: () => this.ui.open({ kind: 'bank' }) },
      { id: 'phone', label: 'Phone', icon: ICONS.phone, action: () => this.ui.open({ kind: 'phone' }) },
      { id: 'reports', label: 'Reports', icon: ICONS.chart, action: () => this.ui.open({ kind: 'finances' }) },
      { id: 'world', label: 'Travel', icon: ICONS.plane, action: () => this.ui.open({ kind: 'world' }) },
      { id: 'disk', label: 'Disk', icon: ICONS.disk, action: () => this.ui.open({ kind: 'saves' }) },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(this.shell.register(this, { lines: this.lines, tools: this.tools }));
  }
}
