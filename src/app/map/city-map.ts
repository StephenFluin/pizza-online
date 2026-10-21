import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { Application, Container, Graphics } from 'pixi.js';
import { GameService } from '../game/game.service';
import { CityMap, GameState, formatMoney } from '../game/model';
import { MapOverlay, UiService } from '../game/ui.service';
import { TILE, drawCity, drawLots } from './city-art';
import { Traffic } from './traffic';

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 4;
const DISTRICT_TINTS = [
  0xe63946, 0x457b9d, 0x2a9d8f, 0xf4a261, 0x8e5bd6, 0xe9c46a, 0x06d6a0, 0xef476f, 0x118ab2,
];

interface Hover {
  text: string;
  x: number;
  y: number;
}

/**
 * The city view: a 3/4-view city with animated traffic. Drag to scroll, wheel/pinch
 * or the on-screen buttons to zoom smoothly to any level, hover for details, click a lot to select it.
 */
@Component({
  selector: 'app-city-map',
  template: `
    <div
      #host
      class="host"
      tabindex="0"
      role="application"
      aria-roledescription="city map"
      [attr.aria-label]="label()"
      (keydown)="onKey($event)"
      (pointerleave)="hover.set(null)"
    ></div>
    @if (hover(); as h) {
      <div class="tooltip" [style.left.px]="h.x + 14" [style.top.px]="h.y + 14" aria-hidden="true">
        {{ h.text }}
      </div>
    }
    <div class="zoom" role="group" aria-label="Zoom">
      <button type="button" (click)="zoomBy(1.25)" aria-label="Zoom in">+</button>
      <button type="button" (click)="zoomBy(0.8)" aria-label="Zoom out">−</button>
      <button type="button" (click)="fit()" aria-label="Fit city to screen">⤢</button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .host {
      position: absolute;
      inset: 0;
      touch-action: none;
    }
    .host:focus-visible {
      outline: 3px solid #ffd166;
      outline-offset: -3px;
    }
    .tooltip {
      position: absolute;
      pointer-events: none;
      background: #1d3557ee;
      color: #fdf6e3;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85rem;
      white-space: pre-line;
      max-width: 240px;
      z-index: 2;
    }
    .zoom {
      position: absolute;
      left: 12px;
      top: 12px;
      display: grid;
      gap: 4px;
      z-index: 2;
    }
    .zoom button {
      width: 40px;
      height: 40px;
      padding: 0;
      font-size: 1.2rem;
      background: #fffaf0;
      color: #1d3557;
      border-color: #1d3557;
    }
  `,
})
export class CityMapComponent {
  private readonly game = inject(GameService);
  private readonly ui = inject(UiService);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');

  protected readonly hover = signal<Hover | null>(null);
  private readonly hoveredLot = signal<number | null>(null);

  private app: Application | null = null;
  private world: Container | null = null;
  private ground: Graphics | null = null;
  private tint: Graphics | null = null;
  private lots: Graphics | null = null;
  private agents: Graphics | null = null;
  private readonly traffic = new Traffic();
  private drawnCityId: string | null = null;
  private tintKey = '';
  /** Target zoom for smooth animated zooming, with the screen point it is anchored on. */
  private zoomTarget: { scale: number; sx: number; sy: number } | null = null;

  protected readonly label = computed(() => {
    const c = this.game.city();
    return c
      ? `Map of ${c.name}. Arrow keys scroll, plus and minus zoom, Escape clears the selection.`
      : 'City map';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init().catch((err) => console.error('Failed to start PixiJS', err));
    });
    destroyRef.onDestroy(() => {
      this.app?.destroy({ removeView: true }, { children: true });
      this.app = null;
    });

    effect(() => {
      const city = this.game.city();
      const state = this.game.state();
      const selected = this.game.selectedLotId();
      const hovered = this.hoveredLot();
      const overlay = this.ui.overlay();
      this.ui.markers();
      if (this.app && city && state) this.redraw(city, state, selected, hovered, overlay);
    });
  }

  private async init(): Promise<void> {
    const PIXI = await import('pixi.js');
    const app = new PIXI.Application();
    const el = this.host().nativeElement;
    await app.init({
      resizeTo: el,
      background: 0x2d4a3e,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    el.appendChild(app.canvas);
    app.canvas.setAttribute('aria-hidden', 'true');
    this.app = app;

    this.world = new PIXI.Container();
    this.ground = new PIXI.Graphics();
    this.tint = new PIXI.Graphics();
    this.agents = new PIXI.Graphics();
    this.lots = new PIXI.Graphics();
    this.world.addChild(this.ground, this.tint, this.agents, this.lots);
    app.stage.addChild(this.world);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    this.bindInput(app);
    app.ticker.add((ticker) => {
      const dt = Math.min(0.1, ticker.deltaMS / 1000);
      // Traffic moves with the game speed and stops when paused.
      this.traffic.update(dt * this.game.speed());
      if (this.agents) this.traffic.draw(this.agents);
      this.animateZoom();
    });

    const city = this.game.city();
    const state = this.game.state();
    if (city && state) this.redraw(city, state, this.game.selectedLotId(), null, this.ui.overlay());
  }

  private redraw(
    city: CityMap,
    state: GameState,
    selected: number | null,
    hovered: number | null,
    overlay: MapOverlay,
  ): void {
    if (!this.ground || !this.lots || !this.tint) return;
    if (city.id !== this.drawnCityId) {
      this.drawnCityId = city.id;
      drawCity(this.ground, city);
      this.traffic.reset(city);
      this.fit();
      this.tintKey = '';
    }
    drawLots(this.lots, city, state, selected, hovered);
    const markers = [...this.ui.markers()].sort().join(',');
    const job = state.players.find((p) => p.isHuman)?.job;
    const key = `${overlay}|${markers}|${city.id}|${state.restaurants.length}|${state.day}|${job?.id ?? ''}:${job?.stage ?? ''}`;
    if (key !== this.tintKey) {
      this.tintKey = key;
      this.drawOverlay(city, state, overlay);
    }
  }

  private drawOverlay(city: CityMap, state: GameState, overlay: MapOverlay): void {
    const g = this.tint!;
    g.clear();
    const inCity = state.restaurants.filter((x) => x.cityId === city.id);
    const colorOf = (ownerId: number) =>
      state.players.find((p) => p.id === ownerId)?.color ?? 0xffffff;
    const me = state.players.find((p) => p.isHuman)?.id;
    const control = overlay === 'control' ? districtControl(city, inCity) : null;

    if (overlay === 'districts' || overlay === 'wealth' || control) {
      for (let y = 0; y < city.height; y++) {
        for (let x = 0; x < city.width; x++) {
          const t = city.tiles[y * city.width + x];
          if (t.district < 0) continue;
          const d = city.districts[t.district];
          let color: number | null;
          if (control) {
            const leader = control.get(d.id);
            color = leader === undefined ? null : colorOf(leader);
          } else {
            color =
              overlay === 'districts'
                ? DISTRICT_TINTS[d.id % DISTRICT_TINTS.length]
                : wealthColor(d.wealth);
          }
          if (color !== null) g.rect(x * TILE, y * TILE, TILE, TILE).fill({ color, alpha: 0.38 });
        }
      }
    }

    // The local boss's delivery: a parcel to collect, then a flag at the drop-off.
    const job = state.players.find((p) => p.isHuman)?.job;
    if (job?.type === 'delivery' && job.cityId === city.id) {
      const stop = job.stage === 'pickup' ? job.pickup : job.dropoff;
      if (stop) {
        const cx = (stop.x + 0.5) * TILE;
        const cy = (stop.y + 0.5) * TILE;
        g.circle(cx, cy, TILE * 1.4)
          .fill({ color: 0xffd166, alpha: 0.35 })
          .stroke({ width: 3, color: 0x7a5a00 });
        if (job.stage === 'pickup')
          g.rect(cx - 7, cy - 22, 14, 11)
            .fill(0xb08968)
            .stroke({ width: 2, color: 0x5c3a21 });
        else
          g.rect(cx - 1, cy - 30, 2, 22)
            .fill(0x222222)
            .poly([cx + 1, cy - 30, cx + 14, cy - 25, cx + 1, cy - 20])
            .fill(0xe63946);
      }
    }

    const markers = this.ui.markers();
    if (markers.has('range') || overlay === 'competition') {
      for (const r of inCity) {
        const lot = city.lots[r.lotId];
        const cx = (lot.x + lot.w / 2) * TILE;
        const cy = (lot.y + lot.h / 2) * TILE;
        // Catchment area shrinks with distance like the customer model does.
        for (const [radius, alpha] of [
          [14, 0.1],
          [8, 0.15],
          [4, 0.2],
        ] as const)
          g.circle(cx, cy, radius * TILE).fill({ color: colorOf(r.ownerId), alpha });
      }
    }
    if (markers.has('locations')) {
      for (const lot of city.lots.filter((l) => l.restaurantId === null)) {
        g.rect(lot.x * TILE - 2, lot.y * TILE - 2, lot.w * TILE + 4, lot.h * TILE + 4).stroke({
          width: 3,
          color: 0xffd166,
        });
      }
    }
    for (const r of inCity) {
      const mine = r.ownerId === me;
      if (!(markers.has('properties') || (mine && markers.has('player')))) continue;
      const lot = city.lots[r.lotId];
      const cx = (lot.x + lot.w / 2) * TILE;
      const cy = lot.y * TILE - 26;
      // Diamond marker floating over each restaurant, in the owner's colour.
      const s = mine && markers.has('player') ? 13 : 9;
      g.poly([cx, cy - s, cx + s, cy, cx, cy + s, cx - s, cy])
        .fill(0xf5e6c8)
        .stroke({ width: 3, color: colorOf(r.ownerId) });
    }
  }

  private bindInput(app: Application): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let dragDistance = 0;
    let pinchStart = 0;

    app.stage.on('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
      dragDistance = 0;
      this.zoomTarget = null;
      if (pointers.size === 2) pinchStart = this.pinchLength(pointers);
    });
    app.stage.on('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        this.updateHover(e.global.x, e.global.y);
        return;
      }
      if (!this.world) return;
      this.hover.set(null);
      if (pointers.size === 2) {
        pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
        const len = this.pinchLength(pointers);
        if (pinchStart > 0)
          this.zoomAt(e.global.x, e.global.y, this.world.scale.x * (len / pinchStart));
        pinchStart = len;
        dragDistance += 10;
        return;
      }
      const dx = e.global.x - prev.x;
      const dy = e.global.y - prev.y;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      this.world.position.x += dx;
      this.world.position.y += dy;
      this.clamp();
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
        // Continuous zoom: trackpads send small deltas, mouse wheels larger ones.
        const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015));
        const current = this.zoomTarget?.scale ?? this.world?.scale.x ?? 1;
        this.zoomTarget = {
          scale: clampZoom(current * factor),
          sx: ev.clientX - rect.left,
          sy: ev.clientY - rect.top,
        };
      },
      { passive: false },
    );
  }

  private updateHover(sx: number, sy: number): void {
    const w = this.world;
    const city = this.game.city();
    const st = this.game.state();
    if (!w || !city || !st) return;
    const tx = Math.floor((sx - w.position.x) / w.scale.x / TILE);
    const ty = Math.floor((sy - w.position.y) / w.scale.y / TILE);
    const tile =
      tx >= 0 && ty >= 0 && tx < city.width && ty < city.height
        ? city.tiles[ty * city.width + tx]
        : null;
    const lot =
      city.lots.find((l) => tx >= l.x && tx < l.x + l.w && ty >= l.y && ty < l.y + l.h) ?? null;
    if (this.hoveredLot() !== (lot?.id ?? null)) this.hoveredLot.set(lot?.id ?? null);
    if (!tile) {
      this.hover.set(null);
      return;
    }
    const district = city.districts[tile.district];
    this.ui.hoverDistrict.set(district?.name ?? null);
    let text = '';
    if (lot) {
      const r =
        lot.restaurantId === null ? null : st.restaurants.find((x) => x.id === lot.restaurantId);
      if (r) {
        const owner = st.players.find((p) => p.id === r.ownerId);
        text = `${r.name}\n${owner?.isHuman ? 'Your restaurant' : `Run by ${owner?.name}`} · ${r.lastDay.customers} guests yesterday`;
      } else {
        text = `For rent or sale · ${lot.seats} seats\n${formatMoney(lot.rentPerMonth)}/month · ${formatMoney(lot.purchasePrice)} to buy\nClick, then call the realtor`;
      }
    } else if (tile.kind === 'building') {
      const kinds = ['Townhouse', 'Apartments', 'Apartment block', 'Tower block'];
      text = `${kinds[tile.variant]} · ${district?.name ?? ''}`;
    } else if (tile.kind === 'park') {
      text = `Park · ${district?.name ?? ''}`;
    } else if (tile.kind === 'water') {
      text = 'River';
    }
    this.hover.set(text ? { text, x: sx, y: sy } : null);
  }

  private pinchLength(pointers: Map<number, { x: number; y: number }>): number {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** Sets the zoom to `scale`, keeping the world point under (sx, sy) fixed on screen. */
  private zoomAt(sx: number, sy: number, scale: number): void {
    const w = this.world;
    if (!w) return;
    const next = clampZoom(scale);
    const wx = (sx - w.position.x) / w.scale.x;
    const wy = (sy - w.position.y) / w.scale.y;
    w.scale.set(next);
    w.position.set(sx - wx * next, sy - wy * next);
    this.clamp();
  }

  private animateZoom(): void {
    const t = this.zoomTarget;
    const w = this.world;
    if (!t || !w) return;
    const current = w.scale.x;
    const next = current + (t.scale - current) * 0.25;
    if (Math.abs(next - t.scale) < 0.002) {
      this.zoomAt(t.sx, t.sy, t.scale);
      this.zoomTarget = null;
    } else {
      this.zoomAt(t.sx, t.sy, next);
    }
  }

  protected zoomBy(factor: number): void {
    if (!this.app || !this.world) return;
    const current = this.zoomTarget?.scale ?? this.world.scale.x;
    this.zoomTarget = {
      scale: clampZoom(current * factor),
      sx: this.app.screen.width / 2,
      sy: this.app.screen.height / 2,
    };
  }

  protected fit(): void {
    const city = this.game.city();
    if (!this.app || !this.world || !city) return;
    this.zoomTarget = null;
    const scale = clampZoom(
      Math.min(
        this.app.screen.width / (city.width * TILE),
        this.app.screen.height / (city.height * TILE),
      ) * 1.6,
    );
    this.world.scale.set(scale);
    this.world.position.set(
      (this.app.screen.width - city.width * TILE * scale) / 2,
      (this.app.screen.height - city.height * TILE * scale) / 2,
    );
    this.clamp();
  }

  /** Keeps at least part of the city on screen so the player can't scroll into the void. */
  private clamp(): void {
    const w = this.world;
    const city = this.game.city();
    if (!w || !this.app || !city) return;
    const cw = city.width * TILE * w.scale.x;
    const ch = city.height * TILE * w.scale.y;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const margin = 80;
    w.position.x =
      cw < sw ? (sw - cw) / 2 : Math.min(margin, Math.max(sw - cw - margin, w.position.x));
    w.position.y =
      ch < sh ? (sh - ch) / 2 : Math.min(margin, Math.max(sh - ch - margin, w.position.y));
  }

  protected onKey(ev: KeyboardEvent): void {
    const w = this.world;
    if (!w) return;
    const step = 60;
    switch (ev.key) {
      case 'ArrowLeft':
        w.position.x += step;
        break;
      case 'ArrowRight':
        w.position.x -= step;
        break;
      case 'ArrowUp':
        w.position.y += step;
        break;
      case 'ArrowDown':
        w.position.y -= step;
        break;
      case '+':
      case '=':
        this.zoomBy(1.25);
        break;
      case '-':
      case '_':
        this.zoomBy(0.8);
        break;
      case '0':
        this.fit();
        break;
      case 'Escape':
        this.game.selectLot(null);
        break;
      default:
        return;
    }
    this.clamp();
    ev.preventDefault();
  }

  private pick(sx: number, sy: number): void {
    const w = this.world;
    const city = this.game.city();
    if (!w || !city) return;
    const tx = Math.floor((sx - w.position.x) / w.scale.x / TILE);
    const ty = Math.floor((sy - w.position.y) / w.scale.y / TILE);
    // A delivery job's stop takes the click before anything else.
    if (this.game.visitTile(tx, ty)) return;
    const lot = city.lots.find((l) => tx >= l.x && tx < l.x + l.w && ty >= l.y && ty < l.y + l.h);
    this.game.selectLot(lot ? lot.id : null);
  }
}

function clampZoom(scale: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
}

function wealthColor(wealth: number): number {
  // Red (poor) through yellow to green (rich).
  const r = Math.round(255 * Math.min(1, 2 - wealth * 2));
  const g = Math.round(255 * Math.min(1, wealth * 2));
  return (r << 16) | (g << 8) | 0x30;
}

/** For each district, the owner whose restaurants pull the most guests from it. */
function districtControl(
  city: CityMap,
  restaurants: GameState['restaurants'],
): Map<number, number> {
  const result = new Map<number, number>();
  for (const d of city.districts) {
    const pull = new Map<number, number>();
    for (const r of restaurants) {
      const lot = city.lots[r.lotId];
      const p = (0.5 + r.reputation) * Math.exp(-Math.hypot(lot.x - d.cx, lot.y - d.cy) / 14);
      pull.set(r.ownerId, (pull.get(r.ownerId) ?? 0) + p);
    }
    let best = -1;
    let bestPull = 0.15;
    for (const [owner, p] of pull) if (p > bestPull) [best, bestPull] = [owner, p];
    if (best >= 0) result.set(d.id, best);
  }
  return result;
}
