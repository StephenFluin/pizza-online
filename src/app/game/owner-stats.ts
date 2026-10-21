import { CharacterStats, character } from './characters';
import { GameState, Player } from './model';

/**
 * How an owner's character stats affect play. Each effect is mild (around ±10–25%)
 * so the choice of character flavours a game without deciding it.
 */

export function statsOf(player: Pick<Player, 'characterId'> | null | undefined): CharacterStats {
  return character(player?.characterId).stats;
}

export function ownerStats(state: GameState, ownerId: number): CharacterStats {
  return statsOf(state.players.find((p) => p.id === ownerId));
}

/** Cooking skill flavours every pizza: 0.9× to 1.1× appeal. */
export const cookingBonus = (s: CharacterStats) => 1 + (s.cooking - 50) / 500;

/** Charisma makes advertising work harder: 0.75× to 1.25×. */
export const adBonus = (s: CharacterStats) => 1 + (s.charisma - 50) / 200;

/** Shrewd owners pay a little less for ingredients: up to 5% either way. */
export const ingredientPriceFactor = (s: CharacterStats) => 1 - (s.intelligence - 50) / 1000;

/** Extra chance (−0.25..+0.25) of winning a haggle, from charisma and intelligence. */
export const haggleBonus = (s: CharacterStats) => (s.charisma + s.intelligence - 100) / 400;

/** Good managers attract better applicants: −0.2..+0.2 skill. */
export const applicantSkillBonus = (s: CharacterStats) => (s.management - 50) / 250;

/** A new restaurant's starting reputation, from the owner's popularity (0.2–0.4). */
export const startReputation = (s: CharacterStats) => 0.2 + s.popularity / 500;

/** How much the bank will lend: more for popular owners and bigger chains. */
export const creditLimit = (s: CharacterStats, restaurants: number) =>
  Math.round((20000 + s.popularity * 800 + restaurants * 30000) / 10000) * 10000;

/** Restaurants the owner can supervise personally before the rest suffer (energy 0–100 → 1–5). */
export const supervisable = (s: CharacterStats) => 1 + Math.floor(s.energy / 25);

/** Monthly loan interest. */
export const INTEREST_RATE = 0.01;
