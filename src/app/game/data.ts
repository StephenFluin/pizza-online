import { Ingredient, IngredientCategory, Recipe, Topping } from './model';

export const INGREDIENTS: readonly Ingredient[] = [
  { id: 'tomato', category: 'vegetables', name: 'Tomato', cost: 0.3, shelfLife: 6, color: 0xd63a2f, shape: 'circle', grams: [25, 12, 5], calories: 18, intensity: 4, fat: 0, sweet: 4, salty: 1, hot: 0 },
  { id: 'mozzarella', category: 'cheese', name: 'Mozzarella', cost: 0.5, shelfLife: 8, color: 0xf6f0d8, shape: 'circle', grams: [20, 10, 4], calories: 280, intensity: 3, fat: 7, sweet: 1, salty: 3, hot: 0 },
  { id: 'salami', category: 'meat', name: 'Salami', cost: 0.6, shelfLife: 20, color: 0xa3283a, shape: 'circle', grams: [12, 6, 3], calories: 400, intensity: 7, fat: 8, sweet: 0, salty: 8, hot: 3 },
  { id: 'ham', category: 'meat', name: 'Ham', cost: 0.6, shelfLife: 7, color: 0xf0a3a3, shape: 'cube', grams: [15, 8, 4], calories: 145, intensity: 4, fat: 4, sweet: 1, salty: 6, hot: 0 },
  { id: 'mushroom', category: 'vegetables', name: 'Mushroom', cost: 0.4, shelfLife: 5, color: 0xc8b49a, shape: 'slice', grams: [10, 5, 2], calories: 22, intensity: 3, fat: 0, sweet: 1, salty: 1, hot: 0 },
  { id: 'pepper', category: 'vegetables', name: 'Green pepper', cost: 0.3, shelfLife: 7, color: 0x3e9a3a, shape: 'strip', grams: [8, 4, 2], calories: 20, intensity: 4, fat: 0, sweet: 3, salty: 0, hot: 1 },
  { id: 'onion', category: 'vegetables', name: 'Onion', cost: 0.2, shelfLife: 25, color: 0xeadcf0, shape: 'ring', grams: [8, 4, 2], calories: 40, intensity: 6, fat: 0, sweet: 4, salty: 0, hot: 2 },
  { id: 'olive', category: 'vegetables', name: 'Olive', cost: 0.5, shelfLife: 40, color: 0x2b2b2b, shape: 'ring', grams: [4, 2, 1], calories: 115, intensity: 6, fat: 6, sweet: 0, salty: 7, hot: 0 },
  { id: 'basil', category: 'vegetables', name: 'Basil', cost: 0.3, shelfLife: 3, color: 0x2f8f3c, shape: 'leaf', grams: [2, 1, 0.5], calories: 23, intensity: 7, fat: 0, sweet: 1, salty: 0, hot: 1, herb: true },
  { id: 'pineapple', category: 'fruit', name: 'Pineapple', cost: 0.5, shelfLife: 10, color: 0xf3d040, shape: 'cube', grams: [18, 9, 4], calories: 50, intensity: 5, fat: 0, sweet: 9, salty: 0, hot: 0 },
  { id: 'anchovy', category: 'meat', name: 'Anchovy', cost: 0.8, shelfLife: 30, color: 0x8c8a7e, shape: 'strip', grams: [6, 3, 1], calories: 210, intensity: 9, fat: 5, sweet: 0, salty: 10, hot: 0 },
  { id: 'shrimp', category: 'meat', name: 'Shrimp', cost: 1.1, shelfLife: 3, color: 0xf2925c, shape: 'slice', grams: [12, 6, 0], calories: 99, intensity: 5, fat: 1, sweet: 2, salty: 5, hot: 0 },
  { id: 'chili', category: 'vegetables', name: 'Chili', cost: 0.3, shelfLife: 12, color: 0xe0281e, shape: 'strip', grams: [3, 1.5, 0.6], calories: 40, intensity: 10, fat: 0, sweet: 1, salty: 0, hot: 10 },
  { id: 'corn', category: 'vegetables', name: 'Sweetcorn', cost: 0.2, shelfLife: 30, color: 0xf7d24a, shape: 'cube', grams: [5, 0, 0], calories: 86, intensity: 3, fat: 1, sweet: 6, salty: 1, hot: 0 },
  { id: 'egg', category: 'meat', name: 'Egg', cost: 0.3, shelfLife: 10, color: 0xfff6c8, shape: 'circle', grams: [50, 25, 0], calories: 155, intensity: 4, fat: 6, sweet: 0, salty: 2, hot: 0 },
  { id: 'artichoke', category: 'vegetables', name: 'Artichoke', cost: 0.7, shelfLife: 9, color: 0x8fae5a, shape: 'leaf', grams: [20, 10, 0], calories: 47, intensity: 5, fat: 0, sweet: 1, salty: 2, hot: 0 },
  { id: 'spinach', category: 'vegetables', name: 'Spinach', cost: 0.3, shelfLife: 3, color: 0x2d6a4f, shape: 'leaf', grams: [6, 3, 1], calories: 23, intensity: 4, fat: 0, sweet: 0, salty: 2, hot: 0 },
  { id: 'garlic', category: 'vegetables', name: 'Garlic', cost: 0.2, shelfLife: 40, color: 0xf2e9dc, shape: 'cube', grams: [4, 2, 1], calories: 150, intensity: 9, fat: 0, sweet: 1, salty: 1, hot: 4, herb: true },
  { id: 'tuna', category: 'meat', name: 'Tuna', cost: 0.9, shelfLife: 30, color: 0xc9a9a6, shape: 'cube', grams: [15, 8, 4], calories: 130, intensity: 6, fat: 4, sweet: 0, salty: 6, hot: 0 },
  { id: 'chicken', category: 'meat', name: 'Chicken', cost: 0.7, shelfLife: 4, color: 0xf3d9b1, shape: 'strip', grams: [18, 9, 4], calories: 165, intensity: 4, fat: 3, sweet: 0, salty: 3, hot: 0 },
  { id: 'bacon', category: 'meat', name: 'Bacon', cost: 0.7, shelfLife: 14, color: 0xc05746, shape: 'strip', grams: [10, 5, 2], calories: 540, intensity: 7, fat: 10, sweet: 1, salty: 9, hot: 0 },
  { id: 'banana', category: 'fruit', name: 'Banana', cost: 0.3, shelfLife: 5, color: 0xf6e27f, shape: 'circle', grams: [15, 7, 3], calories: 89, intensity: 4, fat: 0, sweet: 10, salty: 0, hot: 0 },
  { id: 'fig', category: 'fruit', name: 'Fig', cost: 0.8, shelfLife: 5, color: 0x7b3f61, shape: 'slice', grams: [20, 10, 4], calories: 74, intensity: 5, fat: 0, sweet: 9, salty: 0, hot: 0 },
  { id: 'pear', category: 'fruit', name: 'Pear', cost: 0.4, shelfLife: 8, color: 0xd4e09b, shape: 'slice', grams: [18, 9, 4], calories: 57, intensity: 4, fat: 0, sweet: 8, salty: 0, hot: 0 },
  { id: 'peach', category: 'fruit', name: 'Peach', cost: 0.5, shelfLife: 5, color: 0xf9a66c, shape: 'slice', grams: [18, 9, 4], calories: 39, intensity: 4, fat: 0, sweet: 8, salty: 0, hot: 0 },
  { id: 'parmesan', category: 'cheese', name: 'Parmesan', cost: 0.9, shelfLife: 60, color: 0xf5e1a4, shape: 'cube', grams: [8, 4, 2], calories: 430, intensity: 8, fat: 7, sweet: 0, salty: 9, hot: 0 },
  { id: 'gorgonzola', category: 'cheese', name: 'Gorgonzola', cost: 1.0, shelfLife: 20, color: 0xdfe6d8, shape: 'cube', grams: [12, 6, 3], calories: 350, intensity: 9, fat: 8, sweet: 0, salty: 7, hot: 2 },
  { id: 'feta', category: 'cheese', name: 'Feta', cost: 0.7, shelfLife: 25, color: 0xfafaf5, shape: 'cube', grams: [12, 6, 3], calories: 265, intensity: 6, fat: 6, sweet: 0, salty: 9, hot: 0 },
  { id: 'oregano', category: 'vegetables', name: 'Oregano', cost: 0.2, shelfLife: 60, color: 0x5b7a3a, shape: 'leaf', grams: [1, 0.5, 0.3], calories: 265, intensity: 8, fat: 0, sweet: 0, salty: 1, hot: 2, herb: true },
  { id: 'goat-cheese', category: 'cheese', name: 'Goat cheese', cost: 0.9, shelfLife: 14, color: 0xf7f3e3, shape: 'circle', grams: [12, 6, 3], calories: 360, intensity: 7, fat: 7, sweet: 1, salty: 5, hot: 0 },
  { id: 'cherry-tomato', category: 'vegetables', name: 'Cherry tomato', cost: 0.4, shelfLife: 6, color: 0xe63946, shape: 'half', grams: [12, 6, 3], calories: 18, intensity: 4, fat: 0, sweet: 5, salty: 1, hot: 0 },
  { id: 'sundried-tomato', category: 'vegetables', name: 'Sun-dried tomato', cost: 0.7, shelfLife: 60, color: 0xa4161a, shape: 'strip', grams: [6, 3, 1.5], calories: 258, intensity: 8, fat: 2, sweet: 6, salty: 5, hot: 0 },
  { id: 'jalapeno', category: 'vegetables', name: 'Jalapeño', cost: 0.4, shelfLife: 10, color: 0x3a7d44, shape: 'ring', grams: [4, 2, 1], calories: 29, intensity: 9, fat: 0, sweet: 1, salty: 0, hot: 9 },
  { id: 'red-onion', category: 'vegetables', name: 'Red onion', cost: 0.25, shelfLife: 25, color: 0x9b5de5, shape: 'ring', grams: [8, 4, 2], calories: 40, intensity: 6, fat: 0, sweet: 4, salty: 0, hot: 2 },
  { id: 'rocket', category: 'vegetables', name: 'Rocket', cost: 0.5, shelfLife: 4, color: 0x55a630, shape: 'leaf', grams: [2, 1, 0.5], calories: 25, intensity: 6, fat: 0, sweet: 0, salty: 1, hot: 2 },
  { id: 'broccoli', category: 'vegetables', name: 'Broccoli', cost: 0.35, shelfLife: 5, color: 0x2d6a4f, shape: 'floret', grams: [10, 5, 2], calories: 34, intensity: 3, fat: 0, sweet: 1, salty: 1, hot: 0 },
  { id: 'courgette', category: 'vegetables', name: 'Courgette', cost: 0.3, shelfLife: 7, color: 0x80b918, shape: 'circle', grams: [12, 6, 3], calories: 17, intensity: 3, fat: 0, sweet: 1, salty: 0, hot: 0 },
  { id: 'aubergine', category: 'vegetables', name: 'Aubergine', cost: 0.4, shelfLife: 7, color: 0x5a189a, shape: 'circle', grams: [15, 7, 3], calories: 25, intensity: 4, fat: 1, sweet: 1, salty: 1, hot: 0 },
  { id: 'roasted-pepper', category: 'vegetables', name: 'Roasted red pepper', cost: 0.5, shelfLife: 10, color: 0xd00000, shape: 'strip', grams: [10, 5, 2], calories: 31, intensity: 5, fat: 1, sweet: 4, salty: 1, hot: 1 },
  { id: 'green-olive', category: 'vegetables', name: 'Green olive', cost: 0.5, shelfLife: 40, color: 0x7a9e3d, shape: 'ring', grams: [4, 2, 1], calories: 145, intensity: 6, fat: 6, sweet: 0, salty: 8, hot: 0 },
  { id: 'capers', category: 'vegetables', name: 'Capers', cost: 0.8, shelfLife: 90, color: 0x6a994e, shape: 'pearl', grams: [1, 0.5, 0], calories: 23, intensity: 8, fat: 0, sweet: 0, salty: 9, hot: 0 },
  { id: 'potato', category: 'vegetables', name: 'Potato', cost: 0.2, shelfLife: 30, color: 0xf4e285, shape: 'slice', grams: [15, 7, 3], calories: 77, intensity: 2, fat: 1, sweet: 1, salty: 1, hot: 0 },
  { id: 'rosemary', category: 'vegetables', name: 'Rosemary', cost: 0.3, shelfLife: 20, color: 0x386641, shape: 'leaf', grams: [1, 0.5, 0.3], calories: 131, intensity: 9, fat: 0, sweet: 0, salty: 0, hot: 1, herb: true },
  { id: 'pepperoni', category: 'meat', name: 'Pepperoni', cost: 0.6, shelfLife: 25, color: 0xc1121f, shape: 'circle', grams: [6, 3, 1.5], calories: 494, intensity: 7, fat: 9, sweet: 1, salty: 8, hot: 4 },
  { id: 'sausage', category: 'meat', name: 'Italian sausage', cost: 0.6, shelfLife: 5, color: 0x9c6644, shape: 'crumble', grams: [10, 5, 2], calories: 300, intensity: 6, fat: 8, sweet: 1, salty: 7, hot: 2 },
  { id: 'minced-beef', category: 'meat', name: 'Minced beef', cost: 0.7, shelfLife: 3, color: 0x7f5539, shape: 'crumble', grams: [10, 5, 2], calories: 250, intensity: 5, fat: 7, sweet: 0, salty: 4, hot: 0 },
  { id: 'prosciutto', category: 'meat', name: 'Prosciutto', cost: 1.2, shelfLife: 20, color: 0xffadad, shape: 'strip', grams: [8, 4, 2], calories: 250, intensity: 6, fat: 6, sweet: 1, salty: 9, hot: 0 },
  { id: 'meatball', category: 'meat', name: 'Meatball', cost: 0.8, shelfLife: 4, color: 0x6f4518, shape: 'circle', grams: [20, 10, 5], calories: 220, intensity: 5, fat: 6, sweet: 1, salty: 5, hot: 1 },
  { id: 'mussels', category: 'meat', name: 'Mussels', cost: 0.9, shelfLife: 2, color: 0x2b2d42, shape: 'slice', grams: [8, 4, 0], calories: 86, intensity: 6, fat: 1, sweet: 1, salty: 6, hot: 0 },
  { id: 'smoked-salmon', category: 'meat', name: 'Smoked salmon', cost: 1.4, shelfLife: 10, color: 0xff8c69, shape: 'strip', grams: [10, 5, 2], calories: 117, intensity: 7, fat: 4, sweet: 0, salty: 8, hot: 0 },
  { id: 'ricotta', category: 'cheese', name: 'Ricotta', cost: 0.6, shelfLife: 7, color: 0xfffbf0, shape: 'crumble', grams: [15, 7, 3], calories: 174, intensity: 2, fat: 6, sweet: 2, salty: 1, hot: 0 },
  { id: 'provolone', category: 'cheese', name: 'Provolone', cost: 0.7, shelfLife: 30, color: 0xf3e5ab, shape: 'cube', grams: [10, 5, 2], calories: 350, intensity: 6, fat: 7, sweet: 0, salty: 6, hot: 0 },
  { id: 'cheddar', category: 'cheese', name: 'Cheddar', cost: 0.6, shelfLife: 40, color: 0xf9a825, shape: 'cube', grams: [10, 5, 2], calories: 403, intensity: 6, fat: 8, sweet: 0, salty: 6, hot: 0 },
  { id: 'buffalo-mozzarella', category: 'cheese', name: 'Buffalo mozzarella', cost: 1.1, shelfLife: 5, color: 0xffffff, shape: 'circle', grams: [25, 12, 5], calories: 250, intensity: 3, fat: 7, sweet: 1, salty: 2, hot: 0 },
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
  standard('std-pepperoni', 'Pepperoni', [['pepperoni', 24]]),
  standard('std-quattro-formaggi', 'Four Cheese', [['gorgonzola', 5], ['parmesan', 6], ['provolone', 5]]),
];
