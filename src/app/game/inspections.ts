import { cityDef } from './data';
import { roomStats } from './furniture';
import { GameState, Restaurant } from './model';
import { recipeQuality } from './recipes';

/**
 * The mayor's quality inspections and phone calls. Inspectors rate each
 * restaurant now and then and award or take away one star at a time; the mayor
 * phones the owner about the result, city projects, complaints and awards.
 * Numbers and texts are our own.
 */

export type IncomingTopic = 'inspection' | 'donation' | 'complaint' | 'award';

/** A call waiting for the player to answer; the clock pauses while one is ringing. */
export interface IncomingCall {
  id: number;
  /** Phone-book contact who is calling (see contacts.ts). */
  contactId: string;
  topic: IncomingTopic;
  restaurantId?: number;
  /** Topic details: the stars before and after, an amount of money, an award title. */
  before?: number;
  after?: number;
  amount?: number;
  title?: string;
}

const FIRST_INSPECTION_AFTER = 14;
const INSPECTION_EVERY = [30, 45];

/** Quality rating (0–100) an inspector gives: how happy guests leave, the menu's craft quality and the atmosphere. */
export function qualityRating(st: GameState, r: Restaurant): number {
  const days = (r.history ?? []).slice(-7);
  const served = days.reduce((n, d) => n + d.customers, 0);
  const satisfaction = served ? days.reduce((n, d) => n + d.satisfaction, 0) / served : 0;
  const recipes = r.menu.map((m) => st.recipes.find((x) => x.id === m.recipeId)).filter((x): x is NonNullable<typeof x> => !!x);
  const craft = recipes.length ? recipes.reduce((n, x) => n + recipeQuality(x), 0) / recipes.length : 0;
  const lot = st.cities.find((c) => c.id === r.cityId)?.lots[r.lotId];
  const decor = lot ? roomStats(r.layout, lot, r.floorId).decor / 3 : 0;
  return Math.round(satisfaction * 55 + craft * 30 + decor * 15);
}

/** Stars move one at a time: up above stars×14+30, down below stars×14+12, so a rating doesn't flicker. */
export function inspect(stars: number, rating: number): number {
  if (rating > stars * 14 + 30 && stars < 5) return stars + 1;
  if (rating < stars * 14 + 12 && stars > 0) return stars - 1;
  return stars;
}

function mayorId(cityId: string): string {
  return `${cityId}:mayor`;
}

export function queueCall(st: GameState, call: Omit<IncomingCall, 'id'>): void {
  st.phoneQueue ??= [];
  // One call per topic and restaurant at a time.
  if (st.phoneQueue.some((c) => c.topic === call.topic && c.restaurantId === call.restaurantId && c.contactId === call.contactId)) return;
  st.phoneQueue.push({ id: st.nextId++, ...call });
}

/** Each morning: due inspections, and now and then a request or complaint from city hall. */
export function mayorMorning(st: GameState): void {
  for (const r of st.restaurants) {
    const owner = st.players.find((p) => p.id === r.ownerId);
    if (!owner) continue;
    r.nextInspection ??= st.day + FIRST_INSPECTION_AFTER;
    if (st.day >= r.nextInspection && (r.history?.length ?? 0) >= 3) {
      const before = r.stars ?? 0;
      const rating = qualityRating(st, r);
      r.qualityRating = rating;
      r.stars = inspect(before, rating);
      r.nextInspection = st.day + INSPECTION_EVERY[0] + Math.floor(Math.random() * (INSPECTION_EVERY[1] - INSPECTION_EVERY[0]));
      if (owner.isHuman) queueCall(st, { contactId: mayorId(r.cityId), topic: 'inspection', restaurantId: r.id, before, after: r.stars });
    }
  }

  const me = st.players.find((p) => p.isHuman);
  if (!me) return;
  const myCities = [...new Set(st.restaurants.filter((r) => r.ownerId === me.id).map((r) => r.cityId))];
  for (const cityId of myCities) {
    const col = cityDef(cityId).costOfLiving;
    // Roughly every two months each mayor asks for help with a project.
    if (Math.random() < 1 / 60) queueCall(st, { contactId: mayorId(cityId), topic: 'donation', amount: Math.round(((2 + Math.floor(Math.random() * 4)) * 1000 * col) / 500) * 500 });
    // Residents sometimes complain, more often about badly run restaurants.
    for (const r of st.restaurants.filter((x) => x.ownerId === me.id && x.cityId === cityId)) {
      if (Math.random() < 0.004 * (1.5 - r.reputation)) queueCall(st, { contactId: mayorId(cityId), topic: 'complaint', restaurantId: r.id, amount: Math.round((800 * col) / 100) * 100 });
    }
  }
}

export const PROJECTS = ['a new playground in the park', 'repairs to the old town hall clock', 'the summer street festival', 'a fountain on the market square', 'new benches along the river', 'the children’s hospital appeal'];
export const COMPLAINTS = ['the noise from your kitchen extractor late at night', 'pizza boxes blowing down the street', 'delivery scooters parked on the pavement', 'the smell of burnt cheese drifting into their flats', 'queues blocking the entrance to the bakery next door'];
