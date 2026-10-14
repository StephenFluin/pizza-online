import { Look } from './characters';
import { FIRST_NAMES, LAST_NAMES, cityDef } from './data';
import { randomLook } from './contacts';
import { GameState, Player, Restaurant, formatMoney } from './model';
import { haggleBonus, ingredientPriceFactor, statsOf } from './owner-stats';
import { Rng, hashString } from './rng';
import { Vendor, vendorById, vendorPrice } from './vendors';

/**
 * Supplier contracts: a standing daily delivery from one vendor to one
 * restaurant at a locked-in price, negotiated with the vendor's sales rep.
 * The opening offer depends on how much business you've done with them; you
 * then argue over the discount, the delivery fee, the penalty for walking
 * away and the length of the deal until you sign or the rep runs out of
 * patience.
 */

export interface SupplyContract {
  id: number;
  vendorId: string;
  restaurantId: number;
  /** Ingredient id -> units delivered every morning. */
  items: Record<string, number>;
  /** List price of one day's delivery when signed; locked for the whole term. */
  dailyValue: number;
  /** Share off the list price, 0..MAX_DISCOUNT. */
  discount: number;
  /** Charged on every delivery. */
  fee: number;
  /** Owed to the vendor for cancelling early. */
  penalty: number;
  term: number;
  daysLeft: number;
  /** Days in a row the owner couldn't pay; the vendor walks away after a few. */
  unpaid?: number;
}

/** What a player and a vendor have been through together. */
export interface SupplierRelation {
  contracts: number;
  /** 0..100: grows with finished contracts, shrinks with cancellations and broken payments. */
  goodwill: number;
  /** Deliveries this vendor failed to make under a contract. */
  missed: number;
  /** The rep won't talk again before this day after losing patience. */
  sulkUntil?: number;
}

export interface Terms {
  discount: number;
  fee: number;
  penalty: number;
  term: number;
  dailyValue: number;
}

export const MAX_DISCOUNT = 0.4;
export const MIN_TERM = 7;
export const MAX_TERM = 84;
/** Arguments the rep sits through before ending the call. */
export const PATIENCE = 6;
/** Spend with a vendor that makes you a customer they'd hate to lose. */
const BIG_CUSTOMER = 15000;

export type Argument = 'discount' | 'fee' | 'penalty' | 'longer' | 'shorter' | 'late';

export const ARGUMENTS: { id: Argument; label: string }[] = [
  { id: 'discount', label: 'The discount is too small' },
  { id: 'fee', label: 'I won’t pay a delivery fee' },
  { id: 'penalty', label: 'The penalty clause is too steep' },
  { id: 'longer', label: 'Make it a longer deal' },
  { id: 'shorter', label: 'Make it a shorter deal' },
  { id: 'late', label: 'Your deliveries have let me down' },
];

export interface SalesRep {
  name: string;
  look: Look;
  /** 0 (soft touch) .. 1 (hard bargainer). */
  toughness: number;
}

/** The vendor's sales rep, stable per game. */
export function salesRep(v: Vendor, seed: number): SalesRep {
  const rng = new Rng(hashString(`rep:${v.id}`) ^ seed);
  return { name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`, look: randomLook(rng), toughness: rng.range(0.15, 0.85) };
}

/** The relation with a vendor for updating, created on first contact. */
export function relation(p: Player, vendorId: string): SupplierRelation {
  p.suppliers ??= {};
  return (p.suppliers[vendorId] ??= newRelation());
}

/** The relation with a vendor for reading, without touching the state. */
export function relationOf(p: Player, vendorId: string): SupplierRelation {
  return p.suppliers?.[vendorId] ?? newRelation();
}

function newRelation(): SupplierRelation {
  return { contracts: 0, goodwill: 20, missed: 0 };
}

/** List price of a day's delivery today, or null if the vendor doesn't stock something asked for. */
export function dailyListPrice(st: GameState, v: Vendor, items: Record<string, number>): number | null {
  let total = 0;
  for (const [id, units] of Object.entries(items)) {
    if (units <= 0) continue;
    const price = vendorPrice(v, id, st.day);
    if (price === null) return null;
    total += price * units;
  }
  return Math.round(total * 100) / 100;
}

/** Smallest daily delivery a vendor signs a contract for: a tenth of its one-off minimum. */
export function contractMinimum(v: Vendor): number {
  return Math.round(v.minimumOrder / 10);
}

/** The rep's first offer: newcomers get little off and a stiff penalty; regulars and big orders do better. */
export function openingTerms(st: GameState, p: Player, v: Vendor, dailyValue: number): Terms {
  const rel = relationOf(p, v.id);
  const spent = st.vendorSpend[v.id] ?? 0;
  const size = Math.min(4, dailyValue / Math.max(1, contractMinimum(v)) / 2);
  const loyal = rel.contracts > 0;
  const discount = Math.min(MAX_DISCOUNT, loyal ? 0.03 + size * 0.02 + rel.goodwill / 500 : 0.02 + size * 0.01);
  const fee = spent >= BIG_CUSTOMER ? 0 : Math.round((2 + dailyValue * 0.04) * cityDef(v.cityId).costOfLiving);
  return { discount: round2(discount), fee, penalty: Math.round(dailyValue * (loyal ? 4 : 7)), term: 28, dailyValue };
}

export interface Reply {
  /** What the rep says. */
  text: string;
  terms: Terms;
  /** Patience used up by this argument. */
  strain: number;
  /** The rep hangs up. */
  ended?: boolean;
}

/**
 * The rep's answer to an argument. Success depends on the owner's charisma and
 * intelligence, the rep's toughness, how far the terms have already moved and
 * how worn out the rep is; repeating yourself or bluffing costs patience.
 */
export function argue(st: GameState, p: Player, v: Vendor, rep: SalesRep, terms: Terms, arg: Argument, used: Argument[], strain: number, rng: () => number = Math.random): Reply {
  const t = { ...terms };
  const repeats = used.filter((a) => a === arg).length;
  const odds = 0.55 + haggleBonus(statsOf(p)) - rep.toughness * 0.35 - strain * 0.05 - repeats * 0.15;
  const finish = (reply: Reply): Reply => {
    const total = strain + reply.strain;
    if (total >= PATIENCE) return { ...reply, text: `${reply.text} Look, I’ve got other customers. Call me another day.`, ended: true };
    return reply;
  };

  switch (arg) {
    case 'discount': {
      if (t.discount >= MAX_DISCOUNT - 0.005) return finish({ text: 'Any lower and I’d be paying you to take it. No.', terms: t, strain: 2 });
      if (rng() < odds) {
        t.discount = round2(Math.min(MAX_DISCOUNT, t.discount + 0.03 + rng() * 0.04));
        return finish({ text: `Alright, alright. ${pct(t.discount)} off, and that’s generous.`, terms: t, strain: 1 });
      }
      return finish({ text: repeats ? 'You said that already. The answer hasn’t changed.' : 'Those are already our best prices, believe me.', terms: t, strain: repeats ? 2 : 1 });
    }
    case 'fee': {
      if (t.fee === 0) return finish({ text: 'There is no fee. Did you even read the terms?', terms: t, strain: 1 });
      if (rng() < odds + 0.1) {
        t.fee = rng() < 0.5 ? 0 : Math.round(t.fee / 2);
        return finish({ text: t.fee === 0 ? 'Fine, we’ll waive the delivery fee.' : `I can halve it to ${formatMoney(t.fee)}. That’s fuel money.`, terms: t, strain: 1 });
      }
      return finish({ text: 'The vans don’t run on goodwill. The fee stays.', terms: t, strain: 2 });
    }
    case 'penalty': {
      const floor = Math.round(t.dailyValue);
      if (t.penalty <= floor) return finish({ text: 'That penalty barely covers our paperwork as it is.', terms: t, strain: 1 });
      if (rng() < odds + 0.05) {
        t.penalty = Math.max(floor, Math.round(t.penalty * 0.6));
        return finish({ text: `We can bring the cancellation penalty down to ${formatMoney(t.penalty)}.`, terms: t, strain: 1 });
      }
      return finish({ text: 'If you plan to keep the deal, the penalty shouldn’t worry you.', terms: t, strain: 1 });
    }
    case 'longer': {
      if (t.term >= MAX_TERM) return finish({ text: `${MAX_TERM / 7} weeks is as far ahead as we plan.`, terms: t, strain: 1 });
      t.term = Math.min(MAX_TERM, t.term + 14);
      t.discount = round2(Math.min(MAX_DISCOUNT, t.discount + 0.01));
      return finish({ text: `Now we’re talking. ${t.term} days, and I’ll knock another point off.`, terms: t, strain: 0 });
    }
    case 'shorter': {
      if (t.term <= MIN_TERM) return finish({ text: 'A week is the shortest deal we do.', terms: t, strain: 1 });
      t.term = Math.max(MIN_TERM, t.term - 7);
      t.discount = round2(Math.max(0, t.discount - 0.01));
      return finish({ text: `${t.term} days it is, but the discount shrinks a little.`, terms: t, strain: 0 });
    }
    case 'late': {
      const rel = relationOf(p, v.id);
      // Only works when it's true: the vendor is unreliable or has let you down before.
      if (rel.missed > 0 || v.missChance > 0.08) {
        if (used.includes('late')) return finish({ text: 'I heard you the first time.', terms: t, strain: 2 });
        t.discount = round2(Math.min(MAX_DISCOUNT, t.discount + 0.04));
        return finish({ text: `I can’t argue with that. Let me make it up to you: ${pct(t.discount)} off.`, terms: t, strain: 1 });
      }
      return finish({ text: 'We’ve never missed a delivery for you. Don’t try that with me.', terms: t, strain: 3 });
    }
  }
}

/** Signs a contract; the first delivery comes tomorrow morning. */
export function signContract(st: GameState, p: Player, v: Vendor, r: Restaurant, items: Record<string, number>, terms: Terms): SupplyContract {
  const contract: SupplyContract = {
    id: st.nextId++,
    vendorId: v.id,
    restaurantId: r.id,
    items: Object.fromEntries(Object.entries(items).filter(([, n]) => n > 0)),
    dailyValue: terms.dailyValue,
    discount: terms.discount,
    fee: terms.fee,
    penalty: terms.penalty,
    term: terms.term,
    daysLeft: terms.term,
  };
  (p.contracts ??= []).push(contract);
  r.preferredVendors[v.category] = v.id;
  return contract;
}

/** What one delivery costs the owner. */
export function deliveryCost(c: Pick<SupplyContract, 'dailyValue' | 'discount' | 'fee'>, p: Player): number {
  return Math.round((c.dailyValue * (1 - c.discount) * ingredientPriceFactor(statsOf(p)) + c.fee) * 100) / 100;
}

/** Ends a contract early; the penalty is paid there and then. */
export function cancelContract(st: GameState, p: Player, contractId: number, pay: (amount: number) => void): string | null {
  const c = p.contracts?.find((x) => x.id === contractId);
  if (!c) return null;
  pay(c.penalty);
  p.contracts = p.contracts!.filter((x) => x.id !== contractId);
  const rel = relation(p, c.vendorId);
  rel.goodwill = Math.max(0, rel.goodwill - 20);
  return `${vendorById(st, c.vendorId)?.name ?? 'The vendor'} tore up the contract. Cancellation penalty: ${formatMoney(c.penalty)}.`;
}

export interface ContractHooks {
  addStock: (r: Restaurant, id: string, units: number, quality: number) => void;
  charge: (p: Player, amount: number, label: string) => void;
  message: (text: string) => void;
  canPay: (p: Player, amount: number) => boolean;
}

/** Each morning: contract deliveries, missed deliveries (the vendor pays a forfeit) and contracts running out. */
export function contractsMorning(st: GameState, hooks: ContractHooks): void {
  for (const p of st.players) {
    if (!p.contracts?.length) continue;
    for (const c of [...p.contracts]) {
      const r = st.restaurants.find((x) => x.id === c.restaurantId);
      const v = vendorById(st, c.vendorId);
      if (!r || !v || r.ownerId !== p.id) {
        p.contracts = p.contracts.filter((x) => x !== c);
        continue;
      }
      const rel = relation(p, v.id);
      if (Math.random() < v.missChance) {
        // A missed delivery costs the vendor a tenth of the day's value.
        const forfeit = Math.round(c.dailyValue * 0.1);
        rel.missed++;
        hooks.charge(p, -forfeit, 'Supplier forfeits');
        if (p.isHuman) hooks.message(`${v.name} missed today’s contract delivery to ${r.name} and pays you ${formatMoney(forfeit)} for the trouble.`);
      } else {
        const cost = deliveryCost(c, p);
        if (hooks.canPay(p, cost)) {
          for (const [id, units] of Object.entries(c.items)) hooks.addStock(r, id, units, v.quality);
          hooks.charge(p, cost, 'Ingredients');
          st.vendorSpend[v.id] = (st.vendorSpend[v.id] ?? 0) + (p.isHuman ? cost : 0);
          c.unpaid = 0;
        } else {
          c.unpaid = (c.unpaid ?? 0) + 1;
          rel.goodwill = Math.max(0, rel.goodwill - 5);
          if (c.unpaid >= 3) {
            p.contracts = p.contracts.filter((x) => x !== c);
            rel.goodwill = Math.max(0, rel.goodwill - 20);
            if (p.isHuman) hooks.message(`${v.name} has cancelled your contract for ${r.name} after three unpaid deliveries.`);
            continue;
          }
          if (p.isHuman) hooks.message(`${v.name} held back today’s delivery to ${r.name}: you couldn’t cover ${formatMoney(cost)}.`);
        }
      }
      if (--c.daysLeft <= 0) {
        p.contracts = p.contracts.filter((x) => x !== c);
        rel.contracts++;
        rel.goodwill = Math.min(100, rel.goodwill + 15);
        if (p.isHuman) hooks.message(`Your contract with ${v.name} for ${r.name} has run its course. Call them to agree a new one.`);
      }
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
