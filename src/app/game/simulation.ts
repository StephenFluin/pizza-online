import { PerkId, character, firstName } from './characters';
import { INGREDIENTS, cityDef, ingredient } from './data';
import { TURNOVER_PER_SEAT, applyRoom, roomStats, starterLayout } from './furniture';
import { CityMap, DAYS_PER_MONTH, DayStats, GameState, OPEN_MINUTE, Player, Restaurant } from './model';
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
    const room = roomStats(r.layout, city.lots[r.lotId]);
    // Cooks can only bake as fast as the ovens allow; dishwashers free up waiters.
    const cooks = r.staff.filter((s) => s.role === 'cook').reduce((n, s) => n + PIZZAS_PER_COOK_HOUR * (0.6 + s.skill * 0.8), 0);
    const kitchen = Math.min(cooks, room.kitchenCapacity);
    const floor = r.staff.filter((s) => s.role === 'waiter').reduce((n, s) => n + GUESTS_PER_WAITER_HOUR * (0.6 + s.skill * 0.8), 0) * (1 + Math.min(2, room.dishwashers) * 0.15);
    capacity.set(r.id, { kitchen, floor, seats: room.seats * TURNOVER_PER_SEAT });
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
        const score = best.appeal * (0.5 + r.reputation) * (0.85 + r.decor * 0.12) * Math.exp(-dist / 14) * adBoost(state, r);
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

export function hasPerk(state: GameState, ownerId: number, perk: PerkId): boolean {
  const owner = state.players.find((p) => p.id === ownerId);
  return !!owner && character(owner.characterId).perk === perk;
}

/** Advertising multiplier for a restaurant from its owner's campaigns in that city. */
function adBoost(state: GameState, r: Restaurant): number {
  const owner = state.players.find((p) => p.id === r.ownerId);
  const boost = (owner?.ads ?? []).filter((a) => a.cityId === r.cityId).reduce((n, a) => n + a.boost, 0);
  return 1 + boost * (hasPerk(state, r.ownerId, 'showman') ? 1.25 : 1);
}

function bestItem(state: GameState, r: Restaurant, district: CityMap['districts'][number], col: number) {
  let best: { price: number; appeal: number } | null = null;
  for (const m of r.menu) {
    const recipe = state.recipes.find((x) => x.id === m.recipeId);
    if (!recipe) continue;
    const appeal = itemAppeal(recipe, m.price, district, col) * (hasPerk(state, r.ownerId, 'chef') ? 1.06 : 1);
    if (!best || appeal > best.appeal) best = { price: m.price, appeal };
  }
  return best;
}

/** Picks the most appealing pizza that is in stock and deducts its ingredients. */
function serveFromStock(state: GameState, r: Restaurant, district: CityMap['districts'][number], col: number) {
  const options = r.menu
    .map((m) => {
      const recipe = state.recipes.find((x) => x.id === m.recipeId);
      const chef = hasPerk(state, r.ownerId, 'chef') ? 1.06 : 1;
      return recipe ? { recipe, price: m.price, appeal: itemAppeal(recipe, m.price, district, col) * chef } : null;
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
    // A refrigerator halves spoilage.
    const chill = r.layout.some((p) => p.itemId === 'fridge') ? 0.5 : 1;
    for (const id of Object.keys(r.stock)) {
      r.stock[id] = Math.max(0, r.stock[id] * (1 - chill / ingredient(id).shelfLife));
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
  const thrifty = character(owner.characterId).perk === 'thrifty' ? 0.9 : 1;
  const cost = ingredient(id).cost * portions * cityDef(r.cityId).costOfLiving * thrifty;
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
  for (const p of state.players) {
    for (const ad of p.ads) ad.daysLeft--;
    p.ads = p.ads.filter((a) => a.daysLeft > 0);
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
      if (!r.owned && r.rentPerMonth > 0) addLedger(player, state.day, 'Rent', -r.rentPerMonth);
      const wages = r.staff.reduce((n, s) => n + s.wagePerMonth, 0);
      if (wages > 0) addLedger(player, state.day, 'Wages', -wages);
    }
    const rate = character(player.characterId).perk === 'banker' ? 0.005 : 0.01;
    if (player.loan > 0) addLedger(player, state.day, 'Loan interest', -Math.round(player.loan * rate));
    if (player.isHuman) {
      const month = player.ledger.filter((e) => e.day > state.day - DAYS_PER_MONTH);
      const net = month.reduce((n, e) => n + e.amount, 0);
      addMessage(state, `Month closed. Net result: ${net >= 0 ? '+' : '-'}$${Math.abs(Math.round(net)).toLocaleString('en-US')}.`);
    }
  }
}

/** Opens a restaurant for any player. Returns null when the lot is taken or the owner can't pay. */
export function openRestaurantAt(
  st: GameState,
  cityId: string,
  lotId: number,
  ownerId: number,
  buy: boolean,
  /** Negotiated monthly rent or purchase price; defaults to the asking price. */
  agreedPrice?: number,
): Restaurant | null {
  const city = st.cities.find((c) => c.id === cityId);
  const lot = city?.lots[lotId];
  const owner = st.players.find((p) => p.id === ownerId);
  if (!city || !lot || !owner || lot.restaurantId !== null) return null;
  const price = agreedPrice ?? (buy ? lot.purchasePrice : lot.rentPerMonth);
  if (owner.cash < price) return null;
  addLedger(owner, st.day, buy ? 'Property purchase' : 'Rent deposit', -price);
  const count = st.restaurants.filter((r) => r.ownerId === ownerId).length;
  const r: Restaurant = {
    id: st.nextId++,
    ownerId,
    cityId: city.id,
    lotId,
    name: `${firstName(owner.name)}'s Pizzeria${count ? ` #${count + 1}` : ''}`,
    owned: buy,
    decor: 0,
    layout: starterLayout(lot),
    seats: 0,
    kitchenCapacity: 0,
    rentPerMonth: buy ? 0 : price,
    staff: [],
    menu: [
      { recipeId: 'std-margherita', price: Math.round(8 * cityDef(city.id).costOfLiving) },
      { recipeId: 'std-salami', price: Math.round(9 * cityDef(city.id).costOfLiving) },
    ],
    stock: {},
    reputation: character(owner.characterId).perk === 'charmer' ? 0.45 : 0.3,
    autoRestock: true,
    restockTarget: 250,
    today: emptyStats(),
    lastDay: emptyStats(),
  };
  applyRoom(r, lot);
  lot.restaurantId = r.id;
  st.restaurants.push(r);
  if (st.minute >= OPEN_MINUTE) restock(st, r);
  if (owner.isHuman) addMessage(st, `${r.name} opened in ${city.districts[lot.district].name}, ${city.name}. Hire a cook and a waiter to start serving.`);
  else if (st.restaurants.some((x) => x.cityId === city.id && st.players.find((p) => p.id === x.ownerId)?.isHuman)) {
    addMessage(st, `Competition! ${owner.name} opened a pizzeria in ${city.districts[lot.district].name}, ${city.name}.`);
  }
  return r;
}
