import type { Graphics } from 'pixi.js';
import { ingredient } from '../game/data';
import { Recipe, Topping } from '../game/model';

const CRUST = 0xe2b46c;
const CRUST_DARK = 0xc48f45;
const DOUGH = 0xf1d39a;
const SAUCE = 0xc8371f;
const CHEESE = 0xf7e3a1;

/** Draws a whole pizza centred at (cx, cy) using vector shapes only. */
export function drawPizza(g: Graphics, recipe: Pick<Recipe, 'sauce' | 'cheese' | 'toppings'>, cx: number, cy: number, radius: number): void {
  g.circle(cx, cy + radius * 0.04, radius * 1.02).fill({ color: 0x000000, alpha: 0.18 });
  g.circle(cx, cy, radius).fill(CRUST);
  // Crust bubbles around the rim.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    g.circle(cx + Math.cos(a) * radius * 0.94, cy + Math.sin(a) * radius * 0.94, radius * 0.05).fill(CRUST_DARK);
  }
  g.circle(cx, cy, radius * 0.88).fill(DOUGH);
  if (recipe.sauce) g.circle(cx, cy, radius * 0.86).fill(SAUCE);
  if (recipe.cheese) {
    // A few overlapping blobs read as melted cheese.
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39;
      const r = (i % 3) * 0.22 * radius;
      g.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, radius * 0.3).fill({ color: CHEESE, alpha: 0.6 });
    }
  }
  for (const t of recipe.toppings) drawTopping(g, t, cx + t.x * radius, cy + t.y * radius, radius * 0.09);
}

/**
 * Draws a placed topping at its cut: whole pieces as one shape, chopped ones as
 * a few smaller fragments, minced ones as a scatter of specks.
 */
export function drawTopping(g: Graphics, t: Topping, x: number, y: number, s: number): void {
  const cut = t.cut ?? 0;
  if (cut === 0) {
    drawPiece(g, t, x, y, s);
    return;
  }
  const count = cut === 1 ? 3 : 7;
  const scale = cut === 1 ? 0.55 : 0.28;
  const spread = cut === 1 ? 0.65 : 0.95;
  for (let i = 0; i < count; i++) {
    // Deterministic offsets from the piece's rotation so redraws don't jitter.
    const a = t.rotation + (i / count) * Math.PI * 2 + (i % 2) * 0.4;
    const r = s * spread * (0.55 + ((i * 37) % 10) / 22);
    drawPiece(g, { ...t, rotation: t.rotation + i * 1.3 }, x + Math.cos(a) * r, y + Math.sin(a) * r, s * scale);
  }
}

function drawPiece(g: Graphics, t: Topping, x: number, y: number, s: number): void {
  const ing = ingredient(t.ingredient);
  const c = ing.color;
  const cos = Math.cos(t.rotation);
  const sin = Math.sin(t.rotation);
  // Rotates a local point around the topping centre.
  const p = (lx: number, ly: number): [number, number] => [x + lx * cos - ly * sin, y + lx * sin + ly * cos];
  switch (ing.shape) {
    case 'circle':
      g.circle(x, y, s).fill(c).stroke({ width: s * 0.15, color: darken(c), alpha: 0.6 });
      break;
    case 'ring':
      g.circle(x, y, s * 0.85).stroke({ width: s * 0.38, color: c });
      break;
    case 'slice': {
      const pts = [p(-s, s * 0.3), p(-s * 0.7, -s * 0.6), p(0, -s), p(s * 0.7, -s * 0.6), p(s, s * 0.3), p(s * 0.3, s * 0.3), p(s * 0.3, s), p(-s * 0.3, s), p(-s * 0.3, s * 0.3)];
      g.poly(pts.flat()).fill(c).stroke({ width: s * 0.12, color: darken(c) });
      break;
    }
    case 'leaf': {
      const pts = [p(-s * 1.1, 0), p(-s * 0.4, -s * 0.6), p(s * 0.5, -s * 0.5), p(s * 1.1, 0), p(s * 0.5, s * 0.5), p(-s * 0.4, s * 0.6)];
      g.poly(pts.flat()).fill(c);
      g.moveTo(...p(-s, 0)).lineTo(...p(s, 0)).stroke({ width: s * 0.1, color: darken(c) });
      break;
    }
    case 'strip': {
      const pts = [p(-s * 1.2, -s * 0.3), p(s * 1.2, -s * 0.3), p(s * 1.2, s * 0.3), p(-s * 1.2, s * 0.3)];
      g.poly(pts.flat()).fill(c).stroke({ width: s * 0.1, color: darken(c) });
      break;
    }
    case 'cube': {
      const pts = [p(-s * 0.7, -s * 0.7), p(s * 0.7, -s * 0.7), p(s * 0.7, s * 0.7), p(-s * 0.7, s * 0.7)];
      g.poly(pts.flat()).fill(c).stroke({ width: s * 0.12, color: darken(c) });
      break;
    }
  }
}

function darken(color: number): number {
  const r = ((color >> 16) & 0xff) * 0.7;
  const gr = ((color >> 8) & 0xff) * 0.7;
  const b = (color & 0xff) * 0.7;
  return (r << 16) | (gr << 8) | b;
}
