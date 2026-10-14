import { Injectable, computed, signal } from '@angular/core';
import { CITIES, FIRST_NAMES, LAST_NAMES, STANDARD_RECIPES, cityDef } from './data';
import { generateCity } from './city-gen';
import { createRivals, runAiWeek } from './ai';
import { applicantSkillBonus, ingredientPriceFactor, statsOf } from './owner-stats';
import { vendorById, vendorPrice } from './vendors';
import { SELL_BACK, applyRoom, canPlace, catalogItem, diningCells, floorType } from './furniture';
import { character } from './characters';
import { AdCampaign, CLOSE_MINUTE, DAYS_PER_MONTH, GameState, Lot, OPEN_MINUTE, Player, Recipe, Restaurant, Staff, StaffRole } from './model';
import { deserialize, loadFromSlot, saveToSlot } from './saves';
import { checkOutcome } from './world';
import { addLedger, addMessage, buyStock, endDay, openRestaurantAt, simulateHour, startDay } from './simulation';

export type GameSpeed = 0 | 1 | 2 | 4;

/** Real time between automatic saves to browser storage. */
const AUTOSAVE_INTERVAL_MS = 90_000;

/** Game minutes that pass per real second at 1x speed. */
const MINUTES_PER_SECOND = 5;

export const PLAYER_COLORS = [0xe63946];
export const START_CASH = 50000;
export const MAX_LOAN = 150000;
export const LOAN_STEP = 10000;


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
  /** Day number whose end-of-day report is waiting for the player; the clock is held until they continue. */
  readonly dayReport = signal<number | null>(null);
  /** Stop at the end of every trading day to show the report. */
  readonly reportEachDay = signal(true);
  private resumeSpeed: GameSpeed = 1;

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
  private lastAutosave = 0;
  private autosaveFailed = false;
  private readonly saveWhenHidden = () => {
    if (document.visibilityState === 'hidden') this.autosaveNow();
  };
  private readonly saveOnExit = () => this.autosaveNow();
  /** Job applicants per restaurant id, refreshed weekly. Plain cache: read inside computeds. */
  private readonly applicantCache = new Map<number, Staff[]>();

  newGame(playerName: string, cityId: string, characterId = 'gianna', seed = Math.floor(Math.random() * 2 ** 31), rivalIds: string[] = []): void {
    const hero = character(characterId);
    const human: Player = {
      id: 0,
      name: playerName.trim() || hero.name,
      characterId: hero.id,
      color: PLAYER_COLORS[0],
      isHuman: true,
      cash: hero.stats.money,
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
      players: [human, ...createRivals(1, START_CASH, hero.id, rivalIds)],
      restaurants: [],
      recipes: STANDARD_RECIPES.map((r) => structuredClone(r)),
      nextId: 1,
      messages: [{ day: 0, text: `Welcome to ${cityDef(cityId).name}, ${human.name}! Pick an empty lot to open your first pizzeria.` }],
      outcome: null,
      orders: [],
      vendorSpend: {},
    });
    this.selectedLotId.set(null);
    this.applicantCache.clear();
    this.dayReport.set(null);
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
    this.lastAutosave = last;
    this.loopHandle = setInterval(() => {
      const now = performance.now();
      this.tick(Math.min(5, (now - last) / 1000));
      last = now;
      if (now - this.lastAutosave >= AUTOSAVE_INTERVAL_MS) this.autosaveNow();
    }, 100);
    // Also save when the tab is hidden or closed so little progress is ever lost.
    document.addEventListener('visibilitychange', this.saveWhenHidden);
    window.addEventListener('pagehide', this.saveOnExit);
    return () => this.stopLoop();
  }

  stopLoop(): void {
    if (this.loopHandle !== null) clearInterval(this.loopHandle);
    this.loopHandle = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.saveWhenHidden);
      window.removeEventListener('pagehide', this.saveOnExit);
    }
  }

  /** Writes the current game to the autosave slot in browser storage. */
  autosaveNow(): void {
    this.lastAutosave = performance.now();
    const st = this.state();
    if (st) this.autosave(st);
  }

  /** Advances the clock by real elapsed seconds. */
  tick(seconds: number): void {
    const s = this.state();
    if (!s || this.speed() === 0 || this.dayReport() !== null) return;
    this.minuteAccumulator += seconds * MINUTES_PER_SECOND * this.speed();
    const minutes = Math.floor(this.minuteAccumulator);
    if (minutes < 1) return;
    this.minuteAccumulator -= minutes;
    this.mutate((st) => {
      for (let i = 0; i < minutes; i++) {
        if (this.advanceMinute(st)) {
          this.minuteAccumulator = 0;
          break;
        }
      }
    });
  }

  /** Runs the rest of today's trading hours at once (the classic "end turn"). */
  endDayNow(): void {
    if (this.dayReport() !== null) return;
    this.mutate((st) => {
      for (let i = 0; i < 24 * 60; i++) if (this.advanceMinute(st)) break;
    });
  }

  /** Closes the end-of-day report and starts the next morning. */
  continueDay(): void {
    if (this.dayReport() === null) return;
    this.mutate((st) => this.rollOver(st));
    this.dayReport.set(null);
    const st = this.state();
    this.speed.set(st?.outcome ? 0 : this.resumeSpeed || 1);
  }

  private rollOver(st: GameState): void {
    st.day++;
    st.minute = OPEN_MINUTE - 60;
    if (st.day % 7 === 0) this.applicantCache.clear();
  }

  /** Advances one game minute; returns true when the day has just ended. */
  private advanceMinute(st: GameState): boolean {
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
      const me = st.players.find((p) => p.isHuman);
      const hasShops = st.restaurants.some((r) => r.ownerId === me?.id);
      if (st.outcome || (this.reportEachDay() && hasShops)) {
        // Hold the clock at closing time until the player has read the report.
        this.resumeSpeed = this.speed() || this.resumeSpeed;
        this.speed.set(0);
        this.dayReport.set(st.day);
      } else {
        // Nothing to report: skip the closed night hours straight to the next morning.
        this.rollOver(st);
      }
      return true;
    }
    return false;
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
    const bonus = applicantSkillBonus(statsOf(this.human()));
    const list: Staff[] = [];
    for (const role of ['cook', 'cook', 'waiter', 'waiter', 'cook', 'waiter'] as StaffRole[]) {
      const skill = Math.round(Math.max(0.05, Math.min(1, Math.random() + bonus)) * 100) / 100;
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

  /** Runs `fn` on one restaurant, its owner and its lot, then refreshes the room's cached stats. */
  private withRoom(restaurantId: number, fn: (r: Restaurant, owner: Player, lot: Lot, st: GameState) => void): void {
    this.mutate((st) => {
      const r = st.restaurants.find((x) => x.id === restaurantId);
      const owner = st.players.find((p) => p.id === r?.ownerId);
      const lot = r ? st.cities.find((c) => c.id === r.cityId)?.lots[r.lotId] : undefined;
      if (!r || !owner || !lot) return;
      fn(r, owner, lot, st);
      applyRoom(r, lot);
    });
  }

  /** Buys pieces from a store into the restaurant's storage. */
  buyToStorage(restaurantId: number, itemId: string, quantity: number): boolean {
    let ok = false;
    this.withRoom(restaurantId, (r, owner, _lot, st) => {
      const cost = catalogItem(itemId).price * cityDef(r.cityId).costOfLiving * quantity;
      if (quantity <= 0 || owner.cash < cost) return;
      addLedger(owner, st.day, 'Furniture', -cost);
      for (let i = 0; i < quantity; i++) r.storage.push(itemId);
      ok = true;
    });
    return ok;
  }

  /** Moves a piece from storage onto the floor plan when it fits. */
  placeFromStorage(restaurantId: number, storageIndex: number, x: number, y: number): boolean {
    let ok = false;
    this.withRoom(restaurantId, (r, _owner, lot) => {
      const itemId = r.storage[storageIndex];
      if (!itemId || !canPlace(r.layout, lot, itemId, x, y)) return;
      r.storage.splice(storageIndex, 1);
      r.layout.push({ itemId, x, y });
      ok = true;
    });
    return ok;
  }

  /** Takes a placed piece off the floor and puts it back into storage. */
  putAway(restaurantId: number, index: number): void {
    this.withRoom(restaurantId, (r) => {
      const item = r.layout[index];
      if (!item) return;
      r.layout.splice(index, 1);
      r.storage.push(item.itemId);
    });
  }

  /** Sells a piece from storage for half its price. */
  sellStored(restaurantId: number, storageIndex: number): void {
    this.withRoom(restaurantId, (r, owner, _lot, st) => {
      const itemId = r.storage[storageIndex];
      if (!itemId) return;
      addLedger(owner, st.day, 'Furniture sold', catalogItem(itemId).price * cityDef(r.cityId).costOfLiving * SELL_BACK);
      r.storage.splice(storageIndex, 1);
    });
  }

  /** Lays a new floor across the dining room, priced per cell. */
  layFloor(restaurantId: number, floorId: string): boolean {
    let ok = false;
    this.withRoom(restaurantId, (r, owner, lot, st) => {
      const floor = floorType(floorId);
      const cost = floor.pricePerCell * diningCells(lot) * cityDef(r.cityId).costOfLiving;
      if (r.floorId === floor.id || owner.cash < cost) return;
      addLedger(owner, st.day, 'Flooring', -cost);
      r.floorId = floor.id;
      ok = true;
    });
    return ok;
  }

  /** Moves a placed item to a new cell when it fits there. */
  moveItem(restaurantId: number, index: number, x: number, y: number): boolean {
    let ok = false;
    this.mutate((st) => {
      const r = st.restaurants.find((x2) => x2.id === restaurantId);
      const lot = r ? st.cities.find((c) => c.id === r.cityId)?.lots[r.lotId] : undefined;
      const item = r?.layout[index];
      if (!r || !lot || !item || !canPlace(r.layout, lot, item.itemId, x, y, index)) return;
      item.x = x;
      item.y = y;
      applyRoom(r, lot);
      ok = true;
    });
    return ok;
  }

  /** Sells a placed item back for half its price. */
  sellItem(restaurantId: number, index: number): void {
    this.mutate((st) => {
      const r = st.restaurants.find((x2) => x2.id === restaurantId);
      const owner = st.players.find((p) => p.id === r?.ownerId);
      const lot = r ? st.cities.find((c) => c.id === r.cityId)?.lots[r.lotId] : undefined;
      const item = r?.layout[index];
      if (!r || !owner || !lot || !item) return;
      addLedger(owner, st.day, 'Furniture sold', catalogItem(item.itemId).price * cityDef(r.cityId).costOfLiving * SELL_BACK);
      r.layout.splice(index, 1);
      applyRoom(r, lot);
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

  /** Starts a campaign for the player; refused when the channel is busy in that city or cash is short. */
  advertise(campaign: AdCampaign): boolean {
    let ok = false;
    this.mutate((st) => {
      const p = st.players.find((x) => x.isHuman);
      if (!p || p.cash < campaign.cost) return;
      if (p.ads.some((a) => a.cityId === campaign.cityId && a.channel === campaign.channel)) return;
      addLedger(p, st.day, 'Advertising', -campaign.cost);
      p.ads.push(campaign);
      addMessage(st, `New ${campaign.channel === 'tv' ? 'TV' : campaign.channel} campaign in ${cityDef(campaign.cityId).name}: ${campaign.effectiveness}% effective for ${campaign.daysLeft} days.`);
      ok = true;
    });
    return ok;
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
    this.dayReport.set(st.minute >= CLOSE_MINUTE ? st.day : null);
    this.selectedLotId.set(null);
    this.speed.set(st.outcome ? 0 : 1);
    this.state.set(st);
  }

  private autosave(st: GameState): void {
    try {
      saveToSlot('auto', st);
      this.autosaveFailed = false;
    } catch {
      // Report the first failure only, not every 90 seconds.
      if (!this.autosaveFailed) addMessage(st, 'Autosave failed: browser storage is full or unavailable.');
      this.autosaveFailed = true;
    }
  }

  /**
   * Orders stock from a vendor for delivery tomorrow morning. Refused below the
   * vendor's minimum order. The vendor becomes the restaurant's preferred one
   * for automatic restocking in that category.
   */
  placeOrder(restaurantId: number, vendorId: string, items: Record<string, number>): string | null {
    let error: string | null = 'Order failed.';
    this.mutate((st) => {
      const r = st.restaurants.find((x) => x.id === restaurantId);
      const v = vendorById(st, vendorId);
      const owner = st.players.find((p) => p.id === r?.ownerId);
      if (!r || !v || !owner) return;
      const thrifty = ingredientPriceFactor(statsOf(owner));
      const lines = Object.entries(items).filter(([id, n]) => n > 0 && vendorPrice(v, id, st.day) !== null);
      const total = Math.round(lines.reduce((n, [id, units]) => n + vendorPrice(v, id, st.day)! * units, 0) * thrifty * 100) / 100;
      if (lines.length === 0) {
        error = 'Nothing to order.';
        return;
      }
      if (total < v.minimumOrder) {
        error = `${v.name} only delivers orders of $${v.minimumOrder} or more.`;
        return;
      }
      st.orders.push({ id: st.nextId++, restaurantId, vendorId, items: Object.fromEntries(lines), total, deliverDay: st.day + 1 });
      r.preferredVendors[v.category] = v.id;
      error = null;
    });
    return error;
  }

  cancelOrder(orderId: number): void {
    this.mutate((st) => (st.orders = st.orders.filter((o) => o.id !== orderId)));
  }
}
