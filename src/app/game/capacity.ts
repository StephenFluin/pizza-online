import { ingredient } from './data';
import { roomStats } from './furniture';
import { CustomerGroup, GameState, Restaurant } from './model';
import { CUSTOMER_GROUPS, cachedPizzaStats } from './pizza-stats';
import { recipeUsage } from './recipes';
import { OPEN_HOURS, estimateDailyDemand, hourlyRates } from './simulation';
import { activeManager, managerSettings } from './staff';

export type ConstraintId = 'seating' | 'stock' | 'cooks' | 'ovens' | 'waiters';

export interface Constraint {
  id: ConstraintId;
  label: string;
  /** Guests per day this part of the restaurant can handle. */
  perDay: number;
  /** One line explaining the figure. */
  detail: string;
  /** What would raise it. */
  fix: string;
}

export interface CapacityReport {
  /** Guests who would come in a full day at today's popularity. */
  demand: number;
  constraints: Constraint[];
  /** The tightest constraint, or popularity when demand is below every capacity. */
  limitedBy: ConstraintId | 'popularity';
  /** Most guests the restaurant can serve in a day. */
  servable: number;
  /** Popularity with each customer group in the restaurant's district (0–100) and its share of residents. */
  groups: { id: CustomerGroup; label: string; share: number; liking: number }[];
}

/** Pizzas the stock can make for the current menu mix, and the ingredient that runs out first. */
function stockCapacity(st: GameState, r: Restaurant): { pizzas: number; limiting: string | null; refills: boolean } {
  const recipes = r.menu.map((m) => st.recipes.find((x) => x.id === m.recipeId)).filter((x): x is NonNullable<typeof x> => !!x);
  if (recipes.length === 0) return { pizzas: 0, limiting: null, refills: false };
  // Weight each pizza by yesterday's sales, or equally before the first day.
  const sold = recipes.map((x) => r.lastDay.pizzas?.[x.id]?.sold ?? 0);
  const totalSold = sold.reduce((n, x) => n + x, 0);
  const weights = recipes.map((_, i) => (totalSold > 0 ? sold[i] / totalSold : 1 / recipes.length));
  const perPizza: Record<string, number> = {};
  recipes.forEach((x, i) => {
    for (const [id, units] of Object.entries(recipeUsage(x))) perPizza[id] = (perPizza[id] ?? 0) + units * weights[i];
  });
  // A standing order or a shopping manager tops every ingredient up each morning.
  const refills = r.autoRestock || (!!activeManager(r) && managerSettings(r).shopping);
  let pizzas = Infinity;
  let limiting: string | null = null;
  for (const [id, need] of Object.entries(perPizza)) {
    if (need <= 0) continue;
    const have = refills ? Math.max(r.stock[id] ?? 0, r.restockTarget) : (r.stock[id] ?? 0);
    const n = have / need;
    if (n < pizzas) {
      pizzas = n;
      limiting = id;
    }
  }
  return { pizzas: Math.floor(pizzas === Infinity ? 0 : pizzas), limiting, refills };
}

export function restaurantCapacity(st: GameState, r: Restaurant): CapacityReport {
  const city = st.cities.find((c) => c.id === r.cityId)!;
  const lot = city.lots[r.lotId];
  const room = roomStats(r.layout, lot, r.floorId);
  const rates = hourlyRates(r, room);
  const day = (perHour: number) => Math.floor(perHour * OPEN_HOURS);
  const working = r.staff.filter((s) => !s.course && !s.daysAway);
  const cooks = working.filter((s) => s.role === 'cook').length;
  const waiters = working.filter((s) => s.role === 'waiter').length;
  const stock = stockCapacity(st, r);
  const stockNote = stock.limiting ? `${ingredient(stock.limiting).name} runs out first` : 'nothing on the menu';

  const constraints: Constraint[] = [
    {
      id: 'seating',
      label: 'Seating',
      perDay: day(rates.seats),
      detail: `${r.seats} seats, each used about ${1.5} times an hour`,
      fix: 'Buy tables and chairs in the restaurant view.',
    },
    {
      id: 'stock',
      label: 'Ingredient stock',
      perDay: stock.pizzas,
      detail: `${stockNote}${stock.refills ? `; restocked to ${r.restockTarget} units each morning` : '; no standing order'}`,
      fix: stock.refills ? 'Raise the restock target, or order more from a vendor.' : 'Order stock from a vendor or set up a standing order.',
    },
    {
      id: 'cooks',
      label: 'Cooks',
      perDay: day(rates.cooks),
      detail: `${cooks} cook${cooks === 1 ? '' : 's'} at work`,
      fix: 'Hire or train cooks, or keep them motivated.',
    },
    {
      id: 'ovens',
      label: 'Ovens',
      perDay: day(rates.ovens),
      detail: `${Math.round(room.kitchenCapacity)} pizzas an hour from ${room.counters} prep counter${room.counters === 1 ? '' : 's'}`,
      fix: 'Buy ovens, and a prep counter for every two ovens.',
    },
    {
      id: 'waiters',
      label: 'Waiters',
      perDay: day(rates.waiters),
      detail: `${waiters} waiter${waiters === 1 ? '' : 's'} at work${room.dishwashers ? ` with ${room.dishwashers} dishwasher${room.dishwashers === 1 ? '' : 's'}` : ''}`,
      fix: 'Hire or train waiters, or buy a dishwasher.',
    },
  ];

  const tightest = constraints.reduce((a, b) => (b.perDay < a.perDay ? b : a));
  const demand = estimateDailyDemand(st, r);
  const limitedBy = demand < tightest.perDay * 0.95 ? 'popularity' : tightest.id;

  const district = city.districts[lot.district];
  const recipes = r.menu.map((m) => st.recipes.find((x) => x.id === m.recipeId)).filter((x): x is NonNullable<typeof x> => !!x);
  const groups = CUSTOMER_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    share: district.groupMix?.[g.id] ?? 1 / 6,
    // The group's favourite pizza on the menu.
    liking: recipes.reduce((best, x) => Math.max(best, cachedPizzaStats(x, city.districts).groups[g.id]), 0),
  }));

  return { demand, constraints, limitedBy, servable: Math.min(...constraints.map((c) => c.perDay)), groups };
}
