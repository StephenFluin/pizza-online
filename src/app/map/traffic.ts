import type { Graphics } from 'pixi.js';
import { CityMap } from '../game/model';
import { TILE } from './city-art';

interface Agent {
  /** Position in tile units (centre of tile = +0.5). */
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  color: number;
  kind: 'car' | 'person';
  /** Which side of the road a pedestrian walks on: -1 or 1. */
  side: number;
}

const CAR_COLORS = [0xe63946, 0x457b9d, 0xf1faee, 0xffb703, 0x2a9d8f, 0x6d597a, 0x1d3557, 0xe76f51];
const CLOTHES = [0xd62828, 0x003049, 0xf77f00, 0x6a4c93, 0x2a9d8f, 0x8d99ae, 0xfcbf49];
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Cars driving on the right and people walking along kerbs; purely cosmetic. */
export class Traffic {
  private agents: Agent[] = [];
  private city: CityMap | null = null;

  reset(city: CityMap): void {
    this.city = city;
    this.agents = [];
    const roads: [number, number][] = [];
    for (let y = 0; y < city.height; y++) for (let x = 0; x < city.width; x++) if (this.isRoad(x, y)) roads.push([x, y]);
    // Busier cities get more traffic.
    const pop = city.districts.reduce((n, d) => n + d.population, 0);
    const cars = Math.min(180, Math.round(roads.length / 8 + pop / 8000));
    const people = Math.min(160, Math.round(roads.length / 10 + pop / 10000));
    for (let i = 0; i < cars + people; i++) {
      const [x, y] = roads[Math.floor(Math.random() * roads.length)];
      const options = DIRS.filter(([dx, dy]) => this.isRoad(x + dx, y + dy));
      const [dx, dy] = options.length ? options[Math.floor(Math.random() * options.length)] : [1, 0];
      const car = i < cars;
      this.agents.push({
        x: x + 0.5,
        y: y + 0.5,
        dx,
        dy,
        speed: car ? 1.6 + Math.random() * 1.4 : 0.35 + Math.random() * 0.25,
        color: car ? CAR_COLORS[i % CAR_COLORS.length] : CLOTHES[i % CLOTHES.length],
        kind: car ? 'car' : 'person',
        side: Math.random() < 0.5 ? -1 : 1,
      });
    }
  }

  /** Advances agents by `dt` seconds of game-scaled time. */
  update(dt: number): void {
    for (const a of this.agents) {
      const cx = Math.floor(a.x);
      const cy = Math.floor(a.y);
      const before = a.dx !== 0 ? a.x - cx - 0.5 : a.y - cy - 0.5;
      a.x += a.dx * a.speed * dt;
      a.y += a.dy * a.speed * dt;
      const after = a.dx !== 0 ? a.x - cx - 0.5 : a.y - cy - 0.5;
      const dir = a.dx + a.dy;
      // Choose a new heading when crossing the centre of a tile.
      if (Math.sign(before * dir) <= 0 && Math.sign(after * dir) > 0) this.steer(a, cx, cy);
    }
  }

  private steer(a: Agent, cx: number, cy: number): void {
    const forward = this.isRoad(cx + a.dx, cy + a.dy);
    const turns = DIRS.filter(([dx, dy]) => !(dx === -a.dx && dy === -a.dy) && this.isRoad(cx + dx, cy + dy));
    if (forward && (turns.length <= 1 || Math.random() < 0.65)) return;
    const choice = turns.length ? turns[Math.floor(Math.random() * turns.length)] : ([-a.dx, -a.dy] as [number, number]);
    a.x = cx + 0.5;
    a.y = cy + 0.5;
    [a.dx, a.dy] = choice;
  }

  draw(g: Graphics): void {
    g.clear();
    for (const a of this.agents) {
      // Cars keep to the right of the centre line; people walk by the kerb.
      const offset = a.kind === 'car' ? 0.22 : 0.42 * a.side;
      const px = (a.x + -a.dy * offset) * TILE;
      const py = (a.y + a.dx * offset) * TILE;
      if (a.kind === 'car') {
        const horiz = a.dx !== 0;
        const w = horiz ? 10 : 6;
        const h = horiz ? 6 : 10;
        g.rect(px - w / 2 + 1, py - h / 2 + 1, w, h).fill({ color: 0x000000, alpha: 0.25 });
        g.roundRect(px - w / 2, py - h / 2, w, h, 2).fill(a.color);
        // Windscreen towards the direction of travel.
        g.rect(px + a.dx * 2 - (horiz ? 1 : 2), py + a.dy * 2 - (horiz ? 2 : 1), horiz ? 2 : 4, horiz ? 4 : 2).fill(0x9ec9e2);
      } else {
        g.rect(px - 1, py - 3, 3, 4).fill(a.color);
        g.circle(px + 0.5, py - 4.5, 1.5).fill(0xf1c27d);
      }
    }
  }

  private isRoad(x: number, y: number): boolean {
    const c = this.city;
    if (!c || x < 0 || y < 0 || x >= c.width || y >= c.height) return false;
    return c.tiles[y * c.width + x].kind === 'road';
  }
}
