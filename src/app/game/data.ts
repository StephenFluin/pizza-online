import { Ingredient, IngredientCategory, Recipe, Topping } from './model';

export const INGREDIENTS: readonly Ingredient[] = [
  { id: 'tomato', category: 'vegetables', name: 'Tomato', cost: 0.3, shelfLife: 6, color: 0xd63a2f, shape: 'circle' },
  { id: 'mozzarella', category: 'cheese', name: 'Mozzarella', cost: 0.5, shelfLife: 8, color: 0xf6f0d8, shape: 'circle' },
  { id: 'salami', category: 'meat', name: 'Salami', cost: 0.6, shelfLife: 20, color: 0xa3283a, shape: 'circle' },
  { id: 'ham', category: 'meat', name: 'Ham', cost: 0.6, shelfLife: 7, color: 0xf0a3a3, shape: 'cube' },
  { id: 'mushroom', category: 'vegetables', name: 'Mushroom', cost: 0.4, shelfLife: 5, color: 0xc8b49a, shape: 'slice' },
  { id: 'pepper', category: 'vegetables', name: 'Green pepper', cost: 0.3, shelfLife: 7, color: 0x3e9a3a, shape: 'strip' },
  { id: 'onion', category: 'vegetables', name: 'Onion', cost: 0.2, shelfLife: 25, color: 0xeadcf0, shape: 'ring' },
  { id: 'olive', category: 'vegetables', name: 'Olive', cost: 0.5, shelfLife: 40, color: 0x2b2b2b, shape: 'ring' },
  { id: 'basil', category: 'vegetables', name: 'Basil', cost: 0.3, shelfLife: 3, color: 0x2f8f3c, shape: 'leaf' },
  { id: 'pineapple', category: 'fruit', name: 'Pineapple', cost: 0.5, shelfLife: 10, color: 0xf3d040, shape: 'cube' },
  { id: 'anchovy', category: 'meat', name: 'Anchovy', cost: 0.8, shelfLife: 30, color: 0x8c8a7e, shape: 'strip' },
  { id: 'shrimp', category: 'meat', name: 'Shrimp', cost: 1.1, shelfLife: 3, color: 0xf2925c, shape: 'slice' },
  { id: 'chili', category: 'vegetables', name: 'Chili', cost: 0.3, shelfLife: 12, color: 0xe0281e, shape: 'strip' },
  { id: 'corn', category: 'vegetables', name: 'Sweetcorn', cost: 0.2, shelfLife: 30, color: 0xf7d24a, shape: 'cube' },
  { id: 'egg', category: 'meat', name: 'Egg', cost: 0.3, shelfLife: 10, color: 0xfff6c8, shape: 'circle' },
  { id: 'artichoke', category: 'vegetables', name: 'Artichoke', cost: 0.7, shelfLife: 9, color: 0x8fae5a, shape: 'leaf' },
  { id: 'spinach', category: 'vegetables', name: 'Spinach', cost: 0.3, shelfLife: 3, color: 0x2d6a4f, shape: 'leaf' },
  { id: 'garlic', category: 'vegetables', name: 'Garlic', cost: 0.2, shelfLife: 40, color: 0xf2e9dc, shape: 'cube' },
  { id: 'tuna', category: 'meat', name: 'Tuna', cost: 0.9, shelfLife: 30, color: 0xc9a9a6, shape: 'cube' },
  { id: 'chicken', category: 'meat', name: 'Chicken', cost: 0.7, shelfLife: 4, color: 0xf3d9b1, shape: 'strip' },
  { id: 'bacon', category: 'meat', name: 'Bacon', cost: 0.7, shelfLife: 14, color: 0xc05746, shape: 'strip' },
  { id: 'banana', category: 'fruit', name: 'Banana', cost: 0.3, shelfLife: 5, color: 0xf6e27f, shape: 'circle' },
  { id: 'fig', category: 'fruit', name: 'Fig', cost: 0.8, shelfLife: 5, color: 0x7b3f61, shape: 'slice' },
  { id: 'pear', category: 'fruit', name: 'Pear', cost: 0.4, shelfLife: 8, color: 0xd4e09b, shape: 'slice' },
  { id: 'peach', category: 'fruit', name: 'Peach', cost: 0.5, shelfLife: 5, color: 0xf9a66c, shape: 'slice' },
  { id: 'parmesan', category: 'cheese', name: 'Parmesan', cost: 0.9, shelfLife: 60, color: 0xf5e1a4, shape: 'cube' },
  { id: 'gorgonzola', category: 'cheese', name: 'Gorgonzola', cost: 1.0, shelfLife: 20, color: 0xdfe6d8, shape: 'cube' },
  { id: 'feta', category: 'cheese', name: 'Feta', cost: 0.7, shelfLife: 25, color: 0xfafaf5, shape: 'cube' },
  { id: 'goat-cheese', category: 'cheese', name: 'Goat cheese', cost: 0.9, shelfLife: 14, color: 0xf7f3e3, shape: 'circle' },
];

export const INGREDIENT_CATEGORIES: { id: IngredientCategory; label: string }[] = [
  { id: 'vegetables', label: 'Vegetables' },
  { id: 'meat', label: 'Meat & fish' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'cheese', label: 'Cheese' },
];

/** Sauce and cheese are measured per pizza rather than placed by hand. */
export const BASE_COST = { dough: 0.4, sauce: 0.3, cheese: 0.6 };

export function ingredient(id: string): Ingredient {
  return INGREDIENTS.find((i) => i.id === id) ?? INGREDIENTS[0];
}

export interface CityDef {
  id: string;
  name: string;
  /** Multiplies rents and prices people are willing to pay. */
  costOfLiving: number;
  /** Ingredients this city's residents tend to like. */
  favourites: string[];
  /** Position on the world map, 0..1. */
  wx: number;
  wy: number;
}

export const CITIES: readonly CityDef[] = [
  { id: 'rome', name: 'Rome', costOfLiving: 1.0, favourites: ['basil', 'mozzarella', 'tomato', 'artichoke'], wx: 0.53, wy: 0.33 },
  { id: 'paris', name: 'Paris', costOfLiving: 1.3, favourites: ['ham', 'mushroom', 'egg', 'olive'], wx: 0.5, wy: 0.27 },
  { id: 'london', name: 'London', costOfLiving: 1.4, favourites: ['ham', 'mushroom', 'onion', 'corn'], wx: 0.49, wy: 0.24 },
  { id: 'berlin', name: 'Berlin', costOfLiving: 1.1, favourites: ['salami', 'onion', 'pepper', 'ham'], wx: 0.54, wy: 0.24 },
  { id: 'newyork', name: 'New York', costOfLiving: 1.6, favourites: ['salami', 'pepper', 'mushroom', 'onion'], wx: 0.27, wy: 0.31 },
  { id: 'minneapolis', name: 'Minneapolis', costOfLiving: 1.0, favourites: ['salami', 'corn', 'onion', 'mushroom'], wx: 0.22, wy: 0.28 },
  { id: 'rio', name: 'Rio de Janeiro', costOfLiving: 0.8, favourites: ['corn', 'egg', 'chili', 'olive'], wx: 0.34, wy: 0.68 },
  { id: 'tokyo', name: 'Tokyo', costOfLiving: 1.7, favourites: ['shrimp', 'corn', 'mushroom', 'egg'], wx: 0.86, wy: 0.33 },
  { id: 'sydney', name: 'Sydney', costOfLiving: 1.3, favourites: ['shrimp', 'pineapple', 'pepper', 'egg'], wx: 0.88, wy: 0.73 },
  { id: 'mexico', name: 'Mexico City', costOfLiving: 0.7, favourites: ['chili', 'corn', 'pepper', 'onion'], wx: 0.19, wy: 0.42 },
];

export function cityDef(id: string): CityDef {
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}

const DISTRICT_PREFIXES = ['Old', 'North', 'South', 'East', 'West', 'Upper', 'Lower', 'New', 'Little', 'Market'];
const DISTRICT_SUFFIXES = ['Town', 'Harbour', 'Hill', 'Park', 'Square', 'Quarter', 'Gardens', 'Heights', 'Side', 'Village'];

/** Picks `count` distinct district names using the supplied random source. */
export function districtNames(count: number, random: () => number): string[] {
  const names = new Set<string>();
  while (names.size < count) {
    const p = DISTRICT_PREFIXES[Math.floor(random() * DISTRICT_PREFIXES.length)];
    const s = DISTRICT_SUFFIXES[Math.floor(random() * DISTRICT_SUFFIXES.length)];
    names.add(`${p} ${s}`);
  }
  return [...names];
}

export const FIRST_NAMES = ['Ada', 'Bruno', 'Carla', 'Dario', 'Elena', 'Fabio', 'Gina', 'Hugo', 'Ines', 'Jonas', 'Kira', 'Luca', 'Mia', 'Nico', 'Olga', 'Paolo', 'Rosa', 'Sven', 'Tina', 'Umberto', 'Vera', 'Wim', 'Yara', 'Zeno'];
export const LAST_NAMES = ['Rossi', 'Bianchi', 'Moreau', 'Smith', 'Müller', 'Silva', 'Tanaka', 'Novak', 'Garcia', 'Kowalski', 'Jensen', 'Olsen', 'Costa', 'Ricci', 'Lindqvist'];

/** Places toppings in a ring pattern so standard recipes look hand-made. */
function scatter(ingredientId: string, count: number, offset: number): Topping[] {
  const toppings: Topping[] = [];
  for (let i = 0; i < count; i++) {
    const ring = i % 3;
    const r = 0.2 + ring * 0.25;
    const a = (i / count) * Math.PI * 2 + offset;
    toppings.push({ ingredient: ingredientId, x: Math.cos(a) * r, y: Math.sin(a) * r, rotation: a * 1.7 });
  }
  return toppings;
}

function standard(id: string, name: string, parts: [string, number][]): Recipe {
  const toppings = parts.flatMap(([ing, count], i) => scatter(ing, count, i * 0.9));
  return { id, name, ownerId: null, sauce: true, cheese: true, toppings };
}

export const STANDARD_RECIPES: readonly Recipe[] = [
  standard('std-margherita', 'Margherita', [['tomato', 6], ['basil', 5]]),
  standard('std-salami', 'Salami', [['salami', 9]]),
  standard('std-funghi', 'Funghi', [['mushroom', 10]]),
  standard('std-hawaii', 'Hawaii', [['ham', 7], ['pineapple', 7]]),
  standard('std-veggie', 'Garden', [['pepper', 6], ['onion', 5], ['mushroom', 5], ['olive', 4]]),
  standard('std-diavola', 'Diavola', [['salami', 7], ['chili', 6], ['onion', 4]]),
  standard('std-mare', 'Frutti di Mare', [['shrimp', 7], ['anchovy', 4], ['olive', 4]]),
  standard('std-capricciosa', 'Capricciosa', [['ham', 5], ['mushroom', 5], ['artichoke', 4], ['olive', 4], ['egg', 2]]),
];
