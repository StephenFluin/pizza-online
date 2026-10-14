import { Injectable, computed, signal } from '@angular/core';
import { CITIES, FIRST_NAMES, LAST_NAMES, STANDARD_RECIPES, cityDef } from './data';
import { generateCity } from './city-gen';
import { CLOSE_MINUTE, GameState, OPEN_MINUTE, Player, Restaurant, Staff, StaffRole } from './model';
import { addLedger, addMessage, buyStock, emptyStats, endDay, restock, simulateHour, startDay } from './simulation';

export type GameSpeed = 0 | 1 | 2 | 4;

/** Game minutes that pass per real second at 1x speed. */
const MINUTES_PER_SECOND = 20;
export const DECOR_COST = [0, 4000, 9000, 16000];

export const PLAYER_COLORS = [0xe63946, 0x2a9d8f, 0xf4a261, 0x6a4c93];

/**
 * Owns the game state. The state object is mutated in place for performance
 * (ten generated cities are large) and the signal is re-set to notify readers,
 * so derived signals use `equal: () => false`.
 */
@Injectable({ providedIn: 'root' })
export class GameService {
  readonly state = signal<GameState | null>(null, { equal: () => false });
  readonly speed = signal<GameSpeed>(1);
  readonly selectedLotId = signal<number | null>(null);

  readonly city = computed(
    () => {
      const s = this.state();
      return s ? (s.cities.find((c) => c.id === s.currentCityId) ?? null) : null;
    },
    { equal: () => false },
  );
  readonly human = computed(() => this.state()?.players.find((p) => p.isHuman) ?? null, { equal: () => false });
  readonly selectedLot = computed(
    () => {
      const id = this.selectedLotId();
      return id === null ? null : (this.city()?.lots[id] ?? null);
    },
    { equal: () => false },
  );
  readonly selectedRestaurant = computed(
    () => {
      const lot = this.selectedLot();
      return lot?.restaurantId != null ? (this.state()?.restaurants.find((r) => r.id === lot.restaurantId) ?? null) : null;
    },
    { equal: () => false },
  );

  private minuteAccumulator = 0;
  private loopHandle: ReturnType<typeof setInterval> | null = null;
  /** Job applicants per restaurant id, refreshed weekly. Plain cache: read inside computeds. */
  private readonly applicantCache = new Map<number, Staff[]>();

  newGame(playerName: string, cityId: string, seed = Math.floor(Math.random() * 2 ** 31)): void {
    const human: Player = {
      id: 0,
      name: playerName.trim() || 'Player',
      color: PLAYER_COLORS[0],
      isHuman: true,
      cash: 50000,
      loan: 0,
      ledger: [],
    };
    this.state.set({
      version: 1,
      seed,
      day: 0,
      minute: OPEN_MINUTE - 60,
      currentCityId: cityId,
      cities: CITIES.map((def) => generateCity(def, seed)),
      players: [human],
      restaurants: [],
      recipes: STANDARD_RECIPES.map((r) => structuredClone(r)),
      nextId: 1,
      messages: [{ day: 0, text: `Welcome to ${cityDef(cityId).name}, ${human.name}! Pick an empty lot to open your first pizzeria.` }],
    });
    this.selectedLotId.set(null);
    this.applicantCache.clear();
  }

  /** Runs `fn` against the live state and notifies readers. */
  mutate(fn: (state: GameState) => void): void {
    const s = this.state();
    if (!s) return;
    fn(s);
    this.state.set(s);
  }

  /**
   * Starts the game clock. It runs on wall-clock time rather than the render loop so the
   * simulation keeps its pace when frames drop or the tab is in the background.
   */
  startLoop(): () => void {
    this.stopLoop();
    let last = performance.now();
    this.loopHandle = setInterval(() => {
      const now = performance.now();
      this.tick(Math.min(5, (now - last) / 1000));
      last = now;
    }, 100);
    return () => this.stopLoop();
  }

  stopLoop(): void {
    if (this.loopHandle !== null) clearInterval(this.loopHandle);
    this.loopHandle = null;
  }

  /** Advances the clock by real elapsed seconds. */
  tick(seconds: number): void {
    const s = this.state();
    if (!s || this.speed() === 0) return;
    this.minuteAccumulator += seconds * MINUTES_PER_SECOND * this.speed();
    const minutes = Math.floor(this.minuteAccumulator);
    if (minutes < 1) return;
    this.minuteAccumulator -= minutes;
    this.mutate((st) => {
      for (let i = 0; i < minutes; i++) this.advanceMinute(st);
    });
  }

  private advanceMinute(st: GameState): void {
    st.minute++;
    if (st.minute === OPEN_MINUTE) startDay(st);
    if (st.minute % 60 === 0 && st.minute > OPEN_MINUTE && st.minute <= CLOSE_MINUTE) simulateHour(st, st.minute / 60 - 1);
    if (st.minute === CLOSE_MINUTE) endDay(st);
    // Skip the closed night hours so the player isn't waiting for nothing.
    if (st.minute >= CLOSE_MINUTE + 60) {
      st.day++;
      st.minute = OPEN_MINUTE - 60;
      if (st.day % 7 === 0) this.applicantCache.clear();
    }
  }

  selectLot(id: number | null): void {
    this.selectedLotId.set(id);
  }

  /** Opens a restaurant on a free lot, either renting (deposit = one month) or buying it. */
  openRestaurant(lotId: number, buy: boolean, ownerId = 0): Restaurant | null {
    let created: Restaurant | null = null;
    this.mutate((st) => {
      const city = st.cities.find((c) => c.id === st.currentCityId);
      const lot = city?.lots[lotId];
      const owner = st.players.find((p) => p.id === ownerId);
      if (!city || !lot || !owner || lot.restaurantId !== null) return;
      const price = buy ? lot.purchasePrice : lot.rentPerMonth;
      if (owner.cash < price) return;
      addLedger(owner, st.day, buy ? 'Property purchase' : 'Rent deposit', -price);
      const count = st.restaurants.filter((r) => r.ownerId === ownerId).length;
      const r: Restaurant = {
        id: st.nextId++,
        ownerId,
        cityId: city.id,
        lotId,
        name: `${owner.name}'s Pizzeria${count ? ` #${count + 1}` : ''}`,
        owned: buy,
        decor: 0,
        staff: [],
        menu: [
          { recipeId: 'std-margherita', price: 8 },
          { recipeId: 'std-salami', price: 9 },
        ],
        stock: {},
        reputation: 0.3,
        autoRestock: true,
        restockTarget: 250,
        today: emptyStats(),
        lastDay: emptyStats(),
      };
      lot.restaurantId = r.id;
      st.restaurants.push(r);
      if (st.minute >= OPEN_MINUTE) restock(st, r);
      if (owner.isHuman) addMessage(st, `${r.name} opened in ${city.districts[lot.district].name}. Hire a cook and a waiter to start serving.`);
      created = r;
    });
    return created;
  }

  closeRestaurant(restaurantId: number): void {
    this.mutate((st) => {
      const r = st.restaurants.find((x) => x.id === restaurantId);
      if (!r) return;
      const city = st.cities.find((c) => c.id === r.cityId);
      const lot = city?.lots[r.lotId];
      const owner = st.players.find((p) => p.id === r.ownerId);
      if (lot) {
        lot.restaurantId = null;
        if (r.owned && owner) addLedger(owner, st.day, 'Property sale', Math.round(lot.purchasePrice * 0.8));
      }
      st.restaurants = st.restaurants.filter((x) => x.id !== restaurantId);
      if (owner?.isHuman) addMessage(st, `${r.name} has closed its doors.`);
    });
  }

  applicantsFor(r: Restaurant): Staff[] {
    const existing = this.applicantCache.get(r.id);
    if (existing) return existing;
    const col = cityDef(r.cityId).costOfLiving;
    const list: Staff[] = [];
    for (const role of ['cook', 'cook', 'waiter', 'waiter', 'cook', 'waiter'] as StaffRole[]) {
      const skill = Math.round(Math.random() * 100) / 100;
      list.push({
        id: Math.floor(Math.random() * 1e9),
        name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
        role,
        skill,
        wagePerMonth: Math.round(((role === 'cook' ? 1400 : 1100) + skill * 1600) * col / 10) * 10,
      });
    }
    this.applicantCache.set(r.id, list);
    return list;
  }

  hire(restaurantId: number, staff: Staff): void {
    this.applicantCache.set(restaurantId, (this.applicantCache.get(restaurantId) ?? []).filter((s) => s.id !== staff.id));
    this.mutate((st) => {
      const r = st.restaurants.find((x) => x.id === restaurantId);
      if (!r || r.staff.length >= 12) return;
      r.staff.push(staff);
    });
  }

  fire(restaurantId: number, staffId: number): void {
    this.mutate((st) => {
      const r = st.restaurants.find((x) => x.id === restaurantId);
      if (r) r.staff = r.staff.filter((s) => s.id !== staffId);
    });
  }

  buy(restaurantId: number, ingredientId: string, portions: number): boolean {
    let ok = false;
    this.mutate((st) => {
      const r = st.restaurants.find((x) => x.id === restaurantId);
      const owner = st.players.find((p) => p.id === r?.ownerId);
      if (r && owner) ok = buyStock(st, owner, r, ingredientId, portions);
    });
    return ok;
  }

  updateRestaurant(restaurantId: number, fn: (r: Restaurant) => void): void {
    this.mutate((st) => {
      const r = st.restaurants.find((x) => x.id === restaurantId);
      if (r) fn(r);
    });
  }

  upgradeDecor(restaurantId: number): void {
    this.mutate((st) => {
      const r = st.restaurants.find((x) => x.id === restaurantId);
      const owner = st.players.find((p) => p.id === r?.ownerId);
      if (!r || !owner || r.decor >= 3) return;
      const cost = DECOR_COST[r.decor + 1] * cityDef(r.cityId).costOfLiving;
      if (owner.cash < cost) return;
      addLedger(owner, st.day, 'Furniture', -cost);
      r.decor++;
    });
  }
}
