import { CITIES, INGREDIENTS, cityDef, ingredient } from './data';
import { GameState } from './model';
import { invalidatePizzaStats } from './pizza-stats';

/**
 * The city papers: daily events that move ingredient fashions and demand,
 * a weekly economic trend per city, and weekly pizza charts. All articles are
 * our own.
 */

export interface Article {
  title: string;
  body: string;
  kind: 'event' | 'economy' | 'business' | 'weather';
}

export interface IngredientTrend {
  ingredientId: string;
  /** Taste shift applied to every district while it runs. */
  delta: number;
  daysLeft: number;
}

export interface CityConditions {
  /** −1 (slump) .. 1 (boom); moves a little each week and scales demand ±15%. */
  economy: number;
  /** Extra demand today (e.g. 0.2 = +20%) and how many days it lasts. */
  demandBoost: number;
  boostDays: number;
  trends: IngredientTrend[];
}

export interface ChartEntry {
  recipeName: string;
  owner: string;
  sold: number;
}

export interface Edition {
  cityId: string;
  day: number;
  articles: Article[];
}

type EventTemplate = (st: GameState, cityId: string) => Article | null;

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

function startTrend(
  st: GameState,
  cityId: string,
  ingredientId: string,
  delta: number,
  days: number,
): void {
  const c = conditions(st, cityId);
  const city = st.cities.find((x) => x.id === cityId);
  if (!city || c.trends.some((t) => t.ingredientId === ingredientId)) return;
  for (const d of city.districts)
    d.tastes[ingredientId] = Math.max(-1, Math.min(1, (d.tastes[ingredientId] ?? 0) + delta));
  c.trends.push({ ingredientId, delta, daysLeft: days });
  invalidatePizzaStats();
}

const POPULAR: EventTemplate[] = [
  (st, cityId) => {
    const ing = pick(INGREDIENTS);
    startTrend(st, cityId, ing.id, 0.35, 21);
    return {
      kind: 'event',
      title: `${ing.name} is the taste of the season`,
      body: `Food writers can't stop talking about ${ing.name.toLowerCase()}. Pizzerias that put it on the menu can expect hungry crowds for the next few weeks.`,
    };
  },
  (st, cityId) => {
    const ing = pick(INGREDIENTS.filter((i) => i.category === 'vegetables'));
    startTrend(st, cityId, ing.id, 0.3, 28);
    return {
      kind: 'event',
      title: `Doctors praise the humble ${ing.name.toLowerCase()}`,
      body: `A new study links ${ing.name.toLowerCase()} to long life and good cheer. Greengrocers report queues around the block.`,
    };
  },
  (st, cityId) => {
    const ing = pick(INGREDIENTS.filter((i) => i.category === 'cheese' || i.category === 'fruit'));
    startTrend(st, cityId, ing.id, 0.4, 14);
    return {
      kind: 'event',
      title: `Celebrity chef swears by ${ing.name.toLowerCase()}`,
      body: `"Nothing beats ${ing.name.toLowerCase()} on a pizza," the star of a popular cooking show told reporters. Expect copycats.`,
    };
  },
];

const UNPOPULAR: EventTemplate[] = [
  (st, cityId) => {
    const ing = pick(INGREDIENTS.filter((i) => i.category === 'meat'));
    startTrend(st, cityId, ing.id, -0.45, 21);
    return {
      kind: 'event',
      title: `Health scare hits ${ing.name.toLowerCase()} sales`,
      body: `Inspectors are investigating a supplier after complaints. Many diners are steering clear of ${ing.name.toLowerCase()} until it blows over.`,
    };
  },
  (st, cityId) => {
    const ing = pick(INGREDIENTS);
    startTrend(st, cityId, ing.id, -0.3, 14);
    return {
      kind: 'event',
      title: `Is ${ing.name.toLowerCase()} out of fashion?`,
      body: `A trendsetting magazine declares ${ing.name.toLowerCase()} "so last year". Younger diners seem to agree.`,
    };
  },
];

const DEMAND: EventTemplate[] = [
  (st, cityId) => {
    const c = conditions(st, cityId);
    c.demandBoost = 0.25;
    c.boostDays = 1;
    return {
      kind: 'event',
      title: 'Cup final tonight',
      body: 'The whole city will be glued to the big match, and nobody wants to cook. Pizza ovens will be busy.',
    };
  },
  (st, cityId) => {
    const c = conditions(st, cityId);
    c.demandBoost = -0.2;
    c.boostDays = 2;
    return {
      kind: 'weather',
      title: 'Heatwave grips the city',
      body: 'Temperatures soar and appetites wilt. Ice cream parlours are doing better than pizzerias this week.',
    };
  },
  (st, cityId) => {
    const c = conditions(st, cityId);
    c.demandBoost = 0.15;
    c.boostDays = 2;
    return {
      kind: 'weather',
      title: 'Rain, rain and more rain',
      body: 'A soggy weekend ahead. Locals are expected to stay in town and treat themselves to comfort food.',
    };
  },
  (st, cityId) => {
    const c = conditions(st, cityId);
    c.demandBoost = 0.2;
    c.boostDays = 3;
    return {
      kind: 'event',
      title: 'Street festival comes to town',
      body: 'Music, parades and thousands of visitors are expected over the next few days. Restaurants should stock up.',
    };
  },
];

export function conditions(st: GameState, cityId: string): CityConditions {
  st.cityConditions ??= {};
  return (st.cityConditions[cityId] ??= { economy: 0, demandBoost: 0, boostDays: 0, trends: [] });
}

/** Demand multiplier for a city today from its economy and any special occasion. */
export function demandFactor(st: GameState, cityId: string): number {
  const c = conditions(st, cityId);
  return (1 + c.economy * 0.15) * (1 + (c.boostDays > 0 ? c.demandBoost : 0));
}

/** Morning: age running trends and occasions, then maybe a new event per city; returns the player's front page. */
export function morningNews(st: GameState): void {
  for (const city of CITIES) {
    const c = conditions(st, city.id);
    if (c.boostDays > 0) c.boostDays--;
    const ended = c.trends.filter((t) => --t.daysLeft <= 0);
    if (ended.length) {
      const cityMap = st.cities.find((x) => x.id === city.id);
      for (const t of ended)
        for (const d of cityMap?.districts ?? [])
          d.tastes[t.ingredientId] = Math.max(
            -1,
            Math.min(1, (d.tastes[t.ingredientId] ?? 0) - t.delta),
          );
      c.trends = c.trends.filter((t) => t.daysLeft > 0);
      invalidatePizzaStats();
    }
  }
  const articles: Article[] = [];
  for (const city of CITIES) {
    // Roughly one event per city every few days.
    if (Math.random() > 0.3) continue;
    const roll = Math.random();
    const template = roll < 0.45 ? pick(POPULAR) : roll < 0.7 ? pick(UNPOPULAR) : pick(DEMAND);
    const article = template(st, city.id);
    if (article && city.id === st.currentCityId) articles.push(article);
  }
  if (st.day % 7 === 0) {
    weeklyEconomy(st);
    articles.push(economyArticle(st, st.currentCityId));
    updateCharts(st);
  }
  st.newspaper = {
    cityId: st.currentCityId,
    day: st.day,
    articles: [
      ...articles,
      ...(st.newspaper?.cityId === st.currentCityId ? (st.newspaper.articles ?? []) : []),
    ].slice(0, 8),
  };
}

function weeklyEconomy(st: GameState): void {
  for (const city of CITIES) {
    const c = conditions(st, city.id);
    // A slow random walk that drifts back towards normal.
    c.economy = Math.max(-1, Math.min(1, c.economy * 0.9 + (Math.random() - 0.5) * 0.35));
  }
}

function economyArticle(st: GameState, cityId: string): Article {
  const e = conditions(st, cityId).economy;
  const name = cityDef(cityId).name;
  if (e > 0.4)
    return {
      kind: 'economy',
      title: `${name} is booming`,
      body: 'Shops are full and wallets are open. Restaurants report their best trade in years.',
    };
  if (e > 0.1)
    return {
      kind: 'economy',
      title: `Steady growth in ${name}`,
      body: 'Business leaders are cautiously optimistic as spending edges up.',
    };
  if (e > -0.1)
    return {
      kind: 'economy',
      title: `Business as usual in ${name}`,
      body: 'Analysts see no big changes this week.',
    };
  if (e > -0.4)
    return {
      kind: 'economy',
      title: `${name} tightens its belt`,
      body: 'Households are spending less. Value for money matters more than ever.',
    };
  return {
    kind: 'economy',
    title: `Slump deepens in ${name}`,
    body: 'Unemployment rises and restaurants report empty tables. Hard times ahead.',
  };
}

/** Weekly top five pizzas per city, by yesterday's sales across every chain. */
export function updateCharts(st: GameState): void {
  st.charts ??= {};
  for (const city of CITIES) {
    const totals = new Map<string, ChartEntry>();
    for (const r of st.restaurants.filter((x) => x.cityId === city.id)) {
      const owner = st.players.find((p) => p.id === r.ownerId)?.name ?? '';
      for (const [recipeId, sales] of Object.entries(r.lastDay.pizzas ?? {})) {
        const recipe = st.recipes.find((x) => x.id === recipeId);
        if (!recipe || sales.sold === 0) continue;
        const key = `${recipeId}:${r.ownerId}`;
        const entry = totals.get(key) ?? { recipeName: recipe.name, owner, sold: 0 };
        entry.sold += sales.sold;
        totals.set(key, entry);
      }
    }
    st.charts[city.id] = [...totals.values()].sort((a, b) => b.sold - a.sold).slice(0, 5);
  }
}

/** Articles about notable trends currently running in a city, for the paper's side column. */
export function trendNotes(st: GameState, cityId: string): string[] {
  return conditions(st, cityId).trends.map(
    (t) =>
      `${ingredient(t.ingredientId).name} ${t.delta > 0 ? 'in fashion' : 'out of favour'} (${t.daysLeft} more days)`,
  );
}
