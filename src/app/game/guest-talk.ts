import { cityDef, ingredient } from './data';
import { roomStats } from './furniture';
import { CustomerGroup, GameState, Restaurant } from './model';
import { CUSTOMER_GROUPS, GROUP_TASTES, cachedPizzaStats } from './pizza-stats';
import { fairPrice, groupAppeal } from './recipes';
import { Rng } from './rng';

/**
 * What a guest at one of the tables thinks, for clicking on diners in the
 * restaurant view. Each remark comes from the same numbers that drive the
 * simulation (waiting, prices, how well the pizza suits the guest's group, the
 * room's style, stock outs and trouble), so listening in is a way to learn
 * what's holding a restaurant back.
 */

export type Mood = 'happy' | 'neutral' | 'unhappy';

export interface GuestRemark {
  group: CustomerGroup;
  groupLabel: string;
  /** The pizza on the guest's plate, if the menu has one. */
  pizza: string | null;
  text: string;
  mood: Mood;
}

interface Opinion {
  text: string;
  /** −1 (annoyed) .. 1 (delighted); the strongest opinions get voiced. */
  feeling: number;
  weight: number;
}

const FLAVOUR_WORDS = {
  fat: { more: 'could be a lot richer', less: 'is far too greasy for me' },
  sweet: { more: 'needs a touch of sweetness', less: 'is much too sweet' },
  salty: { more: 'tastes a bit bland', less: 'is very salty' },
  hot: { more: 'could do with more kick', less: 'is burning my mouth' },
} as const;

/** One guest's verdict; the same chair gives the same guest for the rest of the hour. */
export function guestRemark(st: GameState, r: Restaurant, chair: number): GuestRemark | null {
  const city = st.cities.find((c) => c.id === r.cityId);
  const lot = city?.lots[r.lotId];
  const district = lot ? city?.districts[lot.district] : undefined;
  if (!city || !lot || !district) return null;
  const rng = new Rng(st.seed ^ (r.id * 7919) ^ (chair * 104729) ^ (st.day * 31 + Math.floor(st.minute / 60)));

  // Who sits here: drawn from the district's mix of residents.
  let roll = rng.next();
  let group: CustomerGroup = CUSTOMER_GROUPS[0].id;
  for (const g of CUSTOMER_GROUPS) {
    roll -= district.groupMix[g.id] ?? 0;
    group = g.id;
    if (roll <= 0) break;
  }
  const groupLabel = CUSTOMER_GROUPS.find((g) => g.id === group)?.label ?? '';
  const col = cityDef(r.cityId).costOfLiving;

  // What they ordered: the menu weighted by how much it appeals to them, as in the simulation.
  const choices = r.menu
    .map((m) => ({ m, recipe: st.recipes.find((x) => x.id === m.recipeId) }))
    .filter((c): c is { m: (typeof r.menu)[number]; recipe: NonNullable<typeof c.recipe> } => !!c.recipe)
    .map((c) => ({ ...c, appeal: groupAppeal(c.recipe, c.m.price, district, col, group, city.districts) }));
  const total = choices.reduce((n, c) => n + c.appeal ** 3, 0);
  let pick = rng.next() * total;
  const dish = choices.find((c) => (pick -= c.appeal ** 3) <= 0) ?? choices[0];

  const opinions: Opinion[] = [];
  const say = (text: string, feeling: number, weight = 1) => opinions.push({ text, feeling, weight });

  if (dish) {
    const stats = cachedPizzaStats(dish.recipe, city.districts);
    const score = stats.groups[group];
    const name = dish.recipe.name;
    if (score >= 75) say(`This ${name} is exactly how I like it.`, 0.9, 1.2);
    else if (score >= 60) say(`The ${name} is pretty good.`, 0.4);
    else {
      // Name the flavour furthest from what this group wants.
      const taste = GROUP_TASTES[group];
      const gaps = (Object.keys(FLAVOUR_WORDS) as (keyof typeof FLAVOUR_WORDS)[]).map((f) => ({ f, gap: taste[f] - stats[f] }));
      const worst = gaps.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
      const words = FLAVOUR_WORDS[worst.f];
      say(`Hmm. This ${name} ${worst.gap > 0 ? words.more : words.less}.`, score < 45 ? -0.8 : -0.4, 1.2);
    }
    const fair = fairPrice(district, col);
    if (dish.m.price > fair * 1.3) say(`${moneyWord(dish.m.price)} for a pizza? That’s steep for round here.`, -0.7, 1.1);
    else if (dish.m.price < fair * 0.8) say(`At ${moneyWord(dish.m.price)} it’s a real bargain.`, 0.6);
    const loved = dish.recipe.toppings.map((t) => t.ingredient).find((id) => (district.tastes[id] ?? 0) > 0.45);
    if (loved) say(`You can’t beat ${ingredient(loved).name.toLowerCase()} on a pizza.`, 0.5, 0.6);
    const hated = dish.recipe.toppings.map((t) => t.ingredient).find((id) => (district.tastes[id] ?? 0) < -0.45);
    if (hated) say(`I’m picking off the ${ingredient(hated).name.toLowerCase()}. Nobody round here eats it.`, -0.5, 0.8);
  } else {
    say('There’s nothing on the menu! What are we supposed to eat?', -1, 3);
  }

  const pop = r.popularity;
  if (pop.waitMinutes > pop.expectedMinutes * 1.25) say(`We’ve been waiting ${Math.round(pop.waitMinutes)} minutes for our food.`, -0.8, 1.3);
  else if (pop.waitMinutes > 0 && pop.waitMinutes < pop.expectedMinutes * 0.7) say('That was quick. Hardly had time to sit down!', 0.5, 0.7);

  const missing = Object.entries(r.today.missing ?? {}).sort((a, b) => b[1] - a[1])[0];
  if (missing && missing[1] > 0) say(`Shame they’d run out of ${ingredient(missing[0]).name.toLowerCase()}.`, -0.6, 0.9);
  if (r.today.lostSeats > 3) say('We had to queue ages for a table.', -0.5, 0.9);

  const room = roomStats(r.layout, lot, r.floorId);
  const look = room.groupAppeal[group] ?? 4.5;
  if (look >= 7) say('I love how this place looks.', 0.6, 0.8);
  else if (look <= 3) say('The decor isn’t really my style.', -0.4, 0.7);

  const menuSize = r.menu.length;
  if (menuSize > 0 && menuSize < district.desiredStandard + district.desiredOwn - 1) say('I wish there was a bit more choice on the menu.', -0.3, 0.6);
  if ((r.troubles?.length ?? 0) > 0) say('Is it me, or is something not quite right in here today?', -0.6, 1.1);
  if ((r.stars ?? 0) >= 3) say(`We came because of the ${r.stars} stars. Deserved, I think.`, 0.6, 0.7);
  if (st.players.find((p) => p.id === r.ownerId)?.ads.some((a) => a.cityId === r.cityId)) say('I saw the advert and fancied a pizza.', 0.3, 0.4);

  // Voice the strongest feelings, with a little chance so neighbours don't all say the same thing.
  const ranked = opinions.map((o) => ({ ...o, rank: Math.abs(o.feeling) * o.weight * (0.7 + rng.next() * 0.6) })).sort((a, b) => b.rank - a.rank);
  const said = ranked.slice(0, ranked.length > 2 && rng.chance(0.5) ? 2 : 1);
  const feeling = said.reduce((n, o) => n + o.feeling * o.weight, 0) / said.reduce((n, o) => n + o.weight, 0);
  // A change of heart between the two remarks gets a "but".
  const text = said.map((o, i) => (i > 0 && Math.sign(o.feeling) !== Math.sign(said[0].feeling) ? but(o.text) : o.text)).join(' ');
  return {
    group,
    groupLabel,
    pizza: dish?.recipe.name ?? null,
    text,
    mood: feeling > 0.15 ? 'happy' : feeling < -0.15 ? 'unhappy' : 'neutral',
  };
}

function but(text: string): string {
  const keepCase = /^(I\b|I’|[^A-Za-z])/.test(text);
  return `But ${keepCase ? text : text[0].toLowerCase() + text.slice(1)}`;
}

function moneyWord(n: number): string {
  return `$${n % 1 === 0 ? n : n.toFixed(2)}`;
}
