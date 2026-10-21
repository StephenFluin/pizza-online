import type { Graphics } from 'pixi.js';
import { CityMap, GameState, Lot } from '../game/model';

export const TILE = 24;

const C = {
  grass: 0x7fb069,
  grassDark: 0x6a9a58,
  road: 0x4f5359,
  kerb: 0x9a9a92,
  pavement: 0xb9b4a6,
  roadLine: 0xe8e2b0,
  water: 0x3d7ab8,
  waterLight: 0x6aa6dc,
  bridge: 0x8a7a66,
  park: 0x5a9a4c,
  trunk: 0x6b4f2a,
  canopy: 0x2f6b34,
  canopyLight: 0x4a8a45,
  lot: 0xc9b27e,
  lotDirt: 0xb39a64,
  window: 0x2b3a4a,
  windowLit: 0xf7dc6f,
  shadow: 0x000000,
};

/** Façade colours; roofs are a darker shade of the same hue. */
const FACADES = [0xd8b4a0, 0xe5c58a, 0xc9ada7, 0xa8bcc8, 0xd6ccc2, 0xb7c9a8, 0xe0a890, 0xc2b0d4];

/** Height in pixels of a building with this variant; richer districts build taller. */
function buildingHeight(variant: number, wealth: number): number {
  return 8 + variant * 7 + Math.round(wealth * 8);
}

function shade(color: number, f: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) * f);
  const g = Math.min(255, ((color >> 8) & 0xff) * f);
  const b = Math.min(255, (color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

function tileAt(city: CityMap, x: number, y: number) {
  if (x < 0 || y < 0 || x >= city.width || y >= city.height) return null;
  return city.tiles[y * city.width + x];
}

/**
 * Draws the static city in a 3/4 view: flat ground first, then everything with
 * height row by row from back to front so nearer buildings overlap ones behind.
 */
export function drawCity(g: Graphics, city: CityMap): void {
  g.clear();
  const W = city.width * TILE;
  const H = city.height * TILE;
  g.rect(0, 0, W, H).fill(C.grass);

  // Ground layer.
  for (let y = 0; y < city.height; y++) {
    for (let x = 0; x < city.width; x++) {
      const t = city.tiles[y * city.width + x];
      const px = x * TILE;
      const py = y * TILE;
      switch (t.kind) {
        case 'road':
          drawRoad(g, city, x, y, px, py);
          break;
        case 'water':
          g.rect(px, py, TILE, TILE).fill(C.water);
          if ((x * 3 + y * 5) % 4 === 0)
            g.rect(px + 4, py + 9, 9, 2).fill({ color: C.waterLight, alpha: 0.8 });
          break;
        case 'park':
          g.rect(px, py, TILE, TILE).fill(C.park);
          if ((x + y) % 2 === 0) g.rect(px + 3, py + 15, 4, 2).fill(C.grassDark);
          break;
        case 'building':
          // Pavement around buildings; the building itself is drawn in the next pass.
          g.rect(px, py, TILE, TILE).fill(C.pavement);
          break;
        default:
          break;
      }
    }
  }
  for (const lot of city.lots) drawLotGround(g, lot);

  // Raised layer, back to front.
  for (let y = 0; y < city.height; y++) {
    for (let x = 0; x < city.width; x++) {
      const t = city.tiles[y * city.width + x];
      const px = x * TILE;
      const py = y * TILE;
      if (t.kind === 'building') {
        const wealth = city.districts[t.district]?.wealth ?? 0.5;
        drawBuilding(
          g,
          px,
          py,
          buildingHeight(t.variant, wealth),
          FACADES[(t.district * 3 + t.variant + x) % FACADES.length],
          (x * 7 + y * 13) % 5,
        );
      } else if (t.kind === 'park' && (x * 7 + y * 3) % 3 === 0) {
        drawTree(g, px + TILE / 2, py + TILE - 4, 1 + ((x + y) % 2) * 0.25);
      } else if (t.kind === 'grass' && (x * 5 + y) % 7 === 0) {
        drawTree(g, px + TILE / 2, py + TILE - 4, 0.8);
      }
    }
  }
}

function drawRoad(g: Graphics, city: CityMap, x: number, y: number, px: number, py: number): void {
  const overWater = (dx: number, dy: number) => tileAt(city, x + dx, y + dy)?.kind === 'water';
  const isBridge = overWater(-1, 0) || overWater(1, 0) || overWater(0, -1) || overWater(0, 1);
  const road = (dx: number, dy: number) => tileAt(city, x + dx, y + dy)?.kind === 'road';
  const horiz = road(-1, 0) || road(1, 0);
  const vert = road(0, -1) || road(0, 1);
  g.rect(px, py, TILE, TILE).fill(
    isBridge && tileAt(city, x, y + 1)?.kind !== 'road' && !horiz ? C.bridge : C.road,
  );
  // Kerbs where the road meets non-road tiles.
  if (!road(0, -1)) g.rect(px, py, TILE, 2).fill(C.kerb);
  if (!road(0, 1)) g.rect(px, py + TILE - 2, TILE, 2).fill(C.kerb);
  if (!road(-1, 0)) g.rect(px, py, 2, TILE).fill(C.kerb);
  if (!road(1, 0)) g.rect(px + TILE - 2, py, 2, TILE).fill(C.kerb);
  if (horiz && !vert) g.rect(px + 3, py + TILE / 2 - 1, TILE / 2 - 3, 2).fill(C.roadLine);
  else if (vert && !horiz) g.rect(px + TILE / 2 - 1, py + 3, 2, TILE / 2 - 3).fill(C.roadLine);
  else if (horiz && vert) {
    // Zebra crossing hints at junctions.
    for (let i = 0; i < 4; i++)
      g.rect(px + 3 + i * 5, py + 1, 3, 3).fill({ color: 0xffffff, alpha: 0.5 });
  }
}

function drawBuilding(
  g: Graphics,
  px: number,
  py: number,
  h: number,
  facade: number,
  pattern: number,
): void {
  const x0 = px + 2;
  const w = TILE - 4;
  const roofY = py + 2 - h;
  const depth = TILE - 8;
  // Shadow cast to the right.
  g.rect(x0 + w, roofY + 6, 4, depth + h - 6).fill({ color: C.shadow, alpha: 0.18 });
  // Roof (top face) and front façade.
  g.rect(x0, roofY, w, depth).fill(shade(facade, 0.72));
  g.rect(x0, roofY, w, 2).fill({ color: 0xffffff, alpha: 0.25 });
  g.rect(x0, roofY + depth, w, h + 6).fill(facade);
  g.rect(x0, roofY + depth, w, 1).fill(shade(facade, 0.55));
  // Windows: rows on the façade, some lit.
  const rows = Math.max(1, Math.floor((h + 2) / 7));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 3; c++) {
      const lit = (pattern + r * 3 + c) % 4 === 0;
      g.rect(x0 + 2 + c * 6, roofY + depth + 3 + r * 7, 3, 4).fill(lit ? C.windowLit : C.window);
    }
  }
  // Door at street level.
  g.rect(x0 + w / 2 - 2, py + TILE - 8, 4, 6).fill(shade(facade, 0.45));
  // Rooftop details.
  if (pattern === 1) g.rect(x0 + 3, roofY + 3, 5, 4).fill(shade(facade, 0.55));
  if (pattern === 3) g.circle(x0 + w - 5, roofY + 5, 2.5).fill(0x9aa5ad);
}

function drawTree(g: Graphics, x: number, baseY: number, scale: number): void {
  g.ellipse(x + 2, baseY + 1, 7 * scale, 3 * scale).fill({ color: C.shadow, alpha: 0.2 });
  g.rect(x - 1.5, baseY - 8 * scale, 3, 8 * scale).fill(C.trunk);
  g.circle(x, baseY - 12 * scale, 7 * scale).fill(C.canopy);
  g.circle(x - 2 * scale, baseY - 14 * scale, 3.5 * scale).fill(C.canopyLight);
}

function drawLotGround(g: Graphics, lot: Lot): void {
  const px = lot.x * TILE;
  const py = lot.y * TILE;
  g.rect(px, py, lot.w * TILE, lot.h * TILE).fill(C.lot);
  for (let i = 0; i < lot.w * lot.h * 3; i++) {
    const dx = (i * 37) % (lot.w * TILE - 6);
    const dy = (i * 23) % (lot.h * TILE - 6);
    g.rect(px + 3 + dx, py + 3 + dy, 3, 2).fill(C.lotDirt);
  }
}

/**
 * Draws things that change during play: restaurants on lots, "for sale" signs,
 * and the selection outline.
 */
export function drawLots(
  g: Graphics,
  city: CityMap,
  state: GameState,
  selected: number | null,
  hovered: number | null,
): void {
  g.clear();
  for (const lot of city.lots) {
    const px = lot.x * TILE;
    const py = lot.y * TILE;
    const restaurant =
      lot.restaurantId === null ? null : state.restaurants.find((r) => r.id === lot.restaurantId);
    if (restaurant) {
      const owner = state.players.find((p) => p.id === restaurant.ownerId);
      drawRestaurant(
        g,
        px,
        py,
        lot.w * TILE,
        lot.h * TILE,
        owner?.color ?? 0xffffff,
        owner?.isHuman ?? false,
      );
      // The mayor's stars hang above the door.
      for (let i = 0; i < (restaurant.stars ?? 0); i++)
        g.star(px + 8 + i * 9, py + lot.h * TILE - 4, 5, 4, 2)
          .fill(0xffd166)
          .stroke({ width: 1, color: 0x7a5a00 });
    } else {
      drawForSaleSign(g, px + lot.w * TILE - 10, py + lot.h * TILE - 4);
    }
    if (lot.id === selected || lot.id === hovered) {
      g.rect(px - 1, py - 1, lot.w * TILE + 2, lot.h * TILE + 2).stroke({
        width: lot.id === selected ? 3 : 2,
        color: 0xffffff,
        alpha: lot.id === selected ? 1 : 0.7,
      });
    }
  }
}

function drawRestaurant(
  g: Graphics,
  px: number,
  py: number,
  w: number,
  h: number,
  color: number,
  mine: boolean,
): void {
  const height = 16;
  const x0 = px + 2;
  const bw = w - 4;
  const roofY = py + 4 - height;
  const depth = h - 14;
  g.rect(x0 + bw, roofY + 6, 4, depth + height).fill({ color: 0x000000, alpha: 0.2 });
  g.rect(x0, roofY, bw, depth).fill(0xb5524a);
  // Roof tiles.
  for (let i = 0; i < depth; i += 4)
    g.rect(x0, roofY + i, bw, 1).fill({ color: 0x000000, alpha: 0.12 });
  // Façade.
  g.rect(x0, roofY + depth, bw, height + 10).fill(0xf5e6c8);
  // Striped awning in the owner's colour.
  const awningY = roofY + depth + 6;
  for (let i = 0; i < bw; i += 6) g.rect(x0 + i, awningY, Math.min(3, bw - i), 6).fill(color);
  for (let i = 3; i < bw; i += 6) g.rect(x0 + i, awningY, Math.min(3, bw - i), 6).fill(0xffffff);
  g.rect(x0, awningY + 6, bw, 1).fill({ color: 0x000000, alpha: 0.3 });
  // Big windows and door.
  g.rect(x0 + 3, awningY + 9, bw / 2 - 6, 7).fill(0xfbe8a6);
  g.rect(x0 + bw / 2 + 3, awningY + 9, bw / 2 - 6, 7).fill(0xfbe8a6);
  g.rect(x0 + bw / 2 - 2, awningY + 9, 4, 9).fill(0x6b3b2a);
  // Round pizza sign on the roof.
  const sx = x0 + bw / 2;
  const sy = roofY + depth / 2;
  g.circle(sx, sy, 8).fill(0xe9b872).stroke({ width: 2, color });
  g.circle(sx, sy, 6).fill(0xd64933);
  g.circle(sx - 2, sy - 2, 1.4)
    .fill(0xf6f0d8)
    .circle(sx + 2.5, sy + 1, 1.4)
    .fill(0xf6f0d8)
    .circle(sx - 1, sy + 3, 1.2)
    .fill(0x2f8f3c);
  if (mine)
    g.star(x0 + 6, roofY + 5, 5, 4, 2)
      .fill(0xffd166)
      .stroke({ width: 1, color: 0x7a5a00 });
}

function drawForSaleSign(g: Graphics, x: number, baseY: number): void {
  g.rect(x, baseY - 14, 2, 14).fill(0x6b4f2a);
  g.rect(x - 7, baseY - 18, 16, 9)
    .fill(0xffffff)
    .stroke({ width: 1, color: 0x6b4f2a });
  g.rect(x - 5, baseY - 16, 12, 2).fill(0xb3261e);
  g.rect(x - 5, baseY - 13, 8, 2).fill(0x1d3557);
}
