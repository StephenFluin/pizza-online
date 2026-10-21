import { Look } from './characters';
import { randomLook } from './contacts';
import { CITIES, STANDARD_RECIPES, cityDef } from './data';
import { roomStats } from './furniture';
import { DAYS_PER_MONTH, GameState, Player, Recipe } from './model';
import { PizzaStats, pizzaStats } from './pizza-stats';
import { queueCall } from './inspections';
import { Rng, hashString } from './rng';

/**
 * City life beyond the restaurants: each mayor's favour and yearly awards,
 * business ranks, and the annual pizza contest. Award names, judges and
 * texts are our own.
 */

export const DAYS_PER_YEAR = DAYS_PER_MONTH * 12;
/** Day of the year the contest is held (late autumn) and when invitations go out. */
export const CONTEST_DAY = 300;
export const CONTEST_NOTICE = 14;
export const MAX_FAVOUR = 200;

export interface Award {
  year: number;
  cityId: string;
  title: string;
}

export interface Boost {
  cityId: string | null;
  points: number;
  daysLeft: number;
  reason: string;
}

export interface ContestEntry {
  playerId: number;
  recipe: Recipe;
  /** Five judges' scores out of 20. */
  scores: number[];
  total: number;
}

export interface Contest {
  year: number;
  cityId: string;
  phase: 'entry' | 'judged';
  entries: ContestEntry[];
}

// ---- Mayor's favour --------------------------------------------------------------

export function favour(p: Player, cityId: string): number {
  return p.favour?.[cityId] ?? 0;
}

/** A donation to the mayor's good causes: $250 buys a point of favour. */
export function donate(st: GameState, p: Player, cityId: string, amount: number): number {
  p.favour ??= {};
  p.favour[cityId] = Math.min(MAX_FAVOUR, favour(p, cityId) + amount / 250);
  return p.favour[cityId];
}

/** Popularity points from the mayor's favour (0–10) and any running award boosts. */
export function cityPrestige(st: GameState, p: Player, cityId: string): number {
  const boosts = (p.boosts ?? [])
    .filter((b) => b.cityId === null || b.cityId === cityId)
    .reduce((n, b) => n + b.points, 0);
  return Math.round(favour(p, cityId) / 20) + boosts;
}

// ---- Ranks -------------------------------------------------------------------------

export const RANKS: { title: string; netWorth: number }[] = [
  { title: 'Kitchen Hand', netWorth: -Infinity },
  { title: 'Pizza Cook', netWorth: 60_000 },
  { title: 'Head Chef', netWorth: 120_000 },
  { title: 'Restaurateur', netWorth: 250_000 },
  { title: 'Entrepreneur', netWorth: 500_000 },
  { title: 'Business Leader', netWorth: 1_000_000 },
  { title: 'Pizza Baron', netWorth: 2_000_000 },
  { title: 'Pizza Magnate', netWorth: 4_000_000 },
  { title: 'Pizza Royalty', netWorth: 8_000_000 },
];

/** Cash less debt, plus owned property and half the value of furniture. */
export function netWorth(st: GameState, p: Player): number {
  let worth = p.cash - p.loan;
  for (const r of st.restaurants.filter((x) => x.ownerId === p.id)) {
    const lot = st.cities.find((c) => c.id === r.cityId)?.lots[r.lotId];
    if (lot && r.owned) worth += lot.purchasePrice;
    if (lot)
      worth += (roomStats(r.layout, lot, r.floorId).value * cityDef(r.cityId).costOfLiving) / 2;
  }
  return Math.round(worth);
}

export function rankOf(worth: number): {
  index: number;
  title: string;
  next: { title: string; netWorth: number } | null;
} {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (worth >= r.netWorth) index = i;
  });
  return { index, title: RANKS[index].title, next: RANKS[index + 1] ?? null };
}

// ---- Daily and yearly routine -----------------------------------------------------

function news(st: GameState, title: string, body: string): void {
  st.messages.push({ day: st.day, text: `${title}: ${body}` });
  if (st.newspaper && st.newspaper.day === st.day)
    st.newspaper.articles.unshift({ kind: 'business', title, body });
  else
    st.newspaper = {
      cityId: st.currentCityId,
      day: st.day,
      articles: [{ kind: 'business', title, body }],
    };
}

/** Runs each morning after the news: boosts wear off, favour fades, ranks and the yearly calendar. */
export function cityLifeMorning(st: GameState): void {
  const dayOfYear = st.day % DAYS_PER_YEAR;
  for (const p of st.players) {
    p.boosts = (p.boosts ?? []).filter((b) => --b.daysLeft > 0);
    if (st.day % 7 === 0 && p.favour)
      for (const k of Object.keys(p.favour)) p.favour[k] = Math.max(0, p.favour[k] - 2);
    if (p.isHuman) {
      const rank = rankOf(netWorth(st, p));
      if (rank.index > (p.rank ?? 0))
        news(
          st,
          'A rising name in pizza',
          `${p.name} is now considered a ${rank.title.toLowerCase()} by the business pages.`,
        );
      p.rank = Math.max(p.rank ?? 0, rank.index);
    }
  }
  if (dayOfYear === CONTEST_DAY - CONTEST_NOTICE) {
    const cityId = contestCity(st);
    news(
      st,
      'Pizza contest announced',
      `This year's international pizza contest will be held in ${cityDef(cityId).name} in two weeks. Every chain may enter one recipe.`,
    );
  }
  if (
    dayOfYear === CONTEST_DAY &&
    st.restaurants.some((r) => st.players.find((p) => p.id === r.ownerId)?.isHuman)
  ) {
    st.contest = { year: yearOf(st), cityId: contestCity(st), phase: 'entry', entries: [] };
  }
  if (dayOfYear === DAYS_PER_YEAR - 1) presentAwards(st);
}

export function yearOf(st: GameState): number {
  return 1994 + Math.floor(st.day / DAYS_PER_YEAR);
}

function contestCity(st: GameState): string {
  return CITIES[yearOf(st) % CITIES.length].id;
}

/** The mayors' yearly awards in every city. */
function presentAwards(st: GameState): void {
  const year = yearOf(st);
  for (const c of CITIES) {
    const shops = st.restaurants.filter((r) => r.cityId === c.id);
    if (shops.length === 0) continue;
    const city = st.cities.find((x) => x.id === c.id)!;
    // A mayor's favour tips close calls.
    const favoured = (ownerId: number, score: number) =>
      score *
      (1 +
        favour(
          st.players.find((p) => p.id === ownerId)!,
          c.id,
        ) /
          400);
    const guests = new Map<number, number>();
    for (const r of shops)
      guests.set(
        r.ownerId,
        (guests.get(r.ownerId) ?? 0) + (r.history ?? []).reduce((n, h) => n + h.customers, 0),
      );
    const categories: { title: string; winner: number | null; why: string }[] = [
      {
        title: 'Golden Oven',
        winner: best([...guests].map(([id, g]) => [id, favoured(id, g)])),
        why: 'for serving the most guests',
      },
      {
        title: 'Prettiest Pizzeria',
        winner: best(
          shops.map((r) => [
            r.ownerId,
            favoured(r.ownerId, roomStats(r.layout, city.lots[r.lotId], r.floorId).decor),
          ]),
        ),
        why: 'for the most beautiful dining room',
      },
      {
        title: 'Employer of the Year',
        winner: best(
          shops
            .filter((r) => r.staff.length >= 3)
            .map((r) => [
              r.ownerId,
              favoured(r.ownerId, r.staff.reduce((n, s) => n + s.motivation, 0) / r.staff.length),
            ]),
        ),
        why: 'for the happiest staff',
      },
      {
        title: 'People’s Favourite',
        winner: best(shops.map((r) => [r.ownerId, favoured(r.ownerId, r.reputation)])),
        why: 'for the best reputation',
      },
    ];
    for (const cat of categories) {
      const p = st.players.find((x) => x.id === cat.winner);
      if (!p) continue;
      const prize = Math.round(5000 * c.costOfLiving);
      p.cash += prize;
      p.ledger.push({ day: st.day, label: 'Prize money', amount: prize });
      (p.awards ??= []).push({ year, cityId: c.id, title: cat.title });
      (p.boosts ??= []).push({ cityId: c.id, points: 12, daysLeft: 90, reason: cat.title });
      if (p.isHuman)
        queueCall(st, {
          contactId: `${c.id}:mayor`,
          topic: 'award',
          title: cat.title,
          amount: prize,
        });
      if (p.isHuman || c.id === st.currentCityId)
        news(
          st,
          `${cat.title} ${year}, ${c.name}`,
          `The mayor presented the award to ${p.name} ${cat.why}, with ${'$' + prize.toLocaleString('en-US')} in prize money.`,
        );
    }
  }
}

function best(scores: [number, number][]): number | null {
  let winner: number | null = null;
  let top = -Infinity;
  for (const [id, s] of scores) {
    if (s > top) {
      top = s;
      winner = id;
    }
  }
  return winner;
}

// ---- The pizza contest ----------------------------------------------------------

export interface Judge {
  name: string;
  title: string;
  look: Look;
  /** How this judge scores a pizza out of 20. */
  score: (s: PizzaStats) => number;
}

const clamp20 = (v: number) => Math.max(0, Math.min(20, Math.round(v)));

export const JUDGES: Judge[] = [
  {
    name: 'Aurelio Bassi',
    title: 'Master chef',
    look: randomLook(new Rng(hashString('judge-1'))),
    score: (s) => clamp20((s.refinement * 0.5 + s.appearance * 0.5) / 5),
  },
  {
    name: 'Mabel Thorne',
    title: 'Restaurant critic',
    look: randomLook(new Rng(hashString('judge-2'))),
    score: (s) =>
      clamp20(
        20 -
          (Math.abs(s.fat - 40) +
            Math.abs(s.salty - 45) +
            Math.abs(s.sweet - 25) +
            Math.abs(s.hot - 25)) /
            8,
      ),
  },
  {
    name: 'Dr. Felix Lenz',
    title: 'Food scientist',
    look: randomLook(new Rng(hashString('judge-3'))),
    score: (s) => clamp20(s.normality / 5 - Math.max(0, s.calories - 1300) / 60),
  },
  {
    name: 'Kiki Sol',
    title: 'Food blogger',
    look: randomLook(new Rng(hashString('judge-4'))),
    score: (s) => clamp20(10 + s.trend / 10 + s.sweet / 10 + (s.appearance - 50) / 10),
  },
  {
    name: 'Rosa Vitale',
    title: 'Grandmother of twelve',
    look: randomLook(new Rng(hashString('judge-5'))),
    score: (s) => clamp20(s.imitation / 6 + s.herbs + s.normality / 20),
  },
];

/** Enters the player's recipe, picks the rivals' entries and has the judges score everyone. */
export function judgeContest(st: GameState, playerRecipe: Recipe): Contest | null {
  const contest = st.contest;
  if (!contest || contest.phase !== 'entry') return null;
  const districts = st.cities.find((c) => c.id === contest.cityId)?.districts ?? [];
  const score = (recipe: Recipe, noise: boolean) => {
    const stats = pizzaStats(recipe, districts);
    const scores = JUDGES.map((j) => clamp20(j.score(stats) + (noise ? Math.random() * 4 - 2 : 0)));
    return { scores, total: scores.reduce((n, x) => n + x, 0) };
  };
  const human = st.players.find((p) => p.isHuman)!;
  const entries: ContestEntry[] = [
    { playerId: human.id, recipe: playerRecipe, ...score(playerRecipe, false) },
  ];
  for (const p of st.players.filter((x) => !x.isHuman)) {
    // Rivals bring their best classic, prepared on the day with some luck either way.
    const options = STANDARD_RECIPES.map((r) => ({ r, s: score(r, true) })).sort(
      (a, b) => b.s.total - a.s.total,
    );
    const pickIndex = Math.floor(Math.random() * 3);
    entries.push({ playerId: p.id, recipe: options[pickIndex].r, ...options[pickIndex].s });
  }
  entries.sort((a, b) => b.total - a.total);
  contest.entries = entries;
  contest.phase = 'judged';
  const winner = st.players.find((p) => p.id === entries[0].playerId)!;
  const prize = 25000;
  winner.cash += prize;
  winner.ledger.push({ day: st.day, label: 'Prize money', amount: prize });
  (winner.awards ??= []).push({
    year: contest.year,
    cityId: contest.cityId,
    title: 'Pizza Contest Champion',
  });
  (winner.boosts ??= []).push({ cityId: null, points: 15, daysLeft: 60, reason: 'Pizza contest' });
  news(
    st,
    `Pizza contest ${contest.year}`,
    `${winner.name} won with "${entries[0].recipe.name}", scoring ${entries[0].total} of 100.`,
  );
  return contest;
}
