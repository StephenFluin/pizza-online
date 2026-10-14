import { STANDARD_RECIPES, ingredient } from './data';
import { Cut, District, Recipe, Topping } from './model';

/** The six customer groups every district is made of. */
export type CustomerGroup = 'children' | 'young' | 'blueCollar' | 'whiteCollar' | 'business' | 'seniors';

export const CUSTOMER_GROUPS: { id: CustomerGroup; label: string }[] = [
  { id: 'children', label: 'Children' },
  { id: 'young', label: 'Young people' },
  { id: 'blueCollar', label: 'Blue collar' },
  { id: 'whiteCollar', label: 'White collar' },
  { id: 'business', label: 'Business people' },
  { id: 'seniors', label: 'Seniors' },
];

interface GroupTaste {
  /** Preferred flavour mix, each 0–100. */
  fat: number;
  sweet: number;
  salty: number;
  hot: number;
  /** How much the group cares about looks, fine cutting, a sensible pizza, trends and familiar classics (weights sum ≤ 0.4). */
  appearance: number;
  refinement: number;
  normality: number;
  trend: number;
  imitation: number;
}

/** Our own taste profiles for each group. */
export const GROUP_TASTES: Record<CustomerGroup, GroupTaste> = {
  children: { fat: 45, sweet: 70, salty: 30, hot: 5, appearance: 0.2, refinement: 0, normality: 0.1, trend: 0.05, imitation: 0.05 },
  young: { fat: 50, sweet: 40, salty: 45, hot: 45, appearance: 0.05, refinement: 0.05, normality: 0.05, trend: 0.25, imitation: 0 },
  blueCollar: { fat: 70, sweet: 15, salty: 60, hot: 55, appearance: 0, refinement: 0, normality: 0.25, trend: 0, imitation: 0.05 },
  whiteCollar: { fat: 40, sweet: 25, salty: 55, hot: 35, appearance: 0.1, refinement: 0.2, normality: 0.05, trend: 0.05, imitation: 0 },
  business: { fat: 30, sweet: 30, salty: 50, hot: 20, appearance: 0.2, refinement: 0.15, normality: 0, trend: 0.05, imitation: 0 },
  seniors: { fat: 45, sweet: 30, salty: 50, hot: 10, appearance: 0.05, refinement: 0.05, normality: 0.15, trend: 0, imitation: 0.15 },
};

/** Weight of the base, sauce and cheese layers, and what they bring to the flavour. */
const DOUGH = { grams: 250, calories: 270 };
const SAUCE = { grams: 80, calories: 30, intensity: 3, fat: 0, sweet: 3, salty: 2, hot: 0 };
const CHEESE = { grams: 100, calories: 280, intensity: 3, fat: 7, sweet: 1, salty: 3, hot: 0 };

export const CUT_NAMES = ['whole', 'chopped', 'minced'] as const;

export function toppingCut(t: Topping): Cut {
  return t.cut ?? 0;
}

/** Grams one placed piece weighs at its cut (falling back to the finest cut the ingredient allows). */
export function pieceGrams(t: Topping): number {
  const ing = ingredient(t.ingredient);
  let cut = toppingCut(t);
  while (cut > 0 && ing.grams[cut] === 0) cut = (cut - 1) as Cut;
  return ing.grams[cut];
}

/** The finest cut an ingredient allows. */
export function maxCut(ingredientId: string): Cut {
  const g = ingredient(ingredientId).grams;
  return g[2] > 0 ? 2 : g[1] > 0 ? 1 : 0;
}

export interface PizzaStats {
  calories: number;
  /** Flavour mix, each 0–100. */
  fat: number;
  sweet: number;
  salty: number;
  hot: number;
  /** 0–100 each. */
  appearance: number;
  refinement: number;
  normality: number;
  /** How close it is to the nearest classic (100 = a copy) and which one. */
  imitation: number;
  closestClassic: string;
  /** 0–10, from the weight of herbs. */
  herbs: number;
  /** −100..100: how fashionable its main ingredients are in the city. */
  trend: number;
  /** Popularity with each customer group, 0–100. */
  groups: Record<CustomerGroup, number>;
  /** Total topping weight in grams. */
  toppingGrams: number;
}

/** Grams of each ingredient on the pizza (toppings only). */
export function toppingWeights(recipe: Pick<Recipe, 'toppings'>): Record<string, number> {
  const w: Record<string, number> = {};
  for (const t of recipe.toppings) w[t.ingredient] = (w[t.ingredient] ?? 0) + pieceGrams(t);
  return w;
}

function appearance(recipe: Pick<Recipe, 'toppings'>): number {
  const n = recipe.toppings.length;
  if (n === 0) return 0;
  // Even spread across quadrants and between centre and rim, nothing hanging off the edge.
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
  const ringBalance = 1 - Math.abs(inner / n - 0.3) * 1.5;
  const coverage = Math.min(1, n / 14);
  const score = ((1 - dev) * 0.45 + ringBalance * 0.3 + coverage * 0.25 - (offBase / n) * 1.2) * 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function refinement(recipe: Pick<Recipe, 'toppings'>): number {
  // Average cut level of pieces that could be cut, relative to how far they could go.
  let total = 0;
  let count = 0;
  for (const t of recipe.toppings) {
    const max = maxCut(t.ingredient);
    if (max === 0) continue;
    total += Math.min(toppingCut(t), max) / max;
    count++;
  }
  return count ? Math.round((total / count) * 100) : 0;
}

function normality(weights: Record<string, number>, toppingGrams: number): number {
  const kinds = Object.keys(weights).length;
  // A hearty but sensible amount of topping and a handful of different things.
  const weightScore = toppingGrams < 120 ? toppingGrams / 120 : toppingGrams <= 450 ? 1 : Math.max(0, 1 - (toppingGrams - 450) / 450);
  const varietyScore = kinds === 0 ? 0 : kinds <= 5 ? 0.6 + kinds * 0.08 : Math.max(0.3, 1 - (kinds - 5) * 0.12);
  return Math.round(Math.min(100, (weightScore * 0.6 + varietyScore * 0.4) * 100));
}

function imitation(weights: Record<string, number>): { score: number; name: string } {
  let best = { score: 0, name: '' };
  for (const std of STANDARD_RECIPES) {
    const ref = toppingWeights(std);
    const ids = new Set([...Object.keys(ref), ...Object.keys(weights)]);
    let diff = 0;
    let sum = 0;
    for (const id of ids) {
      diff += Math.abs((weights[id] ?? 0) - (ref[id] ?? 0));
      sum += (weights[id] ?? 0) + (ref[id] ?? 0);
    }
    const score = sum ? Math.round((1 - diff / sum) * 100) : 0;
    if (score > best.score) best = { score, name: std.name };
  }
  return best;
}

/** Population-weighted city taste for an ingredient, −1..1 (from the district taste tables). */
function cityTasteFor(id: string, districts: District[]): number {
  let total = 0;
  let pop = 0;
  for (const d of districts) {
    total += (d.tastes[id] ?? 0) * d.population;
    pop += d.population;
  }
  return pop ? total / pop : 0;
}

/** Full stats for a recipe; `districts` (the current city) is needed for the trend. */
export function pizzaStats(recipe: Pick<Recipe, 'sauce' | 'cheese' | 'toppings'>, districts: District[] = []): PizzaStats {
  const weights = toppingWeights(recipe);
  const toppingGrams = Object.values(weights).reduce((n, g) => n + g, 0);

  let calories = (DOUGH.grams * DOUGH.calories) / 100;
  const flavour = { fat: 0, sweet: 0, salty: 0, hot: 0 };
  let flavourWeight = 0;
  const addFlavour = (grams: number, f: { intensity: number; fat: number; sweet: number; salty: number; hot: number }) => {
    const w = grams * f.intensity;
    flavour.fat += f.fat * w;
    flavour.sweet += f.sweet * w;
    flavour.salty += f.salty * w;
    flavour.hot += f.hot * w;
    flavourWeight += w;
  };
  if (recipe.sauce) {
    calories += (SAUCE.grams * SAUCE.calories) / 100;
    addFlavour(SAUCE.grams, SAUCE);
  }
  if (recipe.cheese) {
    calories += (CHEESE.grams * CHEESE.calories) / 100;
    addFlavour(CHEESE.grams, CHEESE);
  }
  let herbGrams = 0;
  for (const [id, grams] of Object.entries(weights)) {
    const ing = ingredient(id);
    calories += (grams * ing.calories) / 100;
    addFlavour(grams, ing);
    if (ing.herb) herbGrams += grams;
  }
  const pct = (v: number) => (flavourWeight ? Math.round((v / flavourWeight) * 10) : 0);

  // Trend: how fashionable the four defining ingredients (by weight × intensity) are.
  const defining = Object.entries(weights)
    .map(([id, g]) => ({ id, w: g * ingredient(id).intensity }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 4);
  const trend = defining.length ? Math.round((defining.reduce((n, d) => n + cityTasteFor(d.id, districts), 0) / defining.length) * 100) : 0;

  const stats: Omit<PizzaStats, 'groups'> = {
    calories: Math.round(calories),
    fat: pct(flavour.fat),
    sweet: pct(flavour.sweet),
    salty: pct(flavour.salty),
    hot: pct(flavour.hot),
    appearance: appearance(recipe),
    refinement: refinement(recipe),
    normality: normality(weights, toppingGrams),
    ...(() => {
      const im = imitation(weights);
      return { imitation: im.score, closestClassic: im.name };
    })(),
    herbs: Math.min(10, Math.round(herbGrams / 3)),
    trend,
    toppingGrams: Math.round(toppingGrams),
  };
  const groups = {} as Record<CustomerGroup, number>;
  for (const g of CUSTOMER_GROUPS) groups[g.id] = groupPopularity(stats, GROUP_TASTES[g.id]);
  return { ...stats, groups };
}

function groupPopularity(s: Omit<PizzaStats, 'groups'>, t: GroupTaste): number {
  if (s.toppingGrams === 0) return 0;
  // Flavour match: 100 when the mix matches the group's taste exactly.
  const miss = (Math.abs(s.fat - t.fat) + Math.abs(s.sweet - t.sweet) + Math.abs(s.salty - t.salty) + Math.abs(s.hot - t.hot)) / 4;
  const flavour = Math.max(0, 100 - miss * 1.6);
  const qualityWeight = t.appearance + t.refinement + t.normality + t.trend + t.imitation;
  const quality =
    s.appearance * t.appearance + s.refinement * t.refinement + s.normality * t.normality + ((s.trend + 100) / 2) * t.trend + s.imitation * t.imitation;
  return Math.round(flavour * (1 - qualityWeight) + quality);
}
