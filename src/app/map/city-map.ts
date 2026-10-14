import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, viewChild } from '@angular/core';
import type { Application, Container, Graphics } from 'pixi.js';
import { GameService } from '../game/game.service';
import { CityMap, GameState } from '../game/model';

const TILE = 24;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

const COLORS = {
  grass: 0x7fb069,
  road: 0x55585e,
  roadLine: 0xc9c9a3,
  water: 0x3d7ab8,
  waterLight: 0x5b97cf,
  park: 0x5a9a4c,
  tree: 0x2f6b34,
  lot: 0xd9c38f,
  lotBorder: 0xa48b56,
  select: 0xffffff,
};

const BUILDING_PALETTE = [0xb5838d, 0xe5989b, 0xc9ada7, 0x9a8c98, 0xd6ccc2, 0xa5a58d];

/** Renders the city with PixiJS: drag to scroll, wheel/pinch to zoom, click a lot to select it. */
@Component({
  selector: 'app-city-map',
  template: `<div
    #host
    class="host"
    tabindex="0"
    role="application"
    aria-roledescription="city map"
    [attr.aria-label]="label()"
    (keydown)="onKey($event)"
  ></div>`,
  styles: `
    :host { display: block; position: relative; width: 100%; height: 100%; }
    .host { position: absolute; inset: 0; overflow: hidden; touch-action: none; }
    .host:focus-visible { outline: 3px solid #ffd166; outline-offset: -3px; }
  `,
})
export class CityMapComponent {
  private readonly game = inject(GameService);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private app: Application | null = null;
  private world: Container | null = null;
  private ground: Graphics | null = null;
  private overlay: Graphics | null = null;
  private pixi: typeof import('pixi.js') | null = null;
  private drawnCity: CityMap | null = null;

  protected label = () => {
    const c = this.game.city();
    return c ? `Map of ${c.name}. Arrow keys scroll, plus and minus zoom.` : 'City map';
  };

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init().catch((err) => console.error('Failed to start PixiJS', err));
    });
    destroyRef.onDestroy(() => {
      this.app?.destroy(true, { children: true });
      this.app = null;
    });

    effect(() => {
      const city = this.game.city();
      const state = this.game.state();
      const selected = this.game.selectedLotId();
      if (!this.app || !city || !state) return;
      if (city !== this.drawnCity) this.drawGround(city);
      this.drawOverlay(city, state, selected);
    });
  }

  private async init(): Promise<void> {
    const PIXI = await import('pixi.js');
    this.pixi = PIXI;
    const app = new PIXI.Application();
    const el = this.host().nativeElement;
    await app.init({ resizeTo: el, background: 0x1d3557, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
    el.appendChild(app.canvas);
    app.canvas.setAttribute('aria-hidden', 'true');
    this.app = app;

    this.world = new PIXI.Container();
    this.ground = new PIXI.Graphics();
    this.overlay = new PIXI.Graphics();
    this.world.addChild(this.ground, this.overlay);
    app.stage.addChild(this.world);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    this.bindInput(app);

    const city = this.game.city();
    const state = this.game.state();
    if (city && state) {
      this.drawGround(city);
      this.drawOverlay(city, state, this.game.selectedLotId());
      this.centre(city);
    }
  }

  private centre(city: CityMap): void {
    if (!this.app || !this.world) return;
    const scale = Math.max(MIN_ZOOM, Math.min(1.2, this.app.screen.width / (city.width * TILE)));
    this.world.scale.set(scale);
    this.world.position.set(
      (this.app.screen.width - city.width * TILE * scale) / 2,
      (this.app.screen.height - city.height * TILE * scale) / 2,
    );
  }

  private bindInput(app: Application): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let dragDistance = 0;
    let pinchStart = 0;

    app.stage.on('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
      dragDistance = 0;
      if (pointers.size === 2) pinchStart = this.pinchLength(pointers);
    });
    app.stage.on('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev || !this.world) return;
      if (pointers.size === 2) {
        pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
        const len = this.pinchLength(pointers);
        if (pinchStart > 0) this.zoomAt(e.global.x, e.global.y, len / pinchStart);
        pinchStart = len;
        dragDistance += 10;
        return;
      }
      const dx = e.global.x - prev.x;
      const dy = e.global.y - prev.y;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      this.world.position.x += dx;
      this.world.position.y += dy;
      pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
    });
    const end = (e: { pointerId: number; global: { x: number; y: number } }) => {
      if (!pointers.has(e.pointerId)) return;
      const wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (wasSingle && dragDistance < 6) this.pick(e.global.x, e.global.y);
    };
    app.stage.on('pointerup', end);
    app.stage.on('pointerupoutside', end);

    app.canvas.addEventListener(
      'wheel',
      (ev) => {
        ev.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        this.zoomAt(ev.clientX - rect.left, ev.clientY - rect.top, ev.deltaY < 0 ? 1.15 : 1 / 1.15);
      },
      { passive: false },
    );
  }

  private pinchLength(pointers: Map<number, { x: number; y: number }>): number {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private zoomAt(sx: number, sy: number, factor: number): void {
    const w = this.world;
    if (!w) return;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, w.scale.x * factor));
    const wx = (sx - w.position.x) / w.scale.x;
    const wy = (sy - w.position.y) / w.scale.y;
    w.scale.set(next);
    w.position.set(sx - wx * next, sy - wy * next);
  }

  protected onKey(ev: KeyboardEvent): void {
    const w = this.world;
    if (!w || !this.app) return;
    const step = 60;
    const cx = this.app.screen.width / 2;
    const cy = this.app.screen.height / 2;
    switch (ev.key) {
      case 'ArrowLeft': w.position.x += step; break;
      case 'ArrowRight': w.position.x -= step; break;
      case 'ArrowUp': w.position.y += step; break;
      case 'ArrowDown': w.position.y -= step; break;
      case '+': case '=': this.zoomAt(cx, cy, 1.2); break;
      case '-': case '_': this.zoomAt(cx, cy, 1 / 1.2); break;
      case 'Escape': this.game.selectLot(null); break;
      default: return;
    }
    ev.preventDefault();
  }

  private pick(sx: number, sy: number): void {
    const w = this.world;
    const city = this.game.city();
    if (!w || !city) return;
    const tx = Math.floor((sx - w.position.x) / w.scale.x / TILE);
    const ty = Math.floor((sy - w.position.y) / w.scale.y / TILE);
    const lot = city.lots.find((l) => tx >= l.x && tx < l.x + l.w && ty >= l.y && ty < l.y + l.h);
    this.game.selectLot(lot ? lot.id : null);
  }

  private drawGround(city: CityMap): void {
    const g = this.ground;
    if (!g) return;
    this.drawnCity = city;
    g.clear();
    g.rect(0, 0, city.width * TILE, city.height * TILE).fill(COLORS.grass);
    for (let y = 0; y < city.height; y++) {
      for (let x = 0; x < city.width; x++) {
        const t = city.tiles[y * city.width + x];
        const px = x * TILE;
        const py = y * TILE;
        switch (t.kind) {
          case 'road': {
            g.rect(px, py, TILE, TILE).fill(COLORS.road);
            const horiz = this.isRoad(city, x - 1, y) || this.isRoad(city, x + 1, y);
            const vert = this.isRoad(city, x, y - 1) || this.isRoad(city, x, y + 1);
            if (horiz && !vert) g.rect(px + 4, py + TILE / 2 - 1, TILE - 8, 2).fill(COLORS.roadLine);
            else if (vert && !horiz) g.rect(px + TILE / 2 - 1, py + 4, 2, TILE - 8).fill(COLORS.roadLine);
            break;
          }
          case 'water':
            g.rect(px, py, TILE, TILE).fill(COLORS.water);
            if ((x + y) % 3 === 0) g.rect(px + 4, py + 8, 10, 2).fill(COLORS.waterLight);
            break;
          case 'park':
            g.rect(px, py, TILE, TILE).fill(COLORS.park);
            if ((x * 7 + y * 3) % 4 === 0) g.circle(px + TILE / 2, py + TILE / 2, 7).fill(COLORS.tree);
            break;
          case 'building': {
            const wealth = city.districts[t.district]?.wealth ?? 0.5;
            const color = BUILDING_PALETTE[(t.district + t.variant) % BUILDING_PALETTE.length];
            const inset = 2 + (3 - t.variant);
            g.rect(px + 1, py + 1, TILE - 2, TILE - 2).fill(0x8a9a7a);
            g.rect(px + inset, py + inset, TILE - inset * 2, TILE - inset * 2).fill(color);
            g.rect(px + inset, py + inset, TILE - inset * 2, 3).fill({ color: 0xffffff, alpha: 0.25 + wealth * 0.25 });
            break;
          }
          case 'lot':
          case 'grass':
            break;
        }
      }
    }
    for (const lot of city.lots) {
      g.rect(lot.x * TILE + 1, lot.y * TILE + 1, lot.w * TILE - 2, lot.h * TILE - 2)
        .fill(COLORS.lot)
        .stroke({ width: 1, color: COLORS.lotBorder });
    }
  }

  private drawOverlay(city: CityMap, state: GameState, selected: number | null): void {
    const g = this.overlay;
    if (!g) return;
    g.clear();
    for (const lot of city.lots) {
      const px = lot.x * TILE;
      const py = lot.y * TILE;
      const restaurant = lot.restaurantId === null ? null : state.restaurants.find((r) => r.id === lot.restaurantId);
      if (restaurant) {
        const owner = state.players.find((p) => p.id === restaurant.ownerId);
        const color = owner?.color ?? 0xffffff;
        g.rect(px + 2, py + 2, lot.w * TILE - 4, lot.h * TILE - 4).fill(0xfaf3e0).stroke({ width: 2, color });
        g.rect(px + 2, py + 2, lot.w * TILE - 4, 6).fill(color);
        const cx = px + (lot.w * TILE) / 2;
        const cy = py + (lot.h * TILE) / 2 + 3;
        g.circle(cx, cy, 9).fill(0xe9b872).circle(cx, cy, 7).fill(0xd64933);
        g.circle(cx - 3, cy - 2, 1.5).fill(0xf6f0d8).circle(cx + 3, cy + 1, 1.5).fill(0xf6f0d8);
      } else {
        // "For rent" sign.
        const sx = px + lot.w * TILE - 9;
        g.rect(sx, py + 4, 2, 10).fill(0x6b4f2a);
        g.rect(sx - 5, py + 3, 12, 7).fill(0xffffff).stroke({ width: 1, color: 0x6b4f2a });
      }
      if (lot.id === selected) {
        g.rect(px - 1, py - 1, lot.w * TILE + 2, lot.h * TILE + 2).stroke({ width: 3, color: COLORS.select });
      }
    }
  }

  private isRoad(city: CityMap, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= city.width || y >= city.height) return false;
    return city.tiles[y * city.width + x].kind === 'road';
  }
}
