import { POSTERS, campaignCost, flyerRate } from './advertising';
import { CHARACTERS } from './characters';
import { applicantSkillBonus, ownerStats } from './owner-stats';
import { CITIES, FIRST_NAMES, LAST_NAMES, cityDef } from './data';
import { GameState, PlacedItem, Player, Restaurant, StaffRole } from './model';
import { applyRoom, autoPlace, catalogItem, placeDiningSet } from './furniture';
import { cityTaste, fairPrice } from './recipes';
import { addLedger, openRestaurantAt } from './simulation';

/** Three rival characters: the ones chosen on the selection screen, or random others from the cast. */
export function createRivals(firstId: number, startCash: number, exclude: string, chosen: string[] = []): Player[] {
  const pool = CHARACTERS.filter((c) => c.id !== exclude);
  const picked: typeof pool = chosen.map((id) => pool.find((c) => c.id === id)).filter((c): c is (typeof pool)[number] => !!c).slice(0, 3);
  while (picked.length < 3) {
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (!picked.includes(c)) picked.push(c);
  }
  return picked.map((c, i) => ({
    id: firstId + i,
    name: c.name,
    characterId: c.id,
    color: c.color,
    isHuman: false,
    cash: c.stats.money,
    loan: 0,
    ledger: [],
    ads: [],
  }));
}

/** Weekly decisions for every computer player. */
export function runAiWeek(st: GameState): void {
  for (const p of st.players.filter((x) => !x.isHuman)) {
    const own = st.restaurants.filter((r) => r.ownerId === p.id);
    for (const r of own) manage(st, p, r);
    // Expand when there is a comfortable cash cushion.
    const reserve = 15000 + own.length * 6000;
    if (p.cash > reserve && own.length < 14 && Math.random() < 0.55) expand(st, p, own);
    if (p.cash < -3000) {
      // Shed the weakest restaurant when money runs out.
      const worst = [...own].sort((a, b) => a.lastDay.revenue - b.lastDay.revenue)[0];
      if (worst) closeFor(st, worst);
    }
  }
}

function expand(st: GameState, p: Player, own: Restaurant[]): void {
  // Prefer the human's current city early on, then spread to cities with the fewest of our shops.
  const counts = new Map(CITIES.map((c) => [c.id, own.filter((r) => r.cityId === c.id).length]));
  const candidates = [...CITIES].sort((a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) + (Math.random() - 0.5));
  const cityId = own.length < 2 && Math.random() < 0.7 ? st.currentCityId : candidates[0].id;
  const city = st.cities.find((c) => c.id === cityId);
  if (!city) return;
  const free = city.lots.filter((l) => l.restaurantId === null && l.rentPerMonth * 2 < p.cash);
  if (free.length === 0) return;
  // Score lots by nearby population and wealth, discounted by competing restaurants close by.
  const score = (lotIdx: number) => {
    const lot = city.lots[lotIdx];
    let s = 0;
    for (const d of city.districts) s += (d.population * (0.5 + d.wealth)) * Math.exp(-Math.hypot(lot.x - d.cx, lot.y - d.cy) / 12);
    for (const r of st.restaurants.filter((x) => x.cityId === cityId)) {
      const o = city.lots[r.lotId];
      s *= 1 - 0.35 * Math.exp(-Math.hypot(lot.x - o.x, lot.y - o.y) / 6);
    }
    return s * (0.8 + Math.random() * 0.4);
  };
  const best = free.map((l) => ({ l, s: score(l.id) })).sort((a, b) => b.s - a.s)[0];
  const r = openRestaurantAt(st, cityId, best.l.id, p.id, false);
  if (!r) return;
  hire(st, r, 'cook');
  hire(st, r, 'waiter');
  furnish(st, p, r, 'tables', 3);
  // Pick the three recipes the city likes most and price them fairly.
  const avgWealth = city.districts.reduce((n, d) => n + d.wealth, 0) / city.districts.length;
  const fair = fairPrice({ ...city.districts[0], wealth: avgWealth }, cityDef(cityId).costOfLiving);
  r.menu = st.recipes
    .filter((x) => x.ownerId === null)
    .map((x) => ({ x, t: cityTaste(x, city.districts) }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 3)
    .map(({ x }) => ({ recipeId: x.id, price: Math.round(fair * (0.9 + Math.random() * 0.2) * 2) / 2 }));
}

function manage(st: GameState, p: Player, r: Restaurant): void {
  const d = r.lastDay;
  if (d.noStaff > 15 && r.staff.length < 8) hire(st, r, r.staff.filter((s) => s.role === 'cook').length <= r.staff.filter((s) => s.role === 'waiter').length ? 'cook' : 'waiter');
  if (d.noStock > 10) r.restockTarget = Math.min(600, r.restockTarget + 60);
  // Nudge prices: busy restaurants charge more, quiet ones less.
  const factor = d.turnedAway > d.customers * 0.3 ? 1.05 : d.customers < 25 ? 0.95 : 1;
  for (const m of r.menu) m.price = Math.max(3, Math.round(m.price * factor * 2) / 2);
  // Fit out the room: more tables when full, a better oven when the kitchen is the bottleneck, decor when rich.
  if (d.lostSeats > 0 && p.cash > 8000) furnish(st, p, r, 'tables', 2);
  if (d.lostKitchen > 10 && p.cash > 12000) furnish(st, p, r, 'kitchen', 1);
  if (p.cash > 40000 && r.decor < 2.5 && Math.random() < 0.3) furnish(st, p, r, 'decor', 3);
  // Rivals run flyer or poster campaigns when they can afford them.
  if (p.cash > 30000 && Math.random() < 0.08 && !p.ads.some((a) => a.cityId === r.cityId)) {
    const posters = Math.random() < 0.5;
    const poster = POSTERS[Math.floor(Math.random() * POSTERS.length)];
    const rate = posters ? { effectiveness: poster.effectiveness, weeklyCost: poster.weeklyCost } : flyerRate(300);
    const cost = campaignCost(rate.weeklyCost, 14, cityDef(r.cityId).costOfLiving);
    addLedger(p, st.day, 'Advertising', -cost);
    p.ads.push({ cityId: r.cityId, channel: posters ? 'posters' : 'flyers', daysLeft: 14, effectiveness: rate.effectiveness, cost, ...(posters ? { posterId: poster.id } : { flyers: 300 }) });
  }
}

function hire(st: GameState, r: Restaurant, role: StaffRole): void {
  const bonus = applicantSkillBonus(ownerStats(st, r.ownerId));
  const skill = Math.max(0.1, Math.min(1, 0.3 + Math.random() * 0.5 + bonus));
  r.staff.push({
    id: st.nextId++,
    name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
    role,
    skill,
    wagePerMonth: Math.round(((role === 'cook' ? 1400 : 1100) + skill * 1600) * cityDef(r.cityId).costOfLiving / 10) * 10,
  });
}

function closeFor(st: GameState, r: Restaurant): void {
  const lot = st.cities.find((c) => c.id === r.cityId)?.lots[r.lotId];
  if (lot) lot.restaurantId = null;
  st.restaurants = st.restaurants.filter((x) => x.id !== r.id);
}

/** Rivals buy and place pieces directly from a store matching their budget. */
function furnish(st: GameState, p: Player, r: Restaurant, what: 'tables' | 'kitchen' | 'decor', count: number): void {
  const lot = st.cities.find((c) => c.id === r.cityId)?.lots[r.lotId];
  if (!lot) return;
  const col = cityDef(r.cityId).costOfLiving;
  const line = p.cash > 60000 ? 'nordlicht' : p.cash > 25000 ? 'bistro' : 'timber';
  const placed: PlacedItem[] = [];
  for (let i = 0; i < count; i++) {
    if (what === 'tables') placed.push(...placeDiningSet(r.layout, lot, `${line}:table-large`, `${line}:chair`, 4));
    else if (what === 'kitchen') placed.push(...autoPlace(r.layout, lot, 'chefline:counter', 1), ...autoPlace(r.layout, lot, 'chefline:oven', 1));
    else placed.push(...autoPlace(r.layout, lot, ['greenthumb:plant', 'greenthumb:lamp', 'gallery:painting', 'arcade:jukebox'][i % 4], 1));
  }
  const cost = placed.reduce((n, it) => n + catalogItem(it.itemId).price * col, 0);
  if (cost > 0) addLedger(p, st.day, 'Furniture', -cost);
  applyRoom(r, lot);
}
