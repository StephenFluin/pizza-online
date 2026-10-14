import { Lot, PlacedItem, Restaurant } from './model';

export type ItemCategory = 'dining' | 'decor' | 'kitchen';

export interface CatalogItem {
  id: string;
  name: string;
  category: ItemCategory;
  /** Footprint in grid cells. */
  w: number;
  h: number;
  price: number;
  seats?: number;
  /** Pizzas per hour an oven can bake. */
  ovenCapacity?: number;
  /** Ambience points towards the restaurant's atmosphere. */
  ambience?: number;
  /** Prep counters gate how many ovens can be used. */
  counter?: boolean;
  fridge?: boolean;
  dishwasher?: boolean;
  /** Main colour used when drawing. */
  color: number;
}

export const CATALOG: readonly CatalogItem[] = [
  { id: 'table2', name: 'Table for two', category: 'dining', w: 1, h: 2, price: 250, seats: 2, color: 0xa0522d },
  { id: 'table4', name: 'Table for four', category: 'dining', w: 2, h: 2, price: 600, seats: 4, color: 0xa0522d },
  { id: 'table4-deluxe', name: 'Marble table for four', category: 'dining', w: 2, h: 2, price: 1400, seats: 4, ambience: 2, color: 0xe8e4dc },
  { id: 'booth', name: 'Leather booth', category: 'dining', w: 2, h: 2, price: 1600, seats: 4, ambience: 3, color: 0x7b2d26 },
  { id: 'bar', name: 'Bar counter with stools', category: 'dining', w: 3, h: 1, price: 1800, seats: 3, ambience: 2, color: 0x5c3a21 },
  { id: 'plant', name: 'Potted plant', category: 'decor', w: 1, h: 1, price: 150, ambience: 1, color: 0x2f8f3c },
  { id: 'lamp', name: 'Standing lamp', category: 'decor', w: 1, h: 1, price: 200, ambience: 1, color: 0xf7dc6f },
  { id: 'painting', name: 'Painting', category: 'decor', w: 1, h: 1, price: 600, ambience: 2, color: 0x457b9d },
  { id: 'statue', name: 'Marble statue', category: 'decor', w: 1, h: 1, price: 1500, ambience: 4, color: 0xdedede },
  { id: 'aquarium', name: 'Aquarium', category: 'decor', w: 2, h: 1, price: 2500, ambience: 6, color: 0x48cae4 },
  { id: 'jukebox', name: 'Jukebox', category: 'decor', w: 1, h: 1, price: 1800, ambience: 4, color: 0xe63946 },
  { id: 'oven', name: 'Electric oven', category: 'kitchen', w: 2, h: 1, price: 1500, ovenCapacity: 14, color: 0x8d99ae },
  { id: 'stone-oven', name: 'Wood-fired stone oven', category: 'kitchen', w: 2, h: 1, price: 4500, ovenCapacity: 24, ambience: 1, color: 0xb5651d },
  { id: 'counter', name: 'Prep counter', category: 'kitchen', w: 1, h: 1, price: 400, counter: true, color: 0xced4da },
  { id: 'fridge', name: 'Refrigerator', category: 'kitchen', w: 1, h: 1, price: 900, fridge: true, color: 0xf1faee },
  { id: 'dishwasher', name: 'Dishwasher', category: 'kitchen', w: 1, h: 1, price: 1100, dishwasher: true, color: 0xadb5bd },
];

/** Each prep counter keeps this many ovens busy. */
export const OVENS_PER_COUNTER = 2;
export const KITCHEN_ROWS = 2;
/** How many guests a seat serves per hour. */
export const TURNOVER_PER_SEAT = 1.5;
export const SELL_BACK = 0.5;

export function catalogItem(id: string): CatalogItem {
  return CATALOG.find((c) => c.id === id) ?? CATALOG[0];
}

/** Interior grid size: bigger properties give bigger rooms. */
export function roomSize(lot: Pick<Lot, 'w' | 'h'>): { cols: number; rows: number } {
  return { cols: lot.w * 4, rows: lot.h * 4 };
}

/** The doorway column(s) on the bottom row must stay clear. */
function isDoorway(cols: number, rows: number, x: number, y: number): boolean {
  return y === rows - 1 && (x === Math.floor(cols / 2) || x === Math.floor(cols / 2) - 1);
}

export function canPlace(layout: PlacedItem[], lot: Pick<Lot, 'w' | 'h'>, itemId: string, x: number, y: number, ignoreIndex = -1): boolean {
  const item = catalogItem(itemId);
  const { cols, rows } = roomSize(lot);
  if (x < 0 || y < 0 || x + item.w > cols || y + item.h > rows) return false;
  // Kitchen equipment stays behind the counter line, everything else in the dining room.
  const inKitchen = y + item.h <= KITCHEN_ROWS;
  const inDining = y >= KITCHEN_ROWS;
  if (item.category === 'kitchen' ? !inKitchen : !inDining) return false;
  for (let cy = y; cy < y + item.h; cy++) for (let cx = x; cx < x + item.w; cx++) if (isDoorway(cols, rows, cx, cy)) return false;
  return !layout.some((p, i) => {
    if (i === ignoreIndex) return false;
    const o = catalogItem(p.itemId);
    return x < p.x + o.w && x + item.w > p.x && y < p.y + o.h && y + item.h > p.y;
  });
}

/** Index of the placed item covering a cell, or -1. */
export function itemAt(layout: PlacedItem[], x: number, y: number): number {
  return layout.findIndex((p) => {
    const o = catalogItem(p.itemId);
    return x >= p.x && x < p.x + o.w && y >= p.y && y < p.y + o.h;
  });
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
}

export function roomStats(layout: PlacedItem[], lot: Pick<Lot, 'w' | 'h'>): RoomStats {
  let seats = 0;
  let oven = 0;
  let ovens = 0;
  let counters = 0;
  let ambience = 0;
  let fridge = false;
  let dishwashers = 0;
  let value = 0;
  for (const p of layout) {
    const it = catalogItem(p.itemId);
    seats += it.seats ?? 0;
    if (it.ovenCapacity) {
      oven += it.ovenCapacity;
      ovens++;
    }
    if (it.counter) counters++;
    ambience += it.ambience ?? 0;
    fridge ||= !!it.fridge;
    if (it.dishwasher) dishwashers++;
    value += it.price;
  }
  // Ovens beyond what the counters can feed sit idle.
  const usable = Math.min(ovens, counters * OVENS_PER_COUNTER);
  const kitchenCapacity = ovens === 0 ? 0 : (oven * usable) / ovens;
  const { cols, rows } = roomSize(lot);
  const diningCells = cols * (rows - KITCHEN_ROWS);
  const decor = Math.min(3, (ambience / diningCells) * 8);
  return { seats, kitchenCapacity, ovenCapacity: oven, counters, ambience, decor, fridge, dishwashers, value };
}

/** Recomputes the cached capacity fields on a restaurant after its layout changes. */
export function applyRoom(r: Restaurant, lot: Pick<Lot, 'w' | 'h'>): void {
  const s = roomStats(r.layout, lot);
  r.seats = s.seats;
  r.kitchenCapacity = s.kitchenCapacity;
  r.decor = s.decor;
}

/** A bare-bones fit-out every new restaurant starts with. */
export function starterLayout(lot: Pick<Lot, 'w' | 'h'>): PlacedItem[] {
  const layout: PlacedItem[] = [
    { itemId: 'oven', x: 0, y: 0 },
    { itemId: 'counter', x: 2, y: 0 },
  ];
  autoFurnish(layout, lot, ['table2'], 4);
  return layout;
}

/** Places up to `count` items of the given kinds wherever they fit, scanning row by row. */
export function autoFurnish(layout: PlacedItem[], lot: Pick<Lot, 'w' | 'h'>, itemIds: string[], count: number): number {
  const { cols, rows } = roomSize(lot);
  let placed = 0;
  for (const id of itemIds) {
    const it = catalogItem(id);
    // Leave a one-cell aisle between rows of tables.
    const stepY = it.category === 'dining' ? it.h + 1 : 1;
    const startY = it.category === 'kitchen' ? 0 : KITCHEN_ROWS + (it.category === 'dining' ? 1 : 0);
    for (let y = startY; y < rows && placed < count; y += stepY) {
      for (let x = 0; x < cols && placed < count; x += it.category === 'dining' ? it.w + 1 : 1) {
        if (canPlace(layout, lot, id, x, y)) {
          layout.push({ itemId: id, x, y });
          placed++;
        }
      }
    }
  }
  return placed;
}
