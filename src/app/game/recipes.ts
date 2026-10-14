import { BASE_COST, INGREDIENTS, ingredient } from './data';
import { Cut, District, Recipe, Topping } from './model';
import { cachedPizzaStats, districtGroupScore, toppingWeights } from './pizza-stats';

/** Stock is counted in units of 100 g. */
export const GRAMS_PER_UNIT = 100;
/** Sauce and cheese per pizza, in stock units of tomato and mozzarella. */
const SAUCE_UNITS = 0.8;
const CHEESE_UNITS = 1;

/** Ingredient id -> stock units one pizza uses: each piece by its weight at its cut, plus sauce (tomato) and cheese (mozzarella). */
export function recipeUsage(recipe: Recipe): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const [id, grams] of Object.entries(toppingWeights(recipe))) usage[id] = grams / GRAMS_PER_UNIT;
  if (recipe.sauce) usage['tomato'] = (usage['tomato'] ?? 0) + SAUCE_UNITS;
  if (recipe.cheese) usage['mozzarella'] = (usage['mozzarella'] ?? 0) + CHEESE_UNITS;
  return usage;
}

/** Ingredient cost of one pizza. */
export function recipeCost(recipe: Recipe): number {
  let cost = BASE_COST.dough;
  for (const [id, units] of Object.entries(recipeUsage(recipe))) cost += ingredient(id).cost * units;
  return cost;
}

/**
 * Craft quality 0..1, independent of who eats it: how the toppings look, how
 * finely they're cut and whether it's a sensible pizza, plus sauce and cheese.
 */
export function recipeQuality(recipe: Recipe): number {
  const s = cachedPizzaStats(recipe);
  const craft = (s.appearance * 0.45 + s.refinement * 0.15 + s.normality * 0.4) / 100;
  const base = 0.8 + (recipe.sauce ? 0.1 : 0) + (recipe.cheese ? 0.1 : 0);
  return clamp01(craft * base);
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
 * Appeal of one menu item to a district, 0..~1.5: how much the district's
 * customer groups like it, its craft quality, how fashionable its main
 * ingredients are in the city, and its price against local incomes (poorer
 * districts are more price sensitive).
 */
export function itemAppeal(recipe: Recipe, price: number, district: District, costOfLiving: number, cityDistricts?: District[]): number {
  const stats = cachedPizzaStats(recipe, cityDistricts);
  const groups = districtGroupScore(stats, district);
  const quality = recipeQuality(recipe);
  const food = groups * 0.6 + quality * 0.4;
  const trend = 1 + stats.trend / 300;
  const ratio = fairPrice(district, costOfLiving) / Math.max(0.5, price);
  const priceSensitivity = 1.6 - district.wealth;
  return food * trend * Math.pow(ratio, priceSensitivity);
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
  const toppings: Topping[] = [];
  for (const t of d['toppings'].slice(0, MAX_TOPPINGS)) {
    if (typeof t !== 'object' || t === null) return null;
    const { ingredient: ing, x, y, rotation, cut } = t as Record<string, unknown>;
    if (typeof ing !== 'string' || !INGREDIENT_IDS.has(ing)) return null;
    if (typeof x !== 'number' || typeof y !== 'number' || Math.hypot(x, y) > 1) return null;
    const topping: Topping = { ingredient: ing, x, y, rotation: typeof rotation === 'number' ? rotation : 0 };
    if (cut === 1 || cut === 2) topping.cut = cut as Cut;
    toppings.push(topping);
  }
  return { name: d['name'].slice(0, 32), sauce: d['sauce'] !== false, cheese: d['cheese'] !== false, toppings };
}

export const MAX_TOPPINGS = 40;
const INGREDIENT_IDS = new Set(INGREDIENTS.map((i) => i.id));
