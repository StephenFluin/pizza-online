import { GameState } from './model';

/** Difficulty levels, as in the original's selection; the numbers are our own. */
export type DifficultyId = 'pushover' | 'normal' | 'difficult' | 'impossible';

export interface Difficulty {
  id: DifficultyId;
  label: string;
  description: string;
  /** Starting cash multiplier for the player. */
  cash: number;
  /** How many people eat out. */
  demand: number;
  /** How hard rivals expand and how often they play dirty. */
  rivals: number;
  /** High-score multiplier. */
  score: number;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'pushover',
    label: 'Pushover',
    description: 'More money, customers who warm to you, timid rivals.',
    cash: 1.5,
    demand: 1.2,
    rivals: 0.6,
    score: 0.5,
  },
  {
    id: 'normal',
    label: 'Normal',
    description: 'The game as intended.',
    cash: 1,
    demand: 1,
    rivals: 1,
    score: 1,
  },
  {
    id: 'difficult',
    label: 'Difficult',
    description: 'Less money, customers slower to warm to you, pushy rivals.',
    cash: 0.8,
    demand: 0.88,
    rivals: 1.4,
    score: 1.5,
  },
  {
    id: 'impossible',
    label: 'Impossible',
    description: 'Every dollar counts and the rivals fight dirty.',
    cash: 0.6,
    demand: 0.75,
    rivals: 2,
    score: 2.2,
  },
];

export function difficulty(st: Pick<GameState, 'difficulty'> | null | undefined): Difficulty {
  return DIFFICULTIES.find((d) => d.id === st?.difficulty) ?? DIFFICULTIES[1];
}
