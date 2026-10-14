import { Injectable, inject, signal } from '@angular/core';
import { character } from './characters';
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
    this.greet(call);
  }

  hangUp(): void {
    this.call.set(null);
  }

  choose(optionId: string): void {
    const call = this.call();
    if (!call || call.ended) return;
    const option = call.options.find((o) => o.id === optionId);
    if (option) call.lines.push({ from: 'me', text: option.label });
    switch (call.contact.kind) {
      case 'realtor': this.realtor(call, optionId); break;
      case 'bank': this.bank(call, optionId); break;
      case 'supplier': this.supplier(call, optionId); break;
      case 'agency': this.agency(call, optionId); break;
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
        const negotiator = character(me?.characterId).perk === 'negotiator';
        const chance = 0.7 - call.contact.toughness * 0.45 + (negotiator ? 0.25 : 0) - (call.haggles - 1) * 0.2;
        if (Math.random() < chance && call.discount < 0.25) {
          call.discount = Math.min(0.25, call.discount + 0.04 + Math.random() * (negotiator ? 0.08 : 0.05));
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
    const loan = me?.loan ?? 0;
    const opts: CallOption[] = [];
    if (loan + LOAN_STEP <= MAX_LOAN) opts.push({ id: 'borrow:1', label: `I'd like to borrow ${formatMoney(LOAN_STEP)}.` });
    if (loan + LOAN_STEP * 5 <= MAX_LOAN) opts.push({ id: 'borrow:5', label: `I'd like to borrow ${formatMoney(LOAN_STEP * 5)}.` });
    if (loan > 0) opts.push({ id: 'repay:1', label: `I want to repay ${formatMoney(Math.min(LOAN_STEP, loan))}.` });
    if (loan > LOAN_STEP) opts.push({ id: 'repay:all', label: 'I want to pay off the whole loan.' });
    opts.push({ id: 'rate', label: 'What interest do you charge?' }, { id: 'bye', label: 'That’s all, thank you.' });
    call.options = opts;
  }

  private bank(call: Call, optionId: string): void {
    const me = this.game.human();
    if (!me) return;
    if (optionId.startsWith('borrow:')) {
      const amount = LOAN_STEP * Number(optionId.slice(7));
      // The bank looks at your business before lending.
      const shops = this.game.state()!.restaurants.filter((r) => r.ownerId === me.id).length;
      if (me.loan + amount > Math.max(LOAN_STEP * 3, shops * 40000)) {
        this.say(call, 'I’m sorry, with your current business we can’t lend that much. Open more restaurants and ask again.');
      } else {
        this.game.borrow(amount);
        this.say(call, `Done. ${formatMoney(amount)} has been paid into your account. ${this.bankStatus()}`);
      }
    } else if (optionId.startsWith('repay:')) {
      const amount = optionId === 'repay:all' ? me.loan : LOAN_STEP;
      if (me.cash < Math.min(amount, me.loan)) this.say(call, 'You don’t have enough cash for that repayment.');
      else {
        this.game.repay(amount);
        this.say(call, `Thank you. ${this.bankStatus()}`);
      }
    } else if (optionId === 'rate') {
      const banker = character(me.characterId).perk === 'banker';
      this.say(call, banker ? 'For an old friend like you, half a percent a month.' : 'One percent a month on the outstanding loan, charged at the end of each month.');
    } else {
      this.say(call, 'Goodbye, and good luck with the pizzas.');
      this.end(call);
      return;
    }
    this.bankOptions(call);
  }

  // ---- Supplier ------------------------------------------------------------

  private supplierDiscount(base: number): number {
    const negotiator = character(this.game.human()?.characterId).perk === 'negotiator';
    return base + (negotiator ? 0.05 : 0);
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
