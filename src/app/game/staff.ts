import { Look } from './characters';
import { randomLook } from './contacts';
import { CITIES, FIRST_NAMES, LAST_NAMES, cityDef } from './data';
import { GameState, ManagerSettings, Restaurant, Staff, StaffEvent, StaffRole } from './model';
import { fairPrice, recipeCost } from './recipes';
import { statsOf } from './owner-stats';
import { Rng } from './rng';

/**
 * Staff as characters: generated people with the original's working stats,
 * wages that follow their skills, a weekly job market per city, training
 * courses, motivation, and daily incidents that need the owner's decision.
 * Names, numbers and texts are our own.
 */

export const ROLE_STAT: Record<StaffRole, 'cooking' | 'serving' | 'management'> = {
  cook: 'cooking',
  waiter: 'serving',
  manager: 'management',
};
export const ROLE_LABEL: Record<StaffRole, string> = {
  cook: 'Cook',
  waiter: 'Waiter',
  manager: 'Manager',
};

function clampStat(v: number): number {
  return Math.max(1, Math.min(100, Math.round(v)));
}

/** A face for a staff member, stable for their id. */
export function staffLook(staff: Pick<Staff, 'id'>): Look {
  return randomLook(new Rng(staff.id * 2654435761));
}

/** The role skill (0..1) from the matching stat. */
export function roleSkill(s: Staff): number {
  return s[ROLE_STAT[s.role]] / 100;
}

/** Skill as it shows at work: unmotivated people only give 70% of their best. */
export function effectiveSkill(s: Staff): number {
  return roleSkill(s) * (0.7 + s.motivation / 333);
}

export function isAvailable(s: Staff): boolean {
  return !s.course && !s.daysAway;
}

/**
 * Monthly wage: the role's main skill, serving, output and trustworthiness push
 * pay up, scaled by intelligence; managers are paid mostly for management.
 */
export function fairWage(
  s: Pick<
    Staff,
    | 'role'
    | 'cooking'
    | 'serving'
    | 'management'
    | 'pizzasPerDay'
    | 'trustworthiness'
    | 'intelligence'
  >,
  costOfLiving: number,
): number {
  const main = s.role === 'cook' ? s.cooking : s.role === 'waiter' ? s.serving : s.management * 3;
  const base = s.serving * 0.5 + main + s.pizzasPerDay / 3 + s.trustworthiness / 2;
  return Math.round((base * (1 + s.intelligence / 200) * 14 * costOfLiving) / 10) * 10;
}

/** Generates a job seeker. `bonus` (-0.2..0.2) shifts their main skill. */
export function generateCandidate(
  id: number,
  role: StaffRole,
  costOfLiving: number,
  bonus = 0,
  random: () => number = Math.random,
): Staff {
  const r = (lo: number, hi: number) => lo + random() * (hi - lo);
  const name = `${FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(random() * LAST_NAMES.length)]}`;
  const s: Staff = {
    id,
    name,
    role,
    skill: 0,
    wagePerMonth: 0,
    cooking: clampStat(r(10, 65)),
    serving: clampStat(r(10, 65)),
    management: clampStat(r(10, 60)),
    intelligence: clampStat(r(20, 90)),
    trustworthiness: clampStat(r(30, 95)),
    honesty: clampStat(r(25, 98)),
    personality: clampStat(r(20, 90)),
    health: clampStat(r(55, 100)),
    motivation: clampStat(r(50, 90)),
    pizzasPerDay: Math.round(role === 'cook' ? r(40, 130) : r(10, 60)),
  };
  const stat = ROLE_STAT[role];
  s[stat] = clampStat(r(20, 92) + bonus * 100);
  s.skill = roleSkill(s);
  // Some people ask for a little more or less than they're worth.
  s.wagePerMonth = Math.round((fairWage(s, costOfLiving) * r(0.85, 1.15)) / 10) * 10;
  return s;
}

/** Makes an older save's simple staff record into a full character. */
export function upgradeStaff(
  old: Partial<Staff> & Pick<Staff, 'id' | 'name' | 'role' | 'skill' | 'wagePerMonth'>,
): Staff {
  const s: Staff = {
    cooking: 40,
    serving: 40,
    management: 30,
    intelligence: 50,
    trustworthiness: 70,
    honesty: 75,
    personality: 55,
    health: 80,
    motivation: 70,
    pizzasPerDay: old.role === 'cook' ? 80 : 30,
    ...old,
  };
  s[ROLE_STAT[s.role]] = clampStat(old.skill * 100);
  return s;
}

// ---- Job market ----------------------------------------------------------------

const MARKET_SIZE: Record<StaffRole, number> = { cook: 6, waiter: 6, manager: 3 };

/** The city's job seekers, created on first use. */
export function jobMarket(st: GameState, cityId: string): Staff[] {
  st.jobMarket ??= {};
  if (!st.jobMarket[cityId]) {
    st.jobMarket[cityId] = [];
    refillMarket(st, cityId);
  }
  return st.jobMarket[cityId];
}

function refillMarket(st: GameState, cityId: string): void {
  const market = st.jobMarket[cityId];
  const col = cityDef(cityId).costOfLiving;
  for (const role of ['cook', 'waiter', 'manager'] as StaffRole[]) {
    while (market.filter((s) => s.role === role).length < MARKET_SIZE[role])
      market.push(generateCandidate(st.nextId++, role, col));
  }
}

/** Weekly churn: some job seekers find work elsewhere and new ones arrive. */
export function rotateJobMarkets(st: GameState): void {
  for (const c of CITIES) {
    if (!st.jobMarket?.[c.id]) continue;
    st.jobMarket[c.id] = st.jobMarket[c.id].filter(() => Math.random() > 0.35);
    refillMarket(st, c.id);
  }
}

// ---- Training ---------------------------------------------------------------------

export interface Course {
  stat: 'cooking' | 'serving' | 'management';
  level: number;
  name: string;
  cost: number;
  days: number;
  gain: number;
  /** The course only helps people below this level. */
  maxStat: number;
}

const COURSE_NAMES: Record<Course['stat'], [string, string, string]> = {
  cooking: ['Dough basics', 'Wood-fired techniques', 'Master pizzaiolo'],
  serving: ['Friendly service', 'Front of house', 'Fine-dining service'],
  management: ['Team leading', 'Restaurant operations', 'Business school'],
};

export const COURSES: readonly Course[] = (['cooking', 'serving', 'management'] as const).flatMap(
  (stat) =>
    [0, 1, 2].map((i) => ({
      stat,
      level: i + 1,
      name: COURSE_NAMES[stat][i],
      cost: [500, 1500, 4000][i],
      days: [3, 5, 8][i],
      gain: [10, 15, 20][i],
      maxStat: [60, 80, 100][i],
    })),
);

export function startCourse(s: Staff, course: Course): void {
  s.course = { stat: course.stat, level: course.level, daysLeft: course.days };
}

// ---- Managers ----------------------------------------------------------------------

export function defaultManagerSettings(costOfLiving: number): ManagerSettings {
  return {
    hire: true,
    minCooks: 1,
    minWaiters: 1,
    maxWage: Math.round((3000 * costOfLiving) / 100) * 100,
    shopping: true,
    prices: false,
    incidents: true,
  };
}

export function managerSettings(r: Restaurant): ManagerSettings {
  return (r.managerSettings ??= defaultManagerSettings(cityDef(r.cityId).costOfLiving));
}

/** The working manager of a restaurant, if any. */
export function activeManager(r: Restaurant): Staff | undefined {
  return r.staff.find((s) => s.role === 'manager' && isAvailable(s));
}

const MAX_PER_ROLE = 6;

/**
 * A manager's morning: hire cooks and waiters when the team is below the
 * owner's minimum or guests were lost to slow service, and every few days
 * nudge prices up when busy and down when quiet.
 */
function managerRoutine(st: GameState, r: Restaurant, manager: Staff): void {
  const settings = managerSettings(r);
  const col = cityDef(r.cityId).costOfLiving;
  const y = r.lastDay;

  if (settings.hire) {
    for (const role of ['cook', 'waiter'] as const) {
      const have = r.staff.filter((s) => s.role === role).length;
      const lost = role === 'cook' ? y.lostKitchen : y.lostFloor;
      const minimum = role === 'cook' ? settings.minCooks : settings.minWaiters;
      const wanted = Math.min(MAX_PER_ROLE, Math.max(minimum, have + (lost > 10 ? 1 : 0)));
      if (have >= wanted || r.staff.length >= 12) continue;
      const hire = pickCandidate(
        jobMarket(st, r.cityId),
        role,
        settings.maxWage,
        manager.management,
      );
      if (!hire) {
        addNews(
          st,
          `${manager.name} couldn't find a ${role} at ${r.name} for under $${settings.maxWage} a month.`,
        );
        continue;
      }
      st.jobMarket[r.cityId] = st.jobMarket[r.cityId].filter((s) => s.id !== hire.id);
      r.staff.push(hire);
      addNews(
        st,
        `${manager.name} hired ${hire.name} as a ${role} at ${r.name} for $${hire.wagePerMonth} a month.`,
      );
    }
  }

  if (settings.prices && st.day % 3 === 0 && y.capacity > 0) {
    const city = st.cities.find((c) => c.id === r.cityId);
    const district = city?.districts[city.lots[r.lotId].district];
    if (!district) return;
    const fair = fairPrice(district, col);
    const busy = y.turnedAway > y.customers * 0.25;
    const quiet = y.turnedAway === 0 && y.customers / y.capacity < 0.35;
    if (!busy && !quiet) return;
    for (const m of r.menu) {
      const recipe = st.recipes.find((x) => x.id === m.recipeId);
      const floor = Math.max(fair * 0.6, recipe ? recipeCost(recipe) * col * 1.5 : 0);
      const next = m.price * (busy ? 1.05 : 0.95);
      m.price = Math.round(Math.max(floor, Math.min(fair * 1.5, next)) * 2) / 2;
    }
    addNews(st, `${manager.name} ${busy ? 'raised' : 'lowered'} prices at ${r.name} a little.`);
  }
}

/** The best value candidate within budget; less skilled managers judge people less reliably. */
function pickCandidate(
  market: Staff[],
  role: StaffRole,
  maxWage: number,
  management: number,
): Staff | null {
  const noise = ((100 - management) / 100) * 0.6;
  let best: Staff | null = null;
  let bestScore = -Infinity;
  for (const s of market) {
    if (s.role !== role || s.wagePerMonth > maxWage) continue;
    const value = (effectiveSkill(s) * 1000) / s.wagePerMonth;
    const score = value * (1 + (Math.random() - 0.5) * noise);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

// ---- Daily routine and incidents ------------------------------------------------

const EVENT_TEXT = {
  late: (n: string) => `${n} turned up an hour late this morning, full of excuses about the trams.`,
  sick: (n: string, d: number) =>
    `${n} has called in sick and expects to be away for ${d} day${d === 1 ? '' : 's'}.`,
  raise: (n: string) =>
    `${n} would like a word about pay. They feel they're worth more than you're paying.`,
  quit: (n: string) => `${n} is fed up and says they're about to hand in their notice.`,
  theft: (n: string, a: string) =>
    `Money has gone missing from the till: ${a}. Everything points to ${n}.`,
};

/** Runs each morning: courses, sickness, motivation drift and new incidents for the player's staff. */
export function staffMorning(st: GameState): void {
  for (const r of st.restaurants) {
    const owner = st.players.find((p) => p.id === r.ownerId);
    const manager = activeManager(r);
    const delegate = !!manager && managerSettings(r).incidents;
    const y = r.lastDay;
    const overloaded = y.lostKitchen + y.lostFloor > Math.max(5, y.customers * 0.15);
    for (const s of [...r.staff]) {
      if (s.course) {
        s.course.daysLeft--;
        if (s.course.daysLeft <= 0) {
          const course = COURSES.find(
            (c) => c.stat === s.course!.stat && c.level === s.course!.level,
          );
          if (course) s[course.stat] = clampStat(s[course.stat] + course.gain);
          s.skill = roleSkill(s);
          s.motivation = clampStat(s.motivation + 8);
          if (owner?.isHuman)
            addNews(
              st,
              `${s.name} finished the ${course?.name ?? 'training'} course and is back at work.`,
            );
          delete s.course;
        }
        continue;
      }
      if (s.daysAway) {
        s.daysAway--;
        if (s.daysAway <= 0) delete s.daysAway;
        continue;
      }
      // Motivation drifts towards a comfortable level; overload wears people down, a good manager lifts them.
      let m = s.motivation + (60 - s.motivation) * 0.05;
      if (overloaded && s.role !== 'manager') m -= 2;
      if (manager && s !== manager) m += manager.personality / 60;
      s.motivation = clampStat(m);
      s.health = clampStat(s.health + (Math.random() - 0.45) * 2);
      if (owner?.isHuman) maybeIncident(st, r, s, delegate && s !== manager);
    }
    if (owner?.isHuman && manager) managerRoutine(st, r, manager);
  }
}

function addNews(st: GameState, text: string): void {
  if (st.messages.at(-1)?.text === text) return;
  st.messages.push({ day: st.day, text });
}

function maybeIncident(st: GameState, r: Restaurant, s: Staff, managerHandles: boolean): void {
  // At most one open incident per person.
  if (st.staffEvents.some((e) => e.staffId === s.id)) return;
  const roll = Math.random();
  const wageGap = s.wagePerMonth / Math.max(1, fairWage(s, cityDef(r.cityId).costOfLiving));
  let event: StaffEvent | null = null;
  const base = { id: st.nextId++, restaurantId: r.id, staffId: s.id };
  if (s.honesty < 40 && roll < 0.015) {
    const amount = Math.round(Math.max(20, r.lastDay.revenue * (0.02 + Math.random() * 0.04)));
    event = {
      ...base,
      kind: 'theft',
      amount,
      text: EVENT_TEXT.theft(s.name, `$${amount}`),
      options: ['Fire them on the spot', 'Give them a stern warning', 'Let it go this time'],
    };
  } else if (s.motivation < 25 && roll < 0.05) {
    event = {
      ...base,
      kind: 'quit',
      text: EVENT_TEXT.quit(s.name),
      options: ['Offer a 15% raise', 'Try to talk them round', 'Let them go'],
    };
  } else if ((s.motivation < 50 || wageGap < 0.9) && roll < 0.025) {
    event = {
      ...base,
      kind: 'raise',
      text: EVENT_TEXT.raise(s.name),
      options: ['Give them 10% more', 'Offer 5%', 'Refuse'],
    };
  } else if (roll < 0.015 * (1.6 - s.health / 100)) {
    const days = 1 + Math.floor(Math.random() * 4);
    event = {
      ...base,
      kind: 'sick',
      days,
      text: EVENT_TEXT.sick(s.name, days),
      options: ['Tell them to get well soon', 'Ask them to come in anyway', 'Send flowers'],
    };
  } else if (roll < 0.03 * (1 - s.motivation / 120)) {
    event = {
      ...base,
      kind: 'late',
      text: EVENT_TEXT.late(s.name),
      options: ['Let it go', 'Have a quiet word', 'Dock a day’s pay'],
    };
  }
  if (!event) return;
  // A manager deals with small things on the owner's behalf.
  if (
    managerHandles &&
    (event.kind === 'late' || event.kind === 'sick' || (event.kind === 'theft' && s.honesty < 25))
  ) {
    resolveStaffEvent(st, event, event.kind === 'theft' ? 0 : 1);
    addNews(
      st,
      `Your manager at ${r.name} dealt with ${s.name}: ${event.kind === 'theft' ? 'caught stealing and fired' : event.kind === 'sick' ? 'off sick' : 'late again'}.`,
    );
    return;
  }
  st.staffEvents.push(event);
}

/** Applies the owner's chosen response (0–2) to an incident. */
export function resolveStaffEvent(st: GameState, event: StaffEvent, choice: number): string {
  const r = st.restaurants.find((x) => x.id === event.restaurantId);
  const s = r?.staff.find((x) => x.id === event.staffId);
  const owner = st.players.find((p) => p.id === r?.ownerId);
  st.staffEvents = st.staffEvents.filter((e) => e.id !== event.id);
  if (!r || !s || !owner) return '';
  const leave = () => (r.staff = r.staff.filter((x) => x.id !== s.id));
  // Talking someone round depends on the owner's personality.
  const persuasive = Math.random() < 0.25 + statsOf(owner).personality / 200;
  switch (event.kind) {
    case 'late':
      if (choice === 0) s.motivation = clampStat(s.motivation + 2);
      if (choice === 2) {
        s.motivation = clampStat(s.motivation - 10);
        owner.cash += Math.round(s.wagePerMonth / 30);
        return `${s.name} grumbles about the docked pay.`;
      }
      return choice === 0
        ? `${s.name} is grateful.`
        : `${s.name} promises to set an earlier alarm.`;
    case 'sick':
      if (choice === 1) {
        s.health = clampStat(s.health - 10);
        s.motivation = clampStat(s.motivation - 12);
        return `${s.name} drags themselves in, coughing over the dough.`;
      }
      s.daysAway = event.days ?? 2;
      if (choice === 2) {
        s.motivation = clampStat(s.motivation + 10);
        owner.cash -= 40;
        return `${s.name} is touched by the flowers.`;
      }
      return `${s.name} will be back in ${s.daysAway} days.`;
    case 'raise':
      if (choice === 0) {
        s.wagePerMonth = Math.round((s.wagePerMonth * 1.1) / 10) * 10;
        s.motivation = clampStat(s.motivation + 15);
        return `${s.name} is delighted with the raise.`;
      }
      if (choice === 1) {
        s.wagePerMonth = Math.round((s.wagePerMonth * 1.05) / 10) * 10;
        s.motivation = clampStat(s.motivation + (Math.random() < 0.6 ? 6 : -4));
        return `${s.name} accepts, though not with a smile.`;
      }
      s.motivation = clampStat(s.motivation - 15);
      if (Math.random() < 0.25) {
        leave();
        return `${s.name} has quit.`;
      }
      return `${s.name} goes back to work, sulking.`;
    case 'quit':
      if (choice === 0) {
        s.wagePerMonth = Math.round((s.wagePerMonth * 1.15) / 10) * 10;
        s.motivation = clampStat(s.motivation + 25);
        return `${s.name} agrees to stay.`;
      }
      if (choice === 1 && persuasive) {
        s.motivation = clampStat(s.motivation + 12);
        return `You talk ${s.name} round; they'll give it another go.`;
      }
      leave();
      return `${s.name} has left.`;
    case 'theft':
      // Theft cover pays back what was stolen.
      if (!owner.insurance?.theft) owner.cash -= event.amount ?? 0;
      if (choice === 0) {
        leave();
        return `${s.name} has been fired.`;
      }
      if (choice === 1) {
        s.honesty = clampStat(s.honesty + 12);
        s.motivation = clampStat(s.motivation - 5);
        return `${s.name} swears it won't happen again.`;
      }
      s.honesty = clampStat(s.honesty - 6);
      return `${s.name} seems to think nobody noticed.`;
  }
}
