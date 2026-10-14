import { INGREDIENTS, cityDef, ingredient } from './data';
import { CityMap, DAYS_PER_MONTH, DayStats, GameState, Player, Restaurant } from './model';
import { clamp01, itemAppeal, recipeUsage } from './recipes';

/** Share of residents who eat out at a given hour; lunch and dinner peaks. */
const HOURLY_RATE: Record<number, number> = {
  11: 0.0001, 12: 0.0005, 13: 0.0004, 14: 0.00015, 15: 0.0001, 16: 0.0001,
  17: 0.0002, 18: 0.0005, 19: 0.0006, 20: 0.0005, 21: 0.00025, 22: 0.0001,
};

/** Weight of "eat somewhere else" in the customer's choice. */
const OUTSIDE_OPTION = 1.5;
const PIZZAS_PER_COOK_HOUR = 10;
const GUESTS_PER_WAITER_HOUR = 14;
const MAX_MESSAGES = 60;
export const OVERDRAFT = 5000;

export function emptyStats(): DayStats {
  return { customers: 0, turnedAway: 0, revenue: 0, satisfaction: 0, noStaff: 0, noStock: 0 };
}

export function addMessage(state: GameState, text: string): void {
  state.messages.push({ day: state.day, text });
  if (state.messages.length > MAX_MESSAGES) state.messages.splice(0, state.messages.length - MAX_MESSAGES);
}

export function addLedger(player: Player, day: number, label: string, amount: number): void {
  player.cash += amount;
  const last = player.ledger[player.ledger.length - 1];
  // Merge same-day entries with the same label to keep the ledger compact.
  if (last && last.day === day && last.label === label) last.amount += amount;
  else player.ledger.push({ day, label, amount });
  if (player.ledger.length > 400) player.ledger.splice(0, player.ledger.length - 400);
}

/** Simulates customers for one opening hour in every city. */
export function simulateHour(state: GameState, hour: number): void {
  const rate = HOURLY_RATE[hour];
  if (!rate) return;
  for (const city of state.cities) {
    const restaurants = state.restaurants.filter((r) => r.cityId === city.id);
    if (restaurants.length === 0) continue;
    simulateCityHour(state, city, restaurants, rate);
  }
}

function simulateCityHour(state: GameState, city: CityMap, restaurants: Restaurant[], rate: number): void {
  const col = cityDef(city.id).costOfLiving;
  const capacity = new Map<number, { kitchen: number; floor: number; seats: number }>();
  for (const r of restaurants) {
    const lot = city.lots[r.lotId];
    const kitchen = r.staff.filter((s) => s.role === 'cook').reduce((n, s) => n + PIZZAS_PER_COOK_HOUR * (0.6 + s.skill * 0.8), 0);
    const floor = r.staff.filter((s) => s.role === 'waiter').reduce((n, s) => n + GUESTS_PER_WAITER_HOUR * (0.6 + s.skill * 0.8), 0);
    capacity.set(r.id, { kitchen, floor, seats: lot.seats * 1.5 });
  }

  for (const district of city.districts) {
    const hungry = Math.round(district.population * rate);
    if (hungry <= 0) continue;

    // Score each restaurant for this district: best menu item, reputation, decor, distance.
    const scored = restaurants
      .map((r) => {
        const lot = city.lots[r.lotId];
        const dist = Math.hypot(lot.x - district.cx, lot.y - district.cy);
        const best = bestItem(state, r, district, col);
        if (!best) return null;
        const score = best.appeal * (0.5 + r.reputation) * (0.85 + r.decor * 0.12) * Math.exp(-dist / 14);
        return { r, best, score };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null && s.score > 0);
    const total = scored.reduce((n, s) => n + s.score, OUTSIDE_OPTION);

    for (const s of scored) {
      const wanted = Math.round((hungry * s.score) / total);
      if (wanted <= 0) continue;
      const cap = capacity.get(s.r.id)!;
      const servable = Math.floor(Math.min(cap.kitchen, cap.floor, cap.seats));
      let served = 0;
      for (let i = 0; i < wanted; i++) {
        if (served >= servable) {
          s.r.today.turnedAway++;
          s.r.today.noStaff++;
          continue;
        }
        const item = serveFromStock(state, s.r, district, col);
        if (!item) {
          s.r.today.turnedAway++;
          s.r.today.noStock++;
          continue;
        }
        served++;
        s.r.today.customers++;
        s.r.today.revenue += item.price;
        const staffSkill = s.r.staff.length ? s.r.staff.reduce((n, st) => n + st.skill, 0) / s.r.staff.length : 0;
        s.r.today.satisfaction += clamp01(item.appeal * 0.7 + staffSkill * 0.2 + s.r.decor * 0.05);
      }
      cap.kitchen -= served;
      cap.floor -= served;
      cap.seats -= served;
    }
  }
}

function bestItem(state: GameState, r: Restaurant, district: CityMap['districts'][number], col: number) {
  let best: { price: number; appeal: number } | null = null;
  for (const m of r.menu) {
    const recipe = state.recipes.find((x) => x.id === m.recipeId);
    if (!recipe) continue;
    const appeal = itemAppeal(recipe, m.price, district, col);
    if (!best || appeal > best.appeal) best = { price: m.price, appeal };
  }
  return best;
}

/** Picks the most appealing pizza that is in stock and deducts its ingredients. */
function serveFromStock(state: GameState, r: Restaurant, district: CityMap['districts'][number], col: number) {
  const options = r.menu
    .map((m) => {
      const recipe = state.recipes.find((x) => x.id === m.recipeId);
      return recipe ? { recipe, price: m.price, appeal: itemAppeal(recipe, m.price, district, col) } : null;
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)
    .sort((a, b) => b.appeal - a.appeal);
  for (const o of options) {
    const usage = recipeUsage(o.recipe);
    if (Object.entries(usage).every(([id, n]) => (r.stock[id] ?? 0) >= n)) {
      for (const [id, n] of Object.entries(usage)) r.stock[id] -= n;
      return o;
    }
  }
  return null;
}

/** Morning routine: spoilage and automatic restocking. */
export function startDay(state: GameState): void {
  for (const r of state.restaurants) {
    for (const id of Object.keys(r.stock)) {
      r.stock[id] = Math.max(0, r.stock[id] * (1 - 1 / ingredient(id).shelfLife));
      if (r.stock[id] < 0.01) delete r.stock[id];
    }
    if (r.autoRestock) restock(state, r);
  }
}

export function restock(state: GameState, r: Restaurant): void {
  const owner = state.players.find((p) => p.id === r.ownerId);
  if (!owner) return;
  const needed = new Set<string>();
  for (const m of r.menu) {
    const recipe = state.recipes.find((x) => x.id === m.recipeId);
    if (recipe) for (const id of Object.keys(recipeUsage(recipe))) needed.add(id);
  }
  for (const id of needed) {
    const missing = Math.ceil(r.restockTarget - (r.stock[id] ?? 0));
    if (missing > 0) buyStock(state, owner, r, id, missing);
  }
}

export function buyStock(state: GameState, owner: Player, r: Restaurant, id: string, portions: number): boolean {
  const cost = ingredient(id).cost * portions * cityDef(r.cityId).costOfLiving;
  // Suppliers extend a small overdraft before refusing to deliver.
  if (owner.cash - cost < -OVERDRAFT) return false;
  r.stock[id] = (r.stock[id] ?? 0) + portions;
  addLedger(owner, state.day, 'Ingredients', -cost);
  return true;
}

/** Evening routine: book revenue, update reputation, and roll the day's stats. */
export function endDay(state: GameState): void {
  for (const r of state.restaurants) {
    const owner = state.players.find((p) => p.id === r.ownerId);
    if (owner && r.today.revenue > 0) addLedger(owner, state.day, 'Sales', r.today.revenue);
    const served = r.today.customers;
    if (served > 0) {
      const avg = r.today.satisfaction / served;
      r.reputation = clamp01(r.reputation + (avg - r.reputation) * 0.08);
    }
    if (r.today.turnedAway > served) r.reputation = clamp01(r.reputation - 0.01);
    r.lastDay = r.today;
    r.today = emptyStats();
    if (owner?.isHuman && r.lastDay.turnedAway > 10) {
      const reason = r.lastDay.noStock >= r.lastDay.noStaff ? 'ran out of ingredients' : 'did not have enough staff';
      addMessage(state, `${r.name} turned away ${r.lastDay.turnedAway} guests because it ${reason}.`);
    }
  }
  if ((state.day + 1) % DAYS_PER_MONTH === 0) endMonth(state);
}

function endMonth(state: GameState): void {
  // Food fashions: each city warms to one ingredient and cools on another.
  for (const city of state.cities) {
    const up = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
    const down = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
    if (up.id === down.id) continue;
    for (const d of city.districts) {
      d.tastes[up.id] = Math.min(1, d.tastes[up.id] + 0.12);
      d.tastes[down.id] = Math.max(-1, d.tastes[down.id] - 0.08);
    }
    if (city.id === state.currentCityId) addMessage(state, `Food trend in ${city.name}: ${up.name} is in fashion, ${down.name} is falling out of favour.`);
  }
  for (const player of state.players) {
    const own = state.restaurants.filter((r) => r.ownerId === player.id);
    for (const r of own) {
      const lot = state.cities.find((c) => c.id === r.cityId)?.lots[r.lotId];
      if (lot && !r.owned) addLedger(player, state.day, 'Rent', -lot.rentPerMonth);
      const wages = r.staff.reduce((n, s) => n + s.wagePerMonth, 0);
      if (wages > 0) addLedger(player, state.day, 'Wages', -wages);
    }
    if (player.loan > 0) addLedger(player, state.day, 'Loan interest', -Math.round(player.loan * 0.01));
    if (player.isHuman) {
      const month = player.ledger.filter((e) => e.day > state.day - DAYS_PER_MONTH);
      const net = month.reduce((n, e) => n + e.amount, 0);
      addMessage(state, `Month closed. Net result: ${net >= 0 ? '+' : '-'}$${Math.abs(Math.round(net)).toLocaleString('en-US')}.`);
    }
  }
}
