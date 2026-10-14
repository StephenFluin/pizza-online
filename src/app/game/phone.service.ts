import { Injectable, inject, signal } from '@angular/core';
import { MAX_FAVOUR, favour } from './awards';
import { COMPLAINTS, IncomingCall, PROJECTS } from './inspections';
import { recipeQuality } from './recipes';
import { BLACK_MARKET, FIXER_BUYBACK, protectionFee, SABOTAGE, SHARK_AMOUNTS, SHARK_WEEKLY, SHARK_WEEKS, SabotageKind, borrowFromShark, extendShark, fixerPrice, inJail, repayShark, sharkReprisal } from './underworld';
import { InsuranceType, LOAN_TERMS, MONTHLY_INTEREST, POLICIES, insured, premium } from './insurance';
import { creditLimit, haggleBonus, statsOf } from './owner-stats';
import { Contact, cityContacts, weeklySpecial } from './contacts';
import { cityDef, ingredient } from './data';
import { GameService, LOAN_STEP, MAX_LOAN } from './game.service';
import { Restaurant, formatMoney } from './model';
import { addLedger, addMessage, addStock, openRestaurantAt } from './simulation';

export interface CallLine {
  from: 'them' | 'me';
  text: string;
}

export interface CallOption {
  id: string;
  label: string;
}

export interface Call {
  contact: Contact;
  lotId: number | null;
  /** Restaurant the call is about (supplier and staff agency calls). */
  restaurantId: number | null;
  lines: CallLine[];
  options: CallOption[];
  haggles: number;
  /** Set when this is a call someone made to the player. */
  incoming?: IncomingCall;
  /** Amount being borrowed while the term is chosen. */
  pendingLoan?: number;
  /** Fraction knocked off the asking rent/price so far. */
  discount: number;
  ended: boolean;
}

const BULK_PORTIONS = 100;

/**
 * Runs phone conversations. Calls connect immediately (no dialling); each reply the
 * player picks advances a small scripted conversation that can change the game state.
 */
@Injectable({ providedIn: 'root' })
export class PhoneService {
  private readonly game = inject(GameService);
  readonly call = signal<Call | null>(null);

  contacts(): Contact[] {
    const st = this.game.state();
    return st ? cityContacts(st.currentCityId, st.seed) : [];
  }

  /** Connects to a contact, optionally about a specific lot (realtors). */
  connect(contact: Contact, lotId: number | null = null): void {
    const call: Call = { contact, lotId, restaurantId: null, lines: [], options: [], haggles: 0, discount: 0, ended: false };
    this.call.set(call);
    const st = this.game.state();
    if (st && inJail(st, this.game.human())) {
      this.say(call, 'A guard takes the receiver out of your hand. “No calls from the cells.”');
      this.end(call);
      return;
    }
    this.greet(call);
  }

  hangUp(): void {
    const incoming = this.call()?.incoming;
    this.call.set(null);
    if (incoming) this.game.finishIncomingCall(incoming.id);
  }

  /** The oldest call ringing for the player, if any. */
  ringing(): IncomingCall | null {
    return this.game.state()?.phoneQueue?.[0] ?? null;
  }

  /** Who is on the line for a ringing call. */
  caller(incoming: IncomingCall): Contact | null {
    const st = this.game.state();
    if (!st) return null;
    return cityContacts(incoming.contactId.split(':')[0], st.seed).find((c) => c.id === incoming.contactId) ?? null;
  }

  /** Picks up a ringing call. */
  answer(incoming: IncomingCall): void {
    const contact = this.caller(incoming);
    if (!contact) {
      this.game.finishIncomingCall(incoming.id);
      return;
    }
    const call: Call = { contact, lotId: null, restaurantId: incoming.restaurantId ?? null, lines: [], options: [], haggles: 0, discount: 0, ended: false, incoming };
    this.call.set(call);
    this.incomingGreeting(call, incoming);
  }

  choose(optionId: string): void {
    const call = this.call();
    if (!call || call.ended) return;
    const option = call.options.find((o) => o.id === optionId);
    if (option) call.lines.push({ from: 'me', text: option.label });
    if (call.incoming) {
      this.incomingReply(call, call.incoming, optionId);
      this.call.set({ ...call });
      return;
    }
    switch (call.contact.kind) {
      case 'realtor': this.realtor(call, optionId); break;
      case 'bank': this.bank(call, optionId); break;
      case 'supplier': this.supplier(call, optionId); break;
      case 'agency': this.agency(call, optionId); break;
      case 'mayor': this.mayor(call, optionId); break;
      case 'insurance': this.insurance(call, optionId); break;
      case 'shark': this.shark(call, optionId); break;
      case 'fixer': this.fixer(call, optionId); break;
      case 'boss': this.boss(call, optionId); break;
      default: this.end(call);
    }
    this.call.set({ ...call });
  }

  private greet(call: Call): void {
    const c = call.contact;
    const hello = `${c.company}, ${c.name.split(' ')[0]} speaking.`;
    switch (c.kind) {
      case 'realtor':
        if (call.lotId !== null) this.say(call, `${hello} ${this.lotPitch(call)}`);
        else this.say(call, `${hello} Which of our properties are you interested in?`);
        this.realtorOptions(call);
        break;
      case 'bank':
        this.say(call, `${hello} ${this.bankStatus()} How can I help?`);
        this.bankOptions(call);
        break;
      case 'supplier': {
        const sp = weeklySpecial(c.cityId, this.game.state()!.day);
        this.say(call, `${hello} This week we have ${ingredient(sp.ingredientId).name.toLowerCase()} at ${Math.round(this.supplierDiscount(sp.discount) * 100)}% off. Fancy a delivery?`);
        this.supplierOptions(call);
        break;
      }
      case 'agency':
        this.say(call, `${hello} Looking for good people? Which restaurant needs staff?`);
        this.agencyOptions(call);
        break;
      case 'insurance':
        this.say(call, `${hello} Burglars, fires, lawsuits: one call and you can sleep at night. What can I cover for you?`);
        this.insuranceOptions(call);
        break;
      case 'shark':
        this.say(call, `Yeah? ${c.name.split(' ')[0]}. Need cash fast? No forms, no questions. Just don't be late paying it back.`);
        this.sharkOptions(call);
        break;
      case 'fixer':
        this.say(call, `You didn't get this number from me. What do you need?`);
        this.fixerOptions(call);
        break;
      case 'boss':
        this.say(call, `So, the pizza people. ${c.company} looks after this part of town. Things can happen to restaurants that nobody looks after…`);
        this.bossOptions(call);
        break;
      case 'police':
        this.say(call, `${c.name}, City Police. Unless you're reporting a crime, I'm busy.`);
        call.options = [{ id: 'bye', label: 'Sorry, wrong number.' }];
        break;
      case 'mayor':
        this.say(call, `${c.company}, ${c.name.split(' ')[0]} speaking. ${this.mayorMood(call)}`);
        this.mayorOptions(call);
        break;
    }
  }

  // ---- Realtor -------------------------------------------------------------

  private lotPitch(call: Call): string {
    const lot = this.lot(call);
    const city = this.game.city();
    if (!lot || !city) return '';
    if (lot.restaurantId !== null) return 'I’m afraid that property has already been let.';
    const district = city.districts[lot.district];
    return `The place in ${district.name} has room for ${lot.seats} seats. Rent is ${formatMoney(this.rent(call))} a month, or ${formatMoney(this.price(call))} to buy.`;
  }

  private realtorOptions(call: Call): void {
    const lot = this.lot(call);
    if (!lot) {
      // Phone-book call: list the free lots this agency handles in the current city.
      const city = this.game.city();
      const mine = (city?.lots ?? []).filter((l) => l.restaurantId === null && cityContacts(city!.id, this.game.state()!.seed)[l.id % 3].id === call.contact.id);
      call.options = [
        ...mine.slice(0, 6).map((l) => ({ id: `lot:${l.id}`, label: `The ${l.seats}-seat place in ${city!.districts[l.district].name}` })),
        { id: 'bye', label: 'Never mind, goodbye.' },
      ];
      return;
    }
    if (lot.restaurantId !== null) {
      call.options = [{ id: 'bye', label: 'Pity. Goodbye.' }];
      return;
    }
    call.options = [
      ...(call.haggles < 3 ? [{ id: 'haggle', label: 'Surely you can do better than that?' }] : []),
      { id: 'rent', label: `I'll sign the lease at ${formatMoney(this.rent(call))} a month.` },
      { id: 'buy', label: `I'll buy it for ${formatMoney(this.price(call))}.` },
      { id: 'bye', label: 'I need to think about it. Goodbye.' },
    ];
  }

  private realtor(call: Call, optionId: string): void {
    if (optionId.startsWith('lot:')) {
      call.lotId = Number(optionId.slice(4));
      this.game.selectLot(call.lotId);
      this.say(call, this.lotPitch(call));
      this.realtorOptions(call);
      return;
    }
    switch (optionId) {
      case 'haggle': {
        call.haggles++;
        const me = this.game.human();
        const bonus = haggleBonus(statsOf(me));
        const chance = 0.7 - call.contact.toughness * 0.45 + bonus - (call.haggles - 1) * 0.2;
        if (Math.random() < chance && call.discount < 0.25) {
          call.discount = Math.min(0.25, call.discount + 0.04 + Math.random() * (0.05 + Math.max(0, bonus) * 0.12));
          this.say(call, `You drive a hard bargain. ${formatMoney(this.rent(call))} a month, or ${formatMoney(this.price(call))} to buy. Final offer.`);
        } else if (call.haggles >= 3) {
          this.say(call, 'I have other clients waiting. Call me when you are serious.');
          this.end(call);
          return;
        } else {
          this.say(call, 'That is already a very fair price for this neighbourhood.');
        }
        this.realtorOptions(call);
        return;
      }
      case 'rent':
      case 'buy': {
        const buy = optionId === 'buy';
        const amount = buy ? this.price(call) : this.rent(call);
        const me = this.game.human();
        if (!me || me.cash < amount) {
          this.say(call, buy ? 'Your bank says you can’t cover the purchase. Perhaps a loan first?' : 'You’ll need the first month’s rent as a deposit. Call me when you have it.');
          this.realtorOptions(call);
          return;
        }
        let opened: Restaurant | null = null;
        this.game.mutate((st) => (opened = openRestaurantAt(st, st.currentCityId, call.lotId!, me.id, buy, amount)));
        if (opened) {
          this.say(call, buy ? 'Congratulations, it’s all yours. I’ll send the deeds over.' : 'Wonderful! The lease is signed and the keys are on their way.');
          this.game.selectLot(call.lotId);
        } else {
          this.say(call, 'Oh dear, someone else has just signed for it.');
        }
        this.end(call);
        return;
      }
      default:
        this.say(call, 'Goodbye!');
        this.end(call);
    }
  }

  // ---- Bank ----------------------------------------------------------------

  private bankStatus(): string {
    const me = this.game.human();
    if (!me) return '';
    return `Your balance is ${formatMoney(me.cash)} and you owe us ${formatMoney(me.loan)}.`;
  }

  private bankOptions(call: Call): void {
    const me = this.game.human();
    const debt = me?.loan ?? 0;
    const opts: CallOption[] = [];
    if (call.pendingLoan) {
      // Second step of borrowing: how long to pay it back over.
      call.options = [
        ...LOAN_TERMS.map((m) => ({ id: `term:${m}`, label: `Over ${m} months, please (about ${formatMoney(Math.round(call.pendingLoan! / m + call.pendingLoan! * MONTHLY_INTEREST))} a month at first).` })),
        { id: 'cancel', label: 'Actually, never mind.' },
      ];
      return;
    }
    if (debt + LOAN_STEP <= MAX_LOAN) opts.push({ id: 'borrow:1', label: `I'd like to borrow ${formatMoney(LOAN_STEP)}.` });
    if (debt + LOAN_STEP * 5 <= MAX_LOAN) opts.push({ id: 'borrow:5', label: `I'd like to borrow ${formatMoney(LOAN_STEP * 5)}.` });
    for (const l of me?.loans ?? []) opts.push({ id: `repay:${l.id}`, label: `Pay off the ${formatMoney(l.principal)} loan early (${formatMoney(l.remaining)} left, ${l.monthsLeft} months to go).` });
    opts.push({ id: 'rate', label: 'What are your terms?' }, { id: 'bye', label: 'That’s all, thank you.' });
    call.options = opts;
  }

  private bank(call: Call, optionId: string): void {
    const me = this.game.human();
    if (!me) return;
    if (optionId.startsWith('borrow:')) {
      const amount = LOAN_STEP * Number(optionId.slice(7));
      // The bank looks at your business before lending.
      const shops = this.game.state()!.restaurants.filter((r) => r.ownerId === me.id).length;
      if (me.loan + amount > creditLimit(statsOf(me), shops)) {
        this.say(call, 'I’m sorry, with your current business we can’t lend that much. Open more restaurants and ask again.');
      } else {
        call.pendingLoan = amount;
        this.say(call, `Certainly. Over how long would you like to repay the ${formatMoney(amount)}?`);
      }
    } else if (optionId.startsWith('term:')) {
      const months = Number(optionId.slice(5));
      const amount = call.pendingLoan ?? 0;
      call.pendingLoan = undefined;
      this.game.borrow(amount, months);
      this.say(call, `Done. ${formatMoney(amount)} is in your account, repaid over ${months} months. ${this.bankStatus()}`);
    } else if (optionId === 'cancel') {
      call.pendingLoan = undefined;
      this.say(call, 'No problem at all.');
    } else if (optionId.startsWith('repay:')) {
      const id = Number(optionId.slice(6));
      const loan = me.loans?.find((l) => l.id === id);
      if (!loan) this.say(call, 'I can’t find that loan.');
      else if (me.cash <= 0) this.say(call, 'You don’t have the cash to repay anything right now.');
      else {
        this.game.repayLoanEarly(id);
        this.say(call, `Thank you. ${this.bankStatus()}`);
      }
    } else if (optionId === 'rate') {
      const shops = this.game.state()!.restaurants.filter((r) => r.ownerId === me.id).length;
      this.say(call, `One percent a month on what you still owe, plus an equal slice of the loan each month, taken at the end of the month. With your standing I can lend you up to ${formatMoney(creditLimit(statsOf(me), shops))} in total.`);
    } else {
      this.say(call, 'Goodbye, and good luck with the pizzas.');
      this.end(call);
      return;
    }
    this.bankOptions(call);
  }

  // ---- Insurance -----------------------------------------------------------

  private insuranceOptions(call: Call): void {
    const st = this.game.state();
    const me = this.game.human();
    if (!st || !me) return;
    call.options = [
      ...(Object.keys(POLICIES) as InsuranceType[]).map((t) =>
        insured(me, t)
          ? { id: `cancel:${t}`, label: `Cancel my ${POLICIES[t].label.toLowerCase()}.` }
          : { id: `buy:${t}`, label: `I'll take ${POLICIES[t].label.toLowerCase()} (${POLICIES[t].covers}) for ${formatMoney(premium(st, me, t))} a month.` },
      ),
      { id: 'bye', label: 'That’s all for now.' },
    ];
  }

  private insurance(call: Call, optionId: string): void {
    if (optionId.startsWith('buy:') || optionId.startsWith('cancel:')) {
      const [action, type] = optionId.split(':') as ['buy' | 'cancel', InsuranceType];
      this.game.setInsurance(type, action === 'buy');
      this.say(call, action === 'buy' ? `You're covered from today. The premium is collected at the end of each month.` : 'Policy cancelled. I hope you won’t regret it.');
      this.insuranceOptions(call);
      return;
    }
    this.say(call, 'Stay safe out there!');
    this.end(call);
  }

  // ---- Supplier ------------------------------------------------------------

  private supplierDiscount(base: number): number {
    return base + Math.max(0, haggleBonus(statsOf(this.game.human()))) / 5;
  }

  private myRestaurantsHere(): Restaurant[] {
    const st = this.game.state();
    const me = this.game.human();
    return (st?.restaurants ?? []).filter((r) => r.ownerId === me?.id && r.cityId === st?.currentCityId);
  }

  private supplierOptions(call: Call): void {
    const sp = weeklySpecial(call.contact.cityId, this.game.state()!.day);
    const name = ingredient(sp.ingredientId).name.toLowerCase();
    call.options = [
      ...this.myRestaurantsHere().map((r) => ({ id: `order:${r.id}`, label: `Deliver ${BULK_PORTIONS} portions of ${name} to ${r.name}.` })),
      { id: 'bye', label: 'Not today, thanks.' },
    ];
  }

  private supplier(call: Call, optionId: string): void {
    if (!optionId.startsWith('order:')) {
      this.say(call, 'Righto. Call any time!');
      this.end(call);
      return;
    }
    const rid = Number(optionId.slice(6));
    const sp = weeklySpecial(call.contact.cityId, this.game.state()!.day);
    const ing = ingredient(sp.ingredientId);
    const cost = ing.cost * BULK_PORTIONS * cityDef(call.contact.cityId).costOfLiving * (1 - this.supplierDiscount(sp.discount));
    let ok = false;
    this.game.mutate((st) => {
      const me = st.players.find((p) => p.isHuman);
      const r = st.restaurants.find((x) => x.id === rid);
      if (!me || !r || me.cash < cost) return;
      addLedger(me, st.day, 'Ingredients', -cost);
      addStock(r, ing.id, BULK_PORTIONS, 60);
      ok = true;
    });
    this.say(call, ok ? `Lovely. ${formatMoney(cost)}, delivered this afternoon.` : 'Hmm, your account can’t cover that order.');
    this.supplierOptions(call);
  }

  // ---- Staff agency --------------------------------------------------------

  private agencyOptions(call: Call): void {
    if (call.restaurantId === null) {
      const mine = this.myRestaurantsHere();
      call.options = [...mine.map((r) => ({ id: `for:${r.id}`, label: `${r.name}, please.` })), { id: 'bye', label: 'Nobody right now. Goodbye.' }];
      if (mine.length === 0) this.say(call, 'Once you have a restaurant in town, I’ll find you the best staff.');
      return;
    }
    const r = this.game.state()!.restaurants.find((x) => x.id === call.restaurantId);
    if (!r) return;
    const applicants = this.game.applicantsFor(r).slice(0, 4);
    call.options = [
      ...applicants.map((a) => ({ id: `hire:${a.id}`, label: `Hire ${a.name}, ${a.role}, skill ${Math.round(a.skill * 100)}%, ${formatMoney(a.wagePerMonth)}/month.` })),
      { id: 'back', label: 'Another restaurant, please.' },
      { id: 'bye', label: 'That’s everyone, thanks.' },
    ];
  }

  private agency(call: Call, optionId: string): void {
    if (optionId.startsWith('for:')) {
      call.restaurantId = Number(optionId.slice(4));
      this.say(call, 'Here is who I have available this week:');
    } else if (optionId.startsWith('hire:')) {
      const r = this.game.state()!.restaurants.find((x) => x.id === call.restaurantId);
      const a = r ? this.game.applicantsFor(r).find((x) => x.id === Number(optionId.slice(5))) : undefined;
      if (r && a) {
        this.game.hire(r.id, a);
        this.say(call, `${a.name.split(' ')[0]} starts at ${r.name} tomorrow morning.`);
      }
    } else if (optionId === 'back') {
      call.restaurantId = null;
      this.say(call, 'Which restaurant then?');
    } else {
      this.say(call, 'Pleasure as always.');
      this.end(call);
      return;
    }
    this.agencyOptions(call);
  }

  // ---- Incoming calls from city hall -------------------------------------------

  private restaurantName(id: number | undefined): string {
    return this.game.state()?.restaurants.find((r) => r.id === id)?.name ?? 'your restaurant';
  }

  private incomingGreeting(call: Call, inc: IncomingCall): void {
    const who = `${call.contact.name.split(' ')[0]} here, from the ${call.contact.company.toLowerCase()}.`;
    const name = this.restaurantName(inc.restaurantId);
    const stars = (n: number) => (n === 0 ? 'no stars' : `${n} star${n === 1 ? '' : 's'}`);
    switch (inc.topic) {
      case 'inspection': {
        const before = inc.before ?? 0;
        const after = inc.after ?? 0;
        if (after > before) this.say(call, `${who} Good news! Our inspectors ate at ${name} and were delighted. It now has ${stars(after)}.`);
        else if (after < before) this.say(call, `${who} I'm afraid our inspectors were disappointed by ${name}. It loses a star and now has ${stars(after)}.`);
        else this.say(call, `${who} Our inspectors visited ${name}. The rating stays at ${stars(after)}${after < 5 ? ' for now' : ', the very best'}.`);
        call.options = [
          { id: 'why', label: 'What did the inspectors think could be better?' },
          { id: 'thanks', label: 'Thank you, Mayor.' },
        ];
        break;
      }
      case 'donation': {
        const project = PROJECTS[inc.id % PROJECTS.length];
        this.say(call, `${who} The city is raising money for ${project}. Could you spare ${formatMoney(inc.amount ?? 0)}? The mayor never forgets a friend.`);
        call.options = [
          { id: 'full', label: `Of course, here's ${formatMoney(inc.amount ?? 0)}.` },
          { id: 'half', label: `I can manage ${formatMoney(Math.round((inc.amount ?? 0) / 2))}.` },
          { id: 'no', label: 'Not this time, sorry.' },
        ];
        break;
      }
      case 'complaint': {
        const complaint = COMPLAINTS[inc.id % COMPLAINTS.length];
        this.say(call, `${who} Residents near ${name} have been complaining about ${complaint}. What are you going to do about it?`);
        call.options = [
          { id: 'pay', label: `I'll pay for it to be sorted out (${formatMoney(inc.amount ?? 0)}).` },
          { id: 'word', label: "I'll have a word with my staff." },
          { id: 'ignore', label: "That's not my problem." },
        ];
        break;
      }
      case 'shark':
        this.say(call, `Remember me? You owe ${formatMoney(inc.amount ?? 0)} and you're late. So what's it going to be?`);
        call.options = [
          { id: 'pay', label: `Here's the ${formatMoney(inc.amount ?? 0)}.` },
          { id: 'time', label: 'I need another week. (10% more)' },
          { id: 'refuse', label: "I'm not paying." },
        ];
        break;
      case 'police':
        this.say(call, `${call.contact.name}, City Police. You were caught with ${inc.title?.toLowerCase()} near a rival's restaurant. That's a ${formatMoney(inc.amount ?? 0)} fine${inc.after ? `, and with your record, ${inc.after} days in a cell` : ''}.`);
        call.options = [{ id: 'ok', label: inc.after ? 'I want my lawyer…' : 'I’ll pay.' }];
        break;
      case 'protection':
        this.say(call, `It's ${call.contact.company}. Nice restaurants you have. Shame if something happened to them. ${formatMoney(inc.amount ?? 0)} a week and nothing will.`);
        call.options = [
          { id: 'accept', label: 'All right, I’ll pay for protection.' },
          { id: 'decline', label: 'I don’t need your “protection”.' },
        ];
        break;
      case 'award':
        this.say(call, `${who} Congratulations! The mayor has chosen you for the ${inc.title} award. A cheque for ${formatMoney(inc.amount ?? 0)} is on its way, and the whole city will hear about it.`);
        call.options = [{ id: 'thanks', label: 'What an honour, thank you!' }];
        break;
    }
  }

  private incomingReply(call: Call, inc: IncomingCall, optionId: string): void {
    const st = this.game.state()!;
    const me = this.game.human()!;
    const r = st.restaurants.find((x) => x.id === inc.restaurantId);
    const cityId = call.contact.cityId;
    if (inc.topic === 'inspection' && optionId === 'why' && r) {
      this.say(call, this.inspectionAdvice(r));
      call.options = [{ id: 'thanks', label: 'Thank you, I’ll work on it.' }];
      return;
    }
    if (inc.topic === 'shark') {
      if (optionId === 'pay') {
        let ok = false;
        this.game.mutate((st) => (ok = repayShark(st, me)));
        this.say(call, ok ? 'Pleasure doing business. Call again.' : 'That’s not enough. We’ll be in touch.');
      } else if (optionId === 'time') {
        this.game.mutate((st) => extendShark(st, me));
        this.say(call, 'One more week. It’ll cost you. Don’t make me call again.');
      } else {
        this.game.mutate((st) => sharkReprisal(st, me));
        this.say(call, 'Wrong answer. Check on your restaurants tomorrow.');
      }
    } else if (inc.topic === 'police') {
      this.say(call, inc.after ? 'Your lawyer will see you in the cell. Enjoy the porridge.' : 'Paid. Keep your nose clean.');
    } else if (inc.topic === 'protection') {
      this.game.mutate((st) => ((st.protection ??= {})[cityId] = optionId === 'accept'));
      this.say(call, optionId === 'accept' ? 'Smart. We’ll take it from your account every week.' : 'Your choice. Sleep well.');
    } else if (inc.topic === 'donation') {
      const amount = optionId === 'full' ? (inc.amount ?? 0) : optionId === 'half' ? Math.round((inc.amount ?? 0) / 2) : 0;
      if (amount > 0 && me.cash >= amount) {
        this.game.donateToMayor(cityId, amount);
        this.say(call, optionId === 'full' ? 'Wonderful! The mayor will be thrilled.' : 'Every little helps. Thank you.');
      } else if (amount > 0) {
        this.say(call, 'It seems your account can’t cover that. Another time, perhaps.');
      } else {
        this.game.mutate(() => me.favour && (me.favour[cityId] = Math.max(0, (me.favour[cityId] ?? 0) - 10)));
        this.say(call, 'I see. The mayor will be… disappointed.');
      }
    } else if (inc.topic === 'complaint' && r) {
      if (optionId === 'pay' && me.cash >= (inc.amount ?? 0)) {
        this.game.mutate((s) => {
          addLedger(me, s.day, 'Community', -(inc.amount ?? 0));
          (me.favour ??= {})[cityId] = Math.min(MAX_FAVOUR, (me.favour[cityId] ?? 0) + 5);
        });
        this.say(call, 'Splendid. The residents will be pleased, and so is the mayor.');
      } else if (optionId === 'ignore') {
        this.game.mutate(() => {
          (me.favour ??= {})[cityId] = Math.max(0, (me.favour[cityId] ?? 0) - 15);
          r.reputation = Math.max(0, r.reputation - 0.04);
        });
        this.say(call, 'Then don’t be surprised if the papers hear about it.');
      } else {
        const fixed = Math.random() < 0.6;
        if (!fixed) this.game.mutate(() => (r.reputation = Math.max(0, r.reputation - 0.01)));
        this.say(call, fixed ? 'Thank you. Let’s hope that settles it.' : 'Let’s hope so. We’ve heard that before.');
      }
    } else {
      this.say(call, 'Goodbye, and keep up the good work.');
    }
    this.end(call);
  }

  /** What the inspectors would improve first, from the parts of the rating. */
  private inspectionAdvice(r: Restaurant): string {
    const st = this.game.state()!;
    const days = (r.history ?? []).slice(-7);
    const served = days.reduce((n, d) => n + d.customers, 0);
    const satisfaction = served ? days.reduce((n, d) => n + d.satisfaction, 0) / served : 0;
    const recipes = r.menu.map((m) => st.recipes.find((x) => x.id === m.recipeId)).filter((x): x is NonNullable<typeof x> => !!x);
    const craft = recipes.length ? recipes.reduce((n, x) => n + recipeQuality(x), 0) / recipes.length : 0;
    const weakest = [
      { v: satisfaction, text: 'Guests didn’t leave happy enough: better-liked pizzas, fair prices and good staff would help.' },
      { v: craft, text: 'The pizzas themselves could be better made: even toppings, a sensible amount, some fine chopping.' },
      { v: r.decor / 3, text: 'The dining room felt bare. Nicer furniture, flooring and decoration would impress them.' },
    ].sort((a, b) => a.v - b.v)[0];
    return `The inspectors rated it ${r.qualityRating ?? 0} out of 100. ${weakest.text}`;
  }

  // ---- The back streets --------------------------------------------------------

  private sharkOptions(call: Call): void {
    const me = this.game.human();
    const st = this.game.state();
    if (me?.shark && st) {
      call.options = [
        { id: 'repay', label: `I want to settle up: ${formatMoney(me.shark.owed)}.` },
        { id: 'bye', label: 'Just checking in. Bye.' },
      ];
      return;
    }
    call.options = [
      ...SHARK_AMOUNTS.map((n) => ({ id: `borrow:${n}`, label: `Lend me ${formatMoney(n)} (pay back ${formatMoney(Math.round(n * (1 + SHARK_WEEKLY * SHARK_WEEKS)))} in ${SHARK_WEEKS} weeks).` })),
      { id: 'bye', label: 'Never mind.' },
    ];
  }

  private shark(call: Call, optionId: string): void {
    const me = this.game.human();
    if (!me) return;
    if (optionId.startsWith('borrow:')) {
      let error: string | null = null;
      this.game.mutate((st) => (error = borrowFromShark(st, me, call.contact.cityId, Number(optionId.slice(7)))));
      this.say(call, error ?? `Here you go. ${SHARK_WEEKS} weeks. Don’t make me come looking for you.`);
    } else if (optionId === 'repay') {
      let ok = false;
      this.game.mutate((st) => (ok = repayShark(st, me)));
      this.say(call, ok ? 'All square. Nice doing business.' : 'You’re short. Come back when you have it all.');
    } else {
      this.say(call, 'Click.');
      this.end(call);
      return;
    }
    this.sharkOptions(call);
  }

  private fixerOptions(call: Call): void {
    const st = this.game.state();
    const me = this.game.human();
    if (!st || !me) return;
    const city = call.contact.cityId;
    call.options = [
      ...BLACK_MARKET.map((b) => ({ id: `buy:${b.kind}`, label: `${SABOTAGE[b.kind].label}: ${formatMoney(fixerPrice(city, b.kind, st.day))} (${SABOTAGE[b.kind].effect}).` })),
      ...BLACK_MARKET.filter((b) => (me.blackMarket?.[b.kind] ?? 0) > 0).map((b) => ({ id: `sell:${b.kind}`, label: `Sell you my ${SABOTAGE[b.kind].label.toLowerCase()} for ${formatMoney(Math.round(fixerPrice(city, b.kind, st.day) * FIXER_BUYBACK))}.` })),
      { id: 'bye', label: 'That’s all.' },
    ];
  }

  private fixer(call: Call, optionId: string): void {
    const me = this.game.human();
    if (!me) return;
    const [action, kind] = optionId.split(':') as ['buy' | 'sell' | 'bye', SabotageKind];
    if (action === 'buy' || action === 'sell') {
      let ok = false;
      this.game.mutate((st) => {
        const price = fixerPrice(call.contact.cityId, kind, st.day);
        me.blackMarket ??= {};
        if (action === 'buy' && me.cash >= price) {
          me.cash -= price;
          me.ledger.push({ day: st.day, label: 'Cash purchases', amount: -price });
          me.blackMarket[kind] = (me.blackMarket[kind] ?? 0) + 1;
          ok = true;
        } else if (action === 'sell' && (me.blackMarket[kind] ?? 0) > 0) {
          const pay = Math.round(price * FIXER_BUYBACK);
          me.cash += pay;
          me.ledger.push({ day: st.day, label: 'Cash sales', amount: pay });
          me.blackMarket[kind] = (me.blackMarket[kind] ?? 0) - 1;
          ok = true;
        }
      });
      this.say(call, ok ? (action === 'buy' ? 'It’ll be in the usual place. You never saw me.' : 'Pleasure. Cash, as always.') : 'Can’t do that.');
      this.fixerOptions(call);
      return;
    }
    this.say(call, 'Click.');
    this.end(call);
  }

  private bossOptions(call: Call): void {
    const st = this.game.state();
    const protectedHere = !!st?.protection?.[call.contact.cityId];
    call.options = [
      protectedHere ? { id: 'stop', label: 'I want to stop paying for protection.' } : { id: 'protect', label: `What would protection cost? (${formatMoney(this.protectionFee(call.contact.cityId))} a week)` },
      { id: 'bye', label: 'Goodbye.' },
    ];
  }

  private protectionFee(cityId: string): number {
    const st = this.game.state();
    const me = this.game.human();
    return st && me ? protectionFee(st, me, cityId) : 0;
  }

  private boss(call: Call, optionId: string): void {
    if (optionId === 'protect') {
      this.game.mutate((st) => ((st.protection ??= {})[call.contact.cityId] = true));
      this.say(call, `Wise. ${formatMoney(this.protectionFee(call.contact.cityId))} a week, and nobody touches your restaurants here.`);
    } else if (optionId === 'stop') {
      this.game.mutate((st) => ((st.protection ??= {})[call.contact.cityId] = false));
      this.say(call, 'As you like. Accidents happen, you know.');
    } else {
      this.say(call, 'Ciao.');
      this.end(call);
      return;
    }
    this.bossOptions(call);
  }

  // ---- Mayor ---------------------------------------------------------------

  private mayorMood(call: Call): string {
    const me = this.game.human();
    const f = me ? favour(me, call.contact.cityId) : 0;
    if (f > 120) return 'Always a pleasure! The city is lucky to have you.';
    if (f > 50) return 'Ah, a friend of the city. What can I do for you?';
    return 'The mayor is very busy. Is this about a donation?';
  }

  private mayorOptions(call: Call): void {
    const col = cityDef(call.contact.cityId).costOfLiving;
    call.options = [
      ...[1000, 5000, 20000].map((n) => ({ id: `donate:${Math.round(n * col)}`, label: `I'd like to donate ${formatMoney(Math.round(n * col))} to the city's good causes.` })),
      { id: 'awards', label: 'Tell me about the city awards.' },
      { id: 'bye', label: 'That’s all, thank you.' },
    ];
  }

  private mayor(call: Call, optionId: string): void {
    if (optionId.startsWith('donate:')) {
      const amount = Number(optionId.slice(7));
      if ((this.game.human()?.cash ?? 0) < amount) this.say(call, 'Generous of you, but your bank tells me otherwise.');
      else {
        const f = this.game.donateToMayor(call.contact.cityId, amount);
        this.say(call, f >= MAX_FAVOUR ? 'The mayor could not be more grateful.' : 'How generous! The mayor will hear of this.');
      }
    } else if (optionId === 'awards') {
      this.say(call, 'At the end of every year the mayor presents the Golden Oven, the Prettiest Pizzeria, Employer of the Year and the People’s Favourite. Friends of the city are always remembered.');
    } else {
      this.say(call, 'Goodbye, and thank you for calling.');
      this.end(call);
      return;
    }
    this.mayorOptions(call);
  }

  // ---- Helpers -------------------------------------------------------------

  private lot(call: Call) {
    return call.lotId === null ? null : (this.game.city()?.lots[call.lotId] ?? null);
  }

  private rent(call: Call): number {
    const lot = this.lot(call);
    return lot ? Math.round((lot.rentPerMonth * (1 - call.discount)) / 10) * 10 : 0;
  }

  private price(call: Call): number {
    const lot = this.lot(call);
    return lot ? Math.round((lot.purchasePrice * (1 - call.discount)) / 500) * 500 : 0;
  }

  private say(call: Call, text: string): void {
    call.lines.push({ from: 'them', text });
  }

  private end(call: Call): void {
    call.ended = true;
    call.options = [];
    this.game.mutate((st) => {
      if (call.contact.kind === 'realtor' && call.discount > 0.1) addMessage(st, `${call.contact.name} grumbles about your haggling to colleagues.`);
    });
  }
}
