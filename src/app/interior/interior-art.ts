import type { Graphics } from 'pixi.js';
import { CatalogItem, FloorType, KITCHEN_ROWS, catalogItem, store } from '../game/furniture';
import { PlacedItem } from '../game/model';

/** Pixels per grid cell before the view scales the room to fit the screen. */
export const CELL = 20;
/** Height of the back wall above the grid, where the menu board hangs. */
export const WALL = 70;

function shade(color: number, f: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) * f);
  const g = Math.min(255, ((color >> 8) & 0xff) * f);
  const b = Math.min(255, (color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

/** Draws the room seen from above: back wall, kitchen tiles, dining floor and entrance. */
export function drawRoom(g: Graphics, cols: number, rows: number, accent: number, floor: FloorType): void {
  const W = cols * CELL;
  const H = rows * CELL;
  // Back wall with wainscoting and two windows either side of the menu board.
  g.rect(0, 0, W, WALL).fill(0xe9dcc3);
  for (let x = 0; x < W; x += 16) g.rect(x, WALL - 26, 1, 20).fill({ color: 0x8b5a2b, alpha: 0.25 });
  g.rect(0, WALL - 28, W, 3).fill(0x8b5a2b);
  g.rect(0, WALL - 6, W, 6).fill(shade(accent, 0.8));
  for (const wx of [14, W - 74]) {
    g.rect(wx, 8, 60, 34).fill(0xbfe3f2).stroke({ width: 4, color: 0x6b4f2a });
    g.rect(wx + 29, 8, 2, 34).fill(0x6b4f2a);
    g.rect(wx, 24, 60, 2).fill(0x6b4f2a);
  }

  // Kitchen: small white tiles with grout lines.
  const kitchenH = KITCHEN_ROWS * CELL;
  g.rect(0, WALL, W, kitchenH).fill(0xf8f9fa);
  for (let y = 0; y < kitchenH; y += CELL / 2) g.rect(0, WALL + y, W, 1).fill(0xdee2e6);
  for (let x = 0; x < W; x += CELL / 2) g.rect(x, WALL, 1, kitchenH).fill(0xdee2e6);

  drawFloor(g, floor, 0, WALL + kitchenH, W, H - kitchenH);

  // Serving counter line between kitchen and dining room, with a pass-through hatch.
  g.rect(0, WALL + kitchenH - 4, W, 8).fill(0x6c757d);
  g.rect(W / 2 - 40, WALL + kitchenH - 4, 80, 8).fill(0xc9a227);

  // Entrance mat and outer walls.
  const door = Math.floor(cols / 2) - 2;
  g.rect(door * CELL + 4, WALL + H - 14, CELL * 4 - 8, 12).fill(accent);
  g.rect(0, WALL, 5, H).fill(0x6b4f2a);
  g.rect(W - 5, WALL, 5, H).fill(0x6b4f2a);
  g.rect(0, WALL + H - 5, door * CELL, 5).fill(0x6b4f2a);
  g.rect((door + 4) * CELL, WALL + H - 5, W - (door + 4) * CELL, 5).fill(0x6b4f2a);
}

export function drawFloor(g: Graphics, floor: FloorType, x0: number, y0: number, w: number, h: number): void {
  const [a, b] = floor.colors;
  g.rect(x0, y0, w, h).fill(a);
  switch (floor.pattern) {
    case 'tiles':
      for (let y = 0; y < h; y += CELL) for (let x = 0; x < w; x += CELL) {
        if ((x * 7 + y * 3) % 11 === 0) g.rect(x0 + x + 2, y0 + y + 2, CELL - 4, CELL - 4).fill({ color: b, alpha: 0.6 });
        g.rect(x0 + x, y0 + y, CELL, 1).fill({ color: 0x000000, alpha: 0.12 });
        g.rect(x0 + x, y0 + y, 1, CELL).fill({ color: 0x000000, alpha: 0.12 });
      }
      break;
    case 'checker':
      for (let y = 0; y < h; y += CELL) for (let x = 0; x < w; x += CELL) if (((x + y) / CELL) % 2 === 0) g.rect(x0 + x, y0 + y, CELL, CELL).fill(b);
      break;
    case 'planks':
      for (let y = 0; y < h; y += CELL / 2) {
        g.rect(x0, y0 + y, w, CELL / 2).fill((y / (CELL / 2)) % 2 ? a : b);
        const offset = ((y / (CELL / 2)) * 37) % 90;
        for (let x = offset; x < w; x += 90) g.rect(x0 + x, y0 + y, 1, CELL / 2).fill({ color: 0x000000, alpha: 0.2 });
      }
      break;
    case 'terrazzo':
      for (let i = 0; i < (w * h) / 60; i++) {
        const px = (i * 53) % w;
        const py = (i * 97) % h;
        g.circle(x0 + px, y0 + py, 1 + (i % 3)).fill({ color: [b, 0x9d8f80, 0xc1b5a5][i % 3], alpha: 0.8 });
      }
      break;
    case 'carpet':
      for (let y = 0; y < h; y += CELL * 2) for (let x = 0; x < w; x += CELL * 2) {
        g.poly([x0 + x + CELL, y0 + y + 4, x0 + x + CELL * 2 - 4, y0 + y + CELL, x0 + x + CELL, y0 + y + CELL * 2 - 4, x0 + x + 4, y0 + y + CELL]).fill({ color: b, alpha: 0.7 });
      }
      break;
  }
}

/** Draws a placed piece at its grid position, in its store's colours. */
export function drawItem(g: Graphics, p: PlacedItem, alpha = 1, occupied = false): void {
  const it = catalogItem(p.itemId);
  drawItemAt(g, it, p.x * CELL, WALL + p.y * CELL, alpha, occupied);
}

/** Draws a catalogue item with its top-left corner at (x, y); also used for store previews. */
export function drawItemAt(g: Graphics, it: CatalogItem, x: number, y: number, alpha = 1, occupied = false): void {
  const w = it.w * CELL;
  const h = it.h * CELL;
  const [main, accent, trim] = store(it.storeId).colors;
  const f = (color: number) => ({ color, alpha });
  const shadow = () => g.roundRect(x + 3, y + 4, w - 4, h - 4, 4).fill({ color: 0x000000, alpha: 0.18 * alpha });

  switch (it.kind) {
    case 'table-small':
    case 'table-large': {
      shadow();
      const round = it.kind === 'table-small';
      // Tablecloth over a wooden top, with place settings.
      if (round) g.circle(x + w / 2, y + h / 2, w / 2 - 2).fill(f(trim)).circle(x + w / 2, y + h / 2, w / 2 - 6).fill(f(accent));
      else g.roundRect(x + 2, y + 2, w - 4, h - 4, 5).fill(f(trim)).roundRect(x + 5, y + 5, w - 10, h - 10, 4).fill(f(accent));
      const settings = round ? 2 : 4;
      for (let i = 0; i < settings; i++) {
        const px = round ? x + w / 2 : x + w * (0.2 + 0.6 * ((i % 2 === 0 ? i : i - 1) / Math.max(1, settings - 2)));
        const py = round ? y + h / 2 + (i === 0 ? -8 : 8) : y + (i % 2 === 0 ? h * 0.32 : h * 0.68);
        g.circle(px, py, 6).fill(f(0xffffff)).stroke({ width: 1, color: 0xced4da, alpha });
        g.circle(px + 8, py - 3, 2.2).fill(f(0xbde0fe));
      }
      g.circle(x + w / 2, y + h / 2, 3).fill(f(0xe63946));
      break;
    }
    case 'chair': {
      g.roundRect(x + 3, y + 3, w - 6, h - 6, 4).fill(f(main)).stroke({ width: 1.5, color: shade(main, 0.6), alpha });
      g.roundRect(x + 6, y + 6, w - 12, h - 12, 3).fill(f(shade(accent, 0.9)));
      g.rect(x + 3, y + 3, w - 6, 5).fill(f(shade(main, 0.7)));
      if (occupied) {
        // A diner seen from above: shoulders, then a head with hair.
        const k = Math.round(x * 3 + y * 7);
        const cx = x + w / 2;
        const cy = y + h / 2;
        g.ellipse(cx, cy + 2, 12, 9).fill(f([0x2a9d8f, 0xe76f51, 0x457b9d, 0x6a4c93, 0xe9c46a][k % 5])).stroke({ width: 1, color: 0x000000, alpha: 0.25 * alpha });
        g.circle(cx, cy, 7).fill(f([0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac][(k >> 2) % 5]));
        g.circle(cx, cy - 1.5, 6).fill(f([0x3b2a1a, 0x7a4a1e, 0xd9b26f, 0x111111, 0xa0522d, 0xbcbcbc][(k >> 4) % 6]));
      }
      break;
    }
    case 'booth': {
      shadow();
      g.roundRect(x + 2, y + 2, w - 4, 16, 6).fill(f(main));
      g.roundRect(x + 2, y + h - 18, w - 4, 16, 6).fill(f(main));
      for (let i = 1; i < 4; i++) {
        g.circle(x + (w * i) / 4, y + 10, 2).fill(f(shade(main, 0.6)));
        g.circle(x + (w * i) / 4, y + h - 10, 2).fill(f(shade(main, 0.6)));
      }
      g.roundRect(x + 10, y + 22, w - 20, h - 44, 4).fill(f(trim)).stroke({ width: 2, color: shade(trim, 0.6), alpha });
      g.circle(x + w / 2, y + h / 2, 3).fill(f(accent));
      break;
    }
    case 'bar': {
      shadow();
      g.roundRect(x + 2, y + 2, w - 4, 26, 4).fill(f(trim)).stroke({ width: 2, color: shade(trim, 0.6), alpha });
      for (let i = 0; i < 6; i++) g.circle(x + 12 + i * ((w - 24) / 5), y + 12, 3).fill(f(0xbde0fe));
      for (let i = 0; i < 4; i++) g.circle(x + w * (0.15 + i * 0.23), y + h - 12, 8).fill(f(main)).stroke({ width: 2, color: shade(main, 0.6), alpha });
      break;
    }
    case 'plant': {
      g.circle(x + w / 2, y + h / 2, 12).fill(f(0x8b5a2b)).stroke({ width: 2, color: 0x5c3a21, alpha });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.ellipse(x + w / 2 + Math.cos(a) * 10, y + h / 2 + Math.sin(a) * 10, 9, 4).fill(f(i % 2 ? main : shade(main, 1.3)));
      }
      break;
    }
    case 'lamp':
      g.circle(x + w / 2, y + h / 2, 19).fill({ color: 0xffe066, alpha: 0.18 * alpha });
      g.circle(x + w / 2, y + h / 2, 10).fill(f(0xfff3b0)).stroke({ width: 3, color: accent, alpha });
      break;
    case 'painting':
      g.rect(x + 2, y + 8, w - 4, h - 16).fill(f(accent));
      g.rect(x + 6, y + 12, w - 12, h - 24).fill(f(main));
      g.circle(x + w * 0.65, y + h / 2 - 2, 5).fill(f(0xf4a261));
      g.poly([x + 8, y + h - 14, x + w * 0.4, y + 16, x + w - 8, y + h - 14]).fill(f(0x2a9d8f));
      break;
    case 'statue':
      g.circle(x + w / 2, y + h / 2, 16).fill(f(0x9e9e9e));
      g.circle(x + w / 2, y + h / 2, 11).fill(f(trim));
      g.circle(x + w / 2, y + h / 2 - 3, 5).fill(f(0xf8f9fa));
      break;
    case 'aquarium':
      g.roundRect(x + 2, y + 4, w - 4, h - 8, 4).fill(f(0x48cae4)).stroke({ width: 3, color: 0x495057, alpha });
      for (let i = 0; i < 4; i++) g.ellipse(x + 16 + i * ((w - 32) / 3), y + h / 2 + (i % 2 ? 4 : -4), 6, 3).fill(f([0xf77f00, 0xffd166, 0xe63946, 0x06d6a0][i]));
      for (let i = 0; i < 5; i++) g.rect(x + 8 + i * 20, y + h - 12, 3, 8).fill(f(0x2d6a4f));
      break;
    case 'jukebox':
      g.roundRect(x + 4, y + 2, w - 8, h - 4, 14).fill(f(main)).stroke({ width: 3, color: accent, alpha });
      g.circle(x + w / 2, y + h / 2, 8).fill(f(accent));
      g.circle(x + w / 2, y + h / 2, 3).fill(f(trim));
      break;
    case 'arcade':
      g.roundRect(x + 4, y + 2, w - 8, h - 4, 3).fill(f(trim)).stroke({ width: 2, color: main, alpha });
      g.rect(x + 9, y + 6, w - 18, h * 0.45).fill(f(0x0b132b));
      g.circle(x + w / 2 - 5, y + h * 0.75, 3).fill(f(main)).circle(x + w / 2 + 6, y + h * 0.75, 3).fill(f(accent));
      break;
    case 'oven':
      shadow();
      g.roundRect(x + 2, y + 2, w - 4, h - 4, 4).fill(f(main)).stroke({ width: 2, color: 0x495057, alpha });
      g.rect(x + 10, y + 10, w - 20, h - 26).fill(f(trim));
      g.rect(x + 13, y + 13, w - 26, 4).fill(f(accent));
      for (let i = 0; i < 4; i++) g.circle(x + 14 + i * ((w - 28) / 3), y + h - 9, 3).fill(f(0x212529));
      break;
    case 'stone-oven':
      shadow();
      g.roundRect(x + 2, y + 2, w - 4, h - 4, 30).fill(f(main)).stroke({ width: 3, color: accent, alpha });
      for (let i = 0; i < 6; i++) g.rect(x + 10 + i * ((w - 26) / 5), y + 8, 6, 3).fill(f(shade(main, 0.7)));
      g.ellipse(x + w / 2, y + h / 2 + 6, w * 0.3, h * 0.22).fill(f(0x2b1d14));
      g.ellipse(x + w / 2, y + h / 2 + 8, w * 0.2, h * 0.1).fill(f(trim));
      break;
    case 'counter':
      g.rect(x + 2, y + 2, w - 4, h - 4).fill(f(main)).stroke({ width: 2, color: shade(main, 0.6), alpha });
      g.circle(x + w / 2, y + h / 2, 13).fill(f(0xf1d39a));
      g.circle(x + w / 2, y + h / 2, 9).fill(f(0xc8371f));
      g.rect(x + w - 12, y + 6, 3, 18).fill(f(0x868e96));
      break;
    case 'fridge':
      g.rect(x + 2, y + 2, w - 4, h - 4).fill(f(main)).stroke({ width: 2, color: accent, alpha });
      g.rect(x + 2, y + h * 0.4, w - 4, 2).fill(f(accent));
      g.rect(x + w - 10, y + 8, 3, 10).fill(f(accent));
      g.rect(x + w - 10, y + h * 0.55, 3, 10).fill(f(accent));
      break;
    case 'dishwasher':
      g.rect(x + 2, y + 2, w - 4, h - 4).fill(f(main)).stroke({ width: 2, color: 0x495057, alpha });
      g.circle(x + w / 2, y + h / 2, 12).stroke({ width: 2, color: 0x495057, alpha });
      g.circle(x + w / 2, y + h / 2, 5).fill(f(accent));
      break;
  }
}
