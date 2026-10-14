import { Injectable, computed, signal } from '@angular/core';
import { CITIES, STANDARD_RECIPES, cityDef } from './data';
import { generateCity } from './city-gen';
import { CLOSE_MINUTE, GameState, OPEN_MINUTE, Player } from './model';

export type GameSpeed = 0 | 1 | 2 | 4;

/** Game minutes that pass per real second at 1x speed. */
const MINUTES_PER_SECOND = 20;

export const PLAYER_COLORS = [0xe63946, 0x2a9d8f, 0xf4a261, 0x6a4c93];

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly state = signal<GameState | null>(null);
  readonly speed = signal<GameSpeed>(1);
  readonly selectedLotId = signal<number | null>(null);

  readonly city = computed(() => {
    const s = this.state();
    return s ? (s.cities.find((c) => c.id === s.currentCityId) ?? null) : null;
  });
  readonly human = computed(() => this.state()?.players.find((p) => p.isHuman) ?? null);
  readonly selectedLot = computed(() => {
    const id = this.selectedLotId();
    return id === null ? null : (this.city()?.lots[id] ?? null);
  });

  private minuteAccumulator = 0;

  newGame(playerName: string, cityId: string, seed = Math.floor(Math.random() * 2 ** 31)): void {
    const human: Player = {
      id: 0,
      name: playerName.trim() || 'Player',
      color: PLAYER_COLORS[0],
      isHuman: true,
      cash: 50000,
      loan: 0,
      ledger: [],
    };
    this.state.set({
      version: 1,
      seed,
      day: 0,
      minute: OPEN_MINUTE - 60,
      currentCityId: cityId,
      cities: CITIES.map((def) => generateCity(def, seed)),
      players: [human],
      restaurants: [],
      recipes: STANDARD_RECIPES.map((r) => structuredClone(r)),
      nextId: 1,
      messages: [{ day: 0, text: `Welcome to ${cityDef(cityId).name}, ${human.name}! Pick an empty lot to open your first pizzeria.` }],
    });
    this.selectedLotId.set(null);
  }

  /** Advances the clock by real elapsed seconds; called from the render loop. */
  tick(seconds: number): void {
    const s = this.state();
    if (!s || this.speed() === 0) return;
    this.minuteAccumulator += seconds * MINUTES_PER_SECOND * this.speed();
    const minutes = Math.floor(this.minuteAccumulator);
    if (minutes < 1) return;
    this.minuteAccumulator -= minutes;
    this.state.update((st) => {
      if (!st) return st;
      let minute = st.minute + minutes;
      let day = st.day;
      // Skip the closed night hours so the player isn't waiting for nothing.
      if (minute >= CLOSE_MINUTE + 60) {
        day += 1;
        minute = OPEN_MINUTE - 60;
      }
      return { ...st, minute, day };
    });
  }

  selectLot(id: number | null): void {
    this.selectedLotId.set(id);
  }
}
