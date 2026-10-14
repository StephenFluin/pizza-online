import { cityDef } from './data';
import { catalogItem } from './furniture';
import { GameState, Player, Restaurant } from './model';

/**
 * Loans with repayment schedules, and insurance against the risks of running
 * restaurants: burglary, kitchen fires and food-poisoning claims (plus staff
 * theft). Numbers and texts are our own.
 */

export interface Loan {
  id: number;
  principal: number;
  remaining: number;
  termMonths: number;
  monthsLeft: number;
}

export type InsuranceType = 'theft' | 'fire' | 'liability';

export const POLICIES: Record<InsuranceType, { label: string; covers: string; premiumPerRestaurant: number }> = {
  theft: { label: 'Theft cover', covers: 'burglaries and staff theft', premiumPerRestaurant: 150 },
  fire: { label: 'Fire cover', covers: 'kitchen fire damage', premiumPerRestaurant: 250 },
  liability: { label: 'Liability cover', covers: 'food-poisoning claims', premiumPerRestaurant: 200 },
};

export const LOAN_TERMS = [12, 24, 36];
export const MONTHLY_INTEREST = 0.01;

export function totalDebt(p: Player): number {
  return (p.loans ?? []).reduce((n, l) => n + l.remaining, 0);
}

export function takeLoan(st: GameState, p: Player, amount: number, termMonths: number): void {
  (p.loans ??= []).push({ id: st.nextId++, principal: amount, remaining: amount, termMonths, monthsLeft: termMonths });
  p.loan = totalDebt(p);
}

/** Pays off a loan early (as much as cash allows); returns the amount paid. */
export function repayLoan(p: Player, loanId: number): number {
  const loan = p.loans?.find((l) => l.id === loanId);
  if (!loan) return 0;
  const pay = Math.min(loan.remaining, Math.max(0, p.cash));
  loan.remaining -= pay;
  p.cash -= pay;
  if (loan.remaining <= 0.5) p.loans = p.loans!.filter((l) => l.id !== loanId);
  p.loan = totalDebt(p);
  return pay;
}

/** Month end: interest and the scheduled slice of principal on every loan. */
export function monthlyLoanPayments(st: GameState, p: Player, ledger: (label: string, amount: number) => void): void {
  for (const loan of [...(p.loans ?? [])]) {
    const interest = Math.round(loan.remaining * MONTHLY_INTEREST);
    const principal = Math.min(loan.remaining, Math.round(loan.remaining / Math.max(1, loan.monthsLeft)));
    if (interest > 0) ledger('Loan interest', -interest);
    if (principal > 0) ledger('Loan repayment', -principal);
    loan.remaining -= principal;
    loan.monthsLeft--;
    if (loan.remaining <= 0.5 || loan.monthsLeft <= 0) p.loans = p.loans!.filter((l) => l.id !== loan.id);
  }
  p.loan = totalDebt(p);
}

/** Monthly premium for a policy for this player's chain. */
export function premium(st: GameState, p: Player, type: InsuranceType): number {
  const shops = st.restaurants.filter((r) => r.ownerId === p.id);
  const col = shops.length ? shops.reduce((n, r) => n + cityDef(r.cityId).costOfLiving, 0) / shops.length : 1;
  return Math.round(POLICIES[type].premiumPerRestaurant * Math.max(1, shops.length) * col);
}

export function insured(p: Player, type: InsuranceType): boolean {
  return !!p.insurance?.[type];
}

/** Each morning: things that can go wrong at a restaurant, and what insurance pays. */
export function morningRisks(st: GameState): void {
  for (const r of st.restaurants) {
    if (r.closedDays) r.closedDays--;
    const owner = st.players.find((p) => p.id === r.ownerId);
    if (!owner) continue;
    const col = cityDef(r.cityId).costOfLiving;
    const say = (text: string) => owner.isHuman && st.messages.push({ day: st.day, text });
    const charge = (label: string, amount: number, covered: boolean) => {
      owner.cash -= amount;
      owner.ledger.push({ day: st.day, label, amount: -amount });
      if (covered) {
        owner.cash += amount;
        owner.ledger.push({ day: st.day, label: 'Insurance payout', amount });
      }
    };

    if (Math.random() < 0.003) {
      const amount = Math.round((500 + Math.random() * 1500) * col);
      charge('Burglary', amount, insured(owner, 'theft'));
      say(`Burglars broke into ${r.name} overnight and took $${amount}.${insured(owner, 'theft') ? ' Your theft cover pays it back.' : ' You weren’t insured.'}`);
    }

    // Wood-fired ovens burn hotter; fires close the restaurant for repairs.
    const ovens = r.layout.filter((p) => catalogItem(p.itemId).ovenCapacity);
    const stone = ovens.filter((p) => catalogItem(p.itemId).kind === 'stone-oven').length;
    if (ovens.length && Math.random() < 0.0012 * (1 + stone)) {
      const amount = Math.round((3000 + Math.random() * 5000) * col);
      r.closedDays = 2;
      charge('Fire damage', amount, insured(owner, 'fire'));
      say(`A kitchen fire at ${r.name}! It's closed for two days of repairs costing $${amount}.${insured(owner, 'fire') ? ' Your fire cover pays for the damage.' : ' You weren’t insured.'}`);
    }

    // Cheap or old stock makes food poisoning more likely.
    const quality = avgStockQuality(r);
    if (r.lastDay.customers > 0 && Math.random() < 0.0015 * (1 + Math.max(0, 60 - quality) / 30)) {
      const amount = Math.round((2000 + Math.random() * 8000) * col);
      r.reputation = Math.max(0, r.reputation - 0.1);
      charge('Compensation claim', amount, insured(owner, 'liability'));
      say(`A guest fell ill after eating at ${r.name} and is suing for $${amount}. The story is in the papers.${insured(owner, 'liability') ? ' Your liability cover pays the claim.' : ' You weren’t insured.'}`);
    }
  }
}

function avgStockQuality(r: Restaurant): number {
  const ids = Object.keys(r.stock);
  if (!ids.length) return 60;
  let total = 0;
  let units = 0;
  for (const id of ids) {
    total += (r.stockQuality[id] ?? 50) * r.stock[id];
    units += r.stock[id];
  }
  return units ? total / units : 60;
}
