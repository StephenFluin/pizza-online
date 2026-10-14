import { cityDef, ingredient } from './data';
import { DAYS_PER_MONTH, DayStats, GameState, Restaurant } from './model';
import { recipeUsage } from './recipes';

export interface Finding {
  tone: 'good' | 'bad' | 'tip';
  text: string;
}

export interface PizzaRow {
  recipeId: string;
  name: string;
  price: number;
  ordered: number;
  sold: number;
  revenue: number;
  /** Profit per pizza after ingredients, as a share of the price. */
  margin: number;
}

export interface RestaurantReview {
  id: number;
  name: string;
  city: string;
  day: DayStats;
  /** Rent and wages for one day. */
  overhead: number;
  profit: number;
  /** Share of the day's capacity that was used, 0..1. */
  utilisation: number;
  reputation: number;
  /** Change in reputation over the last week. */
  reputationTrend: number;
  findings: Finding[];
  pizzas: PizzaRow[];
  /** Last seven days, oldest first. */
  week: { day: number; guests: number; profit: number }[];
}

const COOK_RATE = 10;

function dailyOverhead(r: Restaurant): number {
  const wages = r.staff.reduce((n, s) => n + s.wagePerMonth, 0);
  return (wages + (r.owned ? 0 : r.rentPerMonth)) / DAYS_PER_MONTH;
}

function dayProfit(d: DayStats, overhead: number): number {
  return d.revenue - d.foodCost - overhead;
}

/** Reviews one restaurant's finished day and explains what helped and what hurt. */
export function reviewRestaurant(st: GameState, r: Restaurant): RestaurantReview {
  const d = r.lastDay;
  const overhead = dailyOverhead(r);
  const profit = dayProfit(d, overhead);
  const utilisation = d.capacity > 0 ? Math.min(1, d.customers / d.capacity) : 0;
  const history = r.history ?? [];
  const week = history.slice(-7).map((h) => ({ day: h.day, guests: h.customers, profit: dayProfit(h, overhead) }));
  const recipes = st.recipes;

  const pizzas: PizzaRow[] = r.menu.map((m) => {
    const sales = d.pizzas[m.recipeId] ?? { ordered: 0, sold: 0, revenue: 0, cost: 0 };
    const unitCost = sales.sold > 0 ? sales.cost / sales.sold : 0;
    return {
      recipeId: m.recipeId,
      name: recipes.find((x) => x.id === m.recipeId)?.name ?? '?',
      price: m.price,
      ordered: sales.ordered,
      sold: sales.sold,
      revenue: sales.revenue,
      margin: m.price > 0 && sales.sold > 0 ? (m.price - unitCost) / m.price : 0,
    };
  });

  const findings: Finding[] = [];
  const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
  const cooks = r.staff.filter((s) => s.role === 'cook');
  const waiters = r.staff.filter((s) => s.role === 'waiter');

  if (cooks.length === 0 || waiters.length === 0) {
    findings.push({ tone: 'bad', text: `Closed for business: you need at least one cook and one waiter. Call the staff agency.` });
  } else if (profit >= 0) {
    findings.push({ tone: 'good', text: `Made ${money(profit)} after ingredients (${money(d.foodCost)}), rent and wages (${money(overhead)} a day).` });
  } else {
    findings.push({ tone: 'bad', text: `Lost ${money(profit)} after ingredients (${money(d.foodCost)}), rent and wages (${money(overhead)} a day).` });
  }

  const pop = r.popularity;
  if (pop && pop.waiting < -5) {
    findings.push({ tone: 'bad', text: `Guests waited about ${pop.waitMinutes} minutes but locals expect ${pop.expectedMinutes}. More staff, ovens or tables would speed things up.` });
  } else if (pop && pop.waiting > 10) {
    findings.push({ tone: 'good', text: `Quick service: about ${pop.waitMinutes} minutes against an expected ${pop.expectedMinutes}.` });
  }
  if (pop && pop.menu < -5) {
    findings.push({ tone: 'bad', text: 'Locals want more choice: keep at least three classic pizzas on the menu, plus some house creations.' });
  }
  if (d.lostKitchen > 0) {
    const cookRate = cooks.reduce((n, s) => n + COOK_RATE * (0.6 + s.skill * 0.8), 0);
    const advice = cookRate < r.kitchenCapacity ? 'Hire another cook.' : 'Buy another oven, and a prep counter for every two ovens.';
    findings.push({ tone: 'bad', text: `${d.lostKitchen} guests left because the kitchen couldn't keep up. ${advice}` });
  }
  if (d.lostFloor > 0) findings.push({ tone: 'bad', text: `${d.lostFloor} guests left because nobody could serve them. Hire another waiter, or buy a dishwasher.` });
  if (d.lostSeats > 0) findings.push({ tone: 'bad', text: `${d.lostSeats} guests found every seat taken. Add tables in the restaurant view.` });

  const missing = Object.entries(d.missing).sort((a, b) => b[1] - a[1]);
  if (missing.length) {
    const list = missing.slice(0, 3).map(([id, n]) => `${ingredient(id).name.toLowerCase()} (${n} guests)`).join(', ');
    findings.push({ tone: 'bad', text: `Ran out of ${list}. Order more stock or raise the restock target.` });
  }

  const sellers = pizzas.filter((p) => p.sold > 0).sort((a, b) => b.sold - a.sold);
  if (sellers.length) {
    const top = sellers[0];
    findings.push({ tone: 'good', text: `${top.name} was the favourite: ${top.sold} sold at ${Math.round(top.margin * 100)}% margin.` });
  }
  for (const p of pizzas) {
    if (d.customers > 10 && p.ordered === 0) {
      findings.push({ tone: 'tip', text: `Nobody wanted ${p.name}. Locals may not like its toppings, or it costs too much compared with the rest of your menu.` });
    } else if (p.sold > 0 && p.margin < 0.45) {
      findings.push({ tone: 'tip', text: `${p.name} barely pays: only ${Math.round(p.margin * 100)}% of the price is left after ingredients. Raise the price or use cheaper toppings.` });
    }
  }

  if (d.capacity > 0 && utilisation < 0.35 && d.turnedAway < 5) {
    findings.push({ tone: 'bad', text: `A quiet day: only ${Math.round(utilisation * 100)}% of your capacity was used. Try advertising, cheaper prices or pizzas the district likes.` });
  } else if (utilisation > 0.9 && d.turnedAway === 0) {
    findings.push({ tone: 'good', text: 'Running at full capacity without turning anyone away.' });
  }

  const weekAgo = history.length >= 8 ? history[history.length - 8] : history[0];
  const trend = weekAgo ? r.reputation - weekAgo.reputation : 0;
  if (trend > 0.03) findings.push({ tone: 'good', text: `Reputation is up ${Math.round(trend * 100)} points this week.` });
  else if (trend < -0.03) findings.push({ tone: 'bad', text: `Reputation is down ${Math.round(-trend * 100)} points this week.` });
  if (d.customers > 0) {
    const avg = d.satisfaction / d.customers;
    if (avg > r.reputation + 0.05) findings.push({ tone: 'good', text: `Guests left happier than your reputation suggests (${Math.round(avg * 100)}%), so word of mouth is improving.` });
    else if (avg < r.reputation - 0.05) findings.push({ tone: 'bad', text: `Guests were less impressed than expected (${Math.round(avg * 100)}%). Better recipes, staff or decoration would help your reputation.` });
  }

  // Ingredients that will run out tomorrow at today's pace.
  if (!r.autoRestock) {
    const usage: Record<string, number> = {};
    for (const p of pizzas) {
      const recipe = recipes.find((x) => x.id === p.recipeId);
      if (!recipe) continue;
      for (const [id, n] of Object.entries(recipeUsage(recipe))) usage[id] = (usage[id] ?? 0) + n * p.sold;
    }
    const low = Object.entries(usage).filter(([id, u]) => u > 0 && (r.stock[id] ?? 0) / u < 1.5);
    if (low.length) findings.push({ tone: 'bad', text: `Less than two days of ${low.map(([id]) => ingredient(id).name.toLowerCase()).join(', ')} left in stock.` });
  }

  return {
    id: r.id,
    name: r.name,
    city: cityDef(r.cityId).name,
    day: d,
    overhead,
    profit,
    utilisation,
    reputation: r.reputation,
    reputationTrend: trend,
    findings,
    pizzas,
    week,
  };
}

export function reviewCompany(st: GameState): RestaurantReview[] {
  const me = st.players.find((p) => p.isHuman);
  return st.restaurants.filter((r) => r.ownerId === me?.id).map((r) => reviewRestaurant(st, r));
}
