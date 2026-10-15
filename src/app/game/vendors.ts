import { INGREDIENTS, cityDef, ingredient } from './data';
import { GameState, IngredientCategory } from './model';
import { Rng, hashString } from './rng';

/** A wholesaler selling one category of ingredients in one city. */
export interface Vendor {
  id: string;
  cityId: string;
  category: IngredientCategory;
  name: string;
  /** 0–100; better stock makes better pizzas but costs more. */
  quality: number;
  /** Chance (0–1) that a delivery doesn't turn up. */
  missChance: number;
  /** Smallest order the vendor will deliver, in dollars. */
  minimumOrder: number;
  /** Ingredient id -> price multiplier on the city price; missing = not stocked. */
  priceLevels: Record<string, number>;
}

const NAMES: Record<IngredientCategory, string[]> = {
  vegetables: ['Green Valley Produce', 'Sunny Acres Farm', 'Market Garden Co.', 'Root & Leaf', 'Hilltop Growers', 'Riverside Greens'],
  meat: ['Butcher Brothers', 'Prime Cuts', 'Harbour Fish & Meat', 'Smokehouse Supply', 'Coastal Catch', 'Hearth & Hook'],
  fruit: ['Orchard Direct', 'Tropical Imports', 'Golden Grove', 'Fruit Basket Traders', 'Blossom Lane'],
  cheese: ['Dairy Dell', 'Alpine Creamery', 'Old Cellar Cheeses', 'Meadow Milk Co.', 'Wheel & Rind'],
};

export const VENDORS_PER_CATEGORY = 3;

/** All vendors in a city. Deterministic per game seed so they're stable across saves. */
export function cityVendors(cityId: string, seed: number): Vendor[] {
  const rng = new Rng(hashString(`vendors:${cityId}`) ^ seed);
  const vendors: Vendor[] = [];
  for (const category of Object.keys(NAMES) as IngredientCategory[]) {
    const names = [...NAMES[category]];
    for (let i = 0; i < VENDORS_PER_CATEGORY; i++) {
      const name = names.splice(rng.int(0, names.length - 1), 1)[0];
      const quality = rng.int(25, 95);
      const items = INGREDIENTS.filter((ing) => ing.category === category);
      const priceLevels: Record<string, number> = {};
      for (const ing of items) {
        // Most vendors stock most items; better vendors charge more.
        if (rng.chance(0.78)) priceLevels[ing.id] = Math.round((0.65 + (quality / 100) * 0.6 + rng.range(-0.12, 0.12)) * 100) / 100;
      }
      // Always stock at least three items.
      for (const ing of items) if (Object.keys(priceLevels).length < 3 && !(ing.id in priceLevels)) priceLevels[ing.id] = 1;
      vendors.push({
        id: `${cityId}:${category}:${i}`,
        cityId,
        category,
        name,
        quality,
        missChance: Math.round(rng.range(0, 0.18) * (1.2 - quality / 100) * 100) / 100,
        minimumOrder: rng.pick([50, 100, 150, 250, 400]),
        priceLevels,
      });
    }
  }
  return vendors;
}

export function vendorById(state: GameState, vendorId: string): Vendor | null {
  const cityId = vendorId.split(':')[0];
  return cityVendors(cityId, state.seed).find((v) => v.id === vendorId) ?? null;
}

/** Price per unit from a vendor this week, or null if they don't stock it. Prices drift week to week. */
export function vendorPrice(v: Vendor, ingredientId: string, day: number): number | null {
  const level = v.priceLevels[ingredientId];
  if (level === undefined) return null;
  const week = Math.floor(day / 7);
  const wobble = 0.92 + new Rng(hashString(`${v.id}:${ingredientId}:${week}`)).next() * 0.16;
  return Math.round(ingredient(ingredientId).cost * cityDef(v.cityId).costOfLiving * level * wobble * 100) / 100;
}

/** Days the given stock lasts at the restaurant's daily usage, or null when it isn't used. */
export function daysOfSupply(stock: number, usagePerDay: number): number | null {
  return usagePerDay > 0 ? Math.floor(stock / usagePerDay) : null;
}
