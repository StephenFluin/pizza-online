import { CITIES } from './data';
import { GameState } from './model';
import { addMessage } from './simulation';

/** Bankruptcy threshold checked at the end of each month. */
export const BANKRUPT_AT = -20000;

export interface CityStanding {
  cityId: string;
  /** Owner id -> guests served yesterday in this city. */
  guests: Map<number, number>;
  leaderId: number | null;
}

/** Who is serving the most guests in each city. */
export function standings(st: GameState): CityStanding[] {
  return CITIES.map((c) => {
    const guests = new Map<number, number>();
    for (const r of st.restaurants) {
      if (r.cityId === c.id) guests.set(r.ownerId, (guests.get(r.ownerId) ?? 0) + r.lastDay.customers);
    }
    let leaderId: number | null = null;
    let best = 0;
    for (const [id, n] of guests) {
      if (n > best) {
        best = n;
        leaderId = id;
      }
    }
    return { cityId: c.id, guests, leaderId };
  });
}

/** Decides win/loss at month end: lead every city to win, sink too deep into debt to lose. */
export function checkOutcome(st: GameState): void {
  if (st.outcome) return;
  const human = st.players.find((p) => p.isHuman);
  if (!human) return;
  if (human.cash < BANKRUPT_AT) {
    st.outcome = 'lost';
    addMessage(st, 'The bank has called in your debts. Your pizza empire is bankrupt.');
    return;
  }
  const led = standings(st).filter((s) => s.leaderId === human.id).length;
  if (led === CITIES.length) {
    st.outcome = 'won';
    addMessage(st, `${human.name} runs the most popular pizza chain in every city. You win!`);
  }
}
