import { CITIES, FIRST_NAMES, LAST_NAMES, cityDef } from './data';
import { GameState, Player, Restaurant, StaffRole } from './model';
import { cityTaste, fairPrice } from './recipes';
import { addLedger, openRestaurantAt } from './simulation';

export const RIVALS: { name: string; color: number }[] = [
  { name: 'Crusty Corp', color: 0x2a9d8f },
  { name: 'Slice Brothers', color: 0xf4a261 },
  { name: 'Nonna Lucia', color: 0x8e5bd6 },
];

export function createRivals(firstId: number, startCash: number): Player[] {
  return RIVALS.map((r, i) => ({
    id: firstId + i,
    name: r.name,
    color: r.color,
    isHuman: false,
    cash: startCash,
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
  if (p.cash > 40000 && r.decor < 3 && Math.random() < 0.15) {
    const cost = [0, 4000, 9000, 16000][r.decor + 1] * cityDef(r.cityId).costOfLiving;
    addLedger(p, st.day, 'Furniture', -cost);
    r.decor++;
  }
  if (p.cash > 30000 && Math.random() < 0.08 && !p.ads.some((a) => a.cityId === r.cityId)) {
    addLedger(p, st.day, 'Advertising', -2000 * cityDef(r.cityId).costOfLiving);
    p.ads.push({ cityId: r.cityId, kind: 'flyers', daysLeft: 14, boost: 0.25 });
  }
}

function hire(st: GameState, r: Restaurant, role: StaffRole): void {
  const skill = 0.3 + Math.random() * 0.5;
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
