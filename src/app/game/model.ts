/** Core game data model. All state is plain JSON so it can be saved and loaded. */

export type TileKind = 'grass' | 'road' | 'water' | 'park' | 'building' | 'lot';

export interface Tile {
  kind: TileKind;
  /** District index for non-road tiles, -1 otherwise. */
  district: number;
  /** Visual height/variant for buildings, 0..3. */
  variant: number;
}

export interface District {
  id: number;
  name: string;
  /** Residents living in the district. */
  population: number;
  /** 0 (poor) .. 1 (rich). Rich districts pay more and expect better food. */
  wealth: number;
  /** Ingredient id -> preference from -1 (hates) to 1 (loves). */
  tastes: Record<string, number>;
  /** Centre tile used for distance calculations. */
  cx: number;
  cy: number;
}

export interface Lot {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  district: number;
  /** Number of seats a restaurant here can hold. */
  seats: number;
  rentPerMonth: number;
  purchasePrice: number;
  /** Restaurant id when occupied. */
  restaurantId: number | null;
}

export interface CityMap {
  id: string;
  name: string;
  seed: number;
  width: number;
  height: number;
  tiles: Tile[];
  districts: District[];
  lots: Lot[];
}

export type StaffRole = 'cook' | 'waiter';

export interface Staff {
  id: number;
  name: string;
  role: StaffRole;
  /** 0..1 */
  skill: number;
  wagePerMonth: number;
}

/** A piece of furniture or kitchen equipment placed on the restaurant's floor grid. */
export interface PlacedItem {
  itemId: string;
  x: number;
  y: number;
}

export interface MenuItem {
  recipeId: string;
  price: number;
}

export interface Restaurant {
  id: number;
  ownerId: number;
  cityId: string;
  lotId: number;
  name: string;
  owned: boolean;
  /** 0..3 atmosphere level, derived from the furniture in `layout`. */
  decor: number;
  layout: PlacedItem[];
  /** Cached from `layout`: seats and pizzas per hour the kitchen can bake. */
  seats: number;
  kitchenCapacity: number;
  /** Monthly rent agreed with the realtor (0 when the property is owned). */
  rentPerMonth: number;
  staff: Staff[];
  menu: MenuItem[];
  /** Ingredient id -> units in stock. */
  stock: Record<string, number>;
  /** Ingredient id -> average quality (0–100) of the units in stock. */
  stockQuality: Record<string, number>;
  /** Vendor used for automatic restocking, per category (the last one ordered from). */
  preferredVendors: Partial<Record<IngredientCategory, string>>;
  /** 0..1 reputation, rises with satisfied customers. */
  reputation: number;
  /** Top stock up to `restockTarget` portions per used ingredient each morning. */
  autoRestock: boolean;
  restockTarget: number;
  /** Stats for the day in progress and the last finished day. */
  today: DayStats;
  lastDay: DayStats;
  /** Finished days, newest last, for trends in the end-of-day report. */
  history: DayStats[];
}

export interface DayStats {
  customers: number;
  turnedAway: number;
  revenue: number;
  /** Sum of satisfaction (0..1) over served customers. */
  satisfaction: number;
  /** Why customers were turned away, for player feedback. */
  noStaff: number;
  noStock: number;
  /** Guests lost because the kitchen, the waiters or the seats were the bottleneck. */
  lostKitchen: number;
  lostFloor: number;
  lostSeats: number;
  /** Ingredient cost of the pizzas actually served. */
  foodCost: number;
  /** Recipe id -> how often it was wanted and served. */
  pizzas: Record<string, PizzaSales>;
  /** Ingredient id -> guests whose favourite pizza couldn't be made because it ran out. */
  missing: Record<string, number>;
  /** Most guests the restaurant could have served today (for utilisation). */
  capacity: number;
  /** Day number these stats belong to. */
  day: number;
  /** Reputation at closing time. */
  reputation: number;
}

export interface PizzaSales {
  ordered: number;
  sold: number;
  revenue: number;
  cost: number;
}

/** How finely a topping piece is cut: whole, chopped or minced. */
export type Cut = 0 | 1 | 2;

export interface Topping {
  ingredient: string;
  /** Cut of this piece; older recipes without it are whole. */
  cut?: Cut;
  /** Position relative to the pizza centre, in units of the radius (-1..1). */
  x: number;
  y: number;
  rotation: number;
}

export interface Recipe {
  id: string;
  name: string;
  ownerId: number | null;
  sauce: boolean;
  cheese: boolean;
  toppings: Topping[];
}

/** Stock categories, as on the original's stock screen. */
export type IngredientCategory = 'vegetables' | 'meat' | 'fruit' | 'cheese';

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  /** Cost of one portion at the market. */
  cost: number;
  /** Shelf life in days. */
  shelfLife: number;
  color: number;
  shape: 'circle' | 'slice' | 'leaf' | 'strip' | 'cube' | 'ring';
  /** Grams per piece when whole, chopped and minced; 0 means it can't be cut that finely. */
  grams: [number, number, number];
  /** Calories per 100 g. */
  calories: number;
  /** How strongly it flavours a pizza, 1–10. */
  intensity: number;
  /** Flavour profile, each 0–10. */
  fat: number;
  sweet: number;
  salty: number;
  hot: number;
  herb?: boolean;
}

export interface LedgerEntry {
  day: number;
  label: string;
  amount: number;
}

export interface Player {
  id: number;
  name: string;
  /** Id from the character cast; decides portrait and perk. */
  characterId: string;
  color: number;
  isHuman: boolean;
  cash: number;
  loan: number;
  ledger: LedgerEntry[];
  ads: AdCampaign[];
}

export type AdChannel = 'flyers' | 'posters' | 'newspaper' | 'tv';

/** A running advertising campaign; one per channel per city. */
export interface AdCampaign {
  cityId: string;
  channel: AdChannel;
  daysLeft: number;
  /** Effectiveness in percent. Half the city's total feeds restaurant popularity. */
  effectiveness: number;
  /** Total paid for the campaign. */
  cost: number;
  flyers?: number;
  posterId?: number;
  slogan?: string[];
  format?: number;
  tvId?: number;
}

export interface GameState {
  version: 1;
  seed: number;
  /** Days since the game started. */
  day: number;
  /** Minutes since midnight of the current day. */
  minute: number;
  currentCityId: string;
  cities: CityMap[];
  players: Player[];
  restaurants: Restaurant[];
  recipes: Recipe[];
  nextId: number;
  messages: GameMessage[];
  /** Set when the game has been decided. */
  outcome: 'won' | 'lost' | null;
  /** Stock orders waiting for delivery. */
  orders: StockOrder[];
  /** Vendor id -> total the human player has spent there ("so far" on the vendor list). */
  vendorSpend: Record<string, number>;
}

/** Ingredients ordered from a vendor, delivered on the morning of `deliverDay`. */
export interface StockOrder {
  id: number;
  restaurantId: number;
  vendorId: string;
  /** Ingredient id -> units. */
  items: Record<string, number>;
  /** Price agreed when ordering; charged on delivery. */
  total: number;
  deliverDay: number;
}

export interface GameMessage {
  day: number;
  text: string;
}

export const START_YEAR = 1994;
export const DAYS_PER_MONTH = 30;
export const OPEN_MINUTE = 11 * 60;
export const CLOSE_MINUTE = 23 * 60;

export function formatDate(day: number): string {
  const month = Math.floor(day / DAYS_PER_MONTH);
  const year = START_YEAR + Math.floor(month / 12);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${(day % DAYS_PER_MONTH) + 1} ${names[month % 12]} ${year}`;
}

export function formatTime(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatMoney(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(amount)).toLocaleString('en-US')}`;
}
