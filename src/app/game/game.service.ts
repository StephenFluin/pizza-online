import { Injectable, computed, signal } from '@angular/core';
import { CITIES, FIRST_NAMES, LAST_NAMES, STANDARD_RECIPES, cityDef } from './data';
import { generateCity } from './city-gen';
import { createRivals, runAiWeek } from './ai';
import { AdKind, CLOSE_MINUTE, DAYS_PER_MONTH, GameState, OPEN_MINUTE, Player, Recipe, Restaurant, Staff, StaffRole } from './model';
import { deserialize, loadFromSlot, saveToSlot } from './saves';
import { checkOutcome } from './world';
import { addLedger, addMessage, buyStock, endDay, openRestaurantAt, simulateHour, startDay } from './simulation';

export type GameSpeed = 0 | 1 | 2 | 4;

/** Game minutes that pass per real second at 1x speed. */
const MINUTES_PER_SECOND = 20;
export const DECOR_COST = [0, 4000, 9000, 16000];

export const PLAYER_COLORS = [0xe63946];
export const START_CASH = 50000;
export const MAX_LOAN = 150000;
export const LOAN_STEP = 10000;

export const AD_OPTIONS: Record<AdKind, { label: string; cost: number; days: number; boost: number }> = {
  flyers: { label: 'Flyers', cost: 2000, days: 14, boost: 0.25 },
  radio: { label: 'Radio spots', cost: 6000, days: 30, boost: 0.5 },
  tv: { label: 'TV commercial', cost: 18000, days: 30, boost: 1 },
};

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
      cash: START_CASH,
      loan: 0,
      ledger: [],
      ads: [],
    };
    this.state.set({
      version: 1,
      seed,
      day: 0,
      minute: OPEN_MINUTE - 60,
      currentCityId: cityId,
      cities: CITIES.map((def) => generateCity(def, seed)),
      players: [human, ...createRivals(1, START_CASH)],
      restaurants: [],
      recipes: STANDARD_RECIPES.map((r) => structuredClone(r)),
      nextId: 1,
      messages: [{ day: 0, text: `Welcome to ${cityDef(cityId).name}, ${human.name}! Pick an empty lot to open your first pizzeria.` }],
      outcome: null,
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
    if (st.minute === CLOSE_MINUTE) {
      endDay(st);
      if ((st.day + 1) % 7 === 0) runAiWeek(st);
      if ((st.day + 1) % DAYS_PER_MONTH === 0) {
        checkOutcome(st);
        this.autosave(st);
      }
      if (st.outcome) this.speed.set(0);
    }
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

  /** Opens a restaurant on a free lot in the current city, either renting (deposit = one month) or buying it. */
  openRestaurant(lotId: number, buy: boolean): Restaurant | null {
    let created: Restaurant | null = null;
    this.mutate((st) => {
      created = openRestaurantAt(st, st.currentCityId, lotId, this.human()?.id ?? 0, buy);
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

  /** Stores a player-made recipe, adding it when new or replacing the one with the same id. */
  saveRecipe(recipe: Recipe): Recipe {
    let saved = recipe;
    this.mutate((st) => {
      const idx = st.recipes.findIndex((r) => r.id === recipe.id && r.ownerId === recipe.ownerId);
      if (idx >= 0) {
        st.recipes[idx] = structuredClone(recipe);
      } else {
        saved = { ...structuredClone(recipe), id: `r${st.nextId++}`, ownerId: this.human()?.id ?? 0 };
        st.recipes.push(saved);
      }
    });
    return saved;
  }

  deleteRecipe(recipeId: string): void {
    this.mutate((st) => {
      st.recipes = st.recipes.filter((r) => r.id !== recipeId || r.ownerId === null);
      for (const r of st.restaurants) r.menu = r.menu.filter((m) => m.recipeId !== recipeId);
    });
  }

  /** Switches the map to another city. */
  travel(cityId: string): void {
    this.mutate((st) => (st.currentCityId = cityId));
    this.selectedLotId.set(null);
  }

  borrow(amount: number): void {
    this.mutate((st) => {
      const p = st.players.find((x) => x.isHuman);
      if (!p || p.loan + amount > MAX_LOAN) return;
      p.loan += amount;
      addLedger(p, st.day, 'Loan', amount);
    });
  }

  repay(amount: number): void {
    this.mutate((st) => {
      const p = st.players.find((x) => x.isHuman);
      if (!p) return;
      const pay = Math.min(amount, p.loan, Math.max(0, p.cash));
      if (pay <= 0) return;
      p.loan -= pay;
      addLedger(p, st.day, 'Loan repayment', -pay);
    });
  }

  advertise(kind: AdKind, cityId: string): void {
    this.mutate((st) => {
      const p = st.players.find((x) => x.isHuman);
      const opt = AD_OPTIONS[kind];
      const cost = opt.cost * cityDef(cityId).costOfLiving;
      if (!p || p.cash < cost) return;
      addLedger(p, st.day, 'Advertising', -cost);
      p.ads.push({ cityId, kind, daysLeft: opt.days, boost: opt.boost });
      addMessage(st, `${opt.label} campaign started in ${cityDef(cityId).name}.`);
    });
  }

  save(slot: string): boolean {
    const st = this.state();
    if (!st) return false;
    try {
      saveToSlot(slot, st);
      return true;
    } catch {
      return false;
    }
  }

  load(slot: string): boolean {
    const st = loadFromSlot(slot);
    if (!st) return false;
    this.replaceState(st);
    return true;
  }

  loadFromText(text: string): void {
    this.replaceState(deserialize(text));
  }

  quit(): void {
    this.state.set(null);
    this.selectedLotId.set(null);
  }

  private replaceState(st: GameState): void {
    this.applicantCache.clear();
    this.selectedLotId.set(null);
    this.speed.set(st.outcome ? 0 : 1);
    this.state.set(st);
  }

  private autosave(st: GameState): void {
    try {
      saveToSlot('auto', st);
    } catch {
      addMessage(st, 'Autosave failed: browser storage is full or unavailable.');
    }
  }
}
