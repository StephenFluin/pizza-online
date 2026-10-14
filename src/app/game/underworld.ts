import { cityDef } from './data';
import { GameState, Player, Restaurant } from './model';
import { queueCall } from './inspections';
import { Rng, hashString } from './rng';

/**
 * The underworld, played for laughs: loan sharks, a fixer selling sabotage
 * goods, a local boss with jobs and "protection", and the police. Sabotage is
 * strictly non-violent (rats, stink bombs, glue, fake reviews). Names, prices
 * and texts are our own.
 */

// ---- Shared: trouble at a restaurant -----------------------------------------------

export type SabotageKind = 'rats' | 'stink' | 'glue' | 'reviews' | 'gas' | 'windows';

export const SABOTAGE: Record<SabotageKind, { label: string; effect: string; news: (r: string) => string }> = {
  rats: { label: 'Box of rats', effect: 'closed by health inspectors for 2 days, reputation down', news: (r) => `Health inspectors closed ${r} for two days after rats were found in the kitchen.` },
  stink: { label: 'Stink bombs', effect: 'guests stay away for 3 days', news: (r) => `A terrible smell is keeping diners away from ${r}.` },
  glue: { label: 'Superglue for the locks', effect: 'can’t open for a day', news: (r) => `Staff at ${r} couldn’t get in this morning: someone glued the locks.` },
  reviews: { label: 'Fake bad reviews', effect: 'reputation down sharply', news: (r) => `A flood of scathing reviews has hit ${r}. Nobody seems to know who wrote them.` },
  gas: { label: 'Gas cut-off', effect: 'kitchen out for 2 days', news: (r) => `${r} was without gas for two days after a “mysterious” fault.` },
  windows: { label: 'Broken windows', effect: 'closed for a day of repairs', news: (r) => `Vandals smashed the windows of ${r} overnight.` },
};

/** What a piece of sabotage does to a restaurant. */
export function applySabotage(st: GameState, r: Restaurant, kind: SabotageKind): void {
  const owner = st.players.find((p) => p.id === r.ownerId);
  switch (kind) {
    case 'rats':
      r.closedDays = Math.max(r.closedDays ?? 0, 2);
      r.reputation = Math.max(0, r.reputation - 0.08);
      break;
    case 'stink':
      (r.troubles ??= []).push({ points: -30, daysLeft: 3 });
      break;
    case 'glue':
      r.closedDays = Math.max(r.closedDays ?? 0, 1);
      break;
    case 'reviews':
      r.reputation = Math.max(0, r.reputation - 0.12);
      break;
    case 'gas':
      r.closedDays = Math.max(r.closedDays ?? 0, 2);
      break;
    case 'windows': {
      r.closedDays = Math.max(r.closedDays ?? 0, 1);
      const repair = Math.round(1500 * cityDef(r.cityId).costOfLiving);
      if (owner) {
        owner.cash -= repair;
        owner.ledger.push({ day: st.day, label: 'Repairs', amount: -repair });
      }
      break;
    }
  }
  st.messages.push({ day: st.day, text: SABOTAGE[kind].news(r.name) });
}

/** Popularity points from running troubles (stink bombs and the like). */
export function troublePoints(r: Restaurant): number {
  return (r.troubles ?? []).reduce((n, t) => n + t.points, 0);
}

// ---- Loan sharks -----------------------------------------------------------------

export interface SharkLoan {
  cityId: string;
  /** Total owed, interest included. */
  owed: number;
  dueDay: number;
  /** Missed deadlines; at three they take what they're owed. */
  strikes: number;
}

export const SHARK_WEEKLY = 0.05;
export const SHARK_WEEKS = 4;
export const SHARK_AMOUNTS = [5000, 20000, 50000];

export function borrowFromShark(st: GameState, p: Player, cityId: string, amount: number): string | null {
  if (p.shark) return 'You already owe us. Pay that first.';
  p.cash += amount;
  p.ledger.push({ day: st.day, label: 'Cash loan', amount });
  p.shark = { cityId, owed: Math.round(amount * (1 + SHARK_WEEKLY * SHARK_WEEKS)), dueDay: st.day + SHARK_WEEKS * 7, strikes: 0 };
  return null;
}

export function repayShark(st: GameState, p: Player): boolean {
  if (!p.shark || p.cash < p.shark.owed) return false;
  p.cash -= p.shark.owed;
  p.ledger.push({ day: st.day, label: 'Cash loan repaid', amount: -p.shark.owed });
  delete p.shark;
  return true;
}

/** More time, for a fee: another week and 10% more owed. */
export function extendShark(st: GameState, p: Player): void {
  if (!p.shark) return;
  p.shark.owed = Math.round(p.shark.owed * 1.1);
  p.shark.dueDay = st.day + 7;
  p.shark.strikes++;
}

/** Refusing to pay: a reprisal against one of the player's restaurants, and a strike. */
export function sharkReprisal(st: GameState, p: Player): void {
  if (!p.shark) return;
  p.shark.strikes++;
  p.shark.dueDay = st.day + 7;
  const targets = st.restaurants.filter((r) => r.ownerId === p.id);
  const target = targets[Math.floor(Math.random() * targets.length)];
  if (target) applySabotage(st, target, (['windows', 'rats', 'glue'] as const)[Math.floor(Math.random() * 3)]);
}

// ---- The fixer's black market ------------------------------------------------------

export const BLACK_MARKET: { kind: SabotageKind; base: number }[] = [
  { kind: 'rats', base: 1800 },
  { kind: 'stink', base: 600 },
  { kind: 'glue', base: 300 },
  { kind: 'reviews', base: 1200 },
  { kind: 'gas', base: 2500 },
];

/** Today's black-market price of an item in a city; prices wander day to day and differ between cities. */
export function fixerPrice(cityId: string, kind: SabotageKind, day: number): number {
  const item = BLACK_MARKET.find((b) => b.kind === kind)!;
  // A slow wave per city and item plus a little daily noise.
  const seed = hashString(`${cityId}:${kind}`);
  const wave = Math.sin(day / (9 + (seed % 7)) + (seed % 100)) * 0.3;
  const noise = (new Rng(seed ^ day).next() - 0.5) * 0.1;
  return Math.round((item.base * cityDef(cityId).costOfLiving * (1 + wave + noise)) / 10) * 10;
}

/** The fixer buys back at 80% of today's local price, so buying cheap in one city and selling dear in another pays. */
export const FIXER_BUYBACK = 0.8;

// ---- Sabotage by the player ---------------------------------------------------------

export interface SabotageResult {
  success: boolean;
  caught: boolean;
}

/**
 * Doing it yourself: dexterity makes success likelier, courage keeps your nerve
 * if things go wrong. Getting caught brings the police.
 */
export function attemptSabotage(st: GameState, p: Player, target: Restaurant, kind: SabotageKind, dexterity: number, courage: number, hired = false): SabotageResult {
  const successChance = hired ? 0.8 : 0.45 + (dexterity - 50) / 150;
  const success = Math.random() < successChance;
  if (success) applySabotage(st, target, kind);
  const caughtChance = hired ? 0.08 : success ? 0.12 * (1.5 - courage / 100) : 0.45 * (1.5 - courage / 100);
  const caught = Math.random() < caughtChance;
  if (caught) arrest(st, p, target.cityId, kind);
  return { success, caught };
}

// ---- Police -----------------------------------------------------------------------

/** A fine for small things, a few days in jail for repeat offenders. */
export function arrest(st: GameState, p: Player, cityId: string, kind: SabotageKind): void {
  p.record = (p.record ?? 0) + 1;
  const col = cityDef(cityId).costOfLiving;
  const fine = Math.round((4000 + p.record * 3000) * col);
  p.cash -= fine;
  p.ledger.push({ day: st.day, label: 'Police fine', amount: -fine });
  const jailDays = p.record >= 3 ? 3 + p.record : 0;
  if (jailDays) p.jailUntil = st.day + jailDays;
  if (p.isHuman) queueCall(st, { contactId: `${cityId}:police`, topic: 'police', amount: fine, title: SABOTAGE[kind].label, after: jailDays });
  else st.messages.push({ day: st.day, text: `Police caught ${p.name} behind the sabotage and fined them $${fine.toLocaleString('en-US')}.` });
}

export function inJail(st: GameState, p: Player | null | undefined): boolean {
  return !!p?.jailUntil && st.day < p.jailUntil;
}

/** Weekly protection money for a city: more restaurants, more to protect. */
export function protectionFee(st: GameState, p: Player, cityId: string): number {
  const shops = st.restaurants.filter((r) => r.ownerId === p.id && r.cityId === cityId).length;
  return Math.round(((250 + shops * 150) * cityDef(cityId).costOfLiving) / 10) * 10;
}

/** Each morning: loan shark deadlines, protection money and offers, troubles wearing off, release from jail. */
export function underworldMorning(st: GameState): void {
  const me = st.players.find((p) => p.isHuman);
  if (me) {
    const counts = new Map<string, number>();
    for (const r of st.restaurants.filter((x) => x.ownerId === me.id)) counts.set(r.cityId, (counts.get(r.cityId) ?? 0) + 1);
    for (const [cityId, n] of counts) {
      if (st.day % 7 === 0 && st.protection?.[cityId]) {
        const fee = protectionFee(st, me, cityId);
        me.cash -= fee;
        me.ledger.push({ day: st.day, label: 'Protection', amount: -fee });
      }
      // Once a chain is noticeable, the local boss makes an offer.
      st.protectionOffered ??= {};
      if (n >= 2 && !st.protectionOffered[cityId] && st.protection?.[cityId] === undefined) {
        st.protectionOffered[cityId] = true;
        queueCall(st, { contactId: `${cityId}:boss`, topic: 'protection', amount: protectionFee(st, me, cityId) });
      }
    }
  }
  for (const r of st.restaurants) {
    if (r.troubles) r.troubles = r.troubles.filter((t) => --t.daysLeft > 0);
  }
  for (const p of st.players) {
    if (p.jailUntil && st.day === p.jailUntil && p.isHuman) st.messages.push({ day: st.day, text: `${p.name} is out of jail and back at work.` });
    const shark = p.shark;
    if (!shark || st.day < shark.dueDay) continue;
    if (shark.strikes >= 3) {
      // Enough waiting: they take what they're owed, and then some trouble.
      const take = Math.min(Math.max(0, p.cash), shark.owed);
      p.cash -= take;
      p.ledger.push({ day: st.day, label: 'Collected by force', amount: -take });
      sharkReprisal(st, p);
      st.messages.push({ day: st.day, text: `Heavy-set men emptied your safe: $${Math.round(take).toLocaleString('en-US')} taken to settle your cash loan.` });
      delete p.shark;
    } else if (p.isHuman) {
      queueCall(st, { contactId: `${shark.cityId}:shark`, topic: 'shark', amount: shark.owed });
    }
  }
}

/** Rivals with nerve sometimes sabotage the leading player's restaurants. */
export function rivalMischief(st: GameState, rivalStats: (p: Player) => { courage: number; dexterity: number }): void {
  const me = st.players.find((p) => p.isHuman);
  if (!me) return;
  const mine = st.restaurants.filter((r) => r.ownerId === me.id);
  if (!mine.length) return;
  for (const rival of st.players.filter((p) => !p.isHuman)) {
    const stats = rivalStats(rival);
    // Bolder rivals try more often.
    if (Math.random() > 0.015 * (stats.courage / 50)) continue;
    const target = mine[Math.floor(Math.random() * mine.length)];
    if (st.protection?.[target.cityId]) {
      st.messages.push({ day: st.day, text: `Some suspicious characters were seen near ${target.name}, but they left in a hurry. Your protection is paying off.` });
      continue;
    }
    const kind = (['stink', 'reviews', 'glue', 'rats'] as const)[Math.floor(Math.random() * 4)];
    applySabotage(st, target, kind);
    if (Math.random() < 0.35) arrest(st, rival, target.cityId, kind);
  }
}
