import { netWorth, rankOf } from './awards';
import { difficulty } from './difficulty';
import { GameState, formatDate } from './model';

/** The best finished careers, kept in browser storage. */
export interface HighScore {
  name: string;
  score: number;
  netWorth: number;
  rank: string;
  outcome: string;
  difficulty: string;
  /** In-game date the career ended. */
  date: string;
  awards: number;
}

const KEY = 'pizza-online:highscores';
const KEEP = 10;

export function careerSummary(st: GameState): HighScore {
  const me = st.players.find((p) => p.isHuman)!;
  const worth = netWorth(st, me);
  const d = difficulty(st);
  return {
    name: me.name,
    // Net worth weighted by difficulty; a win adds a bonus.
    score: Math.max(
      0,
      Math.round(worth * d.score + (st.outcome === 'won' ? 1_000_000 * d.score : 0)),
    ),
    netWorth: worth,
    rank: rankOf(worth).title,
    outcome: st.outcome === 'won' ? 'Won' : st.outcome === 'lost' ? 'Bankrupt' : 'Retired',
    difficulty: d.label,
    date: formatDate(st.day),
    awards: me.awards?.length ?? 0,
  };
}

export function listHighScores(): HighScore[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as HighScore[];
  } catch {
    return [];
  }
}

/** Records a career; returns its place in the table (1-based) or 0 if it didn't make it. */
export function recordHighScore(entry: HighScore): number {
  const list = [...listHighScores(), entry].sort((a, b) => b.score - a.score).slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: the score just isn't kept.
  }
  return list.indexOf(entry) + 1;
}
