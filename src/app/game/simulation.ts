import { firstName } from './characters';
import { adBonus, cookingBonus, ingredientPriceFactor, ownerStats, startReputation, statsOf, supervisable } from './owner-stats';
import { cityDef, ingredient } from './data';
import { DEFAULT_FLOOR, RoomStats, TURNOVER_PER_SEAT, applyRoom, roomStats, starterLayout } from './furniture';
import { CityMap, DAYS_PER_MONTH, DayStats, GameState, OPEN_MINUTE, Player, Popularity, Recipe, Restaurant, formatMoney } from './model';
import { cityLifeMorning, cityPrestige } from './awards';
import { InsuranceType, POLICIES, insured, monthlyLoanPayments, morningRisks, premium } from './insurance';
import { demandFactor, morningNews } from './newspaper';
import { effectiveSkill, isAvailable, staffMorning } from './staff';
import { cityVendors, vendorById, vendorPrice } from './vendors';
import { clamp01, itemAppeal, recipeCost, recipeUsage } from './recipes';

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

export function emptyStats(day = 0): DayStats {
  return {
    customers: 0,
    turnedAway: 0,
    revenue: 0,
    satisfaction: 0,
    noStaff: 0,
    noStock: 0,
    lostKitchen: 0,
    lostFloor: 0,
    lostSeats: 0,
    foodCost: 0,
    pizzas: {},
    missing: {},
    capacity: 0,
    day,
    reputation: 0,
  };
}

const HISTORY_DAYS = 30;

function pizzaSales(d: DayStats, recipeId: string) {
  return (d.pizzas[recipeId] ??= { ordered: 0, sold: 0, revenue: 0, cost: 0 });
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
    // Restaurants closed for repairs don't trade.
    const restaurants = state.restaurants.filter((r) => r.cityId === city.id && !r.closedDays);
    if (restaurants.length === 0) continue;
    simulateCityHour(state, city, restaurants, rate);
  }
}

function simulateCityHour(state: GameState, city: CityMap, restaurants: Restaurant[], rate: number): void {
  const col = cityDef(city.id).costOfLiving;
  const capacity = new Map<number, { kitchen: number; floor: number; seats: number }>();
  const rooms = new Map<number, RoomStats>();
  for (const r of restaurants) {
    const room = roomStats(r.layout, city.lots[r.lotId], r.floorId);
    rooms.set(r.id, room);
    // Cooks can only bake as fast as the ovens allow; dishwashers free up waiters.
    // Only staff at work count; skill shows through motivation, and fast cooks turn out more pizzas.
    const working = r.staff.filter(isAvailable);
    const cooks = working.filter((s) => s.role === 'cook').reduce((n, s) => n + PIZZAS_PER_COOK_HOUR * (0.5 + effectiveSkill(s) * 0.8) * (0.8 + s.pizzasPerDay / 500), 0);
    const kitchen = Math.min(cooks, room.kitchenCapacity);
    const floor = working.filter((s) => s.role === 'waiter').reduce((n, s) => n + GUESTS_PER_WAITER_HOUR * (0.5 + effectiveSkill(s) * 0.8), 0) * (1 + Math.min(2, room.dishwashers) * 0.15);
    capacity.set(r.id, { kitchen, floor, seats: room.seats * TURNOVER_PER_SEAT });
    r.popularity = computePopularity(state, r, city);
    r.today.capacity += Math.floor(Math.min(kitchen, floor, room.seats * TURNOVER_PER_SEAT));
  }

  for (const district of city.districts) {
    const hungry = Math.round(district.population * rate * demandFactor(state, city.id));
    if (hungry <= 0) continue;

    // Score each restaurant for this district: best menu item, reputation, decor, distance.
    const scored = restaurants
      .map((r) => {
        const lot = city.lots[r.lotId];
        const dist = Math.hypot(lot.x - district.cx, lot.y - district.cy);
        const best = bestItem(state, r, district, col);
        if (!best) return null;
        // Atmosphere, and whether this district's groups like the furniture's style.
        const look = districtLookAppeal(rooms.get(r.id)!, district);
        const score = best.appeal * popularityMultiplier(r.popularity) * (0.85 + r.decor * 0.12) * (0.9 + look * 0.2) * Math.exp(-dist / 14);
        return { r, best, score };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null && s.score > 0);
    const total = scored.reduce((n, s) => n + s.score, OUTSIDE_OPTION);

    for (const s of scored) {
      const wanted = Math.round((hungry * s.score) / total);
      if (wanted <= 0) continue;
      const cap = capacity.get(s.r.id)!;
      const today = s.r.today;
      let served = 0;
      for (let i = 0; i < wanted; i++) {
        // Every guest asks for the pizza they like best here, even if it can't be made.
        pizzaSales(today, s.best.recipeId).ordered++;
        const limit = Math.min(cap.kitchen, cap.floor, cap.seats);
        if (served >= Math.floor(limit)) {
          today.turnedAway++;
          today.noStaff++;
          if (limit === cap.kitchen) today.lostKitchen++;
          else if (limit === cap.floor) today.lostFloor++;
          else today.lostSeats++;
          continue;
        }
        const item = serveFromStock(state, s.r, district, col);
        if (!item || item.recipe.id !== s.best.recipeId) {
          // The favourite was out of stock: note which ingredients were missing.
          const fav = state.recipes.find((x) => x.id === s.best.recipeId);
          if (fav) for (const [id, n] of Object.entries(recipeUsage(fav))) if ((s.r.stock[id] ?? 0) < n) today.missing[id] = (today.missing[id] ?? 0) + 1;
        }
        if (!item) {
          today.turnedAway++;
          today.noStock++;
          continue;
        }
        served++;
        today.customers++;
        today.revenue += item.price;
        const cost = recipeCost(item.recipe) * col * ingredientPriceFactor(ownerStats(state, s.r.ownerId));
        today.foodCost += cost;
        const sales = pizzaSales(today, item.recipe.id);
        sales.sold++;
        sales.revenue += item.price;
        sales.cost += cost;
        const team = s.r.staff.filter(isAvailable);
        const staffSkill = team.length ? team.reduce((n, st) => n + effectiveSkill(st), 0) / team.length : 0;
        today.satisfaction += clamp01(item.appeal * 0.7 + staffSkill * 0.2 + s.r.decor * 0.05);
      }
      cap.kitchen -= served;
      cap.floor -= served;
      cap.seats -= served;
    }
  }
}


/** Sum of a player's live campaign effectiveness (percent) in a city. */
export function adEffectiveness(state: GameState, ownerId: number, cityId: string): number {
  const owner = state.players.find((p) => p.id === ownerId);
  return (owner?.ads ?? []).filter((a) => a.cityId === cityId).reduce((n, a) => n + a.effectiveness, 0);
}

/** How much a district's customer groups like a room's style, 0..1. */
function districtLookAppeal(room: RoomStats, district: CityMap['districts'][number]): number {
  let v = 0;
  for (const [g, share] of Object.entries(district.groupMix ?? {})) v += share * (room.groupAppeal[g as keyof RoomStats['groupAppeal']] ?? 4.5);
  return v / 9;
}

export function emptyPopularity(): Popularity {
  return { waiting: 0, menu: 0, advertising: 0, stars: 0, fulfilment: 0, events: 0, supervision: 0, prestige: 0, total: 0, waitMinutes: 0, expectedMinutes: 15, starCount: 0 };
}

/** Turns popularity points into a demand multiplier (100 points doubles demand). */
export function popularityMultiplier(p: Popularity): number {
  return Math.max(0.25, 1 + p.total / 100);
}

/**
 * A restaurant's popularity from the original's components, in our own numbers:
 * waiting time against the district's patience, menu composition, advertising
 * (half the campaigns' effectiveness), star rating and how much demand was met.
 */
export function computePopularity(state: GameState, r: Restaurant, city: CityMap): Popularity {
  const district = city.districts[city.lots[r.lotId].district];
  const y = r.lastDay;
  const wanted = y.customers + y.turnedAway;

  // Waiting time grows steeply as the restaurant fills up.
  const load = y.capacity > 0 ? wanted / y.capacity : 0.5;
  const waitMinutes = Math.round(6 + 10 * Math.min(3, load) ** 2);
  const expectedMinutes = district.serviceMinutes ?? 15;
  const waiting = Math.round(Math.max(-30, Math.min(30, (expectedMinutes - waitMinutes) * 1.5)));

  // Locals want a few classics, plus house creations beyond what they take for granted.
  const standard = r.menu.filter((m) => state.recipes.find((x) => x.id === m.recipeId)?.ownerId === null).length;
  const houseRecipes = r.menu.length - standard;
  let menu = standard < 3 ? -(3 - standard) * 12 : 0;
  menu += Math.max(0, houseRecipes - (district.desiredOwn ?? 1)) * 3;
  menu += (standard - (district.desiredStandard ?? 3)) * 2;
  menu = Math.max(-40, Math.min(20, menu));

  const advertising = Math.round((adEffectiveness(state, r.ownerId, r.cityId) / 2) * adBonus(ownerStats(state, r.ownerId)));

  const starCount = Math.min(5, Math.floor(r.reputation * 5 + 1e-9));
  const stars = starCount * starCount + (starCount > 0 ? 4 : 0);

  const fulfilled = wanted > 0 ? (100 * y.customers) / wanted : 100;
  const fulfilment = -Math.round((100 - fulfilled) / 6);

  const events = r.popularity?.events ?? 0;

  // The owner can only keep an eye on so many restaurants; the rest lose a little popularity.
  const own = state.restaurants.filter((x) => x.ownerId === r.ownerId).map((x) => x.id).sort((a, b) => a - b);
  // A manager supervises in the owner's place.
  const managed = r.staff.some((s) => s.role === 'manager' && isAvailable(s));
  const supervision = !managed && own.indexOf(r.id) >= supervisable(ownerStats(state, r.ownerId)) ? -10 : 0;

  const owner = state.players.find((p) => p.id === r.ownerId);
  const prestige = owner ? cityPrestige(state, owner, r.cityId) : 0;

  const total = waiting + menu + advertising + stars + fulfilment + events + supervision + prestige;
  return { waiting, menu, advertising, stars, fulfilment, events, supervision, prestige, total, waitMinutes, expectedMinutes, starCount };
}

function bestItem(state: GameState, r: Restaurant, district: CityMap['districts'][number], col: number) {
  let best: { recipeId: string; price: number; appeal: number } | null = null;
  for (const m of r.menu) {
    const recipe = state.recipes.find((x) => x.id === m.recipeId);
    if (!recipe) continue;
    const appeal = itemAppeal(recipe, m.price, district, col, cityDistricts(state, r)) * cookingBonus(ownerStats(state, r.ownerId)) * stockQualityFactor(r, recipe);
    if (!best || appeal > best.appeal) best = { recipeId: m.recipeId, price: m.price, appeal };
  }
  return best;
}

function cityDistricts(state: GameState, r: Restaurant) {
  return state.cities.find((c) => c.id === r.cityId)?.districts;
}

/** Picks the most appealing pizza that is in stock and deducts its ingredients. */
function serveFromStock(state: GameState, r: Restaurant, district: CityMap['districts'][number], col: number) {
  const options = r.menu
    .map((m) => {
      const recipe = state.recipes.find((x) => x.id === m.recipeId);
      const chef = cookingBonus(ownerStats(state, r.ownerId));
      return recipe ? { recipe, price: m.price, appeal: itemAppeal(recipe, m.price, district, col, cityDistricts(state, r)) * chef * stockQualityFactor(r, recipe) } : null;
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

/** Morning routine: spoilage, deliveries and automatic restocking. */
export function startDay(state: GameState): void {
  for (const r of state.restaurants) {
    // A refrigerator halves spoilage.
    const chill = r.layout.some((p) => p.itemId === 'fridge') ? 0.5 : 1;
    for (const id of Object.keys(r.stock)) {
      r.stock[id] = Math.max(0, r.stock[id] * (1 - chill / ingredient(id).shelfLife));
      if (r.stock[id] < 0.01) {
        delete r.stock[id];
        delete r.stockQuality[id];
      }
    }
  }
  deliverOrders(state);
  // Managers do the shopping even without a standing order.
  for (const r of state.restaurants) if (r.autoRestock || r.staff.some((s) => s.role === 'manager' && isAvailable(s))) restock(state, r);
  staffMorning(state);
  morningRisks(state);
  morningNews(state);
  cityLifeMorning(state);
}

/** Adds units to a restaurant's stock, blending their quality into what is already there. */
export function addStock(r: Restaurant, id: string, units: number, quality: number): void {
  const have = r.stock[id] ?? 0;
  const q = r.stockQuality[id] ?? quality;
  r.stock[id] = have + units;
  r.stockQuality[id] = Math.round((have * q + units * quality) / (have + units));
}

/** Delivers today's stock orders; unreliable vendors sometimes don't turn up. Orders are paid on delivery. */
function deliverOrders(state: GameState): void {
  const due = state.orders.filter((o) => o.deliverDay <= state.day);
  state.orders = state.orders.filter((o) => o.deliverDay > state.day);
  for (const o of due) {
    const r = state.restaurants.find((x) => x.id === o.restaurantId);
    const owner = state.players.find((p) => p.id === r?.ownerId);
    const v = vendorById(state, o.vendorId);
    if (!r || !owner || !v) continue;
    if (Math.random() < v.missChance) {
      if (owner.isHuman) addMessage(state, `${v.name} failed to deliver to ${r.name}. Nothing was charged.`);
      continue;
    }
    if (owner.cash - o.total < -OVERDRAFT) {
      if (owner.isHuman) addMessage(state, `${v.name} refused to deliver to ${r.name}: your account can't cover ${formatMoney(o.total)}.`);
      continue;
    }
    addLedger(owner, state.day, 'Ingredients', -o.total);
    for (const [id, units] of Object.entries(o.items)) addStock(r, id, units, v.quality);
    if (owner.isHuman) state.vendorSpend[v.id] = (state.vendorSpend[v.id] ?? 0) + o.total;
  }
}

/** Tops every ingredient on the menu up to the restock target from the preferred (or cheapest) vendor. */
export function restock(state: GameState, r: Restaurant): void {
  const owner = state.players.find((p) => p.id === r.ownerId);
  if (!owner) return;
  const needed = new Set<string>();
  for (const m of r.menu) {
    const recipe = state.recipes.find((x) => x.id === m.recipeId);
    if (recipe) for (const id of Object.keys(recipeUsage(recipe))) needed.add(id);
  }
  const vendors = cityVendors(r.cityId, state.seed);
  for (const id of needed) {
    const missing = Math.ceil(r.restockTarget - (r.stock[id] ?? 0));
    if (missing <= 0) continue;
    const category = ingredient(id).category;
    const preferred = vendors.find((v) => v.id === r.preferredVendors[category] && vendorPrice(v, id, state.day) !== null);
    const cheapest = vendors
      .filter((v) => v.category === category && vendorPrice(v, id, state.day) !== null)
      .sort((a, b) => vendorPrice(a, id, state.day)! - vendorPrice(b, id, state.day)!)[0];
    const v = preferred ?? cheapest;
    if (v) buyStock(state, owner, r, id, missing, vendorPrice(v, id, state.day)!, v.quality);
    else buyStock(state, owner, r, id, missing);
  }
}

/** Buys stock immediately (standing orders, phone deals). Defaults to the plain market price and middling quality. */
export function buyStock(state: GameState, owner: Player, r: Restaurant, id: string, units: number, unitPrice?: number, quality = 50): boolean {
  const thrifty = ingredientPriceFactor(statsOf(owner));
  const price = unitPrice ?? ingredient(id).cost * cityDef(r.cityId).costOfLiving;
  const cost = price * units * thrifty;
  // Suppliers extend a small overdraft before refusing to deliver.
  if (owner.cash - cost < -OVERDRAFT) return false;
  addStock(r, id, units, quality);
  addLedger(owner, state.day, 'Ingredients', -cost);
  return true;
}

/** How much the quality of the stock used for a recipe helps (0.85–1.15). */
function stockQualityFactor(r: Restaurant, recipe: Recipe): number {
  let total = 0;
  let weight = 0;
  for (const [id, n] of Object.entries(recipeUsage(recipe))) {
    total += (r.stockQuality[id] ?? 50) * n;
    weight += n;
  }
  return 0.85 + (weight ? total / weight : 50) * 0.003;
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
    r.today.reputation = r.reputation;
    r.lastDay = r.today;
    // History keeps only the numbers (no per-pizza detail) to keep saves small; rivals keep a week.
    const compact: DayStats = { ...r.today, pizzas: {}, missing: {} };
    r.history = [...(r.history ?? []), compact].slice(owner?.isHuman ? -HISTORY_DAYS : -7);
    r.today = emptyStats(state.day + 1);
  }
  for (const p of state.players) {
    for (const ad of p.ads) ad.daysLeft--;
    p.ads = p.ads.filter((a) => a.daysLeft > 0);
  }
  if ((state.day + 1) % DAYS_PER_MONTH === 0) endMonth(state);
}

function endMonth(state: GameState): void {
  for (const player of state.players) {
    const own = state.restaurants.filter((r) => r.ownerId === player.id);
    for (const r of own) {
      if (!r.owned && r.rentPerMonth > 0) addLedger(player, state.day, 'Rent', -r.rentPerMonth);
      const wages = r.staff.reduce((n, s) => n + s.wagePerMonth, 0);
      if (wages > 0) addLedger(player, state.day, 'Wages', -wages);
    }
    monthlyLoanPayments(state, player, (label, amount) => addLedger(player, state.day, label, amount));
    for (const type of Object.keys(POLICIES) as InsuranceType[]) if (insured(player, type)) addLedger(player, state.day, 'Insurance', -premium(state, player, type));
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
    storage: [],
    floorId: DEFAULT_FLOOR,
    seats: 0,
    kitchenCapacity: 0,
    rentPerMonth: buy ? 0 : price,
    staff: [],
    menu: [
      { recipeId: 'std-margherita', price: Math.round(8 * cityDef(city.id).costOfLiving) },
      { recipeId: 'std-salami', price: Math.round(9 * cityDef(city.id).costOfLiving) },
      { recipeId: 'std-funghi', price: Math.round(9 * cityDef(city.id).costOfLiving) },
    ],
    stock: {},
    stockQuality: {},
    preferredVendors: {},
    reputation: startReputation(statsOf(owner)),
    popularity: emptyPopularity(),
    autoRestock: true,
    restockTarget: 250,
    today: emptyStats(st.day),
    lastDay: emptyStats(st.day - 1),
    history: [],
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
