import { cityDef, ingredient } from './data';
import { GameState, Player, Restaurant } from './model';
import { recipeUsage } from './recipes';

/**
 * Warehouses: cold storage in a city that takes bulk deliveries and supplies
 * the owner's restaurants there each morning in a priority order, plus
 * shipping between the owner's warehouses. Sizes and prices are our own.
 */

export interface Warehouse {
  cityId: string;
  size: WarehouseSize;
  stock: Record<string, number>;
  stockQuality: Record<string, number>;
  /** Restaurant ids, supplied first to last. */
  priority: number[];
}

export type WarehouseSize = 'small' | 'medium' | 'large';

export const WAREHOUSE_SIZES: Record<WarehouseSize, { label: string; capacity: number; rent: number }> = {
  small: { label: 'Small cold store', capacity: 2000, rent: 800 },
  medium: { label: 'Medium cold store', capacity: 5000, rent: 1600 },
  large: { label: 'Large distribution centre', capacity: 12000, rent: 3200 },
};

/** Cold storage slows spoilage to a third. */
export const COLD_STORAGE = 1 / 3;
/** Bulk deliveries to a warehouse of at least this many units get a discount. */
export const BULK_UNITS = 500;
export const BULK_DISCOUNT = 0.1;
export const SHIPPING_DAYS = 2;
export const SHIPPING_PER_UNIT = 0.05;

export interface Shipment {
  id: number;
  ownerId: number;
  fromCityId: string;
  toCityId: string;
  items: Record<string, number>;
  quality: Record<string, number>;
  arriveDay: number;
}

export function warehouseIn(p: Player, cityId: string): Warehouse | null {
  return p.warehouses?.[cityId] ?? null;
}

export function warehouseRent(w: Pick<Warehouse, 'size' | 'cityId'>): number {
  return Math.round((WAREHOUSE_SIZES[w.size].rent * cityDef(w.cityId).costOfLiving) / 10) * 10;
}

export function used(w: Warehouse): number {
  return Math.round(Object.values(w.stock).reduce((n, x) => n + x, 0));
}

export function freeSpace(w: Warehouse): number {
  return Math.max(0, WAREHOUSE_SIZES[w.size].capacity - used(w));
}

/** Adds units, blending quality; anything beyond capacity is turned away. Returns units stored. */
export function storeInWarehouse(w: Warehouse, id: string, units: number, quality: number): number {
  const fits = Math.min(units, freeSpace(w));
  if (fits <= 0) return 0;
  const have = w.stock[id] ?? 0;
  const q = w.stockQuality[id] ?? quality;
  w.stock[id] = have + fits;
  w.stockQuality[id] = Math.round((have * q + fits * quality) / (have + fits));
  return fits;
}

/** Keeps the priority list in step with the owner's restaurants in the city. */
export function syncPriority(st: GameState, p: Player, w: Warehouse): void {
  const mine = st.restaurants.filter((r) => r.ownerId === p.id && r.cityId === w.cityId).map((r) => r.id);
  w.priority = [...w.priority.filter((id) => mine.includes(id)), ...mine.filter((id) => !w.priority.includes(id))];
}

/** Morning: cold-store spoilage, arriving shipments, then each restaurant is topped up in priority order. */
export function warehouseMorning(st: GameState, addStock: (r: Restaurant, id: string, units: number, quality: number) => void): void {
  for (const p of st.players) {
    for (const w of Object.values(p.warehouses ?? {})) {
      for (const id of Object.keys(w.stock)) {
        w.stock[id] = Math.max(0, w.stock[id] * (1 - COLD_STORAGE / ingredient(id).shelfLife));
        if (w.stock[id] < 0.5) {
          delete w.stock[id];
          delete w.stockQuality[id];
        }
      }
    }
  }
  const arriving = (st.shipments ?? []).filter((s) => s.arriveDay <= st.day);
  st.shipments = (st.shipments ?? []).filter((s) => s.arriveDay > st.day);
  for (const s of arriving) {
    const p = st.players.find((x) => x.id === s.ownerId);
    const w = p ? warehouseIn(p, s.toCityId) : null;
    if (!p || !w) continue;
    for (const [id, units] of Object.entries(s.items)) storeInWarehouse(w, id, units, s.quality[id] ?? 50);
    if (p.isHuman) st.messages.push({ day: st.day, text: `A shipment from ${cityDef(s.fromCityId).name} arrived at your ${cityDef(s.toCityId).name} warehouse.` });
  }
  for (const p of st.players) {
    for (const w of Object.values(p.warehouses ?? {})) {
      syncPriority(st, p, w);
      for (const rid of w.priority) {
        const r = st.restaurants.find((x) => x.id === rid);
        if (!r) continue;
        for (const [id, need] of Object.entries(menuNeeds(st, r))) {
          const take = Math.min(need, w.stock[id] ?? 0);
          if (take <= 0) continue;
          addStock(r, id, take, w.stockQuality[id] ?? 50);
          w.stock[id] -= take;
          if (w.stock[id] < 0.5) delete w.stock[id];
        }
      }
    }
  }
}

/** Units of each menu ingredient a restaurant needs to reach its restock target. */
function menuNeeds(st: GameState, r: Restaurant): Record<string, number> {
  const needs: Record<string, number> = {};
  for (const m of r.menu) {
    const recipe = st.recipes.find((x) => x.id === m.recipeId);
    if (!recipe) continue;
    for (const id of Object.keys(recipeUsage(recipe))) {
      const missing = Math.floor(r.restockTarget - (r.stock[id] ?? 0));
      if (missing > 0) needs[id] = missing;
    }
  }
  return needs;
}

/** Sends stock to another of the owner's warehouses; it arrives after a couple of days. */
export function ship(st: GameState, p: Player, from: Warehouse, toCityId: string, id: string, units: number): string | null {
  const to = warehouseIn(p, toCityId);
  if (!to) return `You have no warehouse in ${cityDef(toCityId).name}.`;
  const amount = Math.min(units, Math.floor(from.stock[id] ?? 0));
  if (amount <= 0) return 'Nothing to ship.';
  const cost = Math.round(amount * SHIPPING_PER_UNIT * 100) / 100;
  if (p.cash < cost) return 'Not enough cash for the freight.';
  p.cash -= cost;
  p.ledger.push({ day: st.day, label: 'Freight', amount: -cost });
  from.stock[id] -= amount;
  if (from.stock[id] < 0.5) delete from.stock[id];
  (st.shipments ??= []).push({ id: st.nextId++, ownerId: p.id, fromCityId: from.cityId, toCityId, items: { [id]: amount }, quality: { [id]: from.stockQuality[id] ?? 50 }, arriveDay: st.day + SHIPPING_DAYS });
  return null;
}
