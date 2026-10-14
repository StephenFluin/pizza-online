import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, viewChild } from '@angular/core';
import type { Application, Graphics } from 'pixi.js';
import { CITIES } from '../game/data';
import { GameService } from '../game/game.service';
import { UiService } from '../game/ui.service';
import { standings } from '../game/world';

const W = 640;
const H = 320;

/** Rough continent outlines as polygons in 0..1 map coordinates (stylised, not to scale). */
const CONTINENTS: number[][] = [
  [0.05, 0.2, 0.18, 0.12, 0.32, 0.15, 0.33, 0.3, 0.27, 0.38, 0.22, 0.47, 0.17, 0.45, 0.1, 0.33],
  [0.25, 0.5, 0.33, 0.52, 0.38, 0.62, 0.34, 0.82, 0.3, 0.86, 0.28, 0.7],
  [0.44, 0.18, 0.58, 0.14, 0.6, 0.3, 0.52, 0.36, 0.45, 0.32],
  [0.45, 0.4, 0.58, 0.38, 0.62, 0.55, 0.55, 0.78, 0.5, 0.72, 0.46, 0.55],
  [0.58, 0.12, 0.88, 0.14, 0.92, 0.3, 0.84, 0.42, 0.72, 0.48, 0.62, 0.38],
  [0.8, 0.62, 0.92, 0.64, 0.94, 0.78, 0.84, 0.8, 0.78, 0.72],
];

/** World overview: standings per city and travel between cities. */
@Component({
  selector: 'app-world-dialog',
  template: `
    <div #mapHost class="map" aria-hidden="true"></div>
    <p class="progress">You lead in <b>{{ ledCount() }}</b> of {{ cities.length }} cities. Lead them all to win.</p>
    <table>
      <caption class="sr-only">Cities</caption>
      <thead><tr><th scope="col">City</th><th scope="col">Your shops</th><th scope="col">Rival shops</th><th scope="col">Most popular</th><th scope="col"><span class="sr-only">Travel</span></th></tr></thead>
      <tbody>
        @for (row of rows(); track row.id) {
          <tr [class.here]="row.here">
            <th scope="row">{{ row.name }}</th>
            <td>{{ row.mine }}</td>
            <td>{{ row.rivals }}</td>
            <td>{{ row.leader }}</td>
            <td>
              @if (row.here) {
                <span>You are here</span>
              } @else {
                <button type="button" class="small" (click)="travel(row.id)">Travel to {{ row.name }}</button>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    .map { width: 100%; max-width: ${W}px; aspect-ratio: 2 / 1; border-radius: 8px; overflow: hidden; }
    .progress { margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 4px; border-top: 1px solid var(--line); }
    tr.here { background: var(--cream); }
    .small { padding: 2px 8px; font-size: 0.85rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class WorldDialogComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private app: Application | null = null;
  private g: Graphics | null = null;
  protected readonly cities = CITIES;

  protected readonly rows = computed(() => {
    const st = this.game.state();
    const me = this.game.human();
    if (!st || !me) return [];
    const stand = standings(st);
    return CITIES.map((c, i) => {
      const inCity = st.restaurants.filter((r) => r.cityId === c.id);
      const leaderId = stand[i].leaderId;
      return {
        id: c.id,
        name: c.name,
        here: st.currentCityId === c.id,
        mine: inCity.filter((r) => r.ownerId === me.id).length,
        rivals: inCity.filter((r) => r.ownerId !== me.id).length,
        leader: leaderId === null ? '—' : leaderId === me.id ? 'You' : (st.players.find((p) => p.id === leaderId)?.name ?? '—'),
        leaderColor: leaderId === null ? 0x999999 : (st.players.find((p) => p.id === leaderId)?.color ?? 0x999999),
        wx: c.wx,
        wy: c.wy,
      };
    });
  });
  protected readonly ledCount = computed(() => this.rows().filter((r) => r.leader === 'You').length);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init().catch((err) => console.error('Failed to draw world map', err));
    });
    destroyRef.onDestroy(() => this.app?.destroy(true, { children: true }));
    effect(() => this.draw(this.rows()));
  }

  private async init(): Promise<void> {
    const PIXI = await import('pixi.js');
    const app = new PIXI.Application();
    await app.init({ width: W, height: H, background: 0x1d4e89, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    this.mapHost().nativeElement.appendChild(app.canvas);
    this.app = app;
    this.g = new PIXI.Graphics();
    app.stage.addChild(this.g);
    this.draw(this.rows());
  }

  private draw(rows: ReturnType<typeof this.rows>): void {
    const g = this.g;
    if (!g) return;
    g.clear();
    for (let y = 0; y < H; y += 20) g.rect(0, y, W, 1).fill({ color: 0xffffff, alpha: 0.06 });
    for (const poly of CONTINENTS) g.poly(poly.map((v, i) => (i % 2 === 0 ? v * W : v * H))).fill(0x6a994e).stroke({ width: 2, color: 0x386641 });
    for (const r of rows) {
      const x = r.wx * W;
      const y = r.wy * H;
      if (r.here) g.circle(x, y, 13).stroke({ width: 3, color: 0xffffff });
      g.circle(x, y, 8).fill(r.leaderColor).stroke({ width: 2, color: 0x1d3557 });
    }
  }

  protected travel(cityId: string): void {
    this.game.travel(cityId);
    this.ui.close();
  }
}
