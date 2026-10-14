/**
 * Advertising channels and their mini-games. Mechanics follow the original
 * (four channels, one campaign per channel per city, a slogan-building game for
 * newspaper ads); all slogans, posters and commercials are our own.
 */

export type AdChannel = 'flyers' | 'posters' | 'newspaper' | 'tv';

export const AD_CHANNELS: { id: AdChannel; label: string }[] = [
  { id: 'flyers', label: 'Flyers' },
  { id: 'posters', label: 'Posters' },
  { id: 'newspaper', label: 'Newspaper' },
  { id: 'tv', label: 'Television' },
];

export const MIN_CAMPAIGN_DAYS = 7;
export const MAX_CAMPAIGN_DAYS = 28;

/** Which kind of city an ad style suits; it scales effectiveness with the city's wealth. */
export type AdAudience = 'rich' | 'everyone' | 'thrifty';

/** Effectiveness multiplier (0.8–1.2) for an ad style in a city with this average wealth (0..1). */
export function audienceFit(audience: AdAudience, wealth: number): number {
  if (audience === 'rich') return 0.8 + 0.4 * wealth;
  if (audience === 'thrifty') return 1.2 - 0.4 * wealth;
  return 1;
}

// ---- Flyers ------------------------------------------------------------------

export const MIN_FLYERS = 100;
export const MAX_FLYERS = 500;
export const FLYER_STEP = 100;

export function flyerRate(count: number): { effectiveness: number; weeklyCost: number } {
  return { effectiveness: Math.round(10 + (count / 100) * 7), weeklyCost: count * 3 };
}

// ---- Posters -----------------------------------------------------------------

export interface PosterDesign {
  id: number;
  title: string;
  /** Short line printed on the poster. */
  tagline: string;
  audience: AdAudience;
  effectiveness: number;
  weeklyCost: number;
  /** Background and accent colours used when drawing it. */
  colors: [number, number, number];
  layout: 'slice' | 'sunburst' | 'stripes' | 'stack' | 'chef' | 'moon' | 'heart' | 'flame' | 'leaf';
}

export const POSTERS: readonly PosterDesign[] = [
  { id: 0, title: 'Slice of Life', tagline: 'One bite says it all', audience: 'everyone', effectiveness: 28, weeklyCost: 1800, colors: [0xffd166, 0xe63946, 0x1d3557], layout: 'slice' },
  { id: 1, title: 'Sunday Sun', tagline: 'Fresh every morning', audience: 'everyone', effectiveness: 32, weeklyCost: 2200, colors: [0xfff1c1, 0xf4a261, 0x2a9d8f], layout: 'sunburst' },
  { id: 2, title: 'Two for One', tagline: 'Double the pizza, same price', audience: 'thrifty', effectiveness: 34, weeklyCost: 1600, colors: [0xffffff, 0xd62828, 0x003049], layout: 'stripes' },
  { id: 3, title: 'Tower of Taste', tagline: 'Stacked high, priced low', audience: 'thrifty', effectiveness: 30, weeklyCost: 1500, colors: [0x8ecae6, 0xfb8500, 0x023047], layout: 'stack' },
  { id: 4, title: 'The Maestro', tagline: 'Crafted by a master', audience: 'rich', effectiveness: 38, weeklyCost: 3200, colors: [0x2b2d42, 0xedf2f4, 0xd90429], layout: 'chef' },
  { id: 5, title: 'Midnight Oven', tagline: 'Open late, always hot', audience: 'everyone', effectiveness: 30, weeklyCost: 2000, colors: [0x14213d, 0xfca311, 0xe5e5e5], layout: 'moon' },
  { id: 6, title: 'Date Night', tagline: 'Share something special', audience: 'rich', effectiveness: 36, weeklyCost: 2800, colors: [0xffe5ec, 0xc9184a, 0x590d22], layout: 'heart' },
  { id: 7, title: 'Feel the Heat', tagline: 'For the brave only', audience: 'everyone', effectiveness: 33, weeklyCost: 2100, colors: [0x370617, 0xf48c06, 0xffba08], layout: 'flame' },
  { id: 8, title: 'Garden Fresh', tagline: 'Straight from the field', audience: 'rich', effectiveness: 35, weeklyCost: 2500, colors: [0xe9f5db, 0x4f772d, 0x132a13], layout: 'leaf' },
];

// ---- Newspaper slogan game ---------------------------------------------------

/**
 * Each family is one complete five-part slogan. In every round the player picks
 * one fragment; sticking with one family keeps the ad's multiplier, every switch
 * halves it. `#` is replaced with the company name.
 */
export interface SloganFamily {
  audience: AdAudience;
  parts: [string, string, string, string, string];
}

export const SLOGAN_FAMILIES: readonly SloganFamily[] = [
  { audience: 'everyone', parts: ['Fresh as a summer morning:', 'every crust is rolled by hand', 'at #,', 'topped with tomatoes picked at dawn.', 'Taste the sunshine today!'] },
  { audience: 'everyone', parts: ['Bring the whole family:', 'big tables, bigger portions', 'and a warm welcome at #,', 'where the kids eat with a smile.', 'Come as you are, leave as friends!'] },
  { audience: 'everyone', parts: ['Hungry? No time?', 'Our ovens never sleep', 'and # serves you in minutes,', 'piping hot and perfectly crisp.', 'Fast food was never this good!'] },
  { audience: 'rich', parts: ['For the discerning palate:', 'imported cheeses, aged with patience,', 'presented by # by candlelight,', 'with a wine list to match.', 'Reserve your table tonight.'] },
  { audience: 'thrifty', parts: ['Why pay more?', 'Two pizzas for the price of one', 'every Tuesday at #,', 'and we are never stingy with toppings.', 'Your wallet will thank you!'] },
  { audience: 'everyone', parts: ['Just like Grandma made it:', 'a recipe handed down for generations', 'and kept alive at #,', 'baked in a stone oven fired with oak.', 'Taste a little history!'] },
  { audience: 'everyone', parts: ['Feeling brave?', 'Our chillies come with a warning label', 'and # dares you to finish,', 'with a cold drink on standby.', 'Turn up the heat tonight!'] },
  { audience: 'rich', parts: ['Light, bright and good for you:', 'whole-grain bases and garden greens', 'made fresh daily at #,', 'with half the guilt and all the taste.', 'Your body will say thank you!'] },
  { audience: 'rich', parts: ['Planning a special evening?', 'Soft music and softer mozzarella', 'are waiting for you at #,', 'where pizzas come heart-shaped on request.', 'Say it with pizza!'] },
  { audience: 'thrifty', parts: ['Big game tonight?', 'Giant screens and giant slices', 'are ready and waiting at #,', 'with team deals for every fan.', 'Cheer louder on a full stomach!'] },
  { audience: 'thrifty', parts: ['Still up past midnight?', 'The lights stay on late', 'at #, the night owl’s kitchen,', 'and we deliver to your door.', 'Sleep is overrated!'] },
  { audience: 'everyone', parts: ['Pizza, perfected:', 'our chefs weigh every gram', 'in the test kitchen at #,', 'for a bake timed to the second.', 'The future tastes delicious!'] },
];

export const SLOGAN_ROUNDS = 5;
export const SLOGAN_OPTIONS = 5;

export const NEWSPAPER_FORMATS: { label: string; base: number; weeklyCost: number }[] = [
  { label: 'Half page, two colours', base: 22, weeklyCost: 1500 },
  { label: 'Half page, four colours', base: 30, weeklyCost: 2400 },
  { label: 'Full page, two colours', base: 40, weeklyCost: 3600 },
  { label: 'Full page, four colours', base: 52, weeklyCost: 5200 },
];

/** State of one play of the newspaper slogan game. */
export class SloganGame {
  round = 0;
  /** First family shown in the five-row window this round. */
  windowStart: number;
  /** 100 = a perfectly consistent slogan; halves on every family switch. */
  multiplier = 100;
  readonly picks: number[] = [];
  format = 0;

  constructor(private readonly random: () => number = Math.random) {
    this.windowStart = Math.floor(random() * (SLOGAN_FAMILIES.length - SLOGAN_OPTIONS + 1));
  }

  get finished(): boolean {
    return this.picks.length >= SLOGAN_ROUNDS;
  }

  /** Family indices offered this round, top to bottom. */
  options(): number[] {
    return Array.from({ length: SLOGAN_OPTIONS }, (_, i) => this.windowStart + i);
  }

  fragment(family: number, round: number, company: string): string {
    return SLOGAN_FAMILIES[family].parts[round].replace('#', company);
  }

  pick(family: number): void {
    if (this.finished) return;
    const previous = this.picks.at(-1);
    if (previous !== undefined && previous !== family) this.multiplier = Math.max(3, Math.floor(this.multiplier / 2));
    this.picks.push(family);
    this.round = this.picks.length;
    if (!this.finished) this.drift();
  }

  /** The offered window wanders each round, but always keeps the last pick in view. */
  private drift(): void {
    const maxStart = SLOGAN_FAMILIES.length - SLOGAN_OPTIONS;
    const step = Math.floor(this.random() * 5) - 2;
    const last = this.picks.at(-1)!;
    const lo = Math.max(0, last - (SLOGAN_OPTIONS - 1));
    const hi = Math.min(maxStart, last);
    this.windowStart = Math.min(hi, Math.max(lo, this.windowStart + step));
  }

  slogan(company: string): string[] {
    return this.picks.map((f, round) => this.fragment(f, round, company));
  }

  /** How well the chosen families suit the city, averaged. */
  fit(wealth: number): number {
    if (this.picks.length === 0) return 1;
    return this.picks.reduce((n, f) => n + audienceFit(SLOGAN_FAMILIES[f].audience, wealth), 0) / this.picks.length;
  }

  effectiveness(wealth: number): number {
    return Math.round((NEWSPAPER_FORMATS[this.format].base * this.multiplier * this.fit(wealth)) / 100);
  }
}

// ---- Television --------------------------------------------------------------

export interface TvCommercial {
  id: number;
  title: string;
  director: string;
  audience: AdAudience;
  effectiveness: number;
  weeklyCost: number;
  scene: 'oven' | 'scooter' | 'toss' | 'family' | 'rocket' | 'moonlight';
}

export const TV_COMMERCIALS: readonly TvCommercial[] = [
  { id: 0, title: 'Out of the Oven', director: 'Lena Bright', audience: 'everyone', effectiveness: 48, weeklyCost: 6500, scene: 'oven' },
  { id: 1, title: 'Hot Delivery', director: 'Marco Vale', audience: 'thrifty', effectiveness: 52, weeklyCost: 7000, scene: 'scooter' },
  { id: 2, title: 'The Big Toss', director: 'Ines Novak', audience: 'everyone', effectiveness: 56, weeklyCost: 8000, scene: 'toss' },
  { id: 3, title: 'Family Table', director: 'Omar Reyes', audience: 'thrifty', effectiveness: 50, weeklyCost: 7000, scene: 'family' },
  { id: 4, title: 'Pizza in Orbit', director: 'Kai Sorensen', audience: 'everyone', effectiveness: 62, weeklyCost: 10000, scene: 'rocket' },
  { id: 5, title: 'Moonlight Supper', director: 'Clara Duval', audience: 'rich', effectiveness: 60, weeklyCost: 9500, scene: 'moonlight' },
];

/** Total price of a campaign: the weekly rate for its length, scaled by local costs. */
export function campaignCost(weeklyCost: number, days: number, costOfLiving: number): number {
  return Math.round((weeklyCost * days * costOfLiving) / 7 / 10) * 10;
}
