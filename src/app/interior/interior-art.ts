import type { Graphics } from 'pixi.js';
import { KITCHEN_ROWS, catalogItem } from '../game/furniture';
import { PlacedItem } from '../game/model';

export const CELL = 36;
/** Height of the back wall above the grid, where the menu board hangs. */
export const WALL = 64;

function shade(color: number, f: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) * f);
  const g = Math.min(255, ((color >> 8) & 0xff) * f);
  const b = Math.min(255, (color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

/** Draws the empty room seen from above: back wall, kitchen tiles, dining floor and entrance. */
export function drawRoom(g: Graphics, cols: number, rows: number, accent: number): void {
  const W = cols * CELL;
  const H = rows * CELL;
  g.rect(0, 0, W, WALL).fill(0xe9dcc3);
  g.rect(0, WALL - 6, W, 6).fill(shade(accent, 0.8));
  // Windows on the back wall either side of the menu board.
  for (const wx of [12, W - 60]) g.rect(wx, 10, 48, 34).fill(0xbfe3f2).stroke({ width: 3, color: 0x6b4f2a });
  // Kitchen: white tiles.
  for (let y = 0; y < KITCHEN_ROWS; y++) {
    for (let x = 0; x < cols; x++) {
      g.rect(x * CELL, WALL + y * CELL, CELL, CELL).fill((x + y) % 2 ? 0xf8f9fa : 0xe9ecef);
    }
  }
  // Counter line between kitchen and dining room.
  g.rect(0, WALL + KITCHEN_ROWS * CELL - 3, W, 6).fill(0x6c757d);
  // Dining room: wooden planks.
  for (let y = KITCHEN_ROWS; y < rows; y++) {
    g.rect(0, WALL + y * CELL, W, CELL).fill(y % 2 ? 0xc89b6d : 0xbf8f60);
    for (let x = (y % 2) * 2; x < cols; x += 3) g.rect(x * CELL, WALL + y * CELL, 1, CELL).fill({ color: 0x000000, alpha: 0.15 });
  }
  // Entrance mat at the bottom centre.
  const door = Math.floor(cols / 2) - 1;
  g.rect(door * CELL + 4, WALL + H - 10, CELL * 2 - 8, 10).fill(accent);
  // Outer walls.
  g.rect(0, WALL, 4, H).fill(0x6b4f2a);
  g.rect(W - 4, WALL, 4, H).fill(0x6b4f2a);
  g.rect(0, WALL + H - 4, door * CELL, 4).fill(0x6b4f2a);
  g.rect((door + 2) * CELL, WALL + H - 4, W - (door + 2) * CELL, 4).fill(0x6b4f2a);
}

/** Draws a placed item at its grid position. Shapes are simple top-down furniture sketches. */
export function drawItem(g: Graphics, p: PlacedItem, alpha = 1): void {
  const it = catalogItem(p.itemId);
  const x = p.x * CELL;
  const y = WALL + p.y * CELL;
  const w = it.w * CELL;
  const h = it.h * CELL;
  const c = it.color;
  const fill = (color: number) => ({ color, alpha });
  const chair = (cx: number, cy: number) => g.roundRect(cx - 7, cy - 7, 14, 14, 3).fill(fill(0x6b3b2a));
  switch (p.itemId) {
    case 'table2':
      chair(x + w / 2, y + 9);
      chair(x + w / 2, y + h - 9);
      g.circle(x + w / 2, y + h / 2, 12).fill(fill(c)).stroke({ width: 2, color: shade(c, 0.7), alpha });
      g.rect(x + w / 2 - 8, y + h / 2 - 1, 16, 2).fill(fill(0xffffff));
      break;
    case 'table4':
    case 'table4-deluxe':
      for (const [cx, cy] of [[x + w * 0.3, y + 8], [x + w * 0.7, y + 8], [x + w * 0.3, y + h - 8], [x + w * 0.7, y + h - 8]]) chair(cx, cy);
      g.roundRect(x + 8, y + 16, w - 16, h - 32, 4).fill(fill(c)).stroke({ width: 2, color: shade(c, 0.7), alpha });
      g.circle(x + w / 2, y + h / 2, 4).fill(fill(0xe63946));
      break;
    case 'booth':
      g.roundRect(x + 2, y + 2, w - 4, 12, 4).fill(fill(c));
      g.roundRect(x + 2, y + h - 14, w - 4, 12, 4).fill(fill(c));
      g.roundRect(x + 10, y + 18, w - 20, h - 36, 3).fill(fill(0x3d2b1f));
      break;
    case 'bar':
      g.roundRect(x + 2, y + 2, w - 4, 14, 3).fill(fill(c));
      for (let i = 0; i < 3; i++) g.circle(x + CELL / 2 + i * CELL, y + h - 9, 6).fill(fill(0xb08968));
      break;
    case 'plant':
      g.circle(x + w / 2, y + h / 2, 10).fill(fill(0x8b5a2b));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.ellipse(x + w / 2 + Math.cos(a) * 7, y + h / 2 + Math.sin(a) * 7, 6, 4).fill(fill(c));
      }
      break;
    case 'lamp':
      g.circle(x + w / 2, y + h / 2, 13).fill({ color: c, alpha: 0.25 * alpha });
      g.circle(x + w / 2, y + h / 2, 7).fill(fill(c)).stroke({ width: 2, color: 0x7a5a00, alpha });
      break;
    case 'painting':
      g.rect(x + 4, y + 6, w - 8, h - 12).fill(fill(0xc9a227));
      g.rect(x + 8, y + 10, w - 16, h - 20).fill(fill(c));
      g.circle(x + w / 2 + 3, y + h / 2 - 2, 4).fill(fill(0xf4a261));
      break;
    case 'statue':
      g.circle(x + w / 2, y + h / 2, 13).fill(fill(0x9e9e9e));
      g.circle(x + w / 2, y + h / 2, 8).fill(fill(c));
      break;
    case 'aquarium':
      g.roundRect(x + 3, y + 6, w - 6, h - 12, 3).fill(fill(c)).stroke({ width: 3, color: 0x495057, alpha });
      g.ellipse(x + w * 0.35, y + h / 2, 5, 3).fill(fill(0xf77f00));
      g.ellipse(x + w * 0.65, y + h / 2 + 2, 4, 2.5).fill(fill(0xffd166));
      break;
    case 'jukebox':
      g.roundRect(x + 5, y + 4, w - 10, h - 8, 10).fill(fill(c)).stroke({ width: 2, color: 0xffd166, alpha });
      g.circle(x + w / 2, y + h / 2, 6).fill(fill(0xffd166));
      break;
    case 'oven':
      g.roundRect(x + 3, y + 3, w - 6, h - 6, 4).fill(fill(c)).stroke({ width: 2, color: 0x495057, alpha });
      g.rect(x + 10, y + 9, w - 20, h - 18).fill(fill(0x343a40));
      g.rect(x + 12, y + 11, w - 24, 3).fill(fill(0xff6b35));
      break;
    case 'stone-oven':
      g.roundRect(x + 3, y + 3, w - 6, h - 6, 14).fill(fill(c)).stroke({ width: 2, color: 0x6b3b2a, alpha });
      g.ellipse(x + w / 2, y + h / 2 + 2, 14, 8).fill(fill(0x2b1d14));
      g.ellipse(x + w / 2, y + h / 2 + 3, 9, 4).fill(fill(0xff6b35));
      break;
    case 'counter':
      g.rect(x + 2, y + 2, w - 4, h - 4).fill(fill(c)).stroke({ width: 2, color: 0x868e96, alpha });
      g.circle(x + w / 2, y + h / 2, 8).fill(fill(0xf1d39a));
      break;
    case 'fridge':
      g.rect(x + 3, y + 3, w - 6, h - 6).fill(fill(c)).stroke({ width: 2, color: 0x868e96, alpha });
      g.rect(x + w - 10, y + 8, 3, 10).fill(fill(0x868e96));
      break;
    case 'dishwasher':
      g.rect(x + 3, y + 3, w - 6, h - 6).fill(fill(c)).stroke({ width: 2, color: 0x495057, alpha });
      g.circle(x + w / 2, y + h / 2, 7).stroke({ width: 2, color: 0x495057, alpha });
      break;
    default:
      g.rect(x + 2, y + 2, w - 4, h - 4).fill(fill(c));
  }
}
