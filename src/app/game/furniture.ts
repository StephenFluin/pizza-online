import { CustomerGroup, Lot, PlacedItem, Restaurant } from './model';

/**
 * Restaurant fit-out. As in the original, furniture, flooring, extras and
 * kitchen equipment come from different stores, each with a quality and its
 * own appeal to each customer group; tables and chairs are separate pieces and
 * a chair only seats a guest when it stands against a table. All stores, item
 * lines and numbers here are our own.
 */

export type StoreKind = 'furniture' | 'flooring' | 'extras' | 'kitchen';
export type ItemKind =
  | 'table-small'
  | 'table-large'
  | 'chair'
  | 'booth'
  | 'bar'
  | 'plant'
  | 'lamp'
  | 'painting'
  | 'statue'
  | 'aquarium'
  | 'jukebox'
  | 'arcade'
  | 'oven'
  | 'stone-oven'
  | 'counter'
  | 'fridge'
  | 'dishwasher';

export type FurnitureStyle = 'rustic' | 'bistro' | 'modern' | 'luxury';

export interface Store {
  id: string;
  kind: StoreKind;
  name: string;
  /** 0–100. */
  quality: number;
  /** How much each customer group likes this store's style, 0–9. */
  ratings: Record<CustomerGroup, number>;
  style: FurnitureStyle;
  /** Palette used when drawing: [main, accent, trim]. */
  colors: [number, number, number];
}

export interface CatalogItem {
  id: string;
  storeId: string;
  kind: ItemKind;
  name: string;
  /** Footprint in grid cells. */
  w: number;
  h: number;
  price: number;
  quality: number;
  /** Fixed seats (booths, bars); tables seat as many chairs as stand against them, up to `maxChairs`. */
  seats?: number;
  maxChairs?: number;
  ovenCapacity?: number;
  ambience?: number;
  counter?: boolean;
  fridge?: boolean;
  dishwasher?: boolean;
}

export interface FloorType {
  id: string;
  storeId: string;
  name: string;
  /** Price per grid cell of dining room floor. */
  pricePerCell: number;
  quality: number;
  pattern: 'tiles' | 'checker' | 'planks' | 'terrazzo' | 'carpet';
  colors: [number, number];
}

const R = (children: number, young: number, blueCollar: number, whiteCollar: number, business: number, seniors: number): Record<CustomerGroup, number> => ({
  children,
  young,
  blueCollar,
  whiteCollar,
  business,
  seniors,
});

export const STORES: readonly Store[] = [
  { id: 'timber', kind: 'furniture', name: 'Timber & Twine', quality: 45, ratings: R(5, 4, 8, 3, 2, 6), style: 'rustic', colors: [0x8b5a2b, 0xd9b26f, 0x5c3a21] },
  { id: 'bistro', kind: 'furniture', name: 'Bistro Classics', quality: 62, ratings: R(4, 4, 5, 6, 5, 8), style: 'bistro', colors: [0x2f3e46, 0xf1faee, 0xa3283a] },
  { id: 'nordlicht', kind: 'furniture', name: 'Nordlicht Design', quality: 76, ratings: R(4, 9, 3, 7, 6, 2), style: 'modern', colors: [0xf2efe9, 0x48cae4, 0x6c757d] },
  { id: 'palazzo', kind: 'furniture', name: 'Palazzo Interiors', quality: 92, ratings: R(2, 3, 2, 7, 9, 6), style: 'luxury', colors: [0x5c1a1b, 0xe9c46a, 0x2b2d42] },
  { id: 'used-tiles', kind: 'flooring', name: 'Second-hand Tiles', quality: 20, ratings: R(2, 1, 3, 0, 0, 1), style: 'rustic', colors: [0xbfb8a5, 0x9c9480, 0x000000] },
  { id: 'checker', kind: 'flooring', name: 'Checkerboard Co.', quality: 45, ratings: R(7, 6, 5, 3, 2, 5), style: 'bistro', colors: [0xf1faee, 0x1d1d1d, 0x000000] },
  { id: 'oakpine', kind: 'flooring', name: 'Oak & Pine Floors', quality: 65, ratings: R(5, 5, 6, 6, 5, 8), style: 'rustic', colors: [0xc89b6d, 0xb5835a, 0x000000] },
  { id: 'terrazzo', kind: 'flooring', name: 'Terrazzo Masters', quality: 85, ratings: R(3, 6, 2, 8, 9, 5), style: 'luxury', colors: [0xe9e4dc, 0xb7aea2, 0x000000] },
  { id: 'plush', kind: 'flooring', name: 'Plush Carpets', quality: 72, ratings: R(6, 3, 4, 6, 6, 9), style: 'bistro', colors: [0x7b2d26, 0x9d4b44, 0x000000] },
  { id: 'greenthumb', kind: 'extras', name: 'Green Thumb Plants', quality: 60, ratings: R(5, 6, 4, 7, 7, 8), style: 'modern', colors: [0x2f8f3c, 0x8b5a2b, 0x5a9a4c] },
  { id: 'gallery', kind: 'extras', name: 'Gallery Row', quality: 80, ratings: R(3, 5, 2, 8, 9, 7), style: 'luxury', colors: [0x457b9d, 0xc9a227, 0xdedede] },
  { id: 'arcade', kind: 'extras', name: 'Jukebox Junction', quality: 55, ratings: R(9, 9, 6, 3, 1, 2), style: 'modern', colors: [0xe63946, 0xffd166, 0x3a0ca3] },
  { id: 'chefline', kind: 'kitchen', name: 'ChefLine Equipment', quality: 50, ratings: R(0, 0, 0, 0, 0, 0), style: 'modern', colors: [0xadb5bd, 0x343a40, 0xff6b35] },
  { id: 'forno', kind: 'kitchen', name: 'Forno Artigiano', quality: 85, ratings: R(0, 0, 0, 0, 0, 0), style: 'rustic', colors: [0xb5651d, 0x6b3b2a, 0xff6b35] },
  { id: 'cooltech', kind: 'kitchen', name: 'CoolTech Appliances', quality: 70, ratings: R(0, 0, 0, 0, 0, 0), style: 'modern', colors: [0xf1faee, 0x868e96, 0x48cae4] },
];

/** Every furniture store sells the same pieces in its own style and price band. */
function furnitureLine(s: Store): CatalogItem[] {
  const k = 0.5 + s.quality / 60;
  const item = (kind: ItemKind, name: string, w: number, h: number, base: number, extra: Partial<CatalogItem> = {}): CatalogItem => ({
    id: `${s.id}:${kind}`,
    storeId: s.id,
    kind,
    name,
    w,
    h,
    price: Math.round((base * k) / 10) * 10,
    quality: s.quality,
    ...extra,
  });
  return [
    item('table-small', 'Small table', 3, 3, 120, { maxChairs: 2, ambience: 0.2 }),
    item('table-large', 'Large table', 6, 3, 220, { maxChairs: 6, ambience: 0.3 }),
    item('chair', 'Chair', 2, 2, 45, { ambience: 0.1 }),
    item('booth', 'Booth for four', 6, 5, 700, { seats: 4, ambience: 1 }),
    item('bar', 'Bar with stools', 8, 3, 900, { seats: 4, ambience: 1 }),
  ];
}

export const CATALOG: readonly CatalogItem[] = [
  ...STORES.filter((s) => s.kind === 'furniture').flatMap(furnitureLine),
  { id: 'greenthumb:plant', storeId: 'greenthumb', kind: 'plant', name: 'Potted palm', w: 2, h: 2, price: 150, quality: 60, ambience: 1 },
  { id: 'greenthumb:lamp', storeId: 'greenthumb', kind: 'lamp', name: 'Standing lamp', w: 2, h: 2, price: 180, quality: 60, ambience: 1 },
  { id: 'gallery:painting', storeId: 'gallery', kind: 'painting', name: 'Framed painting', w: 3, h: 2, price: 600, quality: 80, ambience: 2 },
  { id: 'gallery:statue', storeId: 'gallery', kind: 'statue', name: 'Marble statue', w: 2, h: 2, price: 1500, quality: 90, ambience: 4 },
  { id: 'gallery:aquarium', storeId: 'gallery', kind: 'aquarium', name: 'Aquarium', w: 5, h: 2, price: 2400, quality: 85, ambience: 5 },
  { id: 'arcade:jukebox', storeId: 'arcade', kind: 'jukebox', name: 'Jukebox', w: 2, h: 2, price: 1700, quality: 60, ambience: 3 },
  { id: 'arcade:arcade', storeId: 'arcade', kind: 'arcade', name: 'Arcade cabinet', w: 2, h: 2, price: 2200, quality: 55, ambience: 3 },
  { id: 'chefline:oven', storeId: 'chefline', kind: 'oven', name: 'Electric oven', w: 4, h: 3, price: 1500, quality: 50, ovenCapacity: 14 },
  { id: 'chefline:counter', storeId: 'chefline', kind: 'counter', name: 'Prep counter', w: 3, h: 3, price: 400, quality: 50, counter: true },
  { id: 'chefline:dishwasher', storeId: 'chefline', kind: 'dishwasher', name: 'Dishwasher', w: 3, h: 3, price: 1100, quality: 50, dishwasher: true },
  { id: 'forno:stone-oven', storeId: 'forno', kind: 'stone-oven', name: 'Wood-fired stone oven', w: 5, h: 4, price: 4500, quality: 85, ovenCapacity: 24, ambience: 1 },
  { id: 'forno:counter', storeId: 'forno', kind: 'counter', name: 'Marble prep counter', w: 3, h: 3, price: 900, quality: 85, counter: true, ambience: 0.5 },
  { id: 'cooltech:fridge', storeId: 'cooltech', kind: 'fridge', name: 'Refrigerator', w: 3, h: 3, price: 900, quality: 70, fridge: true },
  { id: 'cooltech:oven', storeId: 'cooltech', kind: 'oven', name: 'Convection oven', w: 4, h: 3, price: 2600, quality: 70, ovenCapacity: 18 },
];

export const FLOORS: readonly FloorType[] = [
  { id: 'used-tiles:tiles', storeId: 'used-tiles', name: 'Worn tiles', pricePerCell: 1, quality: 20, pattern: 'tiles', colors: [0xbfb8a5, 0x9c9480] },
  { id: 'checker:checker', storeId: 'checker', name: 'Black and white checks', pricePerCell: 4, quality: 45, pattern: 'checker', colors: [0xf1faee, 0x2b2b2b] },
  { id: 'oakpine:planks', storeId: 'oakpine', name: 'Oak planks', pricePerCell: 7, quality: 65, pattern: 'planks', colors: [0xc89b6d, 0xb5835a] },
  { id: 'terrazzo:terrazzo', storeId: 'terrazzo', name: 'Polished terrazzo', pricePerCell: 14, quality: 85, pattern: 'terrazzo', colors: [0xe9e4dc, 0xb7aea2] },
  { id: 'plush:carpet', storeId: 'plush', name: 'Burgundy carpet', pricePerCell: 9, quality: 72, pattern: 'carpet', colors: [0x7b2d26, 0x9d4b44] },
];

export const DEFAULT_FLOOR = 'used-tiles:tiles';
/** Each prep counter keeps this many ovens busy. */
export const OVENS_PER_COUNTER = 2;
/** How many guests a seat serves per hour. */
export const TURNOVER_PER_SEAT = 1.5;
export const SELL_BACK = 0.5;
/** Grid cells per city tile, so bigger lots give bigger rooms. */
const CELLS_X = 16;
const CELLS_Y = 12;
/** Rows behind the counter line that form the kitchen. */
export const KITCHEN_ROWS = 7;

export function store(id: string): Store {
  return STORES.find((s) => s.id === id) ?? STORES[0];
}

export function catalogItem(id: string): CatalogItem {
  return CATALOG.find((c) => c.id === id) ?? CATALOG[0];
}

export function floorType(id: string | undefined): FloorType {
  return FLOORS.find((f) => f.id === id) ?? FLOORS[0];
}

export function isKitchenItem(it: CatalogItem): boolean {
  return store(it.storeId).kind === 'kitchen';
}

export function roomSize(lot: Pick<Lot, 'w' | 'h'>): { cols: number; rows: number } {
  return { cols: lot.w * CELLS_X, rows: lot.h * CELLS_Y };
}

/** Dining room cells, for pricing a new floor. */
export function diningCells(lot: Pick<Lot, 'w' | 'h'>): number {
  const { cols, rows } = roomSize(lot);
  return cols * (rows - KITCHEN_ROWS);
}

/** The doorway at the bottom centre must stay clear. */
function isDoorway(cols: number, rows: number, x: number, y: number): boolean {
  const mid = Math.floor(cols / 2);
  return y >= rows - 2 && x >= mid - 2 && x < mid + 2;
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function canPlace(layout: PlacedItem[], lot: Pick<Lot, 'w' | 'h'>, itemId: string, x: number, y: number, ignoreIndex = -1): boolean {
  const item = catalogItem(itemId);
  const { cols, rows } = roomSize(lot);
  if (x < 0 || y < 0 || x + item.w > cols || y + item.h > rows) return false;
  // Kitchen equipment stays behind the counter line, everything else in the dining room.
  if (isKitchenItem(item) ? y + item.h > KITCHEN_ROWS : y < KITCHEN_ROWS) return false;
  for (let cy = y; cy < y + item.h; cy++) for (let cx = x; cx < x + item.w; cx++) if (isDoorway(cols, rows, cx, cy)) return false;
  const rect = { x, y, w: item.w, h: item.h };
  return !layout.some((p, i) => {
    if (i === ignoreIndex) return false;
    const o = catalogItem(p.itemId);
    return overlaps(rect, { x: p.x, y: p.y, w: o.w, h: o.h });
  });
}

/** Index of the placed item covering a cell, or -1. */
export function itemAt(layout: PlacedItem[], x: number, y: number): number {
  return layout.findIndex((p) => {
    const o = catalogItem(p.itemId);
    return x >= p.x && x < p.x + o.w && y >= p.y && y < p.y + o.h;
  });
}

/** Chairs touching each table (sharing an edge), each chair counted for one table only. */
export function seatingPlan(layout: PlacedItem[]): { seats: number; seatedChairs: Set<number> } {
  const seatedChairs = new Set<number>();
  let seats = 0;
  layout.forEach((p, i) => {
    const it = catalogItem(p.itemId);
    if (it.seats) seats += it.seats;
    if (!it.maxChairs) return;
    let used = 0;
    // A chair "touches" a table when its rectangle borders the table's, grown by one cell.
    const halo = { x: p.x - 1, y: p.y - 1, w: it.w + 2, h: it.h + 2 };
    layout.forEach((c, j) => {
      if (used >= it.maxChairs! || seatedChairs.has(j)) return;
      const ci = catalogItem(c.itemId);
      if (ci.kind !== 'chair') return;
      if (overlaps(halo, { x: c.x, y: c.y, w: ci.w, h: ci.h })) {
        seatedChairs.add(j);
        used++;
      }
    });
    seats += used;
  });
  return { seats, seatedChairs };
}

export interface RoomStats {
  seats: number;
  kitchenCapacity: number;
  ovenCapacity: number;
  counters: number;
  ambience: number;
  /** 0..3 atmosphere level used by the customer model. */
  decor: number;
  fridge: boolean;
  dishwashers: number;
  value: number;
  /** How much each customer group likes the look of the room, 0–9. */
  groupAppeal: Record<CustomerGroup, number>;
}

/** Daily running cost of each kind of piece (power, gas, water, upkeep), before the city's cost of living. */
const RUNNING_COST: Partial<Record<ItemKind, number>> = {
  oven: 16,
  'stone-oven': 12,
  fridge: 6,
  dishwasher: 7,
  counter: 2,
  bar: 3,
  jukebox: 3,
  arcade: 4,
  aquarium: 3,
  lamp: 1,
};
/** Cleaning, linen, water and lights for the dining room, per seat per day. */
const RUNNING_PER_SEAT = 2.5;
const RUNNING_BASE = 25;

/** What a pizzeria costs to keep running for a day it's open, in dollars. */
export function runningCost(layout: PlacedItem[], seats: number, costOfLiving: number): number {
  const equipment = layout.reduce((n, p) => n + (RUNNING_COST[catalogItem(p.itemId).kind] ?? 0), 0);
  return Math.round((RUNNING_BASE + seats * RUNNING_PER_SEAT + equipment) * costOfLiving);
}

export function roomStats(layout: PlacedItem[], lot: Pick<Lot, 'w' | 'h'>, floorId?: string): RoomStats {
  let oven = 0;
  let ovens = 0;
  let counters = 0;
  let ambience = 0;
  let fridge = false;
  let dishwashers = 0;
  let value = 0;
  // Group appeal is the quality-weighted average of the stores' ratings over visible items.
  const appeal: Record<CustomerGroup, number> = R(0, 0, 0, 0, 0, 0);
  let appealWeight = 0;
  const addAppeal = (s: Store, weight: number) => {
    for (const g of Object.keys(appeal) as CustomerGroup[]) appeal[g] += s.ratings[g] * weight;
    appealWeight += weight;
  };
  for (const p of layout) {
    const it = catalogItem(p.itemId);
    if (it.ovenCapacity) {
      oven += it.ovenCapacity;
      ovens++;
    }
    if (it.counter) counters++;
    // Quality makes the same piece contribute more atmosphere.
    ambience += (it.ambience ?? 0) * (0.5 + it.quality / 100);
    fridge ||= !!it.fridge;
    if (it.dishwasher) dishwashers++;
    value += it.price;
    if (!isKitchenItem(it)) addAppeal(store(it.storeId), it.w * it.h);
  }
  const floor = floorType(floorId);
  const cells = diningCells(lot);
  addAppeal(store(floor.storeId), cells * 0.3);
  ambience += (floor.quality / 100) * (cells / 60);

  const usable = Math.min(ovens, counters * OVENS_PER_COUNTER);
  const kitchenCapacity = ovens === 0 ? 0 : (oven * usable) / ovens;
  const decor = Math.min(3, (ambience / cells) * 60);
  for (const g of Object.keys(appeal) as CustomerGroup[]) appeal[g] = appealWeight ? Math.round((appeal[g] / appealWeight) * 10) / 10 : 0;
  return { seats: seatingPlan(layout).seats, kitchenCapacity, ovenCapacity: oven, counters, ambience, decor, fridge, dishwashers, value, groupAppeal: appeal };
}

/** Recomputes the cached capacity fields on a restaurant after its layout changes. */
export function applyRoom(r: Restaurant, lot: Pick<Lot, 'w' | 'h'>): void {
  const s = roomStats(r.layout, lot, r.floorId);
  r.seats = s.seats;
  r.kitchenCapacity = s.kitchenCapacity;
  r.decor = s.decor;
}

/** Places a table with chairs around it at the first free spot; returns the pieces placed. */
export function placeDiningSet(layout: PlacedItem[], lot: Pick<Lot, 'w' | 'h'>, tableId: string, chairId: string, chairs: number): PlacedItem[] {
  const table = catalogItem(tableId);
  const chair = catalogItem(chairId);
  const { cols, rows } = roomSize(lot);
  for (let y = KITCHEN_ROWS + 3; y + table.h + 2 <= rows; y += 2) {
    for (let x = 2; x + table.w + 2 <= cols; x += 2) {
      if (!canPlace(layout, lot, tableId, x, y)) continue;
      // Chairs above and below the table, spread along its length.
      const spots: { x: number; y: number }[] = [];
      const perSide = Math.max(1, Math.ceil(chairs / 2));
      for (let i = 0; i < perSide; i++) {
        const cx = x + Math.round(((i + 0.5) * table.w) / perSide - chair.w / 2);
        spots.push({ x: cx, y: y - chair.h }, { x: cx, y: y + table.h });
      }
      const trial = [...layout, { itemId: tableId, x, y }];
      const placed: PlacedItem[] = [{ itemId: tableId, x, y }];
      for (const s of spots.slice(0, chairs)) {
        if (canPlace(trial, lot, chairId, s.x, s.y)) {
          trial.push({ itemId: chairId, x: s.x, y: s.y });
          placed.push({ itemId: chairId, x: s.x, y: s.y });
        }
      }
      if (placed.length - 1 < Math.min(chairs, 2)) continue;
      layout.push(...placed);
      return placed;
    }
  }
  return [];
}

/** Places single items (decor, kitchen kit) at the first free spots; returns what was placed. */
export function autoPlace(layout: PlacedItem[], lot: Pick<Lot, 'w' | 'h'>, itemId: string, count: number): PlacedItem[] {
  const it = catalogItem(itemId);
  const { cols, rows } = roomSize(lot);
  const placed: PlacedItem[] = [];
  const startY = isKitchenItem(it) ? 0 : KITCHEN_ROWS;
  for (let y = startY; y < rows && placed.length < count; y++) {
    for (let x = 0; x < cols && placed.length < count; x++) {
      if (canPlace(layout, lot, itemId, x, y)) {
        const p = { itemId, x, y };
        layout.push(p);
        placed.push(p);
      }
    }
  }
  return placed;
}

/** A bare-bones fit-out every new restaurant starts with: one oven and counter, four small tables for two. */
export function starterLayout(lot: Pick<Lot, 'w' | 'h'>): PlacedItem[] {
  const layout: PlacedItem[] = [
    { itemId: 'chefline:oven', x: 0, y: 0 },
    { itemId: 'chefline:counter', x: 5, y: 0 },
  ];
  for (let i = 0; i < 4; i++) placeDiningSet(layout, lot, 'timber:table-small', 'timber:chair', 2);
  return layout;
}

/** True when a layout was made with the current catalogue (older saves used other ids). */
export function layoutIsCurrent(layout: PlacedItem[]): boolean {
  return layout.every((p) => CATALOG.some((c) => c.id === p.itemId));
}
