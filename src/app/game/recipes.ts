import { BASE_COST, INGREDIENTS, ingredient } from './data';
import { District, Recipe } from './model';

/** Portions of an ingredient used by one placed topping piece. */
export const PORTION_PER_PIECE = 0.25;

/** Ingredient id -> portions one pizza uses (sauce uses tomato, cheese uses mozzarella). */
export function recipeUsage(recipe: Recipe): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const t of recipe.toppings) usage[t.ingredient] = (usage[t.ingredient] ?? 0) + PORTION_PER_PIECE;
  if (recipe.sauce) usage['tomato'] = (usage['tomato'] ?? 0) + 1;
  if (recipe.cheese) usage['mozzarella'] = (usage['mozzarella'] ?? 0) + 1;
  return usage;
}

/** Ingredient cost of one pizza. */
export function recipeCost(recipe: Recipe): number {
  let cost = BASE_COST.dough;
  for (const [id, portions] of Object.entries(recipeUsage(recipe))) cost += ingredient(id).cost * portions;
  return cost;
}

/**
 * Craft quality 0..1, independent of who eats it: enough toppings, spread evenly
 * across the base, a sensible number of different ingredients, sauce and cheese.
 */
export function recipeQuality(recipe: Recipe): number {
  const n = recipe.toppings.length;
  const amount = n === 0 ? 0 : n < 8 ? n / 8 : n <= 24 ? 1 : Math.max(0.3, 1 - (n - 24) / 24);

  // Evenness: compare piece counts across the four quadrants and the centre/edge rings.
  let spread = 0;
  if (n > 0) {
    const quads = [0, 0, 0, 0];
    let inner = 0;
    let offBase = 0;
    for (const t of recipe.toppings) {
      const r = Math.hypot(t.x, t.y);
      if (r > 0.92) offBase++;
      if (r < 0.5) inner++;
      quads[(t.x >= 0 ? 1 : 0) + (t.y >= 0 ? 2 : 0)]++;
    }
    const mean = n / 4;
    const dev = quads.reduce((s, q) => s + Math.abs(q - mean), 0) / (2 * n);
    const ringBalance = 1 - Math.abs(inner / n - 0.35) * 1.5;
    spread = Math.max(0, (1 - dev) * 0.6 + ringBalance * 0.4 - (offBase / n) * 1.2);
  }

  const kinds = new Set(recipe.toppings.map((t) => t.ingredient)).size;
  const variety = kinds === 0 ? 0 : kinds <= 4 ? 0.6 + kinds * 0.1 : Math.max(0.4, 1 - (kinds - 4) * 0.12);
  const base = (recipe.sauce ? 0.5 : 0) + (recipe.cheese ? 0.5 : 0);

  return clamp01(amount * 0.3 + spread * 0.3 + variety * 0.2 + base * 0.2);
}

/** How much a district likes the ingredients, -1..1, weighted by quantity. */
export function recipeTaste(recipe: Recipe, district: District): number {
  const usage = recipeUsage(recipe);
  let total = 0;
  let weight = 0;
  for (const [id, portions] of Object.entries(usage)) {
    total += (district.tastes[id] ?? 0) * portions;
    weight += portions;
  }
  return weight === 0 ? -1 : total / weight;
}

/** Price a district considers fair for a pizza. */
export function fairPrice(district: District, costOfLiving: number): number {
  return (6 + district.wealth * 7) * costOfLiving;
}

/**
 * Appeal of one menu item to a district, 0..~1.5. Rich districts care more about
 * quality, poorer districts more about price.
 */
export function itemAppeal(recipe: Recipe, price: number, district: District, costOfLiving: number): number {
  const quality = recipeQuality(recipe);
  const taste = (recipeTaste(recipe, district) + 1) / 2;
  const qWeight = 0.3 + district.wealth * 0.3;
  const food = quality * qWeight + taste * (1 - qWeight);
  const ratio = fairPrice(district, costOfLiving) / Math.max(0.5, price);
  const priceSensitivity = 1.6 - district.wealth;
  return food * Math.pow(ratio, priceSensitivity);
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Population-weighted taste of a recipe across a city's districts, -1..1. */
export function cityTaste(recipe: Recipe, districts: District[]): number {
  let total = 0;
  let pop = 0;
  for (const d of districts) {
    total += recipeTaste(recipe, d) * d.population;
    pop += d.population;
  }
  return pop === 0 ? 0 : total / pop;
}

export function tasteLabel(taste: number): string {
  return taste > 0.35 ? 'Loved' : taste > 0.1 ? 'Liked' : taste > -0.1 ? 'Mixed' : 'Disliked';
}

/** Validates an imported recipe file; returns null when it is not a usable recipe. */
export function parseRecipe(data: unknown): Omit<Recipe, 'id' | 'ownerId'> | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d['name'] !== 'string' || !Array.isArray(d['toppings'])) return null;
  const toppings = [];
  for (const t of d['toppings'].slice(0, MAX_TOPPINGS)) {
    if (typeof t !== 'object' || t === null) return null;
    const { ingredient: ing, x, y, rotation } = t as Record<string, unknown>;
    if (typeof ing !== 'string' || !INGREDIENT_IDS.has(ing)) return null;
    if (typeof x !== 'number' || typeof y !== 'number' || Math.hypot(x, y) > 1) return null;
    toppings.push({ ingredient: ing, x, y, rotation: typeof rotation === 'number' ? rotation : 0 });
  }
  return { name: d['name'].slice(0, 32), sauce: d['sauce'] !== false, cheese: d['cheese'] !== false, toppings };
}

export const MAX_TOPPINGS = 40;
const INGREDIENT_IDS = new Set(INGREDIENTS.map((i) => i.id));
