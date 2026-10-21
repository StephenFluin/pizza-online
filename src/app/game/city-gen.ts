import { CityDef, INGREDIENTS, districtNames } from './data';
import { CityMap, CustomerGroup, District, Lot, Tile } from './model';
import { Rng, hashString } from './rng';

export const CITY_WIDTH = 64;
export const CITY_HEIGHT = 48;

/** Builds a deterministic city layout: a road grid, an optional river, districts and rentable lots. */
export function generateCity(def: CityDef, gameSeed: number): CityMap {
  const seed = (hashString(def.id) ^ gameSeed) >>> 0;
  const rng = new Rng(seed);
  const W = CITY_WIDTH;
  const H = CITY_HEIGHT;
  const tiles: Tile[] = Array.from({ length: W * H }, () => ({
    kind: 'building',
    district: -1,
    variant: 0,
  }));
  const at = (x: number, y: number) => tiles[y * W + x];

  // River meandering across the city.
  if (rng.chance(0.7)) {
    let y = rng.int(Math.floor(H * 0.3), Math.floor(H * 0.7));
    for (let x = 0; x < W; x++) {
      if (rng.chance(0.25)) y = Math.max(4, Math.min(H - 5, y + rng.int(-1, 1)));
      for (let dy = 0; dy < 3; dy++) at(x, y + dy).kind = 'water';
    }
  }

  // Road grid; roads overwrite water to form bridges.
  const xs = roadLines(rng, W);
  const ys = roadLines(rng, H);
  for (const x of xs) for (let y = 0; y < H; y++) at(x, y).kind = 'road';
  for (const y of ys) for (let x = 0; x < W; x++) at(x, y).kind = 'road';

  // Districts as Voronoi cells around random centres.
  const districtCount = rng.int(6, 9);
  const centres = Array.from({ length: districtCount }, () => ({
    x: rng.int(4, W - 5),
    y: rng.int(4, H - 5),
  }));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = at(x, y);
      if (t.kind === 'road') continue;
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, i) => {
        const d = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      t.district = best;
      if (t.kind === 'building') t.variant = rng.int(0, 3);
    }
  }

  // Blocks between roads become parks occasionally, otherwise get lots on their road edges.
  const lots: Lot[] = [];
  const bounds = (lines: number[], max: number) => [-1, ...lines, max];
  const bx = bounds(xs, W);
  const by = bounds(ys, H);
  for (let i = 0; i < bx.length - 1; i++) {
    for (let j = 0; j < by.length - 1; j++) {
      const x0 = bx[i] + 1;
      const x1 = bx[i + 1] - 1;
      const y0 = by[j] + 1;
      const y1 = by[j + 1] - 1;
      if (x1 - x0 < 1 || y1 - y0 < 1) continue;
      const hasWater = blockHas(at, x0, y0, x1, y1, 'water');
      if (!hasWater && rng.chance(0.1)) {
        fillBlock(at, x0, y0, x1, y1, 'park');
        continue;
      }
      const attempts = rng.int(1, 2);
      for (let a = 0; a < attempts; a++) {
        const w = rng.int(2, 3);
        const h = 2;
        if (x1 - x0 + 1 < w || y1 - y0 + 1 < h) continue;
        const lx = rng.int(x0, x1 - w + 1);
        const ly = rng.chance(0.5) ? y0 : y1 - h + 1;
        if (!blockAll(at, lx, ly, lx + w - 1, ly + h - 1, 'building')) continue;
        fillBlock(at, lx, ly, lx + w - 1, ly + h - 1, 'lot');
        lots.push({
          id: lots.length,
          x: lx,
          y: ly,
          w,
          h,
          district: at(lx, ly).district,
          seats: w * h * 6,
          rentPerMonth: 0,
          purchasePrice: 0,
          restaurantId: null,
        });
      }
    }
  }

  const names = districtNames(districtCount, () => rng.next());
  const districts: District[] = centres.map((c, i) => {
    const tastes: Record<string, number> = {};
    for (const ing of INGREDIENTS) {
      tastes[ing.id] = def.favourites.includes(ing.id) ? rng.range(0.4, 0.9) : rng.range(-0.5, 0.4);
    }
    const wealth = rng.range(0.1, 1);
    // Wealthier districts have more business and office workers, poorer ones more families and manual workers.
    const raw: Record<CustomerGroup, number> = {
      children: rng.range(0.6, 1.4) * (1.3 - wealth * 0.6),
      young: rng.range(0.6, 1.6),
      blueCollar: rng.range(0.5, 1.3) * (1.6 - wealth * 1.2),
      whiteCollar: rng.range(0.5, 1.3) * (0.6 + wealth),
      business: rng.range(0.3, 1.2) * (0.2 + wealth * 1.6),
      seniors: rng.range(0.5, 1.5),
    };
    const sum = Object.values(raw).reduce((n, v) => n + v, 0);
    const groupMix = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, Math.round((v / sum) * 1000) / 1000]),
    ) as Record<CustomerGroup, number>;
    return {
      id: i,
      name: names[i],
      population: 0,
      wealth,
      groupMix,
      // Busy, business-heavy districts are less patient.
      serviceMinutes: Math.round(20 - groupMix.business * 25 - rng.range(0, 4)),
      desiredStandard: rng.int(2, 5),
      desiredOwn: rng.int(0, 3),
      tastes,
      cx: c.x,
      cy: c.y,
    };
  });
  for (const t of tiles) {
    if (t.kind === 'building')
      districts[t.district].population += rng.int(60, 140) * (t.variant + 1);
  }
  for (const lot of lots) {
    const d = districts[lot.district];
    const base = 1200 + lot.w * lot.h * 280;
    lot.rentPerMonth = Math.round((base * (0.6 + d.wealth) * def.costOfLiving) / 10) * 10;
    lot.purchasePrice = Math.round((lot.rentPerMonth * 40) / 1000) * 1000;
  }

  return { id: def.id, name: def.name, seed, width: W, height: H, tiles, districts, lots };
}

function roadLines(rng: Rng, size: number): number[] {
  const lines: number[] = [];
  let p = rng.int(2, 4);
  while (p < size - 2) {
    lines.push(p);
    p += rng.int(5, 8);
  }
  return lines;
}

type TileAt = (x: number, y: number) => Tile;

function blockHas(
  at: TileAt,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  kind: Tile['kind'],
): boolean {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) if (at(x, y).kind === kind) return true;
  return false;
}

function blockAll(
  at: TileAt,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  kind: Tile['kind'],
): boolean {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) if (at(x, y).kind !== kind) return false;
  return true;
}

function fillBlock(
  at: TileAt,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  kind: Tile['kind'],
): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) at(x, y).kind = kind;
}
