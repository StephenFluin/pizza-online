import type { Graphics } from 'pixi.js';
import { ingredient } from '../game/data';
import { Recipe, Topping } from '../game/model';

const CRUST = 0xe2b46c;
const CRUST_DARK = 0xc48f45;
const DOUGH = 0xf1d39a;
const SAUCE = 0xc8371f;
const CHEESE = 0xf7e3a1;

/** Small deterministic random source so the sauce and cheese look the same on every redraw. */
function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** An irregular blob: a circle whose edge wobbles, for sauce pools and melted cheese. */
function blob(g: Graphics, x: number, y: number, r: number, wobble: number, rnd: () => number, points = 16): Graphics {
  const pts: number[] = [];
  const phase = rnd() * Math.PI * 2;
  const lobes = 2 + Math.floor(rnd() * 3);
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (1 + wobble * (Math.sin(a * lobes + phase) * 0.6 + (rnd() - 0.5) * 0.8));
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  return g.poly(pts);
}

/** Draws a whole pizza centred at (cx, cy) using vector shapes only. */
export function drawPizza(g: Graphics, recipe: Pick<Recipe, 'sauce' | 'cheese' | 'toppings'>, cx: number, cy: number, radius: number): void {
  const rnd = seeded(1994);
  g.circle(cx, cy + radius * 0.04, radius * 1.02).fill({ color: 0x000000, alpha: 0.18 });
  // Crust: an uneven golden rim with browned blisters.
  blob(g, cx, cy, radius, 0.012, rnd, 48).fill(CRUST);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = radius * (0.9 + rnd() * 0.07);
    g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, radius * (0.03 + rnd() * 0.04), radius * (0.02 + rnd() * 0.025)).fill({ color: CRUST_DARK, alpha: 0.5 + rnd() * 0.4 });
  }
  blob(g, cx, cy, radius * 0.88, 0.015, rnd, 40).fill(DOUGH);

  if (recipe.sauce) {
    // Sauce spread by hand: a ragged edge, darker pools and lighter streaks, a few herb flecks.
    blob(g, cx, cy, radius * 0.85, 0.035, rnd, 44).fill(SAUCE);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * radius * 0.7;
      blob(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, radius * (0.06 + rnd() * 0.1), 0.3, rnd, 12).fill({ color: rnd() < 0.5 ? 0x9e2a17 : 0xe0522f, alpha: 0.35 });
    }
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * radius * 0.8;
      g.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, radius * 0.006 + rnd() * radius * 0.006).fill({ color: 0x3f5f2a, alpha: 0.7 });
    }
  }

  if (recipe.cheese) {
    // Melted mozzarella: irregular pools that run into each other, leaving gaps of sauce,
    // with golden browned patches and the odd bubble.
    const pools: [number, number, number][] = [];
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * radius * 0.68;
      pools.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, radius * (0.12 + rnd() * 0.1)]);
    }
    for (const [x, y, r] of pools) blob(g, x, y, r * 1.08, 0.25, rnd, 14).fill({ color: 0xe9c46a, alpha: 0.55 });
    for (const [x, y, r] of pools) blob(g, x, y, r, 0.22, rnd, 14).fill({ color: CHEESE, alpha: 0.95 });
    for (let i = 0; i < 18; i++) {
      const [x, y, r] = pools[Math.floor(rnd() * pools.length)];
      const a = rnd() * Math.PI * 2;
      blob(g, x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, r * (0.15 + rnd() * 0.2), 0.3, rnd, 10).fill({ color: 0xd9a441, alpha: 0.45 });
    }
    for (let i = 0; i < 10; i++) {
      const [x, y, r] = pools[Math.floor(rnd() * pools.length)];
      g.circle(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r, r * 0.12).fill({ color: 0xfff4d6, alpha: 0.9 }).stroke({ width: 1, color: 0xc9953a, alpha: 0.6 });
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
    case 'half': {
      // A halved cherry tomato: skin, paler flesh and seeds.
      g.circle(x, y, s * 0.9).fill(c).stroke({ width: s * 0.1, color: darken(c) });
      g.circle(x, y, s * 0.6).fill(0xf28482);
      for (let i = 0; i < 3; i++) g.ellipse(...p(Math.cos(i * 2.1) * s * 0.3, Math.sin(i * 2.1) * s * 0.3), s * 0.12, s * 0.08).fill(0xffe066);
      break;
    }
    case 'crumble': {
      // Crumbled sausage, mince or ricotta: a cluster of rough little lumps.
      for (let i = 0; i < 5; i++) {
        const [px, py] = p(Math.cos(i * 1.3) * s * 0.45, Math.sin(i * 1.7) * s * 0.4);
        g.circle(px, py, s * (0.35 + (i % 3) * 0.08)).fill(i % 2 ? c : darken(c));
      }
      break;
    }
    case 'floret': {
      // A broccoli floret: a short stalk under a bumpy head.
      g.poly([...p(-s * 0.15, s * 0.1), ...p(s * 0.15, s * 0.1), ...p(s * 0.1, s * 0.9), ...p(-s * 0.1, s * 0.9)]).fill(0x95d5b2);
      for (const [dx, dy] of [[-0.35, -0.2], [0.35, -0.2], [0, -0.5], [0, 0]]) g.circle(...p(dx * s, dy * s), s * 0.38).fill(c);
      break;
    }
    case 'pearl':
      // Capers and other tiny round things.
      g.circle(x, y, s * 0.45).fill(c).stroke({ width: s * 0.08, color: darken(c) });
      g.circle(x - s * 0.15, y - s * 0.15, s * 0.12).fill({ color: 0xffffff, alpha: 0.5 });
      break;
  }
}

function darken(color: number): number {
  const r = ((color >> 16) & 0xff) * 0.7;
  const gr = ((color >> 8) & 0xff) * 0.7;
  const b = (color & 0xff) * 0.7;
  return (r << 16) | (gr << 8) | b;
}
